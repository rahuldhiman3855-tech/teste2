import hashlib
import json
import re
import shutil
import sqlite3
import time
from pathlib import Path
from tempfile import TemporaryDirectory

import fitz
from PyPDF2 import PdfReader


APP_ROOT = Path(__file__).resolve().parent
RAG_ROOT = APP_ROOT / "rag"
UPLOAD_ROOT = RAG_ROOT / "uploads"
ASSET_ROOT = RAG_ROOT / "assets"
CHUNK_ROOT = RAG_ROOT / "chunks"
MANIFEST_ROOT = RAG_ROOT / "documents"
DB_PATH = RAG_ROOT / "rag.sqlite3"
CHUNK_TARGET_CHARS = 1800


def init_storage():
    for path in (RAG_ROOT, UPLOAD_ROOT, ASSET_ROOT, CHUNK_ROOT, MANIFEST_ROOT):
        path.mkdir(parents=True, exist_ok=True)

    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                original_filename TEXT NOT NULL,
                stored_pdf_path TEXT NOT NULL,
                manifest_path TEXT NOT NULL,
                file_sha256 TEXT NOT NULL UNIQUE,
                page_count INTEGER NOT NULL,
                image_count INTEGER NOT NULL,
                chunk_count INTEGER NOT NULL,
                extraction_method TEXT NOT NULL,
                created_at_epoch INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                page_start INTEGER NOT NULL,
                page_end INTEGER NOT NULL,
                chunk_path TEXT NOT NULL,
                chunk_text TEXT NOT NULL,
                normalized_text TEXT NOT NULL,
                created_at_epoch INTEGER NOT NULL,
                FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE,
                UNIQUE(document_id, chunk_index)
            );

            CREATE INDEX IF NOT EXISTS idx_chunks_document
            ON chunks(document_id, chunk_index);
            """
        )


def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def slugify_filename(filename: str) -> str:
    stem = Path(filename).stem.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", stem).strip("-")
    return slug or "document"


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def relative_path(path: Path) -> str:
    return path.relative_to(APP_ROOT).as_posix()


def extract_block_text(block: dict) -> str:
    lines = []
    for line in block.get("lines", []):
        spans = []
        for span in line.get("spans", []):
            text = span.get("text", "")
            if text:
                spans.append(text)
        line_text = "".join(spans).strip()
        if line_text:
            lines.append(line_text)
    return normalize_text(" ".join(lines))


def append_segment(segments: list[str], segment: str):
    if not segment:
        return
    if segment.startswith("[IMAGE:") and segments and not segments[-1].startswith("[IMAGE:"):
        segments[-1] = f"{segments[-1]}\n{segment}"
        return
    segments.append(segment)


def save_image_bytes(image_bytes: bytes, extension: str, document_id: str, page_number: int, image_number: int) -> str:
    asset_dir = ASSET_ROOT / document_id
    asset_dir.mkdir(parents=True, exist_ok=True)
    clean_extension = re.sub(r"[^a-z0-9]", "", (extension or "png").lower()) or "png"
    asset_path = asset_dir / f"page_{page_number:03d}_img_{image_number:03d}.{clean_extension}"
    asset_path.write_bytes(image_bytes)
    return relative_path(asset_path)


def extract_with_pymupdf(pdf_path: Path, document_id: str) -> dict:
    document = fitz.open(pdf_path)
    page_count = len(document)
    if page_count == 0:
        raise RuntimeError("PyMuPDF opened the PDF but found zero pages")

    pages = []
    image_count = 0

    for page_number, page in enumerate(document, start=1):
        blocks = page.get_text("dict", sort=True).get("blocks", [])
        blocks = sorted(blocks, key=lambda block: (block.get("bbox", [0, 0])[1], block.get("bbox", [0, 0])[0], block.get("number", 0)))
        segments = []
        image_number = 1

        for block in blocks:
            block_type = block.get("type")
            if block_type == 0:
                append_segment(segments, extract_block_text(block))
                continue

            if block_type != 1:
                continue

            image_bytes = block.get("image")
            if not image_bytes:
                continue

            image_path = save_image_bytes(image_bytes, block.get("ext", "png"), document_id, page_number, image_number)
            append_segment(segments, f"[IMAGE: {image_path}]")
            image_number += 1
            image_count += 1

        pages.append({"page_number": page_number, "segments": segments})

    return {
        "pages": pages,
        "page_count": page_count,
        "image_count": image_count,
        "extraction_method": "pymupdf",
    }


def extract_with_pypdf(pdf_path: Path, document_id: str, fallback_reason: str) -> dict:
    reader = PdfReader(str(pdf_path), strict=False)
    pages = []
    image_count = 0

    for page_number, page in enumerate(reader.pages, start=1):
        segments = []
        page_text = normalize_text(page.extract_text() or "")
        if page_text:
            append_segment(segments, page_text)

        try:
            images = list(page.images)
        except Exception:
            images = []

        for image_number, image in enumerate(images, start=1):
            image_name = image.name or f"page_{page_number:03d}_img_{image_number:03d}.bin"
            extension = Path(image_name).suffix.lstrip(".") or "bin"
            image_path = save_image_bytes(image.data, extension, document_id, page_number, image_number)
            append_segment(segments, f"[IMAGE: {image_path}]")
            image_count += 1

        pages.append({"page_number": page_number, "segments": segments})

    return {
        "pages": pages,
        "page_count": len(reader.pages),
        "image_count": image_count,
        "extraction_method": f"pypdf_fallback:{fallback_reason}",
    }


def extract_pdf_content(pdf_path: Path, document_id: str) -> dict:
    try:
        return extract_with_pymupdf(pdf_path, document_id)
    except Exception as exc:
        return extract_with_pypdf(pdf_path, document_id, str(exc))


def build_chunk_records(document_id: str, original_filename: str, stored_pdf_path: str, pages: list[dict]) -> list[dict]:
    chunk_dir = CHUNK_ROOT / document_id
    chunk_dir.mkdir(parents=True, exist_ok=True)

    paragraphs = []
    for page in pages:
        page_number = page["page_number"]
        segments = page.get("segments", [])
        if not segments:
            continue
        paragraphs.append({"page_number": page_number, "text": f"[PAGE {page_number}]"})
        for segment in segments:
            paragraphs.append({"page_number": page_number, "text": segment})

    if not paragraphs:
        paragraphs.append({"page_number": 1, "text": "[NO EXTRACTABLE TEXT OR IMAGES FOUND]"})

    chunk_records = []
    current_parts = []
    current_pages = []
    current_length = 0
    chunk_index = 1

    def flush():
        nonlocal current_parts, current_pages, current_length, chunk_index
        if not current_parts:
            return

        page_start = min(current_pages)
        page_end = max(current_pages)
        body = "\n\n".join(current_parts).strip()
        header = "\n".join(
            [
                f"Document: {original_filename}",
                f"Document ID: {document_id}",
                f"Source PDF: {stored_pdf_path}",
                f"Pages: {page_start}-{page_end}",
                f"Chunk: {chunk_index}",
                "",
            ]
        )
        chunk_text = f"{header}\n{body}\n"
        chunk_path = chunk_dir / f"chunk_{chunk_index:04d}.txt"
        chunk_path.write_text(chunk_text, encoding="utf-8")

        chunk_records.append(
            {
                "chunk_index": chunk_index,
                "page_start": page_start,
                "page_end": page_end,
                "chunk_path": relative_path(chunk_path),
                "chunk_text": chunk_text,
                "normalized_text": normalize_text(body).lower(),
            }
        )

        chunk_index += 1
        current_parts = []
        current_pages = []
        current_length = 0

    for paragraph in paragraphs:
        text = paragraph["text"].strip()
        if not text:
            continue

        projected_length = current_length + len(text) + 2
        if current_parts and projected_length > CHUNK_TARGET_CHARS:
            flush()

        current_parts.append(text)
        current_pages.append(paragraph["page_number"])
        current_length += len(text) + 2

        if len(text) > CHUNK_TARGET_CHARS:
            flush()

    flush()
    return chunk_records


def write_manifest(document_record: dict, chunk_records: list[dict]) -> str:
    manifest_path = MANIFEST_ROOT / f"{document_record['id']}.json"
    manifest_payload = {
        "document": document_record,
        "chunks": [
            {
                "chunk_index": chunk["chunk_index"],
                "page_start": chunk["page_start"],
                "page_end": chunk["page_end"],
                "chunk_path": chunk["chunk_path"],
            }
            for chunk in chunk_records
        ],
    }
    manifest_path.write_text(json.dumps(manifest_payload, indent=2), encoding="utf-8")
    return relative_path(manifest_path)


def fetch_document(document_id: str) -> dict | None:
    init_storage()
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT id, original_filename, stored_pdf_path, manifest_path, file_sha256,
                   page_count, image_count, chunk_count, extraction_method, created_at_epoch
            FROM documents
            WHERE id = ?
            """,
            (document_id,),
        ).fetchone()

    if row is None:
        return None
    return dict(row)


def fetch_document_by_hash(file_hash: str) -> dict | None:
    init_storage()
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT id, original_filename, stored_pdf_path, manifest_path, file_sha256,
                   page_count, image_count, chunk_count, extraction_method, created_at_epoch
            FROM documents
            WHERE file_sha256 = ?
            """,
            (file_hash,),
        ).fetchone()

    if row is None:
        return None
    return dict(row)


def delete_document(document_id: str) -> bool:
    init_storage()
    document = fetch_document(document_id)
    if document is None:
        return False

    stored_pdf_path = APP_ROOT / document["stored_pdf_path"]
    manifest_path = APP_ROOT / document["manifest_path"]
    chunk_dir = CHUNK_ROOT / document_id
    asset_dir = ASSET_ROOT / document_id

    with get_connection() as conn:
        conn.execute("DELETE FROM chunks WHERE document_id = ?", (document_id,))
        conn.execute("DELETE FROM documents WHERE id = ?", (document_id,))

    for path in (stored_pdf_path, manifest_path):
        try:
            if path.exists():
                path.unlink()
        except OSError:
            pass

    for directory in (chunk_dir, asset_dir):
        try:
            if directory.exists():
                shutil.rmtree(directory)
        except OSError:
            pass

    return True


def index_pdf_file(pdf_source_path: Path, original_filename: str) -> dict:
    init_storage()
    file_hash = file_sha256(pdf_source_path)
    existing = fetch_document_by_hash(file_hash)
    if existing is not None:
        return {"status": "already_indexed", "document": existing}

    document_id = f"{slugify_filename(original_filename)}-{file_hash[:12]}"
    stored_pdf_path = UPLOAD_ROOT / f"{document_id}.pdf"
    shutil.copy2(pdf_source_path, stored_pdf_path)

    extraction = extract_pdf_content(stored_pdf_path, document_id)
    chunk_records = build_chunk_records(document_id, original_filename, relative_path(stored_pdf_path), extraction["pages"])

    created_at_epoch = int(time.time())
    document_record = {
        "id": document_id,
        "original_filename": original_filename,
        "stored_pdf_path": relative_path(stored_pdf_path),
        "manifest_path": "",
        "file_sha256": file_hash,
        "page_count": extraction["page_count"],
        "image_count": extraction["image_count"],
        "chunk_count": len(chunk_records),
        "extraction_method": extraction["extraction_method"],
        "created_at_epoch": created_at_epoch,
    }

    document_record["manifest_path"] = write_manifest(document_record, chunk_records)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO documents (
                id, original_filename, stored_pdf_path, manifest_path, file_sha256,
                page_count, image_count, chunk_count, extraction_method, created_at_epoch
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document_record["id"],
                document_record["original_filename"],
                document_record["stored_pdf_path"],
                document_record["manifest_path"],
                document_record["file_sha256"],
                document_record["page_count"],
                document_record["image_count"],
                document_record["chunk_count"],
                document_record["extraction_method"],
                document_record["created_at_epoch"],
            ),
        )

        conn.executemany(
            """
            INSERT INTO chunks (
                document_id, chunk_index, page_start, page_end,
                chunk_path, chunk_text, normalized_text, created_at_epoch
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    document_id,
                    chunk["chunk_index"],
                    chunk["page_start"],
                    chunk["page_end"],
                    chunk["chunk_path"],
                    chunk["chunk_text"],
                    chunk["normalized_text"],
                    created_at_epoch,
                )
                for chunk in chunk_records
            ],
        )

    return {"status": "indexed", "document": document_record}


def index_uploaded_pdf(uploaded_file, filename: str) -> dict:
    with TemporaryDirectory() as workspace:
        temp_pdf = Path(workspace) / filename
        uploaded_file.save(temp_pdf)
        return index_pdf_file(temp_pdf, filename)


def strip_wrapping_quotes(text: str) -> str:
    if len(text) >= 2 and text.startswith('"') and text.endswith('"'):
        return text[1:-1].strip()
    return text


def parse_search_query(query: str, exact_phrase: bool = False) -> dict:
    query = normalize_text(query)
    if not query:
        return {"mode": "or", "terms": []}

    if exact_phrase:
        phrase = strip_wrapping_quotes(query)
        if not phrase:
            return {"mode": "phrase", "terms": []}
        return {"mode": "phrase", "terms": [phrase]}

    quoted_terms = [normalize_text(match) for match in re.findall(r'"([^"]+)"', query) if normalize_text(match)]
    remainder = re.sub(r'"[^"]+"', " ", query)
    loose_terms = [normalize_text(term) for term in re.split(r"\s+", remainder) if normalize_text(term)]

    terms = []
    seen_terms = set()
    for term in quoted_terms + loose_terms:
        lowered = term.lower()
        if lowered in seen_terms:
            continue
        seen_terms.add(lowered)
        terms.append(term)

    mode = "and" if '"' in query else "or"
    return {"mode": mode, "terms": terms}


def build_match_haystack(text: str, case_sensitive: bool) -> str:
    normalized = normalize_text(text)
    return normalized if case_sensitive else normalized.lower()


def search_chunks(
    query: str,
    limit: int | None = None,
    *,
    case_sensitive: bool = False,
    exact_phrase: bool = False,
    document_id: str | None = None,
    min_matches: int = 1,
) -> dict:
    init_storage()
    search_config = parse_search_query(query, exact_phrase=exact_phrase)
    terms = search_config["terms"]
    mode = search_config["mode"]

    if not terms:
        return {
            "query": query,
            "mode": mode,
            "terms": [],
            "count": 0,
            "results": [],
            "case_sensitive": case_sensitive,
            "exact_phrase": exact_phrase,
            "document_id": document_id or "",
            "requested_min_matches": min_matches,
            "effective_min_matches": 0,
        }

    sql = """
        SELECT
            d.id AS document_id,
            d.original_filename,
            d.stored_pdf_path,
            d.created_at_epoch,
            c.chunk_index,
            c.page_start,
            c.page_end,
            c.chunk_path,
            c.chunk_text
        FROM chunks c
        JOIN documents d ON d.id = c.document_id
    """
    parameters = []
    if document_id:
        sql += " WHERE d.id = ?"
        parameters.append(document_id)

    with get_connection() as conn:
        rows = conn.execute(sql, parameters).fetchall()

    normalized_terms = [normalize_text(term) for term in terms if normalize_text(term)]
    search_terms = normalized_terms if case_sensitive else [term.lower() for term in normalized_terms]

    if mode == "and":
        effective_min_matches = len(search_terms)
    elif mode == "phrase":
        effective_min_matches = 1
    else:
        effective_min_matches = max(1, min(min_matches, len(search_terms)))

    results = []
    for row in rows:
        haystack = build_match_haystack(row["chunk_text"], case_sensitive=case_sensitive)
        matched_terms = []
        total_occurrences = 0

        for original_term, term in zip(normalized_terms, search_terms):
            occurrences = haystack.count(term)
            if occurrences > 0:
                matched_terms.append(original_term)
                total_occurrences += occurrences

        match_count = len(matched_terms)
        include = False
        if mode == "phrase":
            include = match_count >= 1
        elif mode == "and":
            include = match_count == len(search_terms)
        else:
            include = match_count >= effective_min_matches

        if not include:
            continue

        score = (match_count * 1000) + total_occurrences
        results.append(
            {
                "document_id": row["document_id"],
                "original_filename": row["original_filename"],
                "stored_pdf_path": row["stored_pdf_path"],
                "chunk_index": row["chunk_index"],
                "page_start": row["page_start"],
                "page_end": row["page_end"],
                "chunk_path": row["chunk_path"],
                "score": score,
                "match_count": match_count,
                "matched_terms": matched_terms,
                "occurrences": total_occurrences,
                "text": row["chunk_text"],
                "created_at_epoch": row["created_at_epoch"],
            }
        )

    results.sort(
        key=lambda item: (
            -item["score"],
            -item["match_count"],
            -item["occurrences"],
            -item["created_at_epoch"],
            item["chunk_index"],
        )
    )

    if limit is not None:
        results = results[:limit]

    return {
        "query": query,
        "mode": mode,
        "terms": normalized_terms,
        "count": len(results),
        "results": results,
        "case_sensitive": case_sensitive,
        "exact_phrase": exact_phrase,
        "document_id": document_id or "",
        "requested_min_matches": min_matches,
        "effective_min_matches": effective_min_matches,
    }


def list_documents(limit: int | None = None) -> list[dict]:
    init_storage()
    sql = """
        SELECT id, original_filename, stored_pdf_path, manifest_path, file_sha256,
               page_count, image_count, chunk_count, extraction_method, created_at_epoch
        FROM documents
        ORDER BY created_at_epoch DESC, original_filename ASC
    """
    parameters = []
    if limit is not None:
        sql += " LIMIT ?"
        parameters.append(limit)

    with get_connection() as conn:
        rows = conn.execute(sql, parameters).fetchall()

    return [dict(row) for row in rows]


def get_stats() -> dict:
    init_storage()
    with get_connection() as conn:
        document_count = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
        chunk_count = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        total_images = conn.execute("SELECT COALESCE(SUM(image_count), 0) FROM documents").fetchone()[0]

    return {
        "documents": document_count,
        "chunks": chunk_count,
        "document_count": document_count,
        "total_chunks": chunk_count,
        "total_images": total_images or 0,
        "rag_root": relative_path(RAG_ROOT),
        "database_path": relative_path(DB_PATH),
    }

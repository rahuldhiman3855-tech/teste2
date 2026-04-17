from __future__ import annotations

import re
from pathlib import Path

from flask import Flask, abort, flash, jsonify, redirect, render_template, request, send_file, url_for
from markupsafe import Markup, escape
from werkzeug.utils import secure_filename

from extractor import delete_document, get_stats, index_uploaded_pdf, init_storage, list_documents, search_chunks


app = Flask(__name__)
# Keep upload handling unconstrained here; nginx and the client now enforce the real limits.
app.config["MAX_CONTENT_LENGTH"] = None
app.secret_key = "pdf-rag"
init_storage()


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


@app.route("/<path:path>", methods=["OPTIONS"])
@app.route("/", methods=["OPTIONS"])
def handle_options(path: str | None = None):
    return ("", 204)

DEFAULT_SEARCH_LIMIT = 20
MAX_SEARCH_LIMIT = 200


def require_pdf_upload():
    uploaded_file = request.files.get("pdf")
    if uploaded_file is None or uploaded_file.filename == "":
        return None, ("Choose a PDF file.", 400)

    filename = secure_filename(uploaded_file.filename)
    if not filename.lower().endswith(".pdf"):
        return None, ("Only PDF files are supported.", 400)

    return (uploaded_file, filename), None


def parse_bool(value: str | None) -> bool:
    return (value or "").strip().lower() in {"1", "true", "yes", "on"}


def parse_int(value: str | None, default: int | None, *, minimum: int = 1, maximum: int | None = None) -> int | None:
    if value is None:
        return default

    raw = value.strip()
    if not raw:
        return default

    try:
        parsed = int(raw)
    except ValueError:
        return default

    if parsed < minimum:
        parsed = minimum
    if maximum is not None and parsed > maximum:
        parsed = maximum
    return parsed


def build_search_options(args, documents: list[dict]) -> dict:
    available_ids = {document["id"] for document in documents}
    document_id = (args.get("document_id") or "").strip()
    if document_id not in available_ids:
        document_id = ""

    return {
        "query": (args.get("q") or "").strip(),
        "limit": parse_int(args.get("limit"), None, minimum=1, maximum=MAX_SEARCH_LIMIT),
        "case_sensitive": parse_bool(args.get("case_sensitive")),
        "exact_phrase": parse_bool(args.get("exact_phrase")),
        "document_id": document_id,
        "min_matches": parse_int(args.get("min_matches"), 1, minimum=1, maximum=50) or 1,
    }


def compile_highlight_pattern(terms: list[str], case_sensitive: bool):
    cleaned_terms = [term for term in terms if term]
    if not cleaned_terms:
        return None

    cleaned_terms = sorted(set(cleaned_terms), key=len, reverse=True)
    flags = 0 if case_sensitive else re.IGNORECASE
    return re.compile("|".join(re.escape(term) for term in cleaned_terms), flags)


def highlight_text_line(line: str, pattern):
    if not line:
        return Markup("")
    if pattern is None:
        return Markup(escape(line))

    parts = []
    last_end = 0
    for match in pattern.finditer(line):
        start, end = match.span()
        if start < last_end:
            continue
        parts.append(str(escape(line[last_end:start])))
        parts.append(f"<mark>{escape(line[start:end])}</mark>")
        last_end = end

    parts.append(str(escape(line[last_end:])))
    return Markup("".join(parts))


def decorate_search_results(search_response: dict | None) -> dict | None:
    if search_response is None:
        return None

    pattern = compile_highlight_pattern(search_response.get("terms", []), search_response.get("case_sensitive", False))
    for result in search_response.get("results", []):
        rendered_lines = []
        image_lines = []
        for raw_line in result["text"].splitlines():
            line = raw_line.rstrip()
            rendered = highlight_text_line(line, pattern)
            line_info = {
                "html": rendered,
                "is_image": line.strip().startswith("[IMAGE:"),
                "is_blank": line.strip() == "",
            }
            rendered_lines.append(line_info)
            if line_info["is_image"]:
                image_lines.append(line_info)

        result["rendered_lines"] = rendered_lines
        result["image_lines"] = image_lines

    return search_response


@app.get("/")
def home():
    documents = list_documents()
    search_options = build_search_options(request.args, documents)
    search_response = None
    if search_options["query"]:
        search_response = search_chunks(
            search_options["query"],
            limit=search_options["limit"],
            case_sensitive=search_options["case_sensitive"],
            exact_phrase=search_options["exact_phrase"],
            document_id=search_options["document_id"] or None,
            min_matches=search_options["min_matches"],
        )
        search_response = decorate_search_results(search_response)

    return render_template(
        "index.html",
        documents=documents,
        search_options=search_options,
        search_response=search_response,
        stats=get_stats(),
    )


@app.post("/index")
def index_pdf():
    upload_data, error = require_pdf_upload()
    if error is not None:
        flash(error[0])
        return redirect(url_for("home"))

    uploaded_file, filename = upload_data
    result = index_uploaded_pdf(uploaded_file, filename)
    document = result["document"]

    if result["status"] == "already_indexed":
        flash(
            f"Already indexed: {document['original_filename']} | pages {document['page_count']} | chunks {document['chunk_count']}"
        )
    else:
        flash(
            f"Indexed: {document['original_filename']} | pages {document['page_count']} | images {document['image_count']} | chunks {document['chunk_count']}"
        )

    return redirect(url_for("home"))


@app.post("/api/index")
def api_index_pdf():
    upload_data, error = require_pdf_upload()
    if error is not None:
        return jsonify({"error": error[0]}), error[1]

    uploaded_file, filename = upload_data
    result = index_uploaded_pdf(uploaded_file, filename)
    return jsonify(result)


@app.get("/api/search")
def api_search():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify({"error": "Missing q query parameter."}), 400

    documents = list_documents()
    search_options = build_search_options(request.args, documents)
    return jsonify(
        search_chunks(
            query,
            limit=search_options["limit"],
            case_sensitive=search_options["case_sensitive"],
            exact_phrase=search_options["exact_phrase"],
            document_id=search_options["document_id"] or None,
            min_matches=search_options["min_matches"],
        )
    )


@app.get("/api/documents")
def api_documents():
    return jsonify({"stats": get_stats(), "documents": list_documents()})


@app.get("/api/assets/<path:asset_path>")
def api_assets(asset_path: str):
    resolved_path = (Path(__file__).resolve().parent / asset_path).resolve()
    asset_root = (Path(__file__).resolve().parent / "rag" / "assets").resolve()

    if not str(resolved_path).startswith(str(asset_root)) or not resolved_path.exists() or not resolved_path.is_file():
        abort(404)

    return send_file(resolved_path)


@app.route("/api/documents/<document_id>", methods=["POST", "DELETE"])
def api_delete_document(document_id: str):
    deleted = delete_document(document_id)
    if not deleted:
        return jsonify({"error": "Document not found"}), 404

    return jsonify({"status": "deleted", "document_id": document_id})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)

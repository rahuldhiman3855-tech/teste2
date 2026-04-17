# pdfImgExtractor

Minimal PDF RAG app for:

- uploading PDFs
- extracting native PDF text
- saving image files under `rag/assets/...`
- embedding image paths inside the extracted text flow
- writing chunk text files under `rag/chunks/...`
- indexing all chunks in `rag/rag.sqlite3`
- searching chunks with keyword matching across all uploaded PDFs

## Run with Docker

```bash
cd /Users/rahul.dhiman/Downloads/pdfImgExtractor
docker build -t pdf-rag .
docker run --rm -p 8080:8080 pdf-rag
```

Open `http://localhost:8080`.

## Run locally

```bash
cd /Users/rahul.dhiman/Downloads/pdfImgExtractor
python3 -m pip install -r requirements.txt
python3 app.py
```

## Search behavior

- unquoted query: OR match
- quoted query: AND match

Examples:

- `infotainment system`
- `"infotainment system"`

## API

Index a PDF:

```bash
curl -F "pdf=@/path/to/file.pdf" http://localhost:8080/api/index
```

Search chunks:

```bash
curl "http://localhost:8080/api/search?q=infotainment%20system"
curl "http://localhost:8080/api/search?q=%22infotainment%20system%22"
curl "http://localhost:8080/api/search?q=infotainment%20system&min_matches=2"
curl "http://localhost:8080/api/search?q=infotainment%20system&exact_phrase=1"
curl "http://localhost:8080/api/search?q=Infotainment&case_sensitive=1&limit=10"
```

List indexed PDFs:

```bash
curl http://localhost:8080/api/documents
```

## UI search tuning

The home page includes:

- limit
- case-sensitive toggle
- exact-phrase toggle
- document filter
- minimum keyword match count

Result cards show full chunk text and call out image-path lines separately.

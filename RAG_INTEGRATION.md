# RAG Pipeline Integration Guide

## Overview

The RAG (Retrieval-Augmented Generation) pipeline has been successfully integrated with the UI. This integration allows you to:

- View indexed PDF documents from the RAG pipeline
- Monitor RAG statistics (documents, chunks, images)
- Access RAG data through a dedicated service layer
- Manage RAG pipeline data from the admin interface

## What's Been Integrated

### 1. **Service Layer** (`src/services/ragService.ts`)
A new service module that handles all communication with the RAG pipeline Flask API.

**Exported Functions:**
- `indexPdf(file)` - Index a new PDF document
- `searchChunks(query, options)` - Search through indexed documents
- `getRagDocuments()` - Fetch all indexed documents and statistics
- `checkRagAvailability()` - Check if the RAG pipeline service is running

**Features:**
- Automatic error handling and type safety
- TypeScript interfaces for all data types
- Configurable API URL via environment variable

### 2. **React Hook** (`src/hooks/useRag.ts`)
A custom React hook that provides RAG functionality to components.

**Hook API:**
```typescript
const {
  documents,        // Array of indexed RagDocument objects
  stats,            // RagStats with document count, chunk count, image count
  loading,          // Loading state
  isAvailable,      // Whether RAG pipeline is available
  error,            // Error message if any
  refresh,          // Function to refresh data
  addDocument,      // Function to index a new PDF
  search,           // Function to search documents
} = useRag();
```

### 3. **RAG Sources Component** (`src/components/sources/RAGSources.tsx`)
A new UI component that displays RAG pipeline data in the admin interface.

**Features:**
- Statistics cards showing document count, total chunks, and total images
- List of all indexed PDFs with metadata
- Automatic availability detection
- Graceful error handling with retry capability

### 4. **Updated SourcesPage** (`src/pages/admin/SourcesPage.tsx`)
Added a new "RAG Pipeline" tab to the Knowledge Sources page.

**Changes:**
- Added `RAGSources` component import
- Changed grid layout from 4 to 5 columns
- Added RAG Pipeline tab with BookOpen icon
- No modifications to existing functionality

### 5. **Environment Configuration** (`.env`)
Added RAG API URL configuration.

**New Variable:**
```env
VITE_RAG_API_URL="http://localhost:8080"
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│          React UI (Vite)                        │
│                                                 │
│  SourcesPage.tsx (Admin)                        │
│  ├── SourcesOverview                            │
│  ├── WebCrawlerSources                          │
│  ├── FileSources                                │
│  ├── RAGSources ◄─── Uses useRag() hook         │
│  └── IntegrationSources                         │
└──────────────────┬──────────────────────────────┘
                   │
                   │ useRag() hook
                   │ (Calls ragService)
                   ▼
        ┌──────────────────────┐
        │  ragService.ts       │
        │                      │
        │  Handles all API     │
        │  communication       │
        └──────────────────────┘
                   │
                   │ HTTP Requests
                   ▼
        ┌──────────────────────┐
        │  Flask RAG Pipeline  │
        │  :8080               │
        │                      │
        │  /api/index          │
        │  /api/search         │
        │  /api/documents      │
        └──────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  SQLite DB           │
        │  rag.sqlite3         │
        │                      │
        │  - documents table   │
        │  - chunks table      │
        └──────────────────────┘
```

## How to Use

### In Components

Import and use the `useRag` hook in any component:

```typescript
import { useRag } from '@/hooks/useRag';

export function MyComponent() {
  const { documents, stats, loading, isAvailable } = useRag();

  if (loading) return <div>Loading...</div>;
  if (!isAvailable) return <div>RAG Pipeline unavailable</div>;

  return (
    <div>
      <h2>{documents.length} documents indexed</h2>
      <p>{stats?.total_chunks} total chunks</p>
    </div>
  );
}
```

### Using the Service Directly

For more control, use the service directly without the hook:

```typescript
import { getRagDocuments, searchChunks } from '@/services/ragService';

// Get all documents
const { stats, documents } = await getRagDocuments();

// Search documents
const results = await searchChunks('your query', {
  limit: 20,
  case_sensitive: false,
  exact_phrase: false,
});
```

## File Structure

```
src/
├── services/
│   └── ragService.ts          (New) - RAG API client
├── hooks/
│   └── useRag.ts              (New) - RAG React hook
├── components/
│   └── sources/
│       ├── RAGSources.tsx      (New) - RAG UI component
│       ├── FileSources.tsx     (Unchanged)
│       ├── WebCrawlerSources.tsx (Unchanged)
│       ├── IntegrationSources.tsx (Unchanged)
│       └── SourcesOverview.tsx (Unchanged)
└── pages/
    └── admin/
        └── SourcesPage.tsx     (Modified) - Added RAG tab

.env                            (Modified) - Added VITE_RAG_API_URL
```

## Configuration

### Environment Variables

The RAG pipeline URL can be configured via the `VITE_RAG_API_URL` environment variable:

```env
# Local development (default)
VITE_RAG_API_URL="http://localhost:8080"

# Production (if deployed)
VITE_RAG_API_URL="https://rag-api.example.com"

# Docker
VITE_RAG_API_URL="http://rag-pipeline:8080"
```

## Error Handling

The integration includes graceful error handling:

- **RAG Pipeline Unavailable**: Shows a warning card with retry option
- **Network Errors**: Logged to console, toast notifications for user
- **Invalid Responses**: Typed error handling with descriptive messages
- **Service Check**: Automatic availability detection on component mount

## Performance Considerations

- **Lazy Loading**: RAG data only loads when the RAG Pipeline tab is accessed
- **Caching**: No client-side caching to ensure fresh data
- **Background Refresh**: Manual refresh button allows users to update data
- **Minimal Impact**: Existing features remain unchanged

## Backward Compatibility

✅ **All existing features remain fully functional:**
- Web Crawler sources
- File sources
- Integration sources
- Sources Overview
- All existing UI components

The integration is **non-breaking** and **minimal**:
- Only one new file is imported in SourcesPage
- No modifications to existing components or hooks
- No changes to data models or state management

## Testing the Integration

1. **Verify Environment Setup:**
   ```bash
   echo $VITE_RAG_API_URL
   # Should output: http://localhost:8080
   ```

2. **Start the RAG Pipeline:**
   ```bash
   cd rag-pipeline
   python app.py
   # Should run on http://localhost:8080
   ```

3. **Check RAG Availability:**
   - Navigate to admin panel → Knowledge Sources
   - Click the "RAG Pipeline" tab
   - Should show statistics and documents if available

4. **Test Connectivity:**
   - Open browser developer tools (F12)
   - Go to Network tab
   - Click "RAG Pipeline" tab
   - Should see successful API requests to `/api/documents`

## Troubleshooting

### RAG Pipeline shows as unavailable

1. **Check if Flask server is running:**
   ```bash
   curl http://localhost:8080/api/documents
   ```

2. **Check environment variable:**
   ```bash
   grep VITE_RAG_API_URL .env
   ```

3. **Check browser console for errors** (F12 → Console tab)

4. **Verify Flask server logs** for error messages

### CORS Issues

If you see CORS errors, the RAG Flask app may need CORS configuration. Check `rag-pipeline/app.py` for CORS setup.

## Future Enhancements

Potential additions without breaking changes:
- PDF upload directly from UI (connects to `/api/index`)
- Search interface integrated into RAG tab
- Document deletion functionality
- Advanced search filters
- Document tagging/categorization
- Integration with chat history for source tracking

## Support

For issues or questions:
1. Check `src/services/ragService.ts` for API documentation
2. Check `src/hooks/useRag.ts` for hook usage
3. Review Flask API in `rag-pipeline/app.py`
4. Check browser console for error messages

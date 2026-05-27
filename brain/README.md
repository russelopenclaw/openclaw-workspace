# Brain - Personal Knowledge Management

The Brain page is a personal knowledge base for saving and organizing links, articles, videos, and notes.

## Features

- **Linear-style UI**: Clean, minimal list view with type badges and keyword tags
- **Smart Type Detection**: Auto-detects videos (YouTube, Vimeo), articles (Medium, dev.to), and general links
- **Keyword Extraction**: Automatically extracts 3-5 relevant keywords from content
- **Full-Text Search**: Search across titles, keywords, and content with relevance scoring
- **Type Filtering**: Filter by Links, Articles, Videos, or Notes
- **Sort Options**: Sort by Date Saved, Title, or Type
- **Click to Open**: Click any item to open in new tab

## Files Created

```
/app/brain/page.tsx              # Main Brain page
/components/brain/BrainList.tsx  # Saved items list with filters
/components/brain/BrainItem.tsx  # Individual item card
/api/brain/items/route.ts        # GET all, POST new item
/api/brain/items/[id]/route.ts   # DELETE item
/api/brain/items/search/route.ts # Search with relevance scoring
/lib/brain/types.ts              # Type detection utilities
/lib/brain/keywords.ts           # Keyword extraction
/workspace/brain/items.json      # Data store
```

## API Endpoints

### GET /api/brain/items
Returns all saved brain items.

```json
{
  "success": true,
  "count": 5,
  "items": [...]
}
```

### POST /api/brain/items
Save a new brain item.

**Request:**
```json
{
  "title": "My Article",
  "url": "https://example.com/article",
  "content": "Article content or summary",
  "type": "article",  // optional, auto-detected
  "metadata": {
    "author": "Author Name"
  }
}
```

**Response:**
```json
{
  "success": true,
  "item": {
    "id": "uuid",
    "type": "article",
    "title": "My Article",
    "url": "https://example.com/article",
    "content": "...",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "createdAt": "ISO timestamp",
    "metadata": {...}
  }
}
```

### DELETE /api/brain/items/:id
Delete a brain item by ID.

### GET /api/brain/items/search?q=query
Search brain items with relevance scoring.

```json
{
  "success": true,
  "items": [...],
  "count": 2,
  "query": "react"
}
```

## Data Structure

Stored in `/workspace/brain/items.json`:

```json
{
  "items": [
    {
      "id": "unique-uuid",
      "type": "link|article|video|note",
      "title": "Title",
      "url": "https://url.com",
      "content": "Full content or summary",
      "keywords": ["keyword1", "keyword2"],
      "createdAt": "ISO timestamp",
      "metadata": {
        "domain": "example.com",
        "author": "Optional"
      }
    }
  ]
}
```

## Type Detection

Automatically detects content type based on URL:
- **Video**: YouTube, Vimeo, Twitch, TikTok
- **Article**: Medium, dev.to, Hashnode, Substack, Ghost, WordPress
- **Link**: Default for other URLs
- **Note**: For content without URL

## Usage

1. Navigate to `/brain` in Mission Control
2. View all saved items with type badges and keywords
3. Use search bar to find items by title, keywords, or content
4. Filter by type using the chips at the top
5. Click any item to open the original URL
6. Hover over an item and click × to delete

## Integration

To programmatically save items (e.g., from Alfred):

```javascript
const response = await fetch('/api/brain/items', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Title',
    url: 'https://example.com',
    content: 'Content or summary',
  }),
});
```

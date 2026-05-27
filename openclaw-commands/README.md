# Alfred Commands - Remember Handler

## Overview

The `remember.js` command handler allows users to save content to their Brain (personal knowledge base) using natural language commands via Telegram.

## Usage

Users send messages like:
- `Remember: https://youtube.com/watch?v=abc`
- `Remember: https://medium.com/article`
- `Remember: This is a random note`
- `Remember: https://github.com/project for cool stuff`

## Features

### Auto-Type Detection
- **Videos**: YouTube, Vimeo, Twitch, TikTok → 🎥
- **Articles**: Medium, dev.to, Hashnode, Substack, WordPress → 📄
- **Links**: Other URLs → 🔗
- **Notes**: Text without URL → 📝

### Auto-Keyword Extraction
Automatically extracts 3-5 relevant keywords from:
- Title
- Content/body text
- URL path segments
- Technical terms (camelCase, kebab-case)

### Smart Parsing
- Handles pure URLs
- Handles pure text notes
- Handles mixed content (URL + description)

## Integration with Alfred

### Option 1: Direct Import
```javascript
const remember = require('./openclaw-commands/remember.js');

// In message handler:
if (message.text.startsWith('Remember:')) {
  const result = await remember.handle(message.text);
  if (result.handled) {
    // Send result.response to user
  }
}
```

### Option 2: Pattern Matching
```javascript
const rememberPattern = /^remember:\s*(.+)$/i;

if (userInput.match(rememberPattern)) {
  const result = await remember.handle(userInput);
  // Return result.response
}
```

### Option 3: Parser Integration
If you're using a parser like `brain-8d`, add a rule:

```json
{
  "pattern": "^remember:\\s*.+",
  "handler": "./openclaw-commands/remember.js",
  "method": "handle",
  "type": "command"
}
```

## API Endpoint

Saves to Brain via:
```
POST /api/brain/items
```

Request body:
```json
{
  "title": "Example Title",
  "url": "https://example.com",
  "content": "Full content or summary",
  "type": "article", // auto-detected
  "keywords": ["keyword1", "keyword2"], // auto-extracted
  "metadata": {
    "domain": "example.com"
  }
}
```

## Response Format

### Success
```
✅ Saved to Brain!

🎥 Example Video Title
Type: Video
Keywords: tutorial, javascript, web
URL: https://youtube.com/watch?v=abc
```

### Error
```
❌ Failed to save: [error reason]
```

## Testing

Run standalone test:
```bash
cd /workspace
node openclaw-commands/remember.js
```

Test cases:
1. Pure YouTube URL → video type
2. Medium article URL → article type
3. Plain text → note type
4. Mixed URL + text → extracts URL, uses both for content

## Files

- `remember.js` - Main command handler
- This file - Documentation

## Dependencies

- `fetch` API (Node 18+)
- Brain API endpoint must be running

## Configuration

Set environment variable for Mission Control URL:
```bash
export MISSION_CONTROL_URL=http://localhost:8765
```

Default: `http://localhost:8765`

---

**Status**: ✅ Complete  
**Dependencies**: brain-8d (parser) ✅, brain-8b (API) ✅  
**Task ID**: task-21

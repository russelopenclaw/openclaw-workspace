# Remember Command - Integration Guide

## Quick Start

### 1. In Your Telegram Handler

```javascript
const remember = require('./openclaw-commands/remember.js');

// In your message handler:
if (message.text && message.text.toLowerCase().startsWith('remember:')) {
  const result = await remember.handle(message.text);
  
  if (result.handled) {
    // Send result.response to Telegram user
    await telegram.sendMessage(chatId, result.response);
  }
}
```

### 2. Or Use the Central Handler

```javascript
const commands = require('./openclaw-commands/index.js');

// Process any command
const result = await commands.processMessage(message.text);
if (result.handled) {
  await telegram.sendMessage(chatId, result.result.response);
}
```

## What It Does

1. **Parses** "Remember: [content]" messages
2. **Detects** content type (video, article, link, note)
3. **Extracts** keywords automatically
4. **Saves** to Brain API
5. **Returns** formatted confirmation with type emoji and keywords

## Example Responses

### Video URL
```
User: Remember: https://youtube.com/watch?v=abc123

Bot: ✅ Saved to Brain!

🎥 youtube.com - abc123
Type: Video
Keywords: tutorial, guide, example
URL: https://youtube.com/watch?v=abc123
```

### Article URL
```
User: Remember: https://medium.com/my-article

Bot: ✅ Saved to Brain!

📄 medium.com - my-article
Type: Article
Keywords: react, javascript, web
URL: https://medium.com/my-article
```

### Note
```
User: Remember: Call dentist tomorrow at 2pm

Bot: ✅ Saved to Brain!

📝 Call dentist tomorrow at 2pm
Type: Note
Keywords: dentist, tomorrow, appointment
```

### Mixed Content
```
User: Remember: https://github.com/alfred-project Love this repo!

Bot: ✅ Saved to Brain!

🔗 github.com - alfred-project
Type: Link
Keywords: alfred, project, repo
URL: https://github.com/alfred-project
```

## Error Handling

### API Not Available
```
❌ Failed to save: Failed to connect to Brain API
```

### Empty Content
```
❌ Please provide content or a URL to remember.
```

## Prerequisites

1. Mission Control must be running (provides `/api/brain/items`)
2. Default URL: `http://localhost:8765`
3. Override with: `MISSION_CONTROL_URL` env variable

## Testing

```bash
cd /workspace/openclaw-commands
node remember.js
```

## Troubleshooting

**Command not recognized?**
- Check case: pattern is case-insensitive (`remember:` or `Remember:` both work)
- Ensure colon is present: `Remember text` won't work, need `Remember: text`

**API errors?**
- Mission Control not running? Start it: `npm run dev`
- Wrong URL? Set `MISSION_CONTROL_URL` environment variable

## Files

```
openclaw-commands/
├── remember.js              # Main handler
├── index.js                 # Command registry
├── telegram-integration.js  # Integration examples
├── package.json             # Dependencies
└── README.md                # Documentation
```

---

**Status**: ✅ Ready for Integration  
**Next Steps**: 
1. Import into your Telegram message handler
2. Test with various inputs
3. Deploy and monitor usage

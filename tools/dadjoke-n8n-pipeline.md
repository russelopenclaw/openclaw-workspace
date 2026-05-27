# Dad Joke Video Pipeline — n8n Hybrid (Updated 2026-03-15)

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              n8n Webhooks                                │
├─────────────────────────────────────────────────────────────────────────┤
│ GET joke      → https://n8n.wolfeinkc.uk/webhook/b33fd5b7...           │
│ POST audio    → https://n8n.wolfeinkc.uk/webhook/d9482752...           │
│ POST image    → https://n8n.wolfeinkc.uk/webhook/generate-image        │
│ PUT status    → https://n8n.wolfeinkc.uk/webhook/dad-joke-updater      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                           Alfred's Pipeline                              │
├─────────────────────────────────────────────────────────────────────────┤
│ 1. GET joke from n8n                                                     │
│ 2. POST to audio webhook → get buffered audio                           │
│ 3. Generate THEMATIC background prompt (LLM)                            │
│ 4. POST to image webhook → get background image                         │
│ 5. Validate image with Qwen3.5 (no text, no AI artifacts)              │
│ 6. Retry image up to 3x if validation fails                             │
│ 7. Assemble video: Ken Burns zoom + text overlay                        │
│ 8. Validate video with Qwen3.5 (text timing check)                     │
│ 9. Retry video up to 3x if validation fails                             │
│ 10. Upload to MinIO (versioned)                                         │
│ 11. PUT Dadabase Used=true                                              │
│ 12. POST video to Telegram for Kevin's review                           │
│ 13. WAIT for Kevin's response...                                        │
│ 14. IF "regenerate [notes]" → go back to step 3 with notes              │
│ 15. IF "publish" → upload to YouTube, PUT Dadabase Posted=true          │
└─────────────────────────────────────────────────────────────────────────┘
```

## n8n Flow Inputs/Outputs

### 1. Get Joke
```
GET https://n8n.wolfeinkc.uk/webhook/b33fd5b7-e682-4309-a454-3c4180029743

Response:
{
  "row_number": 26,
  "Joke ID": 26,
  "Joke": "Why don't scientists trust atoms? Because they make up everything!",
  "Used": false,
  "Posted": false
}
```

### 2. Generate Audio
```
POST https://n8n.wolfeinkc.uk/webhook/d9482752-5fb8-4c46-b681-9bd557c7c577

Body:
{
  "Joke": "Why don't scientists trust atoms? Because they make up everything!",
  "format": "setup-punchline",
  "segments": [
    {"text": "Why don't scientists trust atoms?", "type": "setup"},
    {"text": "Because they make up everything!", "type": "punchline"}
  ]
}

Response: audio.mp3 (with 1s buffers already added)
```

### 3. Generate Image
```
POST https://n8n.wolfeinkc.uk/webhook/generate-image

Body:
{
  "prompt": "science laboratory with glowing atoms, molecular structures, digital art, vibrant colors, no text",
  "width": 512,
  "height": 768,
  "steps": 20
}

Response: background.png
```

### 4. Update Dadabase Status
```
PUT https://n8n.wolfeinkc.uk/webhook/dad-joke-updater

Body:
{
  "Joke ID": 26,
  "Used": true,
  "Posted": false
}

// Called twice:
// - After video sent to Telegram for approval: Used=true
// - After video published to YouTube: Posted=true
```

## Timeline (Video Assembly)

| Time | Visual | Audio |
|------|--------|-------|
| 0-1s | Empty background (Ken Burns zoom starts) | Silence buffer |
| 1s+ | Setup/one-liner fast fade in | Joke audio starts |
| Transition | Crossfade to punchline | Punchline begins |
| End | Punchline stays visible | Silence buffer |

## Joke Structure Classification

| Type | Detection | Treatment |
|------|-----------|-----------|
| **One-liner** | 1 sentence, no comma | Text appears once, continuous |
| **One-liner-comma** | 1 sentence, has comma | Text appears once, slight pause |
| **Setup-punchline** | 2+ sentences | Setup fades in, crossfade to punchline |

## Background Prompt Generation

LLM analyzes joke to create THEMATIC prompt (without revealing punchline):

| Joke | Subject | Prompt |
|------|---------|--------|
| "Why don't scientists trust atoms?" | science/atoms | "science laboratory, glowing atoms, molecular structures, digital art, no text" |
| "What do you call a fake noodle?" | food/pasta | "Italian kitchen, pasta noodles, wooden table, food photography, no text" |
| "I'm reading a book about anti-gravity." | books/physics | "floating books, open pages, library, magical atmosphere, no text" |

## Validation Checks

### Image Validation (Qwen3.5 Vision)
- NO text visible in image (words, letters, numbers)
- NO obvious AI artifacts (uncanny faces, extra limbs, weird geometry)
- GOOD quality (not blurry, not low detail)
- THEME matches joke subject

### Video Validation (Qwen3.5 Vision)
- Setup text visible at ~2s into video
- Punchline text visible at ~4.5s into video
- Background looks good throughout
- Text is readable and wraps properly

## Retry Logic

| Step | Max Retries | Fallback |
|------|-------------|----------|
| Image generation | 3x | Gradient background |
| Image validation | 3x | Accept with warnings |
| Video validation | 3x | Send to Kevin anyway |
| YouTube upload | 3x | Manual upload later |

## File Naming (Versioned)

All assets use versioned naming for regeneration without overwriting:

| Asset | Pattern | Example |
|-------|---------|---------|
| Audio | `audio-{ID}-V{N}.mp3` | `audio-26-V1.mp3` |
| Background | `bg-{ID}-V{N}.png` | `bg-26-V1.png` |
| Video | `video-{ID}-V{N}.mp4` | `video-26-V1.mp4` |

## MinIO Structure

```
hp1/dadjokes/
├── 26/
│   ├── audio-26-V1.mp3
│   ├── bg-26-V1.png
│   ├── video-26-V1.mp4
│   └── video-26-V2.mp4  (after regeneration)
├── 27/
│   └── ...
```

## Technical Specs

- **Resolution**: 720x1280 (portrait)
- **Frame rate**: 30fps
- **Duration**: audio_duration × 30 frames (variable)
- **Target size**: <5MB
- **Text effect**: Fast fade in, crossfade transition
- **Background effect**: Ken Burns slow zoom (1.02-1.05x scale)

## Telegram Review Flow

1. Alfred posts video to Kevin's Telegram
2. Kevin reviews video
3. Kevin responds with:
   - `"regenerate [notes]"` → Alfred regenerates with feedback
   - `"publish"` → Alfred uploads to YouTube, updates Dadabase
4. Alfred confirms completion
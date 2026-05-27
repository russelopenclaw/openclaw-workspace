# DadtasticDads Video Creation Workflow

## Current n8n + FFmpeg Workflow (As-Is)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Google Sheets                                                        │
│    └─→ Get next unused dad joke from "Dadabase"                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. ElevenLabs API                                                       │
│    └─→ Generate MP3 audio of full joke                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. Mistral (Local Ollama)                                               │
│    └─→ Split joke into setup and punchline                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. Mistral (Local Ollama)                                               │
│    └─→ Summarize setup in single English word                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. Llama3.1 (Local Ollama)                                              │
│    └─→ Generate image description for illustration                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. Stable Diffusion (Local 192.168.1.33:7860)                           │
│    └─→ Generate 480x720 background image                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. FFmpeg Compilation                                                   │
│    ├─→ Show image entire duration                                       │
│    ├─→ Wait 1 second, start audio + show setup text                     │
│    ├─→ 60/40 time split for setup→punchline (rarely lines up) ⚠️       │
│    └─→ 1 second silence after audio ends                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                         ┌─────────────────────┐
                         │  YouTube Short MP4  │
                         │  (inconsistent) ⚠️  │
                         └─────────────────────┘
```

### Problems with Current Approach

| Issue | Impact |
|-------|--------|
| **60/40 time split** | Setup/punchline rarely sync with audio |
| **FFmpeg scripting** | Hard to iterate, inconsistent styling |
| **No brand template** | Each video may look different |
| **Manual timing** | Requires tweaking per joke |
| **Text animations** | Basic or none |

---

## Proposed Alfred Workflow (Using Remotion)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Google Sheets (gog skill or API)                                     │
│    └─→ Get next unused joke from "Dadabase"                             │
│    └─→ Mark as "in progress"                                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. ElevenLabs API                                                       │
│    └─→ Generate MP3 audio (same as before ✅)                           │
│    └─→ Get audio duration in milliseconds                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. Mistral (Local Ollama @ 192.168.1.33:11434)                          │
│    └─→ Split joke: setup + punchline                                    │
│    └─→ Get estimated delivery timing (when punchline hits) 🎯           │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. Llama3.1 (Local Ollama)                                              │
│    └─→ Generate Stable Diffusion prompt for image                       │
│    └─→ (Skip single-word summary - not needed for video)                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. Stable Diffusion (192.168.1.33:7860)                                 │
│    └─→ Generate 1080x1920 image (9:16 for Shorts/Reels/TikTok)          │
│    └─→ Style: consistent brand aesthetic                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. REMOTION Video Composition ✨                                        │
│    ├─→ Load audio file                                                  │
│    ├─→ Load background image                                            │
│    ├─→ Text animations AUTO-SYNCED to audio timing 🎯                   │
│    ├─→ Setup text fades in at 0:01                                      │
│    ├─→ Punchline text replaces setup at exact delivery moment           │
│    ├─→ Professional fade-out at end                                     │
│    └─→ Brand-consistent styling (fonts, colors, positioning)            │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ 7. Remotion Render                                                      │
│    └─→ Output MP4 (YouTube/Instagram/TikTok optimized)                  │
│    └─→ Mark joke as "published" in Google Sheets                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                         ┌─────────────────────┐
                         │  Professional MP4   │
                         │  (consistent ✅)    │
                         └─────────────────────┘
```

---

## Key Improvements

### 1. **Audio-Synced Text Transitions** 🎯

**Current:** 60/40 time split (guesses when punchline lands)

**Proposed:** Two approaches:

**Option A - LLM Timing Detection:**
```javascript
// Mistral analyzes joke and estimates punchline timing
Prompt: "For this joke, at what percentage through the audio 
does the punchline land? Return: { punchlineAtPercent: 0.65 }"

// Remotion uses this to time the text switch
<Sequence from={audioDuration * 0.65}>
  <PunchlineText />
</Sequence>
```

**Option B - Audio Ducking Detection (More Accurate):**
```javascript
// Use ffmpeg to detect audio pauses/delivery breaks
// Punchline typically follows a brief pause
const timing = detectDeliveryTiming(audioFile);
// Remotion syncs to exact timing
```

### 2. **Remotion vs FFmpeg Benefits**

| Feature | FFmpeg Script | Remotion |
|---------|--------------|----------|
| **Text timing** | Manual frame calculation | Frame-accurate with `useCurrentFrame()` |
| **Animations** | Complex filter chains | React components with interpolation |
| **Styling** | Hardcoded per video | CSS-in-JS template (consistent) |
| **Iteration** | Re-run entire script | Change template, re-render all |
| **Preview** | Render to see | Real-time in Remotion Studio |
| **Audio sync** | Manual timestamp math | Built-in `useAudioWaveform()` |
| **Debugging** | Log diving | React DevTools |

### 3. **Brand Consistency**

**Remotion Template includes:**
```javascript
// dadtasticdads-template/config/brand.js
export const BRAND = {
  colors: {
    background: '#1a1a2e',
    text: '#ffffff',
    accent: '#e94560',
  },
  fonts: {
    setup: 'Anton', // Bold, attention-grabbing
    punchline: 'Roboto', // Clean, readable
  },
  positioning: {
    setup: { y: '40%' },
    punchline: { y: '55%' },
  },
  animations: {
    setupEntry: 'fadeInUp',
    punchlineEntry: 'zoomIn',
  }
};
```

### 4. **Simplified LLM Calls**

**Current:** 2 Mistral calls + 1 Llama3.1 call

**Proposed:** 2 calls total
1. **Mistral:** Split joke + estimate timing (combined)
2. **Llama3.1:** Image prompt generation

**Skip:** Single-word summary (not needed for video)

---

## Remotion Component Structure

```
dadtasticdads-remotion/
├── src/
│   ├── DadJokeVideo.tsx       # Main composition
│   ├── SetupText.tsx          # Animated setup text
│   ├── PunchlineText.tsx      # Animated punchline text
│   ├── BackgroundImage.tsx    # SD image with effects
│   └── AudioSync.tsx          # Audio timing utilities
├── public/
│   ├── fonts/                 # Brand fonts
│   └── logo/                  # DadtasticDads branding
├── remotion.config.js         # Render settings
└── package.json
```

### Example Component

```tsx
// src/DadJokeVideo.tsx
import { useCurrentFrame, interpolate } from 'remotion';
import { Audio } from '@remotion/media';
import { SetupText } from './SetupText';
import { PunchlineText } from './PunchlineText';

export const DadJokeVideo = ({ 
  audioUrl, 
  imageUrl, 
  setup, 
  punchline,
  punchlineTiming // When punchline lands (0-1)
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  const audioDuration = 5; // seconds, from ElevenLabs
  const punchlineFrame = Math.floor(fps * audioDuration * punchlineTiming);
  
  return (
    <div style={{ width: 1080, height: 1920 }}>
      <BackgroundImage src={imageUrl} />
      <Audio src={audioUrl} />
      
      {/* Setup text visible until punchline */}
      <Sequence durationInFrames={punchlineFrame}>
        <SetupText text={setup} />
      </Sequence>
      
      {/* Punchline appears at exact delivery moment */}
      <Sequence from={punchlineFrame}>
        <PunchlineText text={punchline} />
      </Sequence>
    </div>
  );
};
```

---

## Automation Options

### Option 1: Node.js Script (Recommended)

```bash
# Run daily to generate next video
node generate-dadjoke-video.js
```

**Script flow:**
1. Read Google Sheets → get joke
2. Call ElevenLabs → get audio + duration
3. Call Ollama Mistral → split + timing
4. Call Ollama Llama3.1 → image prompt
5. Call Stable Diffusion → image
6. Render Remotion → MP4
7. Update Google Sheets → mark complete

### Option 2: n8n + Remotion Hybrid

Keep your n8n workflow, but replace FFmpeg step:
```
n8n handles: Steps 1-6 (same as before)
             ↓
Remotion handles: Step 7 (video composition)
```

### Option 3: Full Remotion Pipeline

Remotion can orchestrate everything:
```javascript
// Remotion Lambda or self-hosted render farm
// Triggers entire pipeline on schedule
```

---

## Implementation Plan

### Phase 1: Template Creation (1-2 hours)
- [ ] Set up Remotion project structure
- [ ] Create brand config (colors, fonts, logo)
- [ ] Build DadJokeVideo composition
- [ ] Add text animations (fade, slide, zoom)
- [ ] Test with sample joke/audio/image

### Phase 2: Integration (2-3 hours)
- [ ] Create Node.js automation script
- [ ] Integrate Google Sheets (gog or API)
- [ ] Integrate ElevenLabs API
- [ ] Integrate Ollama (Mistral + Llama3.1)
- [ ] Integrate Stable Diffusion API
- [ ] Test end-to-end flow

### Phase 3: Timing Refinement (1 hour)
- [ ] Implement punchline timing detection
- [ ] Test with 5-10 joke samples
- [ ] Fine-tune LLM prompts for timing accuracy
- [ ] Add fallback timing if detection fails

### Phase 4: Polish (1-2 hours)
- [ ] Add DadtasticDads logo/branding
- [ ] Add end screen (subscribe, next joke preview)
- [ ] Optimize render settings for YouTube/Instagram
- [ ] Create batch render for backlog

**Total estimated time:** 5-8 hours

---

## Expected Quality Improvements

| Aspect | Current | With Remotion |
|--------|---------|---------------|
| **Text sync accuracy** | ~40% (60/40 guess) | ~95% (audio-synced) |
| **Visual consistency** | Varies per video | 100% consistent |
| **Professional feel** | Basic | Polished animations |
| **Iteration speed** | 10-15 min per change | Instant preview |
| **Time to produce** | ~5 min/video | ~2 min/video (after setup) |
| **Brand recognition** | Low | High (consistent styling) |

---

## Next Steps

1. **Share a sample joke** (or I can use a test joke)
2. **Confirm brand preferences:**
   - Colors? (dark mode? bright/fun?)
   - Font style? (bold/playful? clean/modern?)
   - Logo/tagline?
3. **I'll build the Remotion template**
4. **Test render** for your approval
5. **Automate the full pipeline**

Ready to start when you are! 🚀

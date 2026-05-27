# Joke Format Detection Strategy

## Overview
Before processing a dad joke for video creation, the system must detect the joke format to determine the optimal text display strategy.

## Three Joke Formats

### 1. One-Liner
**Characteristics:**
- Single sentence
- No question/answer structure
- Punchline is the entire joke
- Often uses wordplay or puns

**Examples:**
- "Waking up this morning was an eye opening experience."
- "I'm so good at winking, I can wink both my eyes at the same time."
- "It doesn't matter how much you push the envelope, it will still be stationary."

**Display Strategy:**
```json
{
  "format": "one-liner",
  "segments": [
    {
      "text": "Waking up this morning was an eye opening experience.",
      "atPercent": 0.0,
      "display": "fade-in",
      "holdUntil": 1.0
    }
  ]
}
```
- Single text block
- Fade in at 0:01
- Hold for entire duration
- No timing split needed

---

### 2. Traditional Setup/Punchline
**Characteristics:**
- Two distinct parts
- Usually question → answer format
- Clear pause between setup and punchline
- Keywords: "Why...", "What...", "How..." followed by answer

**Examples:**
- "Why can't your nose be 12 inches long? Because then it'd be a foot!"
- "How do the trees get on the internet? They log on."
- "What do you call a fish with no eyes? Fsh."

**Display Strategy:**
```json
{
  "format": "setup-punchline",
  "segments": [
    {
      "text": "Why can't your nose be 12 inches long?",
      "atPercent": 0.0,
      "display": "fade-in"
    },
    {
      "text": "Because then it'd be a foot!",
      "atPercent": 0.65,
      "display": "pop-in"
    }
  ]
}
```
- Setup fades in first
- Punchline replaces setup at 60-70% through audio
- Pop-in animation for punchline impact
- Mistral estimates exact timing

---

### 3. Multi-Line / Conversational
**Characteristics:**
- 3+ segments or dialogue exchanges
- May have speaker labels ("Doctor:", "Dad:")
- Longer narrative or back-and-forth
- Story-like structure

**Examples:**
- "Doctor you've got to help me, I'm addicted to Twitter. Doctor: I don't follow you."
- "This is my step ladder. I never knew my real ladder."
- "Me and my mates are in a band called Duvet. We're a cover band."

**Display Strategy:**
```json
{
  "format": "multi-line",
  "segments": [
    {
      "text": "Doctor you've got to help me,",
      "atPercent": 0.0,
      "display": "fade-in"
    },
    {
      "text": "I'm addicted to Twitter.",
      "atPercent": 0.40,
      "display": "fade-in"
    },
    {
      "text": "Doctor: I don't follow you.",
      "atPercent": 0.75,
      "display": "pop-in"
    }
  ]
}
```
- Progressive text reveals
- Each segment timed to natural speech pauses
- Final line often gets pop-in for emphasis
- May use alternating positions for dialogue

---

## Detection Logic

### Step 1: Pattern Matching
```javascript
function detectJokeFormat(joke) {
  // Check for question mark (strong setup/punchline indicator)
  if (joke.includes('?') && joke.split('?').length === 2) {
    return 'setup-punchline';
  }
  
  // Check for dialogue markers
  if (joke.match(/^[A-Za-z]+:/) || joke.includes('. Doctor:') || joke.includes('. Dad:')) {
    return 'multi-line';
  }
  
  // Check for multiple sentences with narrative structure
  const sentences = joke.match(/[.!?]+/g);
  if (sentences && sentences.length >= 2 && joke.length > 80) {
    return 'multi-line';
  }
  
  // Default to one-liner
  return 'one-liner';
}
```

### Step 2: LLM Enhancement (Mistral Prompt)
```
Analyze this dad joke and return:
1. Format: "one-liner", "setup-punchline", or "multi-line"
2. Segments: Array of text parts with timing estimates

Joke: "{joke}"

Return JSON:
{
  "format": "...",
  "segments": [
    {"text": "...", "atPercent": 0.0-1.0, "display": "fade-in|pop-in"}
  ],
  "reasoning": "Brief explanation of format choice"
}
```

---

## Remotion Integration

### TextRenderer Component
```tsx
// MultiFormatText.tsx
interface Segment {
  text: string;
  atPercent: number;
  display: 'fade-in' | 'pop-in';
}

export const MultiFormatText = ({ 
  segments, 
  audioDuration 
}: { 
  segments: Segment[]; 
  audioDuration: number;
}) => {
  return (
    <>
      {segments.map((segment, index) => (
        <AnimatedText
          key={index}
          text={segment.text}
          enterFrame={segment.atPercent * audioDuration}
          animationType={segment.display}
        />
      ))}
    </>
  );
};
```

---

## Implementation Checklist

- [ ] Update `generate-dadjoke-video.js` to call format detection
- [ ] Create Mistral prompt for segment splitting with timing
- [ ] Update Remotion `DadJokeVideo.tsx` to handle multi-segment rendering
- [ ] Add format-specific animations (pop-in for punchlines, fade for setup)
- [ ] Test with examples from each format category
- [ ] Update `DADTASTICDADS-READY.md` with new workflow

---

## Test Cases

### One-Liner Test
```
Input: "Waking up this morning was an eye opening experience."
Expected: format="one-liner", 1 segment, 0-100% duration
```

### Setup/Punchline Test
```
Input: "Why can't your nose be 12 inches long? Because then it'd be a foot!"
Expected: format="setup-punchline", 2 segments, punchline at ~65%
```

### Multi-Line Test
```
Input: "Doctor you've got to help me, I'm addicted to Twitter. Doctor: I don't follow you."
Expected: format="multi-line", 3 segments, final at ~75%
```

---

_Last Updated: March 2, 2026_

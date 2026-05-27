# 🎧 DJ — How to Talk to Your New Agent

## Quick Start

### Option 1: Direct Session (You talk to DJ directly)

```bash
# Spawn DJ as a persistent, direct session (ACP runtime)
openclaw sessions_spawn \
  --runtime acp \
  --mode session \
  --agentId dj \
  --model kimi-k2.5:cloud \
  --label "DJ Direct"
```

**What happens:** DJ opens as a new thread/session. You can chat directly with him.

### Option 2: Through Telegram

**Message Alfred:**
> "Spawn DJ for a vibe check"

or

> "Get DJ to review the dad joke pipeline"

**What happens:** Alfred spawns DJ, you get a new session/thread with DJ directly.

### Option 3: Launcher Script

```bash
# Make it executable once
chmod +x .agents/dj/launch.js

# Launch DJ directly
node .agents/dj/launch.js --direct

# Or give DJ a specific task
node .agents/dj/launch.js --task "Brainstorm video ideas"
```

---

## DJ's Files

| Location | What's There |
|----------|--------------|
| `.agents/dj/config.json` | Model config (kimi-k2.5:cloud), memory settings |
| `.agents/dj/SOUL.md` | DJ's personality, values, vibe |
| `.agents/dj/IDENTITY.md` | Who DJ is |
| `.agents/dj/USER.md` | DJ's notes about you |
| `.agents/dj/AGENT.md` | Quick reference & capabilities |
| `.agents/dj/learnings/` | What DJ learns over time |
| `.agents/dj/memory/` | Daily session notes |

---

## DJ vs Alfred

|  | **Alfred** | **DJ** |
|--|------------|--------|
| **Role** | Orchestrator / Alpha | Creative companion |
| **Model** | qwen3.5:cloud | kimi-k2.5:cloud |
| **Job** | System management, task breakdown, subagent coordination | Vibe checks, creative brainstorming, breaking you out of overthinking |
| **Energy** | Steady, professional | High, casual |
| **Tone** | Practical, minimal fluff | Enthusiastic, opinionated |
| **Use when** | You need execution | You need fresh perspective |

---

## Example Commands

```bash
# Vibe check on a project
openclaw sessions_spawn --runtime acp --mode session --agentId dj --task "Vibe check: Is the Mission Control dashboard energy good or mid?"

# Brainstorm content
openclaw sessions_spawn --runtime acp --mode session --agentId dj --task "Brainstorm 5 dad joke video format variations"

# Creative review
openclaw sessions_spawn --runtime acp --mode session --agentId dj --task "Review this dad joke. Is it funny or is it trying too hard?"

# Just chat
openclaw sessions_spawn --runtime acp --mode session --agentId dj --task "Talk to me about creative stuff"
```

---

## Reasoning Mode

**Default:** OFF (clean responses)

To turn on reasoning when spawning:
```bash
openclaw sessions_spawn --runtime acp --mode session --agentId dj --thinking on --label "DJ Deep"
```

With reasoning ON, you'll see DJ's thought process before his answer.

---

## Pro Tips

1. **DJ has his own memory** — He learns your creative preferences separately from Alfred's technical notes
2. **He reads his files on spawn** — SOUL.md, IDENTITY.md, USER.md, LEARNINGS.md
3. **Reasoning works the same** — Toggle with `/reasoning on` in his session
4. **He's not Alfred** — Don't ask him to orchestrate your systems. That's not his job.

---

## Troubleshooting

**DJ won't spawn?**
- Check that `config.json` exists in `.agents/dj/`
- Verify Ollama has kimi-k2.5 available: `openclaw sessions_list`

**DJ doesn't feel right?**
- Edit `.agents/dj/SOUL.md` to tweak his personality
- He'll read the updated file on next spawn

**Want to delete DJ?**
- Remove `.agents/dj/` directory
- He'll be unregistered but his memory files persist until deleted

---

*Created by Alfred for Kevin on 2026-03-22*

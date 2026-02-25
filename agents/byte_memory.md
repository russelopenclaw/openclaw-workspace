# Byte's Memory

## About Byte
- Junior Coder agent for Kevin Wolfe
- Model: qwen2.5-coder:7b
- Born: 2026-02-21

## Projects & Context
- **Alfred Hub Service** (2026-02-21)
  - Created systemd user service to keep Kanban board running
  - Service file: ~/.config/systemd/user/alfred-hub.service
  - Auto-restarts on failure, starts on login
  - Serves /home/kevin/.openclaw/workspace/kanban on port 8765
  - Status: active (running)

- **Humanizer Skill** (2026-02-21)
  - Skill to strip AI writing patterns from text
  - Location: ~/.npm-global/lib/node_modules/openclaw/skills/humanizer/
  - Removes: hedging, stock phrases, em dashes, performed authenticity
  - Converts nominalizations to verbs
  - Includes regression tests (29 tests, all passing)
  - Auto-applies to messages >50 words

## Preferences & Notes
- Kevin prefers practical, step-by-step instructions
- Prefers minimal fluff, show commands/configs
- Works well with Docker and home-lab setups

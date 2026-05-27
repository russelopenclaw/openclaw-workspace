# IDIOT'S CHECKLIST - READ BEFORE EVERY ACTION

## When Spawning Image Agent
- [ ] Folder structure created? (raw/, approved/, output/, work/)
- [ ] ideas.md updated to "(IN PROGRESS)"?
- [ ] Kanban tasks added?
- [ ] **SET CRON: "Check image status in 12 minutes"**
- [ ] **READ THIS: When images complete → VERIFY quality → Upscale → Spawn video**

---

## When Image Agent Reports Complete
- [ ] **WITHIN 60 SECONDS:** Run `image` tool on 4-5 samples
- [ ] Rate each 1-5 (1 = garbage, 5 = perfect, artifacts lower=better)
- [ ] Any 2/5 or below? → Regenerate NOW
- [ ] All 3/5 or better? → Upscale all to 1920x1080
- [ ] **WITHIN 60 SECONDS OF UPSCALE:** Spawn Video Agent
- [ ] **SET CRON: "Check video status in 20 minutes"**

---

## When Video Agent Reports Complete
- [ ] **WITHIN 60 SECONDS:** Run verification checklist:
  - [ ] Resolution = 1920,1080?
  - [ ] Duration = 3600.0?
  - [ ] Size = 400-800MB?
  - [ ] Assets = 11 files?
- [ ] All pass? → Update ideas.md "(completed)"
- [ ] Update kanban "status: complete"
- [ ] **WRITE ASSESSMENT NOW** (log what actually happened)

---

## If Agent Takes Longer Than Expected
- [ ] Image agent >15 min? → CHECK STATUS NOW
- [ ] Video agent >25 min? → CHECK STATUS NOW
- [ ] No status message for 5+ min? → POLL subagents list

---

## NEVER DO THESE
- ❌ Don't spawn agent and wait passively
- ❌ Don't write assessment from memory (log AS events happen)
- ❌ Don't start next video until this one is 100% done
- ❌ Don't trust "it'll probably be fine" on image quality
- ❌ Don't wait for Kevin to ping "And?"

---

## If You Screw Up (You Will)
1. **ADMIT IT IMMEDIATELY** - Don't wait to be called out
2. **FIX IT NOW** - Don't just document, actually fix
3. **UPDATE CHECKLIST** - What would have prevented this? Add it.

---

## Current Status
**Active Project:** ______________________
**Phase:** □ Images □ Video □ Verification □ Assessment
**Last Check:** ________:____ (fill this in!)
**Next Check Due:** ________:____ (set it!)

---

PIN THIS. READ IT EVERY TIME. NO EXCEPTIONS.

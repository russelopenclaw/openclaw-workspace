# SVEN - Memory

## Persistent Knowledge

### Projects

**Dinner Roulette** (Started: 2026-02-28)
- Location: `/mnt/windsurf-projects/DinneRoulette/restaurant_roulette`
- Platform: Flutter 3.x (Dart)
- Status: Production-ready with minor fixes needed

### Known Issues (to fix)

1. **Test Files Broken - FIX READY:**
   - `location_validation_service_test.dart` - Fixed locally in /tmp
   - 3 missing `));` in GeocodingResponse constructors (lines 236, 258, 295)
   - Manual copy required due to CIFS mount permission issues

2. **Code Cleanup Needed:**
   - 2 service files - unused `flutter/material.dart` imports
   - 7 occurrences of deprecated `withOpacity()` → should use `withValues()`

3. **Refactoring Opportunities:**
   - `restaurant_card.dart` (622 lines) - candidate for extraction

### Patterns Learned

- App uses singleton pattern for services
- Provider for state management
- Extensive location validation with caching
- Google Places API integration
- AdMob monetization in place

### Sessions

| Date | Task | Status |
|------|------|--------|
| 2026-02-28 | Analysis phase - identified all issues | Complete |
| 2026-02-28 | Test fixes prepared for review | Fixed in /tmp, needs manual copy |
| 2026-02-28 | Documented fixes for review | Complete |

### Decisions Made

- Priority: Fix tests first (blocking), then cleanup, then refactoring
- Will commit after each logical fix
- Will summarize all changes for review before any remote push

---

_This memory persists across sessions. Update it as you learn._

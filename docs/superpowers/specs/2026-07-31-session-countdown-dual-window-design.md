# Session countdown dual-window matching

**Date:** 2026-07-31  
**Status:** Approved design

## Goal

If a published schedule uses sub-noon times (e.g. start `10:00` instead of military `22:00`), the live session countdown on person pages should still arm at the corresponding evening wall-clock time (`22:00`). Displayed time labels stay exactly as stored. Correct military times on create remain important for late-run alerts (e.g. sessions ending after 1am).

## Current behavior

- `src/utils/sessionCountdown.ts` maps wall clock into schedule minutes (`getScheduleNowMinutes`), finds the active non-bye row (`findActiveSessionRow`), and computes remaining seconds (`getRemainingSeconds`) using `timeToSortValue` on stored `startTime` / `endTime`.
- A session at `10:00–10:20` is active only when wall clock is in that morning window—not at 10 PM.
- Person-page labels (`timeLabel` via `formatTimeForDisplay`) are independent of countdown matching; this change must not alter them.

## Decisions

| Decision | Choice |
|----------|--------|
| Approach | Dual window per row (base window always; optional +12h mirror) |
| Sub-noon session (e.g. `10:00–10:20`) | Active at 10:00–10:20 **and** 22:00–22:20 |
| Military evening session (e.g. `22:00–22:20`) | Active only at 22:00–22:20 (no AM mirror) |
| Displayed numbers / `timeLabel` | Unchanged |
| Past-midnight extended times (`end ≥ 24:00`) | Existing logic only; no +12h mirror |
| Create-side alerts (e.g. ending after 1am) | Unchanged |
| Scope of code change | `sessionCountdown.ts` matching/remaining only (+ admin guide note) |

## Matching rules

For each non-bye row, build one or two windows in schedule minutes:

1. **Base window:** `[timeToSortValue(startTime), timeToSortValue(endTime))` using existing inclusive-start / exclusive-end and same-day wrap handling as today.
2. **+12h mirror:** Add `[start + 12×60, end + 12×60)` only when:
   - the base window does not wrap (`end > start`),
   - base start and end are both strictly before noon (`< 12:00` / `< 720` minutes), and
   - therefore the row is not using past-midnight extended end times (`≥ 24:00`).

`findActiveSessionRow` returns the first row whose window contains `getScheduleNowMinutes(...)`.

`getRemainingSeconds` uses the end of the **matching** window (base or mirrored) so remaining time at 22:10 for a `10:00–10:20` session reflects ~10 minutes until 22:20, not a stale morning end.

## Out of scope

- Rewriting published or create-grid times to military on publish
- AM/PM suffixes anywhere in the UI
- Changing print templates, matrix labels, or public timetable cell text
- Changing create-side conflict / “after 1am” warning logic

## Documentation

Update `public/Administrative-User-Guide.md` §18 (Live session timer):

- Note that published session times before noon also arm the countdown twelve hours later (workaround when military evening times were not used).
- Note that create/settings should still use correct military / extended times so late-evening and after-1am alerts stay accurate.

## Testing (implementation)

- `10:00–10:20` active at 10:05 and at 22:05; remaining at 22:10 ≈ 10 minutes.
- `22:00–22:20` active at 22:05; **not** active at 10:05.
- Extended past-midnight row (e.g. end `25:00`) unchanged vs current midnight handling; no spurious +12h window.
- Displayed `timeLabel` still shows stored values (e.g. `10:00-10:20`).

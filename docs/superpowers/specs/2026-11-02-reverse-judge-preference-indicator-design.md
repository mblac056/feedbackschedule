# Reverse judge preference indicator on session blocks

**Date:** 2026-11-02  
**Status:** Approved design

## Goal

When a judge is selected, show that judge’s preference rank (1/2/3) on relevant entrant session blocks so schedulers can see who prefers the selected judge—especially among entrants not yet assigned to them.

## Current behavior

- Selecting an entrant shows 1/2/3 preference badges on matching judge column headers via `getJudgePreferenceIndicator`.
- Selecting a judge highlights the header (ring) and clears entrant selection; no reverse preference UI exists on session blocks.
- Session blocks already have a bottom-left selection `•`.

## Decisions

| Decision | Choice |
|----------|--------|
| “Assigned to selected judge” | Entrant has ≥1 scheduled session with `judgeId === selectedJudge` |
| Assigned entrants | Show reverse-pref badge only on blocks in the selected judge’s column |
| Not-assigned entrants | Show badge on all their session blocks (other columns + unassigned) |
| Badge content | Rank of `selectedJudge` in entrant’s `judgePreference1–3`; omit if not in prefs |
| Visual | Same numbered circles/colors as judge-header prefs |
| Placement | Top-right on the session block |
| Architecture | Pure helpers + optional prop from parents into `SessionBlock` |

## Visibility rules

When `selectedJudge` is set:

1. Determine whether the entrant is assigned to that judge (any scheduled session with that `judgeId`).
2. **Assigned:** show indicator only when the rendered block’s `judgeId === selectedJudge`.
3. **Not assigned:** show indicator on every rendered block for that entrant (scheduled elsewhere + unassigned).
4. Indicator value comes from preference lookup; if the judge is not pref 1–3, render nothing.
5. When `selectedJudge` is null, never show reverse badges. Entrant-selected header prefs are unchanged.

## UI

- Amber / gray / brown numbered circle matching existing header prefs.
- Absolute top-right on the session block.
- No extra block highlighting beyond the badge; selection `•` unchanged.

## Components / files

- **Util** (extend `judgePreferenceIndicator.ts` or adjacent):  
  - `getEntrantPreferenceForJudge(entrant, judgeId)` → `{ number, color } | null`  
  - visibility helper: whether to show given `selectedJudge`, block `judgeId` (or unassigned), and assigned-to-judge boolean
- **`GridSchedule`:** build set of entrant ids assigned to `selectedJudge` from `scheduledSessions`; for each block compute indicator prop
- **`UnassignedSessions`:** same for unscheduled blocks (show only when entrant not assigned to selected judge)
- **`SessionBlock`:** optional `preferenceIndicator` prop; render top-right badge when present

## Testing

- Unit tests for preference lookup and visibility rules (assigned on-column / off-column / not-assigned / unassigned / no pref / no selection)
- Manual: select judge → badges on that column for assigned entrants; badges on other/unassigned blocks only for not-assigned entrants; clear judge → badges gone

## Out of scope

- Changing entrant-selected judge-header preference behavior
- Highlighting entire session blocks for reverse prefs
- Multi-judge selection

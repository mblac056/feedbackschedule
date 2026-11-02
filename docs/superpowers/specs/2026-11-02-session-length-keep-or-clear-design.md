# Session length change: keep or clear grid

**Date:** 2026-11-02  
**Status:** Approved design

## Goal

When changing session lengths in Settings, avoid clearing a valid schedule when lengths only get shorter, while still clearing whenever any length increases so overlaps cannot appear.

## Current behavior

- `SettingsModal` clears the entire scheduling grid on any session-length change via `onClearGrid`.
- An amber warning is shown whenever a length field changes while scheduled sessions exist.
- Session duration on the grid and in overlap checks is derived from settings + `startRowIndex`, not from stored `endRowIndex`.
- Published payloads (`buildPublishedPayload`) require and export stored `endRowIndex` as-is.

## Decisions

| Decision | Choice |
|----------|--------|
| Approach | Gate clear/warning in Settings; refresh `endRowIndex` when keeping |
| Any length increases | Clear grid; show amber reset warning while editing |
| Lengths only decrease and/or stay the same | Keep scheduled sessions at same start/judge; no warning |
| Mixed (some longer, some shorter) | Treat as increase → clear |
| Keep-path data fix | Recompute `endRowIndex` from new settings so publish stays correct |
| Removing `endRowIndex` entirely | Out of scope |
| Partial clears when lengthening | Out of scope |

## Decision rule on Save

Compare each of `oneXLongLength`, `threeX20Length`, and `threeX10Length` to the values captured when the modal opened:

| Change | Grid action | Warning while editing |
|--------|-------------|------------------------|
| Any length **increases** | `onClearGrid()` | Show current amber “grid will reset” warning |
| Lengths only **decrease** and/or stay the same | Keep placements; refresh `endRowIndex` | No warning |
| No length changes | No grid action | No warning |

Existing validation is unchanged (multiples of 5; `3x10 < 3x20 < 1xLong`). Non-length settings (start time, movement, export name, code prefix) are unchanged.

## Keep-path `endRowIndex` refresh

When save keeps the grid:

- For each scheduled block with a defined `startRowIndex`, set  
  `endRowIndex = startRowIndex + durationSlots(type, newSettings) − 1`
- Leave unscheduled blocks unchanged
- Implement as a small pure helper; invoke from the parent (`CreatePage` / session management) via a callback such as `onRefreshScheduledEnds`, using existing `handleSessionBlocksReplace` (or equivalent) to persist

Clear path continues to use existing `onClearGrid` / `SessionService.clearGrid`.

## Components

- **`SettingsModal`**: detect any-increase vs shorten/same; show warning only on increase; call clear or refresh callback on save
- **Helper** (e.g. in `scheduleHelpers` or nearby session util): map blocks → refreshed `endRowIndex` given new settings
- **`CreatePage` / `useSessionManagement`**: wire refresh callback into block replace

## Testing

- Unit tests for the increase-vs-keep decision helper (or equivalent pure functions)
- Unit tests that keep-path refresh updates `endRowIndex` from new durations and leaves starts/judges intact
- No requirement to change E2E in this design

## Out of scope

- Removing or fully denormalizing away `endRowIndex`
- Trying to keep non-overlapping sessions when lengthening
- Changing behavior for start-time or other non-length settings

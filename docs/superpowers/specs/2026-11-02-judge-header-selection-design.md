# Judge column header selection

**Date:** 2026-11-02  
**Status:** Approved design

## Goal

Add a toggleable selection control on judge column headers, mutual exclusive with entrant/session selection, and visually highlight the selected judge header. Side effects beyond highlight are deferred.

## Current behavior

- Session blocks expose a small `•` button that toggles `selectedEntrant` via `EntrantContext`.
- Selecting an entrant highlights matching session blocks and drives preference indicators on judge headers.
- `JudgeColumnHeader` shows category-colored headers, optional preference number badge (top-left), and supports column reorder drag. There is no judge selection state.

## Decisions

| Decision | Choice |
|----------|--------|
| Selection state home | New `JudgeContext` (`selectedJudge` / `setSelectedJudge`) |
| Mutual exclusivity | Call-site clear: selecting a judge clears entrant; selecting an entrant clears judge |
| Cardinality | Single judge at a time (`string \| null`) |
| Selected highlight | Ring/outline; keep category background |
| Control affordance | Toggleable `•` in the header top-left corner |
| Preference badge vs bullet | No special collision handling; leave preference badge as-is |
| Extra judge-selection behavior | Out of scope for this slice |

## State & exclusivity

- Add `JudgeTypes.ts`, `JudgeContext.tsx`, and `useJudge.ts`, mirroring the entrant selection pattern.
- Export from `contexts/index.ts` and mount `JudgeProvider` next to `EntrantProvider` in `main.tsx`.
- Toggle judge: if same id → `null`, else that id; always `setSelectedEntrant(null)`.
- Toggle session `•` (and other selection-setting paths such as Preferences panel and session drag-select): also `setSelectedJudge(null)` so exclusivity holds app-wide.
- Do not couple the two providers to each other; callers clear the other selection.

## UI

- On `JudgeColumnHeader`, add an absolute top-left `•` button styled like the session-block control.
- `stopPropagation` on click so toggling does not start column drag.
- When `selectedJudge === judge.id`, apply a sky/blue ring (same family as multi-select session rings).
- Preference number badge behavior unchanged.

## Components / files

- **New:** `JudgeTypes.ts`, `JudgeContext.tsx`, `useJudge.ts`
- **`main.tsx`:** wrap with `JudgeProvider`
- **`contexts/index.ts`:** export provider/hook/types
- **`JudgeColumnHeader`:** bullet control + selected ring via `useJudge`
- **`SessionBlock`:** clear judge when toggling/setting entrant selection
- **`PreferencesPanel` (and any other `setSelectedEntrant` selection paths):** clear judge when selecting an entrant

## Testing

- Manual: toggle judge → header rings and entrant selection clears; toggle session `•` → session highlights and judge ring clears; Preferences entrant click also clears judge selection
- No new automated tests required for this slice

## Out of scope

- Any judge-selection side effects beyond highlight + mutual clear
- Multi-judge selection
- Changing preference-indicator layout to avoid the bullet

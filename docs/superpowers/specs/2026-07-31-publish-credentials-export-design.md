# Publish credentials follow the export file

**Date:** 2026-07-31  
**Status:** Approved design

## Goal

Make publish identity (code + edit token) travel with the schedule export, not stick permanently to a browser/device. Importing an export restores that identity; complete reset and imports without credentials clear it locally.

## Current behavior

- Credentials live only in `localStorage` under `evalmatrix_publish_credentials` (`getPublishCredentials` / `setPublishCredentials` / `clearPublishCredentials` in `src/utils/publishStorage.ts`).
- JSON export/import (`src/utils/importExport.ts`) round-trips judges, entrants, session blocks, settings, and preference notes — not publish credentials.
- Complete reset clears schedule data and settings but does **not** clear publish credentials.
- Consequence: moving to another device via export/import loses the ability to update the same published code; wiping the schedule can leave a stale code bound to the device.

## Decisions

| Decision | Choice |
|----------|--------|
| Where credentials live in the export | Top-level optional `publish` object |
| Old export missing `publish` | Clear local credentials on import |
| Complete reset | Clear local credentials |
| Reset to Defaults | Do **not** clear credentials |
| Strip-credentials export mode | Out of scope |
| API / public viewer changes | None |

## Export shape

Optional top-level field on `ExportData`:

```json
"publish": {
  "code": "ABC123",
  "editToken": "<48 hex characters>"
}
```

- Included only when the browser currently has valid publish credentials.
- Omitted when never published, or after credentials were cleared.
- Runtime storage remains the existing localStorage key; export mirrors it. Publish / Publish as new continue to write credentials locally as today; the next export picks them up automatically.

## Import behavior

1. Import schedule data as today (settings, judges, entrants, session blocks, preference notes).
2. If `publish` is present with both non-empty `code` and `editToken` → `setPublishCredentials(code, editToken)`.
3. If `publish` is missing, or incomplete/malformed → `clearPublishCredentials()`.
4. Do not fail the whole import solely because `publish` is bad, if the rest of the payload is valid.
5. After import, existing refresh/reload behavior is enough for `PublishControls` to show the restored (or cleared) code.

## Complete reset

In Settings → Complete Reset, after clearing judges, entrants, session blocks, settings, and preference notes, also call `clearPublishCredentials()`.

“Reset to Defaults” remains settings-only and does not touch publish credentials.

## Edge cases

- **Publish as new:** Replaces local credentials; subsequent exports include the new `publish` block with no extra wiring.
- **Security:** Anyone with the export file can update that published schedule. Acceptable for this product — the file is a full backup including ownership. Document in the admin guide; no special export UI warning required.
- **Out of scope:** Separate credentials companion file; optional “export without token” mode; changes to publish API or public pages.

## Implementation touchpoints

- `src/utils/importExport.ts` — extend `ExportData`; include credentials in `generateExportData`; set/clear on `importData`.
- `src/components/SettingsModal.tsx` — clear credentials in `handleCompleteReset`.
- `public/Administrative-User-Guide.md` — document that export includes publish identity, complete reset clears it, and import restores or clears it (replace the current note that complete reset does not clear publish credentials).

## Success criteria

- Export after publish contains `publish.code` and `publish.editToken`.
- Import of that file on a clean browser restores the ability to Publish (update) the same code.
- Import of a pre-change export (no `publish`) leaves no local publish credentials.
- Complete reset leaves no local publish credentials; Reset to Defaults does not remove them.
- Public fetch/view and server API behavior unchanged.

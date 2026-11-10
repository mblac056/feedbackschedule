# Publish status, 90-day lifespan, and reserving a code ahead of time

**Date:** 2026-11-10  
**Status:** Draft design

## Goal

Fix three publishing problems without changing what already works: no accounts, code + edit token as ownership, credentials stored locally and carried in the export, and Publish / Publish as new / Preview.

1. Admins can't tell whether the code on screen is live, current, or stale.
2. Published schedules expire after 7 days. That's too short.
3. Admins can't claim a code ahead of time to share with attendees. Empty schedules can't be published, and a code can only be entered by importing a file.

## Decisions

| Decision | Choice |
|----------|--------|
| Lifespan | Flat **90 days** from last publish (sliding; viewing doesn't extend it) |
| Edit token format | Unchanged (48 hex chars). No shorter typeable token. |
| Placeholder note field | Out of scope |
| Handoff link (token in URL) | Out of scope |
| Payload schema version | Unchanged (`version: 1`). Placeholder = `sessions.length === 0`. |
| Ownership after expiry | Token hash kept for 1 year after expiry; only the original token can reclaim the code |

## Current behaviour (for reference)

- `TTL_MS` = 7 days, `netlify/functions/schedules.ts:7`.
- An expired record is deleted on GET and replaced by any PUT, so anyone can take over an expired code (`schedules.ts:146-149`, `:199-206`).
- Local credentials are `{ code, editToken }` only (`src/utils/publishStorage.ts`). Nothing records what was published or when.
- `PublishControls` shows `Code: ABC-DEF` with no state (`src/components/PublishControls.tsx`).
- Publish is only rendered when `scheduledSessions.length > 0` (`SessionsArea.tsx:319`), and the toolbar only exists once judges exist (`CreatePage.tsx:116`). The server already accepts empty arrays.
- Importing an export with no `publish` block clears local credentials silently (`importExport.ts:78`).

---

## 1. Publish status indicator

### Stored state

Extend local credentials (same localStorage key):

```ts
type PublishCredentials = {
  code: string;
  editToken: string;
  /** ISO, from server response on last successful publish/verify */
  updatedAt?: string;
  /** ISO, from server response */
  expiresAt?: string;
  /** SHA-256 hex of JSON.stringify(parsePublishedSchedulePayload(payload)) at last publish */
  fingerprint?: string;
  /** Session count at last publish; used for the empty-overwrite guard (§3) */
  publishedSessionCount?: number;
};
```

- Missing optional fields = legacy credentials. Status is shown as "Live (status unknown)" until the next publish or status check.
- The export `publish` block carries the same optional fields, so status survives a move to another device.

### Fingerprint

- New `src/utils/publishFingerprint.ts`: `fingerprintPayload(payload) => Promise<string>`. It runs `parsePublishedSchedulePayload` (to normalize field order and drop undefined), then `JSON.stringify`, then `crypto.subtle.digest('SHA-256')`.
- Only the public payload is hashed. Preference notes, unscheduled blocks, and inactive judges don't trigger "out of date". That's intended.
- Recompute on the existing data-change events (debounced ~300 ms).

### States

| State | Condition | Display |
|-------|-----------|---------|
| Up to date | fingerprint matches, not expired | **Live** · ABC-DEF · up to date · expires {date} |
| Out of date | fingerprint differs | **Live, out of date** · ABC-DEF · unpublished changes (Publish button gets primary colour) |
| Reserved | last publish had 0 sessions and current has 0 | **Reserved** · ABC-DEF · nothing published yet · expires {date} |
| Expired | `expiresAt` in the past, or status check returns 404 | **Expired** · ABC-DEF · Publish to restore |
| Changed elsewhere | status check `updatedAt` newer than stored | **Live** · ABC-DEF · updated from another device |
| Unknown | legacy credentials, or status check failed (offline) | **Live** · ABC-DEF |

- Expiry within 14 days: show the date in amber.
- The status line renders whenever credentials exist, even with 0 scheduled sessions (today it's tied to the Publish button).

### Status check (server)

`POST /api/schedules/{code}` with body `{ editToken }`. The function already parses the code from the last path segment; adding a method avoids a new route.

| Result | Response |
|--------|----------|
| Token matches, live | `200 { updatedAt, expiresAt, sessionCount }` |
| Token mismatch | `403` |
| Not found / expired | `404` (tombstone: `404 { expired: true }` if token matches) |

- Rate-limited under the PUT bucket.
- Called once on Create page load (if credentials exist), and by "Use an existing code" (§3b).
- Doesn't extend expiry.
- Add `POST` to `Access-Control-Allow-Methods`.

PUT response also gains `expiresAt` (today it returns only `updatedAt`).

---

## 2. Lifespan

### Server

- `TTL_MS = 90 * 24 * 60 * 60 * 1000`.
- Existing records keep their stored `expiresAt` until their next publish. There's no migration.

### Tombstones (close the takeover gap)

- Add `TOMBSTONE_MS = 365 days`.
- On GET of an expired record: replace it with `{ payload: null, editTokenHash, updatedAt, expiresAt }` instead of deleting it. Return 404 as today.
- On PUT to an expired record:
  - Within `expiresAt + TOMBSTONE_MS`: token must match (403 otherwise). Match restores the code with a fresh 90 days.
  - Past the tombstone window: delete and allow a new owner, as today.
- `parsePublishedSchedulePayload` isn't called on tombstones. GET checks expiry before validating.
- Blob cleanup: none needed beyond the existing lazy behaviour. Tombstones are tiny.

### Renew (dropped)

Built and then removed (2026-11-10). Published schedules are short-lived; 90 days covers the use, and an owner can republish an expired code for up to a year. No Renew action.

### Docs

- Admin guide §17 "Lifetime": 7 → 90 days, describe the 1-year reclaim window.

---

## 3. Reserve a code ahead of time

### 3a. Reserve (publish a placeholder)

- **Settings → Publishing** (new section, next to the existing code prefix input):
  - No credentials → **Reserve a code** button.
  - Credentials present → status (§1), Copy code, Show/copy edit token, Use an existing code.
- **Empty state** (`EmptyState.tsx`, before any judges exist): secondary link "Reserve a code now, add the schedule later" that opens the same flow.
- Reserve = the existing `publishWithNewCode()` with whatever payload `buildPublishedPayload` produces (empty `judges`/`entrants`/`sessions`, current settings, round name). The server already accepts it.
- Prompt for **Feedback Round** name first if it's blank. It's the only thing the placeholder page shows.

### Viewer "coming soon" page

`PublicScheduleHub` when `payload.sessions.length === 0`:

- Show the round name heading, logo, refresh, and QR as today.
- Body: "This feedback schedule hasn't been posted yet. Check back closer to the event."
- Hide the tabs and the PDF button.
- Person URLs under a placeholder 404 as they do today.
- Applies to `/preview` too, so admins can see what attendees will see.

### 3b. Use an existing code (manual entry)

Settings → Publishing → **Use an existing code**:

- Fields: code (formatted `ABC-DEF`), edit token (paste).
- **Verify** calls the status check (§1):
  - 200 → save credentials with `updatedAt`/`expiresAt`, show status.
  - 403 → "That edit token doesn't match this code."
  - 404 → "No live schedule at that code." If the token matches a tombstone, offer "Restore by publishing".
- If credentials already exist for a different code, confirm before replacing: "This browser currently publishes to XYZ-123. Switch to ABC-DEF?"
- **Show edit token** sits behind a click, with a one-line note: "Anyone with this code and token can change the published schedule."

### 3c. Protect a claimed code

| Situation | New behaviour |
|-----------|---------------|
| Import file has no `publish` block, browser has credentials | Ask: **Keep ABC-DEF** (default) or **Clear it** (replaces the silent clear at `importExport.ts:78`) |
| Import file has a *different* code than the browser | Ask: keep current or switch to the file's code |
| **Publish as new** while credentials exist | Confirm: "Attendees may already have ABC-DEF. Publishing as new moves you to a new code; ABC-DEF stays at its last version until it expires." |
| **Publish** with 0 sessions over a code whose last publish had sessions | Confirm: "This will replace the live schedule with an empty 'coming soon' page." |
| **Complete Reset** with credentials | Add to the existing warning: "This also removes this browser's claim on ABC-DEF. Export first to keep it." |

Publish button visibility: show `PublishControls` whenever judges exist, not only when sessions > 0. The empty-overwrite guard above covers the risk.

---

## Out of scope

- Renew (extend expiry without republishing).
- Shorter / typeable edit tokens.
- Placeholder note or custom "coming soon" text.
- Handoff links. Credentials alone can't continue editing; the editable data lives in the export.
- Event-date-based expiry.
- Accounts or server-side lists of a user's codes.

## Files touched

| File | Change |
|------|--------|
| `netlify/functions/schedules.ts` | 90-day TTL, tombstones, POST status check, `expiresAt` in PUT response, CORS methods |
| `src/utils/scheduleApi.ts` | `checkPublishStatus()`, PUT returns `{ updatedAt, expiresAt }` |
| `src/utils/publishStorage.ts` | Extended credential shape (backward compatible) |
| `src/utils/publishFingerprint.ts` | New |
| `src/utils/importExport.ts` | Carry optional fields; return a "credentials conflict" result instead of clearing silently |
| `src/components/PublishControls.tsx` | Status line, Publish-as-new and empty-overwrite confirms |
| `src/components/SessionsArea.tsx` | Render `PublishControls` when judges exist |
| `src/components/SettingsModal.tsx` | Publishing section: reserve, show token, use existing code; Complete Reset warning |
| `src/components/ImportExportModal.tsx` | Keep/clear/switch prompt |
| `src/components/EmptyState.tsx` | "Reserve a code" link |
| `src/components/public/PublicScheduleHub.tsx` | Coming-soon state |
| `public/Administrative-User-Guide.md` | §17 publish, §21 stored data |

## Tests

- `publishFingerprint`: same payload → same hash; field reorder → same hash; notes-only change → same hash.
- `schedules.ts`: 90-day expiry; tombstone blocks a foreign token within window and allows it after; tombstone + matching token restores; POST status 200/403/404.
- `importExport`: missing `publish` with local credentials → conflict result, credentials untouched until resolved; legacy `{code, editToken}` imports cleanly.
- `PublicScheduleHub`: 0 sessions → coming-soon copy, no tabs, no PDF button.
- Status states in `PublishControls`: up to date / out of date / reserved / expired.

## Rollout order

1. Server: TTL, tombstones, status endpoint, `expiresAt` in PUT.
2. Status indicator + fingerprint.
3. Reserve + coming-soon page.
4. Import / Publish-as-new / empty-overwrite / reset guards.
5. Use an existing code.
6. Admin guide.

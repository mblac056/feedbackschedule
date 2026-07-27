# Publish Feedback Schedules — Design Spec

**Date:** 2026-07-27  
**Status:** Approved for planning  
**Stack decision:** Netlify Functions + Netlify Blobs (frontend remains Vite/React SPA on Netlify)

## Problem

Creators build feedback schedules locally today. Public users (typically on phones) need a simple way to open a published, read-only view via a short code — without accounts, and without turning the editor into a multi-user app.

## Goals

- Homepage code entry (`xxx-xxx`) to open a published schedule
- Creator can publish anytime from the editor and see the access code
- Public hub with full-grid PDF link + Entrant / Judge schedule tabs
- Per-person pages with only that person’s information
- Optional settings prefix that pre-fills the first three characters of new codes
- Re-publish updates the same code by default; optional “publish as new”
- Auto-expiry ~7 days after last publish/update
- Lightest managed backend that fits current Netlify hosting

## Non-goals

- User accounts / OAuth
- Real-time collaborative editing
- Storing PDFs in the backend
- Full automated test suite for this feature (manual verification during implementation is enough)
- Changing the core editor UX beyond publish controls and routing

## Architecture

### Frontend routes

| Route | Purpose |
|---|---|
| `/` | Code entry → navigate to published schedule |
| `/create` | Existing editor (current single-page app) |
| `/preview` | Public UI hydrated from **local** editor state (no network publish required) |
| `/preview/:personSlug` | Person page for local preview (same UI as published person page) |
| `/:code` | Published hub (PDF + Entrant/Judge tabs) |
| `/:code/:personSlug` | That person’s schedule only |

Codes always display as `XXX-XXX` (six characters). That shape is relied on to stay distinct from `/create` and `/preview`; no `/s/` prefix.

### Backend

- **Netlify Functions** expose a tiny HTTP API
- **Netlify Blobs** stores one record per schedule code
- Expiry enforced on read (stale → delete + 404). A scheduled sweep of orphans is optional later, not required for v1

### Security model

- Public code grants **read-only** access (obscurity suitable for weekend events, not strong auth)
- Creator holds a secret **edit token** in `localStorage`
- Server stores only an **edit token hash**
- Overwrite and “publish as new” require presenting the raw edit token
- If localStorage code/token is lost, the creator cannot update that code anymore and must publish as new

## Public UI

### Hub (`/:code` and `/preview`)

- Top: button/link to download the **full-grid PDF**
- Tabs: **Entrant Schedules** | **Judge Schedules**
- Each tab lists names; selecting one goes to `/:code/:personSlug` or `/preview/:personSlug`

### Person page (`/:code/:personSlug`)

- Read-only schedule for that entrant or judge only
- Prefer reusing data shaping from existing entrant/judge print views where practical
- Clear navigation back to the hub

### `/preview`

- Same components as the published hub/person UI
- Fed from local schedule state so creators can check the phone experience before publishing

## Data model

### Blob record (per code)

```ts
{
  payload: PublishedSchedulePayload; // hydrate JSON for public UI
  editTokenHash: string;
  updatedAt: string; // ISO timestamp; 7-day expiry measured from this
}
```

### `PublishedSchedulePayload`

A **snapshot** of what the public UI needs — not a dump of all editor localStorage. Include:

- Display/event metadata needed for rendering (e.g. export name, timing settings used for display)
- Judges (id, name, and fields needed for public display such as room/category)
- Entrants (id, name, and fields needed for public display)
- Scheduled sessions sufficient to render personal schedules and the full-grid PDF
- Stable name → slug map (on collision, append a short id suffix)

Exclude editor-only data unless later required for PDF fidelity (e.g. preference notes, unscheduled drafts).

### Codes

- Always exactly 6 characters, displayed as `xxx-xxx`
- Settings **prefix** (optional, exactly 3 chars): only suggests/pre-fills the first three of a **new** code; those characters are still part of the unique code
- Alphabet: unambiguous characters (avoid confusable sets such as `0/O`, `1/I/L`)
- Normalize on input: strip dashes/spaces, uppercase; validate six alphanumeric chars from the allowed alphabet

### Client publish state (localStorage)

- Current published `code` (if any)
- Raw `editToken` for that code
- Optional convenience: last-known display formatting

## Publish flow

1. **First publish** or **Publish as new**
   - Generate code (honor prefix prefill when set)
   - Generate edit token; persist in localStorage; send raw token to API once
   - API stores hash + payload + `updatedAt`
   - UI shows the code prominently (copy-friendly)

2. **Re-publish (default)**
   - Reuse stored code + edit token
   - Overwrite blob payload; refresh `updatedAt` (resets 7-day clock)

3. **Missing local token/code**
   - Cannot overwrite previous code
   - Offer publish as new only

## API

Netlify Functions (paths indicative; exact wiring follows Netlify conventions):

| Method | Path | Behavior |
|---|---|---|
| `GET` | `/api/schedules/:code` | Return payload if present and not expired; else 404. Expired records deleted on read. |
| `PUT` | `/api/schedules/:code` | Create or overwrite. Requires `editToken`. Create fails with conflict if code exists and token does not match. Overwrite requires matching token. |

Request/response bodies stay minimal: code (path), edit token (header or body on write), payload (write), payload (read).

## Error handling

- Invalid code format → inline validation on homepage
- Unknown or expired code → friendly not-found / expired message on `/:code`
- Wrong or missing edit token on republish → block overwrite; offer publish as new
- Code collision on create → regenerate and retry
- Unknown person slug → message + link back to hub
- Publish network failure → clear error; local editor data unchanged

## Operational considerations

- **Netlify SPA redirects:** ensure deep links to `/:code` and `/:code/:personSlug` serve the app (not raw 404)
- **PWA / Workbox:** do not treat schedule API responses as long-lived cache; users should see updates after refresh following a re-publish
- **PDF generation:** client-side from the payload (existing print/PDF helper family); PDFs are not stored in Blobs
- **Privacy:** no emails/phones in payload; code access is share-link style
- **Payload size:** keep the snapshot lean for Blobs and mobile loads

## Out of scope for v1 follow-ups (optional later)

- Scheduled Blob sweep for expired keys
- Showing the edit token for backup/export beyond localStorage
- Authenticated creator accounts
- Live push updates without refresh

## Implementation sketch (for planning)

1. Add routing and split current `App` into `/create`
2. Build public hub + person views; wire `/preview` to local state
3. Build payload snapshot helper from editor state
4. Add Netlify Functions + Blobs publish/fetch API
5. Add homepage code entry + publish UI in settings/editor
6. Netlify redirects + PWA cache policy for API
7. Manual phone pass on hub, person page, publish, re-publish, expiry

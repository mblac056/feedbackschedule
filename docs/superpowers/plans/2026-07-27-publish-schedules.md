# Publish Feedback Schedules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let creators publish a read-only feedback schedule to Netlify Blobs and let phone users open it via a six-character `xxx-xxx` code.

**Architecture:** Keep the Vite/React SPA on Netlify. Add `react-router-dom` for `/`, `/create`, `/preview`, `/:code`, and person pages. Snapshot editor state into a lean `PublishedSchedulePayload`, publish via Netlify Functions that store `{ payload, editTokenHash, updatedAt }` in Netlify Blobs. Public pages hydrate from that payload; `/preview` hydrates from local editor state.

**Tech Stack:** React 19, TypeScript, Vite, react-router-dom, Netlify Functions, `@netlify/blobs`, existing jsPDF print helpers, localStorage.

**Spec:** `docs/superpowers/specs/2026-07-27-publish-schedules-design.md`

## Global Constraints

- Codes are always exactly 6 chars, displayed as `XXX-XXX`; no `/s/` route prefix
- Settings prefix (optional, 3 chars) only pre-fills the first three of a **new** code
- Edit token lives in creator localStorage; server stores hash only
- Re-publish overwrites same code by default; “Publish as new” mints a fresh code
- Expiry: 7 days after `updatedAt`, enforced on read
- No automated test suite required; verify manually per task
- Do not dump full editor localStorage into Blobs — publish a lean snapshot only
- PDFs generated client-side; not stored in Blobs

---

## File Structure

| File | Responsibility |
|---|---|
| `src/utils/publishCodes.ts` | Alphabet, normalize/format/validate/generate codes + edit tokens |
| `src/utils/personSlugs.ts` | Stable slugify + collision suffixes |
| `src/types/publishedSchedule.ts` | `PublishedSchedulePayload` and blob record types |
| `src/utils/buildPublishedPayload.ts` | Build snapshot from local judges/entrants/sessions/settings |
| `src/utils/publishStorage.ts` | localStorage for `{ code, editToken }` |
| `src/utils/scheduleApi.ts` | Browser client for GET/PUT `/api/schedules/:code` |
| `src/utils/publishedPdf.ts` | Full-grid PDF download from a payload |
| `src/utils/publishedPersonSchedule.ts` | Derive one person’s display rows from payload |
| `netlify/functions/schedules.ts` | GET/PUT Blobs API + hash + expiry |
| `netlify.toml` | Build, function dir, SPA + API redirects |
| `public/_redirects` | SPA fallback (belt-and-suspenders with `netlify.toml`) |
| `src/pages/HomePage.tsx` | Code entry |
| `src/pages/CreatePage.tsx` | Current `App.tsx` editor moved here |
| `src/pages/PreviewHubPage.tsx` | Hub from local payload |
| `src/pages/PreviewPersonPage.tsx` | Person from local payload |
| `src/pages/PublishedHubPage.tsx` | Hub from API |
| `src/pages/PublishedPersonPage.tsx` | Person from API |
| `src/components/public/PublicScheduleHub.tsx` | Shared hub UI |
| `src/components/public/PublicPersonSchedule.tsx` | Shared person UI |
| `src/components/PublishControls.tsx` | Publish / republish / publish-as-new UI |
| `src/App.tsx` | Router shell only |
| `src/main.tsx` | Wrap with `BrowserRouter` (or keep router in `App`) |
| `src/config/timeConfig.ts` | Add optional `codePrefix?: string` to `SessionSettings` |
| `src/components/SettingsModal.tsx` | Code prefix field |
| `src/components/Header.tsx` | Links to home / preview; create-only actions stay on `/create` |
| `vite.config.ts` | Dev proxy `/api` → Netlify CLI if needed; PWA runtimeCaching for API NetworkOnly |
| `package.json` | Add `react-router-dom`, `@netlify/blobs`, `@netlify/functions` |

---

### Task 1: Code + slug utilities

**Files:**
- Create: `src/utils/publishCodes.ts`
- Create: `src/utils/personSlugs.ts`

**Interfaces:**
- Produces:
  - `CODE_ALPHABET: string`
  - `normalizeCode(input: string): string`
  - `formatCode(normalized: string): string`
  - `isValidNormalizedCode(code: string): boolean`
  - `generateCode(prefix?: string): string`
  - `generateEditToken(): string`
  - `slugifyName(name: string): string`
  - `buildSlugMap(entries: Array<{ id: string; name: string }>): Record<string, string>`  
    Keys are entity ids; values are unique slugs. On collision append `-${id.slice(0, 4)}`.

- [ ] **Step 1: Add `publishCodes.ts`**

```ts
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L

export function normalizeCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function formatCode(normalized: string): string {
  const c = normalizeCode(normalized).slice(0, 6);
  if (c.length <= 3) return c;
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}

export function isValidNormalizedCode(code: string): boolean {
  const c = normalizeCode(code);
  if (c.length !== 6) return false;
  return [...c].every((ch) => CODE_ALPHABET.includes(ch));
}

export function generateCode(prefix?: string): string {
  const rawPrefix = prefix ? normalizeCode(prefix).slice(0, 3) : '';
  const prefixChars = [...rawPrefix].filter((ch) => CODE_ALPHABET.includes(ch)).join('');
  let out = prefixChars;
  while (out.length < 6) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export function generateEditToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export { CODE_ALPHABET };
```

- [ ] **Step 2: Add `personSlugs.ts`**

```ts
export function slugifyName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'person';
}

export function buildSlugMap(entries: Array<{ id: string; name: string }>): Record<string, string> {
  const used = new Set<string>();
  const map: Record<string, string> = {};
  for (const entry of entries) {
    let base = slugifyName(entry.name);
    let slug = base;
    if (used.has(slug)) {
      slug = `${base}-${entry.id.slice(0, 4).toLowerCase()}`;
    }
    let n = 2;
    while (used.has(slug)) {
      slug = `${base}-${entry.id.slice(0, 4).toLowerCase()}-${n++}`;
    }
    used.add(slug);
    map[entry.id] = slug;
  }
  return map;
}
```

- [ ] **Step 3: Manual check**

In a quick Node/browser scratch or temporary console import: `formatCode('ont12a')` → `ONT-12A` only if those chars are in alphabet; `buildSlugMap` with two identical names yields distinct slugs.

- [ ] **Step 4: Commit**

```bash
git add src/utils/publishCodes.ts src/utils/personSlugs.ts
git commit -m "feat: add publish code and person slug helpers"
```

---

### Task 2: Published payload types + builder

**Files:**
- Create: `src/types/publishedSchedule.ts`
- Create: `src/utils/buildPublishedPayload.ts`
- Modify: `src/config/timeConfig.ts` (add `codePrefix?: string`)
- Modify: `src/utils/localStorage.ts` (persist `codePrefix` through get/save settings defaults)

**Interfaces:**
- Consumes: `buildSlugMap`, existing `Judge`, `Entrant`, `SessionBlock`, `SessionSettings`
- Produces:
  - `PublishedSchedulePayload`
  - `buildPublishedPayload(args): PublishedSchedulePayload`

- [ ] **Step 1: Add types**

```ts
// src/types/publishedSchedule.ts
import type { SessionSettings } from '../config/timeConfig';

export interface PublishedJudge {
  id: string;
  name: string;
  category?: 'SNG' | 'MUS' | 'PER';
  roomNumber?: string;
}

export interface PublishedEntrant {
  id: string;
  name: string;
  groupType?: 'Chorus' | 'Quartet' | null;
  roomNumber?: string;
}

export interface PublishedSession {
  id: string;
  entrantId: string;
  entrantName: string;
  type: '1xLong' | '3x20' | '3x10';
  sessionIndex?: number;
  startRowIndex: number;
  endRowIndex: number;
  judgeId: string;
}

export interface PublishedSchedulePayload {
  version: 1;
  exportName?: string;
  settings: Pick<
    SessionSettings,
    'startTime' | 'oneXLongLength' | 'threeX20Length' | 'threeX10Length' | 'moving'
  >;
  judges: PublishedJudge[];
  entrants: PublishedEntrant[];
  sessions: PublishedSession[];
  /** entity id -> slug */
  slugs: Record<string, string>;
  /** slug -> { kind, id } for reverse lookup */
  slugIndex: Record<string, { kind: 'entrant' | 'judge'; id: string }>;
}
```

- [ ] **Step 2: Add `codePrefix` to settings**

In `SessionSettings`:

```ts
codePrefix?: string;
```

In `localStorage.ts` `DEFAULT_SETTINGS`, add `codePrefix: ''`. Ensure `saveSettings` / `getSettings` round-trip it unchanged.

- [ ] **Step 3: Implement builder**

```ts
// src/utils/buildPublishedPayload.ts
import type { Judge, Entrant, SessionBlock } from '../types';
import type { SessionSettings } from '../config/timeConfig';
import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { buildSlugMap } from './personSlugs';

export function buildPublishedPayload(args: {
  judges: Judge[];
  entrants: Entrant[];
  sessionBlocks: SessionBlock[];
  settings: SessionSettings;
}): PublishedSchedulePayload {
  const activeJudges = args.judges.filter((j) => j.active !== false);
  const scheduled = args.sessionBlocks.filter(
    (s) =>
      s.isScheduled &&
      s.judgeId &&
      s.startRowIndex !== undefined &&
      s.endRowIndex !== undefined
  );

  const judgeIds = new Set(scheduled.map((s) => s.judgeId!));
  const entrantIds = new Set(scheduled.map((s) => s.entrantId));

  const judges = activeJudges
    .filter((j) => judgeIds.has(j.id))
    .map((j) => ({
      id: j.id,
      name: j.name,
      category: j.category,
      roomNumber: j.roomNumber,
    }));

  const entrants = args.entrants
    .filter((e) => entrantIds.has(e.id))
    .map((e) => ({
      id: e.id,
      name: e.name,
      groupType: e.groupType,
      roomNumber: e.roomNumber,
    }));

  const slugs = buildSlugMap([
    ...judges.map((j) => ({ id: j.id, name: j.name })),
    ...entrants.map((e) => ({ id: e.id, name: e.name })),
  ]);

  const slugIndex: PublishedSchedulePayload['slugIndex'] = {};
  for (const j of judges) {
    slugIndex[slugs[j.id]] = { kind: 'judge', id: j.id };
  }
  for (const e of entrants) {
    slugIndex[slugs[e.id]] = { kind: 'entrant', id: e.id };
  }

  return {
    version: 1,
    exportName: args.settings.exportName?.trim() || undefined,
    settings: {
      startTime: args.settings.startTime,
      oneXLongLength: args.settings.oneXLongLength,
      threeX20Length: args.settings.threeX20Length,
      threeX10Length: args.settings.threeX10Length,
      moving: args.settings.moving,
    },
    judges,
    entrants,
    sessions: scheduled.map((s) => ({
      id: s.id,
      entrantId: s.entrantId,
      entrantName: s.entrantName,
      type: s.type,
      sessionIndex: s.sessionIndex,
      startRowIndex: s.startRowIndex!,
      endRowIndex: s.endRowIndex!,
      judgeId: s.judgeId!,
    })),
    slugs,
    slugIndex,
  };
}
```

- [ ] **Step 4: Manual check**

With a schedule that has scheduled sessions, call builder and confirm only scheduled people appear and `slugIndex` reverses correctly.

- [ ] **Step 5: Commit**

```bash
git add src/types/publishedSchedule.ts src/utils/buildPublishedPayload.ts src/config/timeConfig.ts src/utils/localStorage.ts
git commit -m "feat: add published schedule payload builder"
```

---

### Task 3: Client publish storage + API helper

**Files:**
- Create: `src/utils/publishStorage.ts`
- Create: `src/utils/scheduleApi.ts`

**Interfaces:**
- Produces:
  - `getPublishCredentials(): { code: string; editToken: string } | null`
  - `setPublishCredentials(code: string, editToken: string): void`
  - `clearPublishCredentials(): void`
  - `fetchPublishedSchedule(code: string): Promise<PublishedSchedulePayload>`
  - `putPublishedSchedule(code: string, editToken: string, payload: PublishedSchedulePayload): Promise<void>`

- [ ] **Step 1: `publishStorage.ts`**

```ts
const KEY = 'evalmatrix_publish_credentials';

export function getPublishCredentials(): { code: string; editToken: string } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; editToken?: string };
    if (!parsed.code || !parsed.editToken) return null;
    return { code: parsed.code, editToken: parsed.editToken };
  } catch {
    return null;
  }
}

export function setPublishCredentials(code: string, editToken: string): void {
  localStorage.setItem(KEY, JSON.stringify({ code, editToken }));
}

export function clearPublishCredentials(): void {
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 2: `scheduleApi.ts`**

```ts
import type { PublishedSchedulePayload } from '../types/publishedSchedule';
import { normalizeCode, isValidNormalizedCode } from './publishCodes';

export class ScheduleApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function fetchPublishedSchedule(code: string): Promise<PublishedSchedulePayload> {
  const normalized = normalizeCode(code);
  if (!isValidNormalizedCode(normalized)) {
    throw new ScheduleApiError(400, 'Invalid code');
  }
  const res = await fetch(`/api/schedules/${normalized}`);
  if (!res.ok) {
    throw new ScheduleApiError(res.status, res.status === 404 ? 'Not found or expired' : 'Fetch failed');
  }
  const data = (await res.json()) as { payload: PublishedSchedulePayload };
  return data.payload;
}

export async function putPublishedSchedule(
  code: string,
  editToken: string,
  payload: PublishedSchedulePayload
): Promise<void> {
  const normalized = normalizeCode(code);
  const res = await fetch(`/api/schedules/${normalized}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editToken, payload }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ScheduleApiError(res.status, text || 'Publish failed');
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/utils/publishStorage.ts src/utils/scheduleApi.ts
git commit -m "feat: add publish credentials storage and schedule API client"
```

---

### Task 4: Netlify Functions + Blobs + redirects

**Files:**
- Create: `netlify/functions/schedules.ts`
- Create: `netlify.toml`
- Create: `public/_redirects`
- Modify: `package.json` (deps + optional `netlify-cli` devDependency)
- Modify: `vite.config.ts` (optional proxy noted below; PWA NetworkOnly for `/api/*` in Task 9)

**Interfaces:**
- Consumes: Blob record shape from spec
- Produces: HTTP GET/PUT at `/api/schedules/:code`

- [ ] **Step 1: Install deps**

```bash
npm install @netlify/blobs @netlify/functions react-router-dom
npm install -D netlify-cli @types/react-router-dom
```

(`@types/react-router-dom` may be unnecessary if types ship with the package — skip if install warns.)

- [ ] **Step 2: Create `netlify/functions/schedules.ts`**

```ts
import type { Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

type BlobRecord = {
  payload: unknown;
  editTokenHash: string;
  updatedAt: string;
};

function normalizeCode(input: string): string {
  return input.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function isValidCode(code: string): boolean {
  return code.length === 6 && [...code].every((ch) => CODE_ALPHABET.includes(ch));
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function tokensEqual(aHex: string, bHex: string): boolean {
  try {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

export default async (req: Request, _context: Context) => {
  if (req.method === 'OPTIONS') {
    return new Response('', { status: 204, headers: corsHeaders() });
  }

  const url = new URL(req.url);
  // Expected path after redirect: /api/schedules/:code or function path with code segment
  const parts = url.pathname.split('/').filter(Boolean);
  const codePart = parts[parts.length - 1] || '';
  const code = normalizeCode(codePart);
  if (!isValidCode(code)) {
    return json(400, { error: 'Invalid code' });
  }

  const store = getStore('published-schedules');

  if (req.method === 'GET') {
    const raw = await store.get(code, { type: 'json' });
    if (!raw) return json(404, { error: 'Not found' });
    const record = raw as BlobRecord;
    if (Date.now() - Date.parse(record.updatedAt) > TTL_MS) {
      await store.delete(code);
      return json(404, { error: 'Expired' });
    }
    return json(200, { payload: record.payload, updatedAt: record.updatedAt });
  }

  if (req.method === 'PUT') {
    let body: { editToken?: string; payload?: unknown };
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Invalid JSON' });
    }
    if (!body.editToken || typeof body.editToken !== 'string' || body.payload === undefined) {
      return json(400, { error: 'editToken and payload required' });
    }

    const existing = (await store.get(code, { type: 'json' })) as BlobRecord | null;
    const incomingHash = hashToken(body.editToken);

    if (existing) {
      if (!tokensEqual(existing.editTokenHash, incomingHash)) {
        return json(403, { error: 'Forbidden' });
      }
    }

    const record: BlobRecord = {
      payload: body.payload,
      editTokenHash: existing?.editTokenHash ?? incomingHash,
      updatedAt: new Date().toISOString(),
    };
    await store.setJSON(code, record);
    return json(200, { ok: true, updatedAt: record.updatedAt });
  }

  return json(405, { error: 'Method not allowed' });
};
```

- [ ] **Step 3: `netlify.toml`**

```toml
[build]
  command = "npm run build"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/schedules/*"
  to = "/.netlify/functions/schedules"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Note: If the function needs the code from the original path, read it from the `x-forwarded` URL or configure the function to parse `Referer`/`x-netlify-original-*`. Prefer this pattern if splat is dropped: set the function to read code from query `?code=` **or** use a Netlify Edge/Function route config. Practical approach that works reliably:

Update the redirect to pass the splat:

```toml
[[redirects]]
  from = "/api/schedules/:code"
  to = "/.netlify/functions/schedules?code=:code"
  status = 200
  force = true
```

And in the function, prefer `url.searchParams.get('code')` over the path segment.

- [ ] **Step 4: `public/_redirects`**

```
/api/schedules/:code  /.netlify/functions/schedules?code=:code  200
/*    /index.html   200
```

- [ ] **Step 5: Fix function to read `code` query param first**

At top of handler after building `url`:

```ts
const code = normalizeCode(url.searchParams.get('code') || parts[parts.length - 1] || '');
```

- [ ] **Step 6: Manual check with Netlify Dev**

```bash
npx netlify dev
```

PUT then GET a schedule; confirm 403 on bad token; confirm response shape `{ payload }`.

- [ ] **Step 7: Commit**

```bash
git add netlify/functions/schedules.ts netlify.toml public/_redirects package.json package-lock.json
git commit -m "feat: add Netlify Blobs schedule publish API"
```

---

### Task 5: Router shell — move editor to `/create`

**Files:**
- Create: `src/pages/CreatePage.tsx` (move current `App` body here)
- Modify: `src/App.tsx` → router only
- Modify: `src/main.tsx` if needed
- Create stub pages: `HomePage`, `PreviewHubPage`, `PublishedHubPage` (minimal placeholders OK until Task 6–7)

**Interfaces:**
- Consumes: existing editor tree
- Produces: working `/create` identical to today’s app; `/` placeholder

- [ ] **Step 1: Install is done in Task 4; import router**

- [ ] **Step 2: Move current `App` component body into `CreatePage.tsx`**

Keep providers that the editor needs (`SettingsProvider` inside CreatePage as today; `EntrantProvider` can stay in `main.tsx`).

- [ ] **Step 3: Replace `App.tsx` with routes**

```tsx
import { Routes, Route } from 'react-router-dom';
import CreatePage from './pages/CreatePage';
import HomePage from './pages/HomePage';
import PreviewHubPage from './pages/PreviewHubPage';
import PreviewPersonPage from './pages/PreviewPersonPage';
import PublishedHubPage from './pages/PublishedHubPage';
import PublishedPersonPage from './pages/PublishedPersonPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/create" element={<CreatePage />} />
      <Route path="/preview" element={<PreviewHubPage />} />
      <Route path="/preview/:personSlug" element={<PreviewPersonPage />} />
      <Route path="/:code" element={<PublishedHubPage />} />
      <Route path="/:code/:personSlug" element={<PublishedPersonPage />} />
    </Routes>
  );
}
```

Declare **static routes before** `/:code` (already ordered above).

- [ ] **Step 4: Wrap with `BrowserRouter` in `main.tsx`**

```tsx
import { BrowserRouter } from 'react-router-dom';
// ...
<BrowserRouter>
  <EntrantProvider>
    <App />
  </EntrantProvider>
</BrowserRouter>
```

- [ ] **Step 5: Temporary stubs for missing pages**

`HomePage`: “Code entry coming soon” + `Link` to `/create`.  
Published/Preview pages: simple “coming soon” text.

- [ ] **Step 6: Manual check**

`npm run dev` → `/create` works like before; `/` shows stub; unknown path that looks like a code hits published stub.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/main.tsx src/pages
git commit -m "feat: add routing and move editor to /create"
```

---

### Task 6: Homepage code entry

**Files:**
- Modify: `src/pages/HomePage.tsx`

- [ ] **Step 1: Implement HomePage**

Behavior:
- Controlled input; as user types, run `formatCode` for display
- On submit, `normalizeCode`; if invalid show inline error; else `navigate(\`/${normalized}\`)` (or formatted path — prefer normalized without dash in URL: `/ONT12A` vs `/ONT-12A`. **Use normalized without dash in the path** for simpler params; display with dashes in UI.)
- Link to `/create` for creators (“Create / edit a schedule”)

```tsx
// Core submit logic
const normalized = normalizeCode(value);
if (!isValidNormalizedCode(normalized)) {
  setError('Enter a six-character code (ABC-DEF).');
  return;
}
navigate(`/${normalized}`);
```

Style: keep existing app colors (`var(--primary-color)`), mobile-first, large input, no card-heavy dashboard look beyond a single focused entry composition.

- [ ] **Step 2: Manual check**

Typing `abc123` formats live; invalid alphabet rejected; valid navigates to `/:code`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/HomePage.tsx
git commit -m "feat: add homepage schedule code entry"
```

---

### Task 7: Shared public hub + person UI

**Files:**
- Create: `src/utils/publishedPersonSchedule.ts`
- Create: `src/utils/publishedPdf.ts`
- Create: `src/components/public/PublicScheduleHub.tsx`
- Create: `src/components/public/PublicPersonSchedule.tsx`
- Modify: `src/pages/PreviewHubPage.tsx`, `PreviewPersonPage.tsx`, `PublishedHubPage.tsx`, `PublishedPersonPage.tsx`

**Interfaces:**
- Consumes: `PublishedSchedulePayload`, `generateMatrixPage` from `printTemplate-matrix.ts` (or adapt), `TIME_CONFIG`, session duration helpers
- Produces: shared hub/person components; pages wire data sources

- [ ] **Step 1: Person schedule helper**

Build display rows for one entrant or judge from payload: time range from `startRowIndex` + settings durations, counterpart name, room based on `moving`, sort by start time. Mirror the columns used in `printTemplate-entrantSchedules.ts` / `printTemplate-judgeSchedules.ts` (time, counterpart, type, room when relevant). Keep this pure TypeScript — no PDF here.

- [ ] **Step 2: PDF helper**

```ts
// publishedPdf.ts — download full grid using payload
import { generateMatrixPage } from './printTemplate-matrix';
// Map payload.sessions + judges + entrants into the shapes generateMatrixPage expects.
// If generateMatrixPage reads localStorage settings internally, either:
//   (a) temporarily unacceptable — refactor generateMatrixPage to accept settings/entrants args, or
//   (b) add generateMatrixPageFromPayload that duplicates the minimal matrix path with explicit args.
```

**Required refactor if needed:** update `generateMatrixPage` to accept optional `entrants` / `settings` arguments instead of only reading localStorage, so public pages work without creator localStorage. Prefer optional params with localStorage fallback to avoid breaking `/create` exports.

- [ ] **Step 3: `PublicScheduleHub`**

Props:

```ts
type Props = {
  payload: PublishedSchedulePayload;
  personBasePath: string; // '/preview' or `/${code}`
  title?: string;
};
```

UI:
- Title = `payload.exportName` or “Feedback Schedule”
- Button: “Download full grid PDF” → `downloadPublishedMatrixPdf(payload)`
- Tabs: Entrants | Judges
- Filtered list of names (simple text filter input)
- Each name `Link` to `${personBasePath}/${slug}`

- [ ] **Step 4: `PublicPersonSchedule`**

Props: `payload`, `personSlug`, `hubPath`.  
Lookup `slugIndex[personSlug]`; if missing show not-found + link to `hubPath`.  
Else render name heading + schedule table from helper.

- [ ] **Step 5: Wire pages**

- `Preview*`: `buildPublishedPayload` from `getJudges()`, `getEntrants()`, `getSessionBlocks()`, `getSettings()`
- `Published*`: `useParams().code` → `fetchPublishedSchedule`; loading / error / expired states

- [ ] **Step 6: Manual check**

With local data, `/preview` lists people; person page shows sessions; PDF downloads. With API (netlify dev), published pages load after a manual PUT.

- [ ] **Step 7: Commit**

```bash
git add src/components/public src/utils/publishedPersonSchedule.ts src/utils/publishedPdf.ts src/pages src/utils/printTemplate-matrix.ts
git commit -m "feat: add public schedule hub and person views"
```

---

### Task 8: Publish controls + settings prefix

**Files:**
- Create: `src/components/PublishControls.tsx`
- Modify: `src/pages/CreatePage.tsx` (render publish controls — Header area or Settings-adjacent)
- Modify: `src/components/SettingsModal.tsx` (code prefix field)
- Modify: `src/components/Header.tsx` (link to `/preview`, maybe home; keep editor actions)

- [ ] **Step 1: Settings — code prefix**

Add input maxLength 3, uppercase, filtered to `CODE_ALPHABET`. Save as `codePrefix` on settings save.

- [ ] **Step 2: `PublishControls`**

State: busy, error, lastPublishedCode (from credentials).

Actions:
1. **Publish / Update**  
   - Build payload  
   - If credentials exist → `putPublishedSchedule(code, token, payload)`  
   - Else → `generateCode(settings.codePrefix)`, `generateEditToken()`, PUT; on 409/collision regenerate up to ~5 times; `setPublishCredentials`  
   - On 403 → show error + suggest Publish as new  
2. **Publish as new**  
   - Always generate new code/token; save credentials; PUT  
3. Show formatted code with copy button + link to `/${code}`

Place controls in Header (create-only) or a compact bar under Header on `CreatePage`.

- [ ] **Step 3: Header links**

On create: “Preview public view” → `/preview`. Logo or secondary link → `/`.

- [ ] **Step 4: Manual check**

Publish → code shown → open in phone browser / other profile → hub works. Change schedule → Publish updates same code. Publish as new → new code; old still works until expiry. Clear site data → cannot overwrite; Publish as new works.

- [ ] **Step 5: Commit**

```bash
git add src/components/PublishControls.tsx src/components/SettingsModal.tsx src/components/Header.tsx src/pages/CreatePage.tsx
git commit -m "feat: add publish controls and code prefix setting"
```

---

### Task 9: PWA cache policy + polish polish

**Files:**
- Modify: `vite.config.ts`
- Modify: public pages error copy if needed
- Modify: `README.md` only if you already document deploy steps (optional; skip if out of scope)

- [ ] **Step 1: Workbox NetworkOnly for API**

In `VitePWA` `workbox.runtimeCaching`, add:

```ts
{
  urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
  handler: 'NetworkOnly',
},
```

- [ ] **Step 2: Confirm SPA deep links**

Deploy preview or `netlify dev`: hard-refresh `/ONT12A` and `/ONT12A/some-slug` must load the app.

- [ ] **Step 3: Expiry sanity**

Temporarily set `TTL_MS` to a short value locally, PUT, wait, GET → 404; restore 7 days.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "fix: avoid caching published schedule API responses in the PWA"
```

---

### Task 10: End-to-end manual pass

No code unless bugs found.

- [ ] **Step 1: Creator path**

`/` → `/create` → build schedule → Settings prefix `ONT` → Publish → code starts with ONT → copy code → Preview looks right → Publish again → same code.

- [ ] **Step 2: Public path**

Open code on phone → PDF → Entrant tab → person page → back → Judge tab → person page. Re-publish from desktop → refresh phone → changes visible.

- [ ] **Step 3: Failure path**

Bad code on home; expired/missing code message; clear localStorage and confirm overwrite blocked with Publish as new offered.

- [ ] **Step 4: Final commit only if fixes were needed**

---

## Spec coverage checklist

| Spec item | Task |
|---|---|
| `/` code entry | 6 |
| `/create` editor | 5 |
| `/preview` + person | 7 |
| `/:code` hub + person | 7 |
| PDF full grid | 7 |
| Entrant/Judge tabs | 7 |
| Prefix in settings | 8 |
| Same code republish + publish as new | 8 |
| Edit token localStorage | 3, 8 |
| Blobs + Functions API | 4 |
| 7-day expiry on read | 4 |
| Lean payload | 2 |
| Netlify SPA redirects | 4 |
| PWA no API cache | 9 |
| No automated tests | honored throughout |

## Self-review notes

- No TBD placeholders left; collision retry and 403 → publish-as-new are specified in Task 8.
- `generateMatrixPage` may need a small refactor in Task 7 — called out explicitly.
- Function code query-param redirect pattern avoids splat loss on Netlify.
- Types `PublishedSchedulePayload` stay consistent across client and API (API treats payload as opaque JSON).

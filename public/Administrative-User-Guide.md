# Feedback Schedule — Administrative User Guide

**Site:** [feedbackschedule.com](https://feedbackschedule.com)  
**Audience:** Barbershop administrative judges building evaluation / feedback schedules  
**Open source:** [github.com/mblac056/feedbackschedule](https://github.com/mblac056/feedbackschedule)

This guide walks through the full product: from an empty browser tab to printed reports and phone-friendly published schedules for judges and entrants. It is written for BHS-style contest feedback options (1xLong / 3x20 / 3x10 feedback), but the same workflow applies anywhere you need preference-aware eval grids.

---

## Table of contents

1. [Introduction](#1-introduction)
2. [Install the app (PWA)](#2-install-the-app-pwa)
3. [Home page and navigation](#3-home-page-and-navigation)
4. [Create page overview](#4-create-page-overview)
5. [Settings](#5-settings)
6. [Importing contest data](#6-importing-contest-data)
7. [Managing judges](#7-managing-judges)
8. [Managing entrants](#8-managing-entrants)
9. [What the tool assumes, and what it doesn’t](#9-what-the-tool-assumes-and-what-it-doesnt)
10. [Populate Grid](#10-populate-grid)
11. [Evaluation Preferences panel](#11-evaluation-preferences-panel)
12. [Working the grid](#12-working-the-grid)
13. [Alerts and critical conflicts](#13-alerts-and-critical-conflicts)
14. [Export and backup](#14-export-and-backup)
15. [Printable reports](#15-printable-reports)
16. [Preview and publish](#16-preview-and-publish)
17. [Published hub and person pages](#17-published-hub-and-person-pages)
18. [Live session timer and sounds](#18-live-session-timer-and-sounds)
19. [Keyboard shortcuts and tips](#19-keyboard-shortcuts-and-tips)
20. [Data stored in this browser](#20-data-stored-in-this-browser)
21. [End-to-end checklist](#21-end-to-end-checklist)
22. [Questions and expertise](#22-questions-and-expertise)

---

## 1. Introduction

Feedback Schedule helps you build visual feedback session grids for a contest weekend: judges, entrants, preferences, drag-and-drop placement, conflict checks, printable packets, and shareable links.

### No account required

- **No login**
- **No password**
- Anyone can open the site and start building

Work in progress lives in **this browser’s local storage**. It does not sync to the cloud until you **Publish**. Another computer, phone, or browser profile will not see your unpublished schedule unless you **export a JSON file** and import it there.

### Devices

The site is **responsive**. You can drive it on a phone in a pinch, but the scheduling grid is designed for a **laptop or desktop with a mouse** (drag, marquee select, preferences panel). Use a larger screen when you are building; use phones for *viewing* published schedules.

### Design philosophy

The tool will schedule **what you ask it to schedule**. It will not invent contest parameters for you (finals cutoffs, chorus-only blocks, district protocols). It will show **trade-offs** (preference hits and misses, avoid-list conflicts, yellow alerts, red physics problems) so you can justify creative decisions with evidence. You’re still the expert for everything that doesn’t fit in a spreadsheet.

---

## 2. Install the app (PWA)

Feedback Schedule is a **Progressive Web App**. Installing it is optional but recommended for administrators.

### Why install

| Benefit | Detail |
|---------|--------|
| Dedicated icon | Launch like a normal app from the dock / home screen |
| Offline editor | App shell and assets are cached so you can keep working on a saved local schedule without connectivity |
| Auto-update | When you open the app **online**, it will load the latest version if one has shipped |

### How to install

- **Chrome / Edge (desktop):** address-bar install icon, or browser menu → **Install Feedback Schedule**
- **Safari (iPhone / iPad):** Share → **Add to Home Screen**
- **Android Chrome:** menu → **Install app** / **Add to Home Screen**

### Update prompts (create page)

While using Create, you may see:

- **App ready to work offline** — cache is prepared  
- **New version available!** → **Update** or **Later**

### Offline limits

- Local create/edit can work from cache + localStorage  
- **Published** codes (shared hub / person pages) require the network; they are not cached for offline viewing  

---

## 3. Home page and navigation

The home page is for **viewers** (and for admins jumping into create).

| Control | Behavior |
|---------|----------|
| **Schedule code** field | Placeholder `ABC-DEF`; formats as two groups of three; uppercases letters |
| **View schedule** | Opens the published hub for that six-character code |
| **Create a schedule** | Opens the admin editor (`/create`) |
| Footer **Open Source** | Links to the GitHub repository |

Invalid codes show: **Enter a six-character code (ABC-DEF).**

---

## 4. Create page overview

The create page is the admin workspace. Until at least one judge exists, you see the empty-state import for the Assignments Report. After that, the main layout appears.

### Header controls

| Control | What it does |
|---------|----------------|
| **Feedback Schedule** (brand) | Returns to the home / code-entry page |
| **Manage Entrants** | Roster, preferences, Include checkboxes |
| **Manage Judges** | Categories, rooms, active/inactive |
| **Import/Export** | Full JSON backup and restore (shortcut **E**) |
| **Settings** | Round name, movement, times, lengths, publish prefix |
| Theme toggle | Light / dark mode (create page; preference is remembered) |
| **Refresh** | Reloads the page |

On narrow screens the same actions live in the hamburger menu.

### Main toolbar (once judges exist)

| Control | What it does |
|---------|----------------|
| **Populate Grid** | Auto-places unscheduled sessions (only when nothing is scheduled yet) |
| **Clear Grid** | Unschedules everything after confirm; session *blocks* remain in Unassigned |
| **Print** | Prints the Feedback Matrix; disabled if any **red** conflict exists |
| Print dropdown | Other reports (see [Printable reports](#15-printable-reports)) |
| **Publish** | Shareable code / preview (see [Preview and publish](#16-preview-and-publish)); disabled on red conflicts |
| **Session Format** | Shows current movement mode (color-coded) — **Groups moving to Judges** or **Judges moving to Groups** |
| **Total Length** | Span from earliest to latest session; turns **red if over 120 minutes** |

Below the toolbar: conflict banners (if any), the time × judge **grid**, and **Unassigned Sessions**.

---

## 5. Settings

Open **Settings** from the header.

| Setting | Purpose |
|---------|---------|
| **Feedback Round** | Human label for this schedule (example placeholder: `2027 Spring ONT Quartet Finals`). Used in export filenames, print titles, and the published hub heading |
| **Publish code prefix** | Optional ≤3 alphanumeric characters stuck on the front of new publish codes. Remaining characters are random (avoiding 0/O/1/I/L) |
| **Movement** | **Judges visit groups** or **Groups visit judges**. Controls which side “owns” rooms on the matrix and printouts |
| **Feedback Start Time** | Clock time for the top of the grid (also editable by clicking the first time-slot label on the far left of the grid) |
| **1XLong Length (minutes)** | Default **40** |
| **3X20 Length (minutes)** | Default **20** |
| **3X10 Length (minutes)** | Default **10** |

### Validation and resets

- Lengths must be **multiples of 5**, and **3X10 &lt; 3X20 &lt; 1XLong**  
- Changing lengths shows **Warning: Scheduling Grid Reset** — the grid will be cleared (export first if you care about placements)  
- **Reset to Defaults** — settings only  
- **Complete Reset** — deletes judges, entrants, session blocks, settings, and preference notes in this browser, then reloads. It does **not** clear your theme preference or stored publish credentials  

When you save entrants after a roster that is mostly choruses or mostly quartets, you may also be prompted to **Switch Movement** (or keep the current mode). That prompt is advisory convenience, not a hard rule.

---

## 6. Importing contest data

You can enter or edit everything by hand. For a real contest, CSV import is faster.

### Assignments Report → Judges

Shown on the empty create page as **Import Judges from CSV**.

- Drag and drop or browse  
- Expects an **Assignments Report** CSV  
- Imports **Official** judges in categories **MUS / PER / SNG**  
- Required columns include **Name**, **Type**, **Category**  
- Success may report how many rows were imported vs filtered out  

### DRCJ Report → Entrants

**Manage Entrants** → **Import Entrants** → **Import Entrants from CSV**.

- Expects **DRCJ Report** format (Group Name, OA, Shared Members, and related columns)  
- Missing **Group Name** fails loudly  

### Eval Preferences → Preferences

**Manage Entrants** → **Import Preferences**.

- Disabled until at least one judge exists (**No judges in the system yet**)  
- Expects the preferences submission CSV (group name, groups to avoid, eval type, 1st/2nd/3rd choice, etc.)  
- Results dialog summarizes **Entrants Updated**, **Not Found**, **Rows Skipped**, warnings, and what changed  

**Tip:** Import judges first, then entrants (both quartets and choruses), then preferences, so judge-name matching works.

---

## 7. Managing judges

**Manage Judges** — add, edit, remove.

| Field | Notes |
|-------|-------|
| **Name** | Display name on grid and reports |
| **Category** | SNG / MUS / PER |
| **Room** | Used when groups move to judges |
| **Active** | Inactive judges are hidden from the grid; closing the modal **unschedules** their sessions |

Empty state copy points you back to CSV import on the main page if you have no judges yet.

Unsaved changes warn before close: **Are you sure you want to close without saving?**

On the grid, judge headers show:

- Name and category  
- Room (when relevant for movement mode)  
- Assigned duration, or **No sessions**  
- Preference badges (**1** / **2** / **3**) when an entrant is selected  

You can **drag judge headers** to reorder columns while editing. That order is for experimentation; **Populate Grid** rebuilds pods and will rearrange judges again.

---

## 8. Managing entrants

**Manage Entrants** is the roster and preference worksheet.

### Toolbar and filters

- **Add Entrant**, **Import Entrants**, **Import Preferences**, **Save & Close**, **Close**  
- **Entrants to Display:** **All** / **Choruses** / **Quartets**  
- Count of selected vs total when filtering  

### Columns

| Field | Purpose |
|-------|---------|
| **Include** | Whether this group gets session blocks for *this* feedback round. Header checkbox can select all eligible rows in the current filter. Disabled when Preference is **None** |
| **Name** | Group name |
| **Group Type** | Chorus or Quartet |
| **Score** | Contest score. Sorting by Score **rewrites persisted priority order** |
| **Groups to Avoid** | Bidirectional avoid list (shared members, etc.). Type a name and press Enter or pick a suggestion; remove with × |
| **Preference** | Preferred session type: **1xLong**, **3x20**, **3x10**, or **None** (None clears Include) |
| **Judge 1 / 2 / 3** | First through third choice judges |
| **Eval Only** | Displayed from import when present (TRUE/FALSE); not a free-edit workflow field |
| **Room** | Used when judges visit groups |
| **Performers** | Headcount — helps you reason about room capacity |
| **O/A Semi-Final / O/A Final** | Order of appearance for judge schedules and related printouts |
| Delete | Remove the entrant |

### Priority order

Populate and preference-aware placement respect entrant **order**.

- **Drag rows** in Manage Entrants (and in the Preferences panel) to set priority  
- **Sort by Score** also **reprioritizes** and saves that order  
- Sorting other columns is for browsing and does **not** change priority  

### Saving Include

- Checking **Include** generates that group’s session blocks (from Preference) into **Unassigned Sessions**  
- Unchecking removes those blocks  

If no one is Included yet, Unassigned shows **No entrants included in schedule yet.**

---

## 9. What the tool assumes, and what it doesn’t

### No implicit contest “sessions”

The software does **not** know:

- That all choruses sing in one contest session  
- That only the top N quartets advance to finals  
- Your district’s local feedback protocols  

**You** choose who is **Include**d and which session types they get. Then the tool places them.

### Guardrails, not a straitjacket

It will not force a particular philosophy, and it will not stop creative layouts unless they break physical possibility (true double-booking). Yellow alerts are “you should look at this.” Red conflicts are “you cannot print or publish until this is fixed.” Preference reds are “here’s the cost of this choice”—not a fail grade.

---

## 10. Populate Grid

Once judges exist and the right people are **Include**d:

1. Put entrants in the priority order you care about  
2. Click **Populate Grid**

### What it does

- Clears scheduled placements and runs a **pod-based** algorithm (same family of idea as BuildEvalMatrix)  
- Groups 3x10 / 3x20 into pods that rotate through sets of three judges  
- Places **1xLong** onto judges with remaining capacity  
- Tries **1st → 2nd → 3rd** judge preference, with conflict-aware fallbacks  
- May leave algorithmic **bye** gaps for judges (those appear as BYE rows on prints and public schedules, not as blocks on the create grid)  
- **Does not change** session types — only *where* existing blocks are placed  

### When the button appears

- **Populate Grid** — only if nothing is currently scheduled  
- If the grid already has placements, use **Clear Grid** (confirm dialog), then Populate again  

### Clear Grid

Confirmation: **Are you sure you want to clear the grid? This action cannot be undone.**  
Sessions return to **Unassigned**; types and entrant data remain.

### Build from scratch instead

Populate always uses the pod approach. If the venue allows a non-pod layout, clear the grid and drag from **Unassigned Sessions** yourself. You still get conflict banners, preference feedback, print, and publish.

---

## 11. Evaluation Preferences panel

Open with the side tab or by pressing **P**.

### Summary pills (also on the closed tab)

| Pill | Meaning |
|------|---------|
| **Good/Assigned** (green) | No group-to-avoid conflict / preferred type / preferred assignment (no differentiation for 1st, 2nd, and 3rd choice judge, so the goal is not necessarily to maximize this number as much as it is to find the best balance) |
| **Conflicts** (red) | Group-to-avoid issue or non-preferred type |
| **Unassigned/Mismatched** (gray) | Neutral |

These counts give a **broad overview** without opening the full panel.

### Table columns

**#**, **Name**, **Groups to Avoid**, **Preference**, **Judge 1/2/3**, **Byes**

Color cues (approximate):

- Avoid pills: green OK, red dashed = time conflict with that group  
- Preference: green = scheduled type matches preference; red = mismatch  
- Judges: green = that preferred judge is assigned; gray = not; category color dots  
- **Byes**: minutes of gap between first and last session for that entrant (`-` if none)  

### Cross-highlighting with the grid

- Select a group in the panel to find them on the grid  
- Select a group on the grid (session **dot** or click) to see priority / preference context  
- Judge headers show **1 / 2 / 3** badges for the selected entrant’s preferred judges  
- Groups to Avoid for that group are also highlighted on the grid in light blue  

### Drag to reorder

Dragging rows in this panel reorders entrants (and related session block order) in local storage. Useful after you decide “this group needs to get more of their preferences”—reorder, **Clear Grid**, **Populate Grid** again. The algorithm takes order into account.

### Notes and Reminders

Free-text notes autosave. Use them for qualitative constraints the matrix cannot express well, for example:

- Early feedback slot needed  
- 1xLong with a SNG judge  
- Different feedback type in semis vs finals  

These notes are included in the **Preference Check** PDF.

### Resize

On desktop, drag the panel’s left edge to widen or narrow it (within a sensible min/max).

---

## 12. Working the grid

### Time axis

- About **3.5 hours** of slots in **5-minute** increments  
- Thicker lines on the hour  
- Click the **first time label** to edit the grid start (`HH:MM`, Enter to save, Escape to cancel). Tooltip: **Click to edit start time**  

### Session blocks

- Show entrant name (and room when judges visit groups)  
- Bottom-left **•** selects / deselects that entrant for highlighting  
- **Right-click (context menu):** **Change to 1xLong / 3x20 / 3x10** — rebuilds that entrant’s blocks and **unschedules** them so you can place or Populate again  
- Colors: default gray; selected blue; avoid-related highlight; yellow/red conflict styling  

### Dragging

| Action | Result |
|--------|--------|
| Drag from **Unassigned** onto a cell | Schedule at that time/judge (amber preview; blocked if illegal) |
| Drag a scheduled block | Move it |
| Drop on **Unassigned** | Unschedule (**Drop here to unschedule session**) |
| Hover another **same-type** scheduled block ~1 second, then drop | **Swap** positions (amber pulse while armed) |
| Drag empty grid area | Marquee multi-select (sky rectangle / rings) |
| Drag one selected block | Move the whole selection together |

While dragging/selecting a group you typically see:

- That group’s other sessions highlighted  
- Groups they conflict with highlighted  
- Preferred judges badged on headers  

You can often optimize **without** opening Preferences—everything you need is painted on the grid.

### Unassigned Sessions

Pool of Included groups not currently on the timeline. Empty copy: **No entrants included in schedule yet.** Context menu for type changes works here too.

### Judge load

Each judge header shows how much time is assigned. **More than 120 minutes** raises a yellow alert. **Total Length** for the whole event also warns in red past two hours of span.

### Changing types mid-stream

1. Context-menu change type (block goes unscheduled)  
2. Either place manually, or Clear + Populate  
3. Remember: Populate never invents types; it only places the types you already set  

---

## 13. Alerts and critical conflicts

Banners appear above the grid. Together with the Preferences panel, they let you get creative while still **quantifying** trade-offs.

### Critical Scheduling Conflicts (red) — stop Print & Publish

| Example message | Meaning |
|-----------------|---------|
| **{name} has overlapping sessions** | Same entrant in two places at once |
| **Room {n} has overlapping sessions** | Hard room double-book (when judges visit groups; longer sessions overlapping) |

Fix these before distributing paper or publishing a code.

### Scheduling Alerts (yellow) — advisory

These will not block Print/Publish. Change them for protocol if you want; they will not stop you.

| Example message | Meaning |
|-----------------|---------|
| **{name} is receiving multiple feedback sessions in the same category ({SNG\|MUS\|PER})** | Same category twice |
| **Sessions ending after 1am for: …** | Schedule runs very late relative to start |
| **Room {n} has overlapping 3x10 sessions** | Softer room overlap (3x10s) |
| **Room {n} may need transition time added before group {name}** | Tight gap (within ~10 minutes) that may need padding |
| **Judge {name} is scheduled for {Xh Ym} of sessions** | Judge load over **2 hours** |

Preference-panel reds (avoid conflicts, mismatched types) are a separate, always-visible trade-off view. **Zero red is not always possible.** The goal is awareness, not a perfect score.

---

## 14. Export and backup

**Import/Export** (header or **E**).

### Export

- **Export to File** downloads JSON: judges, entrants, settings, session blocks, preference notes  
- Filename: `{Feedback Round}-{YYYYMMDD-HHMM}.json`  
- Success: **Data exported successfully!**  

### Import

- **Choose File to Import** — `.json` only  
- **Replaces all current data**, then reloads after a short success message  
- Bad files: **Failed to read file…** / structure errors  

### Best practice

1. Keep a **base contest file** (judges + full roster + preferences)  
2. Duplicate / re-import and carve each feedback round (quartet semis, quartet finals, chorus, etc.) from that base  
3. Export again after major edits **before** Complete Reset or length changes  

Email the JSON to a colleague for review or co-editing. They import on their machine (full replace).

---

## 15. Printable reports

Available when sessions exist and **no red conflicts**. The main **Print** button always prints the **Feedback Matrix**. The dropdown opens one report at a time:

| Report | Contents |
|--------|----------|
| **Feedback Matrix** | Full time × judge grid (`Schedule Matrix` + Feedback Round). Cells show name and duration; judge rooms when groups move. Legal landscape |
| **Judge Schedules** | One page per judge. Time, entrant (`*` = first preference), session type, room/O/A as applicable, **BYE** rows |
| **Entrant Schedules** | One page per entrant. Time, judge (with category), type, room when relevant, **BYE** rows |
| **Entrant Sched. Labels** | Avery-style labels (~10 per page): name, room, timed judge lines |
| **Flow Document** | Minute-by-minute operational flow: starts, moves, finishes, byes, five-minute notices, **(ROOM MISSING)** flags when needed |
| **Feedback Announcements** | Groups clustered by first start — bullet list with room (or TBD) for reading aloud / posting |
| **Preference Check** | Snapshot of the Preferences panel (summary pills, table, byes, **Notes and Reminders**). Expect this in contest reporting packages |

---

## 16. Preview and publish

Publishing uploads the **current** scheduled grid so others can open it with a short code—no admin UI, no login for viewers.

### Before you publish

1. Clear all **red** conflicts  
2. Set **Feedback Round** (hub title)  
3. Optionally set **Publish code prefix** (e.g. district code or similar)  

### Publish menu

Shown when there is at least one scheduled session.

| Action | Behavior |
|--------|----------|
| **Publish** / **Publishing…** | If this browser already published a code, **updates** that code (same edit token). Otherwise mints a new six-character code |
| **Publish as new** | Always creates a **new** code and token (old code remains until it expires) |
| **Preview** | Opens `/preview` using **local** data only — dry run of the public UI without uploading |

After a successful publish you see **Code: ABC-DEF** (link opens in a new tab) plus a **copy** control.

### Common errors

- **Cannot update this schedule (edit token rejected). Use “Publish as new”.** — credentials don’t match the server (different browser, cleared storage, etc.)  
- **Could not publish: too many code collisions** — rare; try again  
- **Publish failed** / not found — network or server issue  

Publish credentials (`code` + edit token) are stored in this browser so **Publish** can update the same code later.

### Lifetime

Published schedules expire **7 days** after last update. Viewers of an expired code see **Schedule not found or expired.** Re-publish (or Publish as new) if the event window is longer.

### Preview vs published

| | Preview | Published |
|--|---------|-----------|
| Data | This browser’s localStorage | Server snapshot for the code |
| URL | `/preview`, `/preview/{person}` | `/{code}`, `/{code}/{person}` |
| For the venue? | No — admin dry run | Yes — share code, link, or QR |
| Back link | **← Back to create** | Hub / home for entering another code |

---

## 17. Published hub and person pages

### Hub (`/{code}` or `/preview`)

- Title: Feedback Round name, or **Feedback Schedule**  
- **QR code** button → dialog **Scan to open schedule** (shows the URL; Escape or backdrop closes)  
- **Refresh** reloads the page  
- **Download full grid PDF** (matrix-style packet; **Preparing PDF…** while working)  
- Tabs: **Entrant Schedules** / **Judge Schedules** (judges listed as `Name (CAT)`)  
- Empty: **No scheduled people yet.**  

### Person page

- **Feedback Schedule for {name}**  
- **Room:** and **Session Type:** when that person has a single fixed room / uniform type  
- Table columns as needed: **Time**, **Judge** or **Entrant**, **Session Type**, **Room**, **O/A**  
- Gap rows appear as italic **BYE (N min)**  
- **← Back to schedule** returns to the hub  
- Preview also offers **← Back to create**  

Errors: **Loading schedule…**, **Person not found.**, **No sessions scheduled.**, load/expiry messages as on the hub.

---

## 18. Live session timer and sounds

On person pages, when wall-clock time falls inside a real (non-bye) session:

### Countdown

- Appears **above** the timetable  
- Label **Current session**, large remaining time, counterpart name and time range  
- **Normal** (&gt; 5 minutes): plain text, no box  
- **Warning** (≤ 5 minutes): yellow box  
- **Critical** (≤ 2 minutes): red box  

### Screen Wake Lock

While a countdown is active, the page requests a **screen wake lock** (supported browsers) so the phone is less likely to sleep mid-session. Leaving the session window releases it.

### Sounds (judge schedules only)

Top-right of the timer:

| Control | Behavior |
|---------|----------|
| Single click | Toggle sounds on/off (default **off**) |
| Double-click | Demo: warning tone, **3 second** pause, done tone |

When enabled:

- **Warning** (~2s ascending just barbershop seventh): at **5:00** remaining for `3x20` / `1xLong`, or **2:00** for `3x10`  
- **Done** (~5s descending barbershop seventh): when that session ends  

Browsers require a user gesture to unlock audio—that’s why the toggle exists. Thresholds that already passed while muted are **not** replayed when you turn sound on later (only fresh crossings fire).

Entrant person pages show the countdown and wake lock but **not** the sound button.

---

## 19. Keyboard shortcuts and tips

| Shortcut | Where | Action |
|----------|-------|--------|
| **P** | Create (not while typing in a field) | Toggle Evaluation Preferences panel |
| **E** | Create | Open Import/Export |
| **Enter** / **Escape** | Editing grid start time | Save / cancel |
| **Enter** | Groups to Avoid field | Add the matching group |
| **Escape** | QR dialog | Close |

### Practical tips

- Export JSON before **Complete Reset**, length changes, or major Clear + Populate experiments  
- Use **Preview** before the first Publish of the weekend  
- If **Publish** can’t update, use **Publish as new** and retire the old code  
- Preference **Notes** are the place for protocol that isn’t in the CSV or is session-specific in the CSV  

---

## 20. Data stored in this browser

| Storage key (conceptually) | Contents |
|----------------------------|----------|
| Judges | Names, categories, rooms, active |
| Entrants | Full roster and preferences |
| Settings | Start time, lengths, movement, Feedback Round, code prefix |
| Session blocks | Types and placements |
| Preference notes | Notes and Reminders text |
| Theme | Light / dark |
| Publish credentials | Last code + edit token for updates |

**Not** persisted: sound on/off, multi-select state, preferences panel open/width, PWA “Later” dismissals.

Clearing site data in the browser wipes the unpublished schedule. Export first.

---

## 21. End-to-end checklist

1. Install the PWA on the admin laptop; confirm offline / update prompts once online  
2. **Create a schedule**  
3. Import **Assignments Report** (judges)  
4. **Manage Entrants** → import **DRCJ**, then **Eval Preferences**  
5. **Settings:** Feedback Round, movement, start time, lengths, optional publish prefix  
6. Set priority (drag or sort by score); **Include** this round’s groups  
7. **Populate Grid**  
8. Open Preferences (**P**) — review Good / Conflicts / Unassigned; add Notes  
9. Drag, swap, multi-select, and type-change as needed  
10. Clear **red** conflicts; decide which **yellow** alerts you’ll accept  
11. **Export** JSON backup  
12. Print Matrix, Judge/Entrant schedules, Labels, Announcements, Flow, Preference Check as needed  
13. **Preview**, then **Publish**; copy code; generate QR from the hub  
14. Brief judges: open their person link, leave the page up during sessions, optionally enable timer sounds  
15. Re-**Publish** after late changes so phones see the update (within the ~7-day window)  

---

## 22. Questions and expertise

Between alerts, critical conflicts, and the Preferences panel, you can feel confident getting as creative as the venue allows—and still **show the trade-offs** you made.

There will always be considerations that aren’t in the tool. That’s why you’re the expert. Use Notes, manual placement, and your knowledge of the constraints and building logistics to optimize giving people more of what they asked for.

For bugs, ideas, or contributions, use the **Open Source** link in the footer / the GitHub repository.

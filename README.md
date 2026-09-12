# Loreforge

Self-hosted worldbuilding and manuscript workspace, in the spirit of Campfire Writing.
One Node process, one SQLite file, no external services.

## Features

- **Worlds** – any number of separate universes, each with its own modules.
- **Modules** – Characters, Locations, Maps, Encyclopedia, Magic, Items, Species, Cultures,
  Factions, Religions, Philosophies, Systems and Research out of the box. Add your own
  (ships, spells, languages…) with custom panel templates.
- **Panels** – every element is a stack of panels you can add, rename, reorder and remove:
  - _Attributes_ – labelled fields (text, long text, number, choice, link to another element)
  - _Text_ – Markdown with `[[wiki links]]` and autocomplete
  - _List_ – organised named items (personality traits, costs, limitations…)
  - _Statistics_ – numeric values rendered as bars
  - _Links_ – curated connections to other elements with notes
  - _Images_ – galleries by URL
- **Interactive maps** – a Map panel holds an image with draggable pins that link to any element.
  Pan, zoom, hover for a tooltip, click a pin to open its element; linked elements show which maps
  they appear on. A pin whose target has a map of its own is ringed and marked with an arrow, so a
  continent map leads into a city map and that into a district — click in, browser-back out.
- **Images** – upload PNG/JPEG/GIF/WebP straight from any image field; files live under
  `/data/uploads` (or `UPLOADS_DIR`) and are served only to members of the world. Settings shows
  storage usage and unused files.
- **Wiki links & backlinks** – write `[[Name]]` anywhere; every element shows what mentions it.
  Unknown names become red links that create the element with one click.
- **Containment** – any element can sit inside another (a quarter inside a city inside a realm).
  Element pages show the trail up to the outermost parent, and a module whose elements are nested
  lists them as a collapsible tree instead of a flat grid. Cycles and runaway depth are refused.
- **Revision history** – chapters and elements keep the content as it was before each edit, one
  version per ten minutes of work, up to fifty per document. Read any version in place, restore it
  in one click, or pin one with a name so it is never pruned. Chapter versions can be compared: the
  diff matches paragraphs first and then words inside an edited one, so an untouched paragraph stays
  quiet and a reworded sentence shows only the words that moved. Viewers of a shared world can read
  history; only editors can restore.
- **Panel comments** – co-writers can leave notes against any single panel of an element, then
  resolve, reopen or delete them. Editors write, viewers read.
- **Relationships** – labelled, directional edges (`mentor of` / `student of`) plus a
  force-directed relationship map.
- **Timeline** – events with free-form date labels, eras and a numeric sort key, so any
  calendar system works.
- **Writing workspace** – the ✍️ Write entry opens a binder of manuscripts and chapters next to
  a book-like editor with autosave, focus mode, formatting shortcuts and the reference panel.
- **Manuscripts** – books → chapters with status tracking, word counts and a read-through view.
- **Chapter cross-references** – every chapter has a reference panel: point-of-view
  character, location, timeline event and cast, plus a live list of every element
  `[[mentioned]]` in the text with a one-click peek at its attributes and an
  insert-at-cursor element search. Element pages show an "Appears in" list with roles,
  manuscripts get a cast summary and a continuous read-through view, timeline events show
  the chapters told there, and search covers chapters.
- **Full-text search** (SQLite FTS5) across elements, chapters and timeline events with stemming,
  prefix matching, ranked results and highlighted snippets; live suggestions in the sidebar. Tags
  filter elements.
- **Tags** – a tags page lists every tag in the world, sized by use, each linking to its search.
- **Manuscript export** – download a book as **EPUB** or **DOCX**, built in-process with no
  external converter. Headings, emphasis, quotes, lists and scene breaks carry over, and each
  chapter starts a new page.
- **Export and import** – download a world as one JSON file and restore it as a new world.
- **Single sign-on** via OpenID Connect (Pocket ID, Authentik, Keycloak…), optional.
- **Sharing** – per-user worlds; share with others as editor or viewer by email or invite link.

## Writing

**Write** in the sidebar (or _Continue writing_ on the dashboard) opens the workspace on the
chapter you last touched. The left column is the binder: every manuscript and chapter, with
one-click _New chapter_ / _New manuscript_. The middle is the page: title, synopsis, and a serif
editor that grows with the text. The right column is the reference panel: point of view, location,
timeline event, cast, an element search that inserts `[[links]]`, and a live list of everything
mentioned in the chapter with a peek at its details.

- Changes autosave 1.5 s after you stop typing; the status line shows _Unsaved changes_,
  _Saving…_ or _Saved hh:mm_. **Ctrl+S** saves immediately.
- **Ctrl+B** / **Ctrl+I** wrap the selection in bold / italic; the toolbar adds headings, quotes
  and a scene break. Markdown and `[[Name]]` links work as everywhere else.
- **Focus** hides both side columns; the word counter also shows words added this session.
- **History** in the footer lists every earlier version of the chapter with its age, author and
  how much it added or cut, and can diff any version against the live text or against the one
  before it. _Keep this version_ pins the draft you are looking at under a name you choose.
  Restoring records what it replaced first, so a restore is itself undoable.
- Viewers of a shared world are routed to the read-through view instead of the editor.
- Old chapter URLs (`/m/<manuscript>/c/<chapter>`) redirect into the workspace.

## Run it

### Docker Compose, prebuilt image (recommended)

The image is published to GHCR by GitHub Actions on every push to `main`
(`ghcr.io/stanleymejia/loreforge:latest`, amd64 + arm64). You only need the compose file:

```bash
curl -O https://raw.githubusercontent.com/StanleyMejia/LoreForge/main/docker-compose.yml
docker compose up -d
# → http://localhost:3000
```

The database lives in the `loreforge-data` named volume (`/data/loreforge.db`, WAL mode) next to
uploaded images (`/data/uploads/<worldId>/`).
Back it up with `docker run --rm -v loreforge-data:/data -v "$PWD":/backup alpine tar czf
/backup/loreforge-data.tgz -C /data .`, or use the in-app JSON export. To use a bind mount
instead, see the comments in the compose file (the container runs as uid 1000).

While this repository is private, the GHCR package is private too. On the Docker host, log in
once with a personal access token that has `read:packages`:

```bash
echo "$GHCR_TOKEN" | docker login ghcr.io -u StanleyMejia --password-stdin
```

Alternatively make the package public under your profile's Packages settings.

### Backup and restore

Export a world from **Settings → Backup** (or `/w/<world>/export`) and keep the JSON file. Uploaded
images live outside it, under `/data/uploads/<worldId>/`, so copy that directory too if you want the
pictures back. To restore, use **Import a world** on the worlds page: the file is always restored as
a _new_ world, with every id reissued and every cross-reference rewritten, so importing never
touches what you already have. Images resolve when their `uploads` directory was copied across;
anything missing is reported after the import. Revision history is not part of the export: a
restored world starts with a clean history and keeps only its current content.

Behind a reverse proxy, set `ORIGIN` to the public URL (e.g. `https://lore.example.lan`) and
uncomment `PROTOCOL_HEADER` / `HOST_HEADER`.

Configuration is all environment variables:

| Variable                         | Default              | Purpose                                             |
| -------------------------------- | -------------------- | --------------------------------------------------- |
| `ORIGIN`                         | –                    | Public origin; form actions are rejected without it |
| `PORT`                           | `3000`               | Listen port inside the container                    |
| `DATABASE_URL`                   | `/data/loreforge.db` | SQLite file path                                    |
| `BODY_SIZE_LIMIT`                | `25M`                | Max request body (uploads, long chapters)           |
| `UPLOADS_DIR`                    | `<db dir>/uploads`   | Where uploaded images are stored                    |
| `MAX_UPLOAD_MB`                  | `10`                 | Per-file upload limit                               |
| `PROTOCOL_HEADER`, `HOST_HEADER` | –                    | Trust proxy headers                                 |

### Single sign-on with Pocket ID (or any OIDC provider)

Authentication is optional. Leave `OIDC_ISSUER` unset and the instance is open, which is fine
on a trusted LAN. Set it and every page requires a login through your identity provider
(Authorization Code flow with PKCE; sessions are server-side in SQLite).

1. In Pocket ID, add an **OIDC client**: name `Loreforge`, callback URL
   `https://lore.example.lan/auth/callback` (your `ORIGIN` + `/auth/callback`), PKCE enabled.
   Copy the client ID and, if you keep it a confidential client, the secret.
2. Set the environment in your compose file:

   ```yaml
   ORIGIN: https://lore.example.lan
   OIDC_ISSUER: https://id.example.lan # Pocket ID base URL (discovery is automatic)
   OIDC_CLIENT_ID: <client id>
   OIDC_CLIENT_SECRET: <secret> # omit for a public client
   OIDC_PROVIDER_NAME: Pocket ID # label on the login button
   AUTH_ALLOWED_EMAILS: you@example.lan # optional, comma-separated
   AUTH_ALLOWED_GROUPS: writers # optional; adds the `groups` scope
   ```

3. `docker compose up -d`. Sign-out also ends the Pocket ID session when the provider
   advertises `end_session_endpoint`.

With sign-in enabled, worlds belong to the person who created them. The `/healthz` endpoint
stays public for container healthchecks.

### Sharing worlds

Owners share a world from **Settings → Sharing**, either by email or with an invite link.

| Role   | Can                                                                                  |
| ------ | ------------------------------------------------------------------------------------ |
| Owner  | Everything, including sharing, renaming and deleting the world                       |
| Editor | Create and change elements, timeline, manuscripts and element types                  |
| Viewer | Read everything and export; all editing controls are hidden and rejected server-side |

- **By email**: the share is pending until that person signs in for the first time with the
  same email; it attaches automatically.
- **Invite links** (`/invite/<token>`): carry a role and an expiry (1–90 days), can be revoked,
  and count their uses. Opening one while signed in adds you to the world.
- Worlds created before sign-in was enabled show up as **Unclaimed** on the worlds page for
  every user; the first person to claim one becomes its owner.

Access is enforced in one place (`src/hooks.server.ts`): non-members get a 404 for the whole
`/w/<world>` tree, viewers get a 403 on any write or edit page.

| Variable              | Default                | Purpose                                             |
| --------------------- | ---------------------- | --------------------------------------------------- |
| `OIDC_ISSUER`         | –                      | Provider base URL; enables auth when set            |
| `OIDC_CLIENT_ID`      | –                      | Client ID registered at the provider                |
| `OIDC_CLIENT_SECRET`  | –                      | Client secret; omit for a public (PKCE-only) client |
| `OIDC_SCOPES`         | `openid profile email` | Requested scopes                                    |
| `OIDC_PROVIDER_NAME`  | `SSO`                  | Name shown on the login button                      |
| `AUTH_ALLOWED_EMAILS` | –                      | Comma-separated email allowlist                     |
| `AUTH_ALLOWED_GROUPS` | –                      | Comma-separated group allowlist (`groups` claim)    |
| `SESSION_TTL_DAYS`    | `30`                   | Session lifetime, sliding                           |

### Docker Compose, build from source

```bash
git clone https://github.com/StanleyMejia/LoreForge.git && cd LoreForge
sed -i 's|# build: .|build: .|' docker-compose.yml
docker compose up -d --build
```

### Bare metal

```bash
cp .env.example .env      # adjust DATABASE_URL / ORIGIN / PORT
pnpm install
pnpm build
node build                # production server on :3000
```

Development server with hot reload: `pnpm dev`.

Before pushing: `pnpm check` (types), `pnpm lint` (formatting), `pnpm selfcheck` (assertions over
the pure helpers — the revision window, retention, the ancestor walk and the tree builder) and
`pnpm build`.

## Architecture

```
SvelteKit (Svelte 5, TypeScript, Tailwind v4)
└─ adapter-node → single Node process
   └─ better-sqlite3 (WAL) via Drizzle ORM
      └─ migrations in ./drizzle, applied automatically at startup
```

| Path                                    | Purpose                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/db/schema.ts`           | Drizzle schema: worlds, element_types, elements, relationships, links, events, manuscripts, chapters, revisions, comments |
| `src/lib/server/repo/*`                 | All queries. Routes never touch the DB directly.                                                                          |
| `src/lib/server/panels.ts`              | Validation of panel JSON coming from the browser                                                                          |
| `src/lib/types.ts`                      | Panel / field type definitions shared by client and server                                                                |
| `src/lib/tree.ts`                       | Cycle-safe ancestor walk and forest builder for containment                                                               |
| `src/lib/revisions.ts`                  | When a revision is due and which ones may be pruned                                                                       |
| `src/lib/diff.ts`                       | Paragraph-then-word diff, shaped for prose rather than code                                                               |
| `src/lib/server/zip.ts`                 | Minimal ZIP writer (stdlib only) behind both EPUB and DOCX                                                                |
| `src/lib/server/epub.ts`, `docx.ts`     | Manuscript export                                                                                                         |
| `src/lib/defaults.ts`                   | Default modules and their panel templates                                                                                 |
| `src/lib/markdown.ts`                   | Markdown renderer with `[[wiki link]]` extension and HTML sanitising                                                      |
| `src/lib/components/PanelEditor.svelte` | The panel-based element editor (also used for type templates)                                                             |
| `src/routes/w/[world]/…`                | All world-scoped pages; server load + form actions per route                                                              |

### Data model

- `element_types.panels` holds the **template** for a module. Creating an element copies it.
- `elements.panels` holds the element's own panels as JSON, so each element can diverge from
  its template (extra attributes, extra panels) without schema changes.
- `links` is a derived table of `[[wiki links]]` extracted on every save. It powers backlinks
  and the "mentions" edges in the relationship map.
- `relationships` are explicit, user-labelled edges.
- `world_members` maps users (or pending emails) to worlds with a role; `world_invites` are
  link tokens that grant a role on redemption.
- `chapter_refs` holds structured chapter → element references (`pov`, `location`, `cast`);
  text mentions in chapters live in `links` with `source_kind = 'chapter'`.
- `elements.parent_id` is containment: a self-reference cleared (not cascaded) when the parent is
  deleted, so removing a region leaves its cities as top-level elements rather than breaking them.
  Cycles are refused when saving; the tree builder also ignores any that exist, so bad data can
  never hang a page.
- `revisions` stores a snapshot of a chapter or element as it was **before** a save, keyed by a
  polymorphic `doc_id` (like `links.source_id`). A save records one only when the newest is older
  than ten minutes, and rows are never overwritten, so a mistake part-way through a window cannot
  destroy the good text. The first edit therefore captures the document as it was created.
  Retention is fifty per document, pruned in the same call that inserts; rows with a label are
  pinned and exempt. An image referenced only by a revision is not counted as unused, so it
  survives the Settings cleanup until that revision is pruned.
- `comments` hangs off an element and a `panel_id`. Panel ids live inside the panels JSON, so there
  is no foreign key to lean on, and the element save path drops comments whose panel has been
  removed — the same explicit cleanup the derived tables get.

### Schema changes

```bash
# edit src/lib/server/db/schema.ts, then:
pnpm db:generate     # writes a new SQL migration into ./drizzle
```

Migrations run on boot, so a container restart upgrades the database.

## Roadmap ideas

- Comment threads with replies, and comments on chapters as well as element panels
- Letting a viewer of a shared world comment, which needs a deliberate exception to the rule that
  viewers cannot write
- A structural diff for element revisions; today only chapter prose can be compared
- Carrying revision history through export and import
- Remembering a map's pan and zoom when drilling into a child map and coming back
- Images, tables and real Word list numbering in the DOCX export
- Offline-friendly editing with conflict resolution

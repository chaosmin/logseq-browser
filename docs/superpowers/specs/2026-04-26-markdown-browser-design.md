# Markdown Browser — Design Spec

**Date:** 2026-04-26  
**Status:** Approved  
**Stack:** Node.js (Express)

---

## Overview

A lightweight local web server that lets users browse and read Markdown files stored on the server's filesystem via a browser. Read-only. Supports global fuzzy search across file titles and body content.

**Context:** The data source is a Logseq knowledge base managed locally on the OpenClaw server. AI agents update the files locally and push to GitHub; the server always has the latest copy. Multi-device access is via this web interface only — no git sync needed on client devices.

---

## Architecture

### Project Structure

```
markdown-browser/
├── server.js          # Express entry point
├── indexer.js         # File scanner + in-memory index builder
├── watcher.js         # chokidar file watcher for hot index updates
├── logseq.js          # Logseq-specific Markdown preprocessor
├── public/
│   ├── index.html     # Single-page app shell
│   ├── style.css      # GitHub Markdown style + two-column layout
│   └── app.js         # Frontend logic (fuse.js search + hash routing)
└── package.json
```

### API Routes

| Route | Description |
|-------|-------------|
| `GET /` | Serve `index.html` |
| `GET /api/index` | Return full index JSON (title + plain-text excerpt + path) |
| `GET /api/file?path=xxx` | Return rendered HTML for the specified `.md` file |
| `GET /api/tree` | Return directory tree JSON |
| `GET /assets/*` | Proxy serve files from Logseq `assets/` directory |

### Data Flow

1. Server starts → `indexer.js` recursively scans all `.md` files under the configured root directory
2. For each file: run through `logseq.js` preprocessor, extract title (frontmatter `title::`, first `#` heading, or filename), strip Markdown/Logseq syntax from body to get plain text, store in memory array
3. Frontend loads → fetches `/api/index` → initialises `fuse.js` with the index
4. User types in search box → `fuse.js` fuzzy-matches locally (debounced 300ms) → results replace file tree, with matching snippets
5. User clicks a file → frontend requests `/api/file?path=xxx` → server preprocesses with `logseq.js` then renders with `marked` + `highlight.js` → frontend inserts HTML into content pane

---

## Logseq Compatibility

Logseq has a distinct document format that differs from standard Markdown. The `logseq.js` preprocessor handles these differences before rendering.

### Directory Structure

Logseq repos use a fixed layout:

```
<root>/
├── pages/      # All regular pages (*.md)
├── journals/   # Daily notes (named by date, e.g. 2024_01_15.md)
├── assets/     # Images and attachments
└── logseq/     # Logseq internal config — excluded from scanning
```

The file tree in the UI separates **Pages** and **Journals** into two top-level sections. Journals are sorted in reverse-chronological order.

### Preprocessor Rules (`logseq.js`)

| Logseq syntax | Rendered as |
|---------------|-------------|
| `[[Page Name]]` | Clickable internal link → navigates to that page |
| `[[namespace/page]]` | Same, with namespace support |
| `key:: value` (property lines) | Rendered as a small metadata table at the top of the page; excluded from search index body |
| `((block-uuid))` | Grey inline placeholder: `[ref]` with tooltip showing the UUID |
| `{{query ...}}` | Grey block: `[Dynamic query — not supported]` |
| `{{embed ((uuid))}}` | Grey block: `[Embedded block — not supported]` |
| `namespace___page.md` (filename) | Displayed in UI as `namespace/page` |
| `#tag` | Rendered as styled inline tag (no click action in v1) |

### Outline Format

Logseq pages are entirely bullet-point outlines (every line starts with `- `). This is rendered as standard nested `<ul>` lists — which is the correct representation. No special handling needed.

### Assets

Images referenced as `../assets/image.png` in Logseq are served via `GET /assets/*` so they render correctly in the browser.

---

## UI Layout

```
┌─────────────────────────────────────────────────────┐
│  🔍 [Search box, full width, placeholder: "模糊搜索..."]  │  ← Fixed top bar
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│  Pages       │  # Document Title                    │
│    📄 a      │                                      │
│    📄 b      │  Rendered Markdown content           │
│  Journals    │  Code blocks with syntax highlighting│
│    📄 Today  │  [[links]] are clickable             │
│    📄 ...    │                                      │
│              │                                      │
│  File tree   │  Content pane                        │
│  (fixed)     │  (flex, scrollable)                  │
└──────────────┴──────────────────────────────────────┘
```

**Search behaviour:**
- Real-time as-you-type search, debounced 300ms, no Enter required
- Results replace file tree: each result shows page name + matched text snippet
- Property lines (`key:: value`) excluded from search body
- Clearing the search box restores the file tree
- Keywords highlighted in results

**Routing:**
- Hash-based URL routing (`/#/pages/page-name`) for shareable links
- `[[Wiki Link]]` clicks update the hash route and load the target page

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `express` | HTTP server |
| `marked` | Markdown → HTML rendering |
| `highlight.js` | Code block syntax highlighting |
| `fuse.js` | Client-side fuzzy search |
| `chokidar` | File system watcher for hot index updates |
| `gray-matter` | Parse Logseq frontmatter properties |
| `minimist` | CLI argument parsing |

---

## Startup

```bash
node server.js --root /path/to/logseq-repo --port 3000
```

Default port: `3000`. `--root` is required and should point to the Logseq repository root (the directory containing `pages/`, `journals/`, `assets/`).

---

## Constraints

- **Read-only:** No write/edit endpoints exposed
- **No symlink traversal:** Avoids circular directory loops
- **Hidden files and `logseq/` directory excluded** from scanning
- **`node_modules` excluded** from scanning
- **Plain text in index only:** Markdown and Logseq syntax stripped from body before indexing to save memory; property lines excluded
- **Path traversal prevention:** `/api/file` and `/assets/*` validate that the resolved path stays within the configured root directory; requests outside root return 403

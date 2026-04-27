# Logseq Browser

A lightweight local web server for browsing and searching [Logseq](https://logseq.com/) knowledge bases via any browser. Read-only. No client-side git sync required — just point it at your local Logseq repo.

## Features

- **Full-text fuzzy search** across all page titles and body content (powered by Fuse.js)
- **Logseq-aware rendering**: wiki links, properties, block refs, tags, highlights, tables, Mermaid diagrams
- **Collapse / expand** outline blocks (respects `collapsed:: true`)
- **Syntax highlighting** for code blocks (highlight.js)
- **Hot index updates** via file watcher — no restart needed when files change
- **Hash-based routing** — shareable deep links to individual pages

## Requirements

- Node.js 18+
- A local Logseq repository (the directory containing `pages/`, `journals/`, `assets/`)

## Quick Start

```bash
cd logseq-browser
npm install
node server.js --root /path/to/your/logseq-repo
```

Then open http://localhost:3000 in your browser.

**Options:**

| Flag | Default | Description |
| --- | --- | --- |
| `--root` | *(required)* | Path to the Logseq repository root |
| `--port` | `3000` | Port to listen on |

## Deployment

### systemd (Linux server, recommended)

Create `/etc/systemd/system/logseq-browser.service`:

```ini
[Unit]
Description=Logseq Browser
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/path/to/logseq-browser
ExecStart=/usr/bin/node server.js --root /path/to/logseq-repo --port 3000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable logseq-browser
sudo systemctl start logseq-browser
sudo systemctl status logseq-browser
```

### PM2 (alternative)

```bash
npm install -g pm2
pm2 start server.js --name logseq-browser -- --root /path/to/logseq-repo --port 3000
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot
```

### Nginx reverse proxy (optional)

To serve behind a domain or subpath:

```nginx
server {
    listen 80;
    server_name notes.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Logseq Syntax Support

| Syntax | Rendered as |
| --- | --- |
| `[[Page Name]]` | Clickable internal link |
| `key:: value` | Stripped (not displayed) |
| `collapsed:: true` | Block starts collapsed |
| `((block-uuid))` | Grey `[ref]` placeholder |
| `{{query ...}}` | Grey unsupported-block notice |
| `{{embed ((uuid))}}` | Grey unsupported-block notice |
| `:LOGBOOK: ... :END:` | Stripped |
| `==highlighted text==` | Yellow highlight |
| ` ```mermaid ``` ` | Rendered diagram (requires internet for CDN) |
| `namespace___page.md` | Displayed as `namespace/page` |

## Project Structure

```
logseq-browser/
├── server.js      # Express entry point + API routes
├── indexer.js     # File scanner + in-memory search index
├── watcher.js     # chokidar file watcher for hot index updates
├── logseq.js      # Logseq markdown preprocessor
├── public/
│   ├── index.html # App shell
│   ├── app.js     # Frontend: search, routing, collapse, Mermaid
│   └── style.css  # Layout + Logseq-specific styles
└── package.json
```

## Development

```bash
npm test   # run Jest test suite
```

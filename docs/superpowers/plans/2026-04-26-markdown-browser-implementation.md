# Markdown Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only Node.js web server that renders a local Logseq Markdown knowledge base in the browser with global fuzzy search.

**Architecture:** Express serves a single-page frontend; on startup the indexer scans `pages/` and `journals/` into memory; fuse.js runs search client-side against that index; chokidar hot-updates the index on file changes; a Logseq preprocessor transforms wiki links, properties, and block refs before `marked` renders the HTML.

**Tech Stack:** Node.js, Express, marked@9, marked-highlight, highlight.js, fuse.js, chokidar, gray-matter, minimist, Jest, supertest

---

## Task 1: Project Setup

**Files:**
- Create: `markdown-browser/package.json`
- Create: `markdown-browser/jest.config.js`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "markdown-browser",
  "version": "1.0.0",
  "description": "Browser-based Logseq Markdown viewer with fuzzy search",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "jest"
  },
  "dependencies": {
    "chokidar": "^3.6.0",
    "express": "^4.18.2",
    "fuse.js": "^7.0.0",
    "github-markdown-css": "^5.5.0",
    "gray-matter": "^4.0.3",
    "highlight.js": "^11.9.0",
    "marked": "^9.1.6",
    "marked-highlight": "^2.1.1",
    "minimist": "^1.2.8"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^6.3.4"
  }
}
```

- [ ] **Step 2: Create jest.config.js**

```javascript
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
};
```

- [ ] **Step 3: Install dependencies**

```bash
cd markdown-browser && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 4: Create directory structure**

```bash
mkdir -p markdown-browser/public markdown-browser/tests
```

- [ ] **Step 5: Commit**

```bash
cd markdown-browser
git init
git add package.json jest.config.js
git commit -m "chore: project setup with dependencies"
```

---

## Task 2: Logseq Preprocessor (TDD)

**Files:**
- Create: `markdown-browser/tests/logseq.test.js`
- Create: `markdown-browser/logseq.js`

- [ ] **Step 1: Write failing tests — create tests/logseq.test.js**

```javascript
const {
  extractProperties,
  convertWikiLinks,
  convertBlockRefs,
  convertUnsupportedBlocks,
  convertTags,
  filenameToTitle,
  toPlainText,
  preprocess,
} = require('../logseq');

describe('extractProperties', () => {
  test('extracts key:: value lines and removes them from text', () => {
    const { properties, cleaned } = extractProperties('title:: My Page\ntags:: foo\nContent');
    expect(properties).toEqual({ title: 'My Page', tags: 'foo' });
    expect(cleaned).toBe('Content');
  });

  test('returns empty properties when no property lines present', () => {
    const { properties, cleaned } = extractProperties('# Hello\nContent');
    expect(properties).toEqual({});
    expect(cleaned).toBe('# Hello\nContent');
  });
});

describe('convertWikiLinks', () => {
  test('converts [[Page Name]] to anchor tag', () => {
    const result = convertWikiLinks('See [[My Page]] for details');
    expect(result).toBe(
      'See <a href="#/pages/My%20Page.md" class="wiki-link">My Page</a> for details'
    );
  });

  test('converts [[Page|Alias]] to anchor with alias text', () => {
    const result = convertWikiLinks('[[My Page|click here]]');
    expect(result).toBe(
      '<a href="#/pages/My%20Page.md" class="wiki-link">click here</a>'
    );
  });

  test('encodes namespace slashes in href', () => {
    const result = convertWikiLinks('[[ns/page]]');
    expect(result).toContain('href="#/pages/ns%2Fpage.md"');
  });
});

describe('convertBlockRefs', () => {
  test('converts ((uuid)) to ref placeholder', () => {
    const uuid = '6374cdb7-d938-4a19-8f6c-a7d6c5c5e5c2';
    expect(convertBlockRefs(`((${uuid}))`)).toBe(
      `<span class="block-ref" title="${uuid}">[ref]</span>`
    );
  });

  test('leaves non-uuid patterns untouched', () => {
    expect(convertBlockRefs('((not-a-uuid))')).toBe('((not-a-uuid))');
  });
});

describe('convertUnsupportedBlocks', () => {
  test('converts {{query}} to unsupported notice', () => {
    expect(convertUnsupportedBlocks('{{query (todo)}}')).toBe(
      '<div class="unsupported-block">[Dynamic query — not supported]</div>'
    );
  });

  test('converts {{embed ((uuid))}} to unsupported notice', () => {
    expect(
      convertUnsupportedBlocks('{{embed ((6374cdb7-d938-4a19-8f6c-a7d6c5c5e5c2))}}')
    ).toBe('<div class="unsupported-block">[Embedded block — not supported]</div>');
  });
});

describe('convertTags', () => {
  test('converts inline #tag preceded by space to styled span', () => {
    expect(convertTags('This is #important note')).toBe(
      'This is <span class="tag">#important</span> note'
    );
  });

  test('does not convert # at start of line (headings)', () => {
    expect(convertTags('# Heading')).toBe('# Heading');
  });
});

describe('filenameToTitle', () => {
  test('converts namespace___page.md to namespace/page', () => {
    expect(filenameToTitle('namespace___page.md')).toBe('namespace/page');
  });

  test('strips .md extension for normal filenames', () => {
    expect(filenameToTitle('my-page.md')).toBe('my-page');
  });
});

describe('toPlainText', () => {
  test('removes property lines', () => {
    const result = toPlainText('title:: My Page\nContent here');
    expect(result).not.toContain('title::');
    expect(result).toContain('Content here');
  });

  test('keeps wiki link display text, removes brackets', () => {
    const result = toPlainText('See [[My Page]] for details');
    expect(result).toContain('My Page');
    expect(result).not.toContain('[[');
  });

  test('removes block refs entirely', () => {
    expect(toPlainText('((6374cdb7-d938-4a19-8f6c-a7d6c5c5e5c2))')).not.toContain('((');
  });
});

describe('preprocess', () => {
  test('returns propsHtml with property table and transformed text with wiki links', () => {
    const { propsHtml, transformed } = preprocess('title:: My Title\n- See [[Linked Page]]');
    expect(propsHtml).toContain('My Title');
    expect(propsHtml).toContain('logseq-properties');
    expect(transformed).toContain('wiki-link');
    expect(transformed).not.toContain('title::');
  });

  test('returns empty propsHtml when no properties', () => {
    const { propsHtml } = preprocess('# Hello\n- Content');
    expect(propsHtml).toBe('');
  });
});
```

- [ ] **Step 2: Run tests — confirm all fail**

```bash
cd markdown-browser && npx jest tests/logseq.test.js
```

Expected: FAIL with "Cannot find module '../logseq'".

- [ ] **Step 3: Implement logseq.js**

```javascript
'use strict';

function extractProperties(text) {
  const properties = {};
  const nonPropertyLines = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-z][a-z0-9_-]*)::[ \t]*(.*)$/);
    if (m) properties[m[1]] = m[2].trim();
    else nonPropertyLines.push(line);
  }
  return { properties, cleaned: nonPropertyLines.join('\n') };
}

function convertWikiLinks(text) {
  text = text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_, page, alias) =>
    `<a href="#/pages/${encodeURIComponent(page)}.md" class="wiki-link">${alias}</a>`
  );
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_, page) =>
    `<a href="#/pages/${encodeURIComponent(page)}.md" class="wiki-link">${page}</a>`
  );
  return text;
}

function convertBlockRefs(text) {
  return text.replace(
    /\(\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)\)/g,
    (_, uuid) => `<span class="block-ref" title="${uuid}">[ref]</span>`
  );
}

function convertUnsupportedBlocks(text) {
  text = text.replace(
    /\{\{embed \(\([^)]+\)\)\}\}/g,
    '<div class="unsupported-block">[Embedded block — not supported]</div>'
  );
  text = text.replace(
    /\{\{query[^}]*\}\}/g,
    '<div class="unsupported-block">[Dynamic query — not supported]</div>'
  );
  return text;
}

function convertTags(text) {
  return text.replace(
    /([ \t])#([a-zA-Z][a-zA-Z0-9_/-]*)/g,
    (_, pre, tag) => `${pre}<span class="tag">#${tag}</span>`
  );
}

function renderPropertiesTable(properties) {
  if (Object.keys(properties).length === 0) return '';
  const rows = Object.entries(properties)
    .map(([k, v]) => `<tr><td class="prop-key">${k}</td><td class="prop-value">${v}</td></tr>`)
    .join('');
  return `<table class="logseq-properties">${rows}</table>`;
}

function filenameToTitle(filename) {
  return filename.replace(/\.md$/, '').replace(/___/g, '/');
}

function toPlainText(text) {
  text = text.replace(/^[a-z][a-z0-9_-]*::.*$/gm, '');
  text = text.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1');
  text = text.replace(/\(\([0-9a-f-]{36}\)\)/g, '');
  text = text.replace(/\{\{[^}]*\}\}/g, '');
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/\*{1,3}([^*\n]+)\*{1,3}/g, '$1');
  text = text.replace(/^[\s]*-\s+/gm, '');
  text = text.replace(/#[a-zA-Z][a-zA-Z0-9_/-]*/g, '');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

function preprocess(rawText) {
  const { properties, cleaned } = extractProperties(rawText);
  const propsHtml = renderPropertiesTable(properties);
  let text = cleaned;
  text = convertUnsupportedBlocks(text);
  text = convertBlockRefs(text);
  text = convertWikiLinks(text);
  text = convertTags(text);
  return { propsHtml, transformed: text };
}

module.exports = {
  extractProperties, convertWikiLinks, convertBlockRefs,
  convertUnsupportedBlocks, convertTags, renderPropertiesTable,
  filenameToTitle, toPlainText, preprocess,
};
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd markdown-browser && npx jest tests/logseq.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add logseq.js tests/logseq.test.js
git commit -m "feat: Logseq markdown preprocessor with tests"
```

---

## Task 3: Indexer (TDD)

**Files:**
- Create: `markdown-browser/tests/indexer.test.js`
- Create: `markdown-browser/indexer.js`

- [ ] **Step 1: Write failing tests — create tests/indexer.test.js**

```javascript
const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logseq-test-'));
  fs.mkdirSync(path.join(tmpDir, 'pages'));
  fs.mkdirSync(path.join(tmpDir, 'journals'));
  jest.resetModules();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function fresh() { return require('../indexer'); }

describe('extractTitle', () => {
  test('uses first # heading', () => {
    expect(fresh().extractTitle('# My Title\nContent', 'page.md')).toBe('My Title');
  });

  test('uses title:: property when no heading', () => {
    expect(fresh().extractTitle('title:: My Title\nContent', 'page.md')).toBe('My Title');
  });

  test('falls back to filename without extension', () => {
    expect(fresh().extractTitle('Just content', 'my-page.md')).toBe('my-page');
  });

  test('converts namespace filename to display name', () => {
    expect(fresh().extractTitle('Content', 'ns___child.md')).toBe('ns/child');
  });
});

describe('buildIndex', () => {
  test('indexes .md files in pages/ and journals/', () => {
    const { buildIndex, getIndex } = fresh();
    fs.writeFileSync(path.join(tmpDir, 'pages', 'test.md'), '# Test\nContent');
    fs.writeFileSync(path.join(tmpDir, 'journals', '2024_01_15.md'), '- Entry');
    buildIndex(tmpDir);
    const index = getIndex();
    expect(index).toHaveLength(2);
    expect(index.find(e => e.type === 'page')).toBeTruthy();
    expect(index.find(e => e.type === 'journal')).toBeTruthy();
  });

  test('excludes hidden files', () => {
    const { buildIndex, getIndex } = fresh();
    fs.writeFileSync(path.join(tmpDir, 'pages', '.hidden.md'), 'Hidden');
    fs.writeFileSync(path.join(tmpDir, 'pages', 'visible.md'), '# Visible');
    buildIndex(tmpDir);
    expect(getIndex()).toHaveLength(1);
    expect(getIndex()[0].title).toBe('Visible');
  });

  test('strips Logseq syntax from body for search', () => {
    const { buildIndex, getIndex } = fresh();
    fs.writeFileSync(
      path.join(tmpDir, 'pages', 'test.md'),
      'title:: MyTitle\n- Content with [[Link]] here'
    );
    buildIndex(tmpDir);
    const entry = getIndex()[0];
    expect(entry.body).toContain('Content with');
    expect(entry.body).toContain('Link');
    expect(entry.body).not.toContain('[[');
    expect(entry.body).not.toContain('title::');
  });

  test('stores relative path from root', () => {
    const { buildIndex, getIndex } = fresh();
    fs.writeFileSync(path.join(tmpDir, 'pages', 'hello.md'), '# Hello');
    buildIndex(tmpDir);
    expect(getIndex()[0].path).toBe(path.join('pages', 'hello.md'));
  });
});

describe('buildTree', () => {
  test('returns pages and journals sections', () => {
    const { buildTree } = fresh();
    fs.writeFileSync(path.join(tmpDir, 'pages', 'a.md'), '# A');
    fs.writeFileSync(path.join(tmpDir, 'journals', '2024_01_15.md'), '- Entry');
    const tree = buildTree(tmpDir);
    expect(tree.pages).toHaveLength(1);
    expect(tree.journals).toHaveLength(1);
  });

  test('journals sorted in reverse chronological order', () => {
    const { buildTree } = fresh();
    fs.writeFileSync(path.join(tmpDir, 'journals', '2024_01_01.md'), '- A');
    fs.writeFileSync(path.join(tmpDir, 'journals', '2024_01_15.md'), '- B');
    fs.writeFileSync(path.join(tmpDir, 'journals', '2024_01_10.md'), '- C');
    const tree = buildTree(tmpDir);
    const names = tree.journals.map(j => j.name);
    expect(names[0]).toBe('2024_01_15');
    expect(names[names.length - 1]).toBe('2024_01_01');
  });
});

describe('updateFile and removeFile', () => {
  test('updateFile adds new entry to index', () => {
    const { buildIndex, updateFile, getIndex } = fresh();
    buildIndex(tmpDir);
    const newFile = path.join(tmpDir, 'pages', 'new.md');
    fs.writeFileSync(newFile, '# New Page');
    updateFile(newFile);
    expect(getIndex().find(e => e.title === 'New Page')).toBeTruthy();
  });

  test('removeFile removes entry from index', () => {
    const { buildIndex, removeFile, getIndex } = fresh();
    const file = path.join(tmpDir, 'pages', 'hello.md');
    fs.writeFileSync(file, '# Hello');
    buildIndex(tmpDir);
    expect(getIndex()).toHaveLength(1);
    removeFile(file);
    expect(getIndex()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — confirm all fail**

```bash
cd markdown-browser && npx jest tests/indexer.test.js
```

Expected: FAIL with "Cannot find module '../indexer'".

- [ ] **Step 3: Implement indexer.js**

```javascript
'use strict';

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { filenameToTitle, toPlainText } = require('./logseq');

let index = [];
let rootDir = '';

function extractTitle(fileContent, filename) {
  const { data, content } = matter(fileContent);
  if (data.title) return String(data.title);
  const titleProp = content.match(/^title::[ \t]*(.+)$/m);
  if (titleProp) return titleProp[1].trim();
  const heading = content.match(/^#+ (.+)$/m);
  if (heading) return heading[1].trim();
  return filenameToTitle(path.basename(filename));
}

function buildIndex(root) {
  rootDir = root;
  index = [];
  for (const { dir, type } of [
    { dir: path.join(root, 'pages'), type: 'page' },
    { dir: path.join(root, 'journals'), type: 'journal' },
  ]) {
    if (fs.existsSync(dir)) scanDir(dir, type);
  }
  return index;
}

function scanDir(dir, type) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath, type);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        index.push({
          path: path.relative(rootDir, fullPath),
          title: extractTitle(content, entry.name),
          body: toPlainText(content),
          type,
        });
      } catch { /* skip unreadable files */ }
    }
  }
}

function updateFile(filePath) {
  const type = filePath.replace(/\\/g, '/').includes('/journals/') ? 'journal' : 'page';
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(rootDir, filePath);
    const entry = {
      path: relativePath,
      title: extractTitle(content, path.basename(filePath)),
      body: toPlainText(content),
      type,
    };
    const i = index.findIndex(e => e.path === relativePath);
    if (i >= 0) index[i] = entry; else index.push(entry);
  } catch { /* file deleted */ }
}

function removeFile(filePath) {
  const relativePath = path.relative(rootDir, filePath);
  index = index.filter(e => e.path !== relativePath);
}

function getIndex() { return index; }

function listMdFiles(dir, root, type) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listMdFiles(fullPath, root, type));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push({
        path: path.relative(root, fullPath),
        name: filenameToTitle(entry.name),
        type,
      });
    }
  }
  return results;
}

function buildTree(root) {
  return {
    pages: listMdFiles(path.join(root, 'pages'), root, 'page'),
    journals: listMdFiles(path.join(root, 'journals'), root, 'journal')
      .sort((a, b) => b.path.localeCompare(a.path)),
  };
}

module.exports = { buildIndex, updateFile, removeFile, getIndex, buildTree, extractTitle };
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd markdown-browser && npx jest tests/indexer.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add indexer.js tests/indexer.test.js
git commit -m "feat: in-memory indexer for Logseq pages and journals"
```

---

## Task 4: Server + API Routes (TDD)

**Files:**
- Create: `markdown-browser/tests/server.test.js`
- Create: `markdown-browser/server.js`

- [ ] **Step 1: Write failing tests — create tests/server.test.js**

```javascript
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const os = require('os');

let tmpDir, app;

beforeEach(() => {
  jest.resetModules();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logseq-srv-test-'));
  fs.mkdirSync(path.join(tmpDir, 'pages'));
  fs.mkdirSync(path.join(tmpDir, 'journals'));
  fs.mkdirSync(path.join(tmpDir, 'assets'));
  fs.writeFileSync(path.join(tmpDir, 'pages', 'hello.md'), '# Hello\n- World');
  const { buildIndex } = require('../indexer');
  buildIndex(tmpDir);
  const { createApp } = require('../server');
  app = createApp(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('GET /api/index', () => {
  test('returns array with title and path fields', async () => {
    const res = await request(app).get('/api/index');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toMatchObject({ title: 'Hello', path: expect.stringContaining('hello.md') });
  });
});

describe('GET /api/tree', () => {
  test('returns tree with pages and journals arrays', async () => {
    const res = await request(app).get('/api/tree');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pages');
    expect(res.body).toHaveProperty('journals');
    expect(res.body.pages).toHaveLength(1);
  });
});

describe('GET /api/file', () => {
  test('returns rendered HTML for valid .md file', async () => {
    const res = await request(app).get(
      '/api/file?path=' + encodeURIComponent(path.join('pages', 'hello.md'))
    );
    expect(res.status).toBe(200);
    expect(res.body.html).toContain('<h1>Hello</h1>');
  });

  test('returns 400 when path param is missing', async () => {
    expect((await request(app).get('/api/file')).status).toBe(400);
  });

  test('returns 404 for non-existent file', async () => {
    expect((await request(app).get('/api/file?path=pages/missing.md')).status).toBe(404);
  });

  test('returns 403 for path traversal attempt', async () => {
    expect((await request(app).get('/api/file?path=../../etc/passwd')).status).toBe(403);
  });

  test('returns 400 for non-.md file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'pages', 'script.js'), 'alert(1)');
    expect((await request(app).get('/api/file?path=pages/script.js')).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests — confirm all fail**

```bash
cd markdown-browser && npx jest tests/server.test.js
```

Expected: FAIL with "Cannot find module '../server'".

- [ ] **Step 3: Implement server.js**

```javascript
'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const { marked } = require('marked');
const { markedHighlight } = require('marked-highlight');
const hljs = require('highlight.js');
const { getIndex, buildTree, buildIndex } = require('./indexer');
const { startWatcher } = require('./watcher');
const { preprocess } = require('./logseq');

marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
}));

function createApp(rootDir) {
  const app = express();
  const resolvedRoot = path.resolve(rootDir);

  app.use(express.static(path.join(__dirname, 'public')));

  app.get('/lib/fuse.min.js', (_, res) =>
    res.sendFile(path.join(__dirname, 'node_modules/fuse.js/dist/fuse.min.js'))
  );
  app.get('/lib/highlight.css', (_, res) =>
    res.sendFile(path.join(__dirname, 'node_modules/highlight.js/styles/github.css'))
  );
  app.get('/lib/github-markdown.css', (_, res) =>
    res.sendFile(path.join(__dirname, 'node_modules/github-markdown-css/github-markdown.css'))
  );

  app.use('/assets', (req, res, next) => {
    const target = path.resolve(path.join(resolvedRoot, 'assets', req.path));
    const assetsRoot = path.join(resolvedRoot, 'assets');
    if (target !== assetsRoot && !target.startsWith(assetsRoot + path.sep)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.sendFile(target, err => { if (err) next(); });
  });

  app.get('/api/index', (_, res) => res.json(getIndex()));

  app.get('/api/tree', (_, res) => res.json(buildTree(rootDir)));

  app.get('/api/file', (req, res) => {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Missing path parameter' });

    const resolved = path.resolve(resolvedRoot, filePath);
    if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!resolved.endsWith('.md')) {
      return res.status(400).json({ error: 'Only .md files are supported' });
    }
    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const raw = fs.readFileSync(resolved, 'utf8');
    const { propsHtml, transformed } = preprocess(raw);
    res.json({ html: propsHtml + marked.parse(transformed) });
  });

  return app;
}

if (require.main === module) {
  const minimist = require('minimist');
  const args = minimist(process.argv.slice(2));
  const rootDir = args.root;
  const port = args.port || 3000;

  if (!rootDir) {
    console.error('Usage: node server.js --root /path/to/logseq-repo [--port 3000]');
    process.exit(1);
  }
  if (!fs.existsSync(rootDir)) {
    console.error(`Error: root directory does not exist: ${rootDir}`);
    process.exit(1);
  }

  const idx = buildIndex(rootDir);
  console.log(`Indexed ${idx.length} files from ${rootDir}`);
  startWatcher(rootDir);

  const app = createApp(rootDir);
  app.listen(port, () => {
    console.log(`Markdown Browser running at http://localhost:${port}`);
  });
}

module.exports = { createApp };
```

- [ ] **Step 4: Run all tests — confirm all pass**

```bash
cd markdown-browser && npx jest
```

Expected: all tests in logseq, indexer, and server test files PASS.

- [ ] **Step 5: Commit**

```bash
git add server.js tests/server.test.js
git commit -m "feat: Express server with API routes for index, tree, and file rendering"
```

---

## Task 5: File Watcher

**Files:**
- Create: `markdown-browser/watcher.js`

- [ ] **Step 1: Implement watcher.js**

```javascript
'use strict';

const chokidar = require('chokidar');
const path = require('path');
const { updateFile, removeFile } = require('./indexer');

function startWatcher(rootDir) {
  const watcher = chokidar.watch(
    [
      path.join(rootDir, 'pages', '**', '*.md'),
      path.join(rootDir, 'journals', '**', '*.md'),
    ],
    {
      ignoreInitial: true,
      followSymlinks: false,
      ignored: /(^|[/\\])\../,
    }
  );

  watcher
    .on('add', filePath => { console.log(`[watcher] added: ${filePath}`); updateFile(filePath); })
    .on('change', filePath => { console.log(`[watcher] changed: ${filePath}`); updateFile(filePath); })
    .on('unlink', filePath => { console.log(`[watcher] removed: ${filePath}`); removeFile(filePath); });

  return watcher;
}

module.exports = { startWatcher };
```

- [ ] **Step 2: Commit**

```bash
git add watcher.js
git commit -m "feat: chokidar file watcher for hot index updates"
```

---

## Task 6: Frontend HTML + CSS

**Files:**
- Create: `markdown-browser/public/index.html`
- Create: `markdown-browser/public/style.css`

- [ ] **Step 1: Create public/index.html**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Markdown Browser</title>
  <link rel="stylesheet" href="/lib/github-markdown.css">
  <link rel="stylesheet" href="/lib/highlight.css">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <header id="topbar">
    <div id="logo">📚 Markdown Browser</div>
    <input type="text" id="search-input" placeholder="模糊搜索..." autocomplete="off" spellcheck="false">
  </header>
  <div id="main">
    <nav id="sidebar">
      <div id="file-tree"></div>
    </nav>
    <main id="content">
      <div id="content-body" class="markdown-body">
        <p class="placeholder">← 从左侧选择一个文件</p>
      </div>
    </main>
  </div>
  <script src="/lib/fuse.min.js"></script>
  <script src="/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create public/style.css**

```css
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #24292f;
}

#topbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 20px;
  border-bottom: 1px solid #d0d7de;
  background: #f6f8fa;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 100;
}
#logo { font-weight: 600; font-size: 15px; white-space: nowrap; }
#search-input {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  font-size: 14px;
  background: #fff;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
#search-input:focus {
  border-color: #0969da;
  box-shadow: 0 0 0 3px rgba(9,105,218,0.15);
}

#main { display: flex; flex: 1; overflow: hidden; }

#sidebar {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid #d0d7de;
  overflow-y: auto;
  padding: 12px 0;
  background: #f6f8fa;
}

.tree-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #57606a;
  padding: 8px 16px 4px;
}
.tree-item {
  display: block;
  width: 100%;
  padding: 4px 16px;
  font-size: 13px;
  color: #24292f;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree-item:hover { background: #eaeef2; }
.tree-item.active { background: #dae8f4; color: #0969da; font-weight: 500; }

.search-result { padding: 8px 16px; cursor: pointer; border-bottom: 1px solid #f0f0f0; }
.search-result:hover { background: #eaeef2; }
.search-result-title { font-size: 13px; font-weight: 500; color: #0969da; margin-bottom: 2px; }
.search-result-snippet {
  font-size: 12px; color: #57606a;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

mark { background: #fff8c5; color: inherit; padding: 0 1px; border-radius: 2px; }

#content { flex: 1; overflow-y: auto; padding: 32px 48px; }
#content-body { max-width: 800px; margin: 0 auto; }
.placeholder { color: #57606a; font-style: italic; }

.logseq-properties {
  border-collapse: collapse;
  margin-bottom: 16px;
  font-size: 13px;
  background: #f6f8fa;
  border-radius: 6px;
  overflow: hidden;
  width: auto;
}
.logseq-properties td { padding: 4px 10px; border: 1px solid #d0d7de; }
.prop-key { font-weight: 600; color: #57606a; white-space: nowrap; }

a.wiki-link { color: #0969da; text-decoration: none; border-bottom: 1px solid rgba(9,105,218,0.3); }
a.wiki-link:hover { border-bottom-color: #0969da; }

.block-ref {
  display: inline-block; padding: 0 4px;
  background: #f0f0f0; border-radius: 3px;
  font-size: 12px; color: #57606a; cursor: help;
}
.unsupported-block {
  padding: 8px 12px; background: #f6f8fa;
  border: 1px dashed #d0d7de; border-radius: 4px;
  color: #57606a; font-size: 13px; font-style: italic; margin: 8px 0;
}
.tag {
  display: inline-block; padding: 0 6px;
  background: #ddf4ff; color: #0550ae;
  border-radius: 2em; font-size: 12px; font-weight: 500;
}

@media (max-width: 768px) {
  #sidebar { width: 200px; }
  #content { padding: 16px; }
}
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/style.css
git commit -m "feat: frontend HTML shell and CSS layout"
```

---

## Task 7: Frontend JavaScript

**Files:**
- Create: `markdown-browser/public/app.js`

- [ ] **Step 1: Create public/app.js**

```javascript
(function () {
  'use strict';

  let fuse = null;
  let currentPath = null;
  let treeData = null;
  let debounceTimer = null;

  const searchInput = document.getElementById('search-input');
  const fileTree = document.getElementById('file-tree');
  const contentBody = document.getElementById('content-body');

  async function init() {
    await Promise.all([loadTree(), loadIndex()]);
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
  }

  async function loadTree() {
    const res = await fetch('/api/tree');
    treeData = await res.json();
    renderTree(treeData);
  }

  async function loadIndex() {
    const res = await fetch('/api/index');
    const index = await res.json();
    fuse = new Fuse(index, {
      keys: [{ name: 'title', weight: 2 }, { name: 'body', weight: 1 }],
      includeScore: true,
      includeMatches: true,
      threshold: 0.4,
      minMatchCharLength: 2,
    });
  }

  function renderTree(tree) {
    fileTree.innerHTML = '';
    appendSection('Pages', tree.pages);
    appendSection('Journals', tree.journals);
  }

  function appendSection(label, items) {
    if (!items || items.length === 0) return;
    const title = document.createElement('div');
    title.className = 'tree-section-title';
    title.textContent = label;
    fileTree.appendChild(title);
    for (const item of items) fileTree.appendChild(makeTreeItem(item));
  }

  function makeTreeItem(item) {
    const btn = document.createElement('button');
    btn.className = 'tree-item';
    btn.textContent = item.name;
    btn.dataset.path = item.path;
    if (item.path === currentPath) btn.classList.add('active');
    btn.addEventListener('click', () => { window.location.hash = '/' + item.path; });
    return btn;
  }

  function handleHashChange() {
    const hash = window.location.hash;
    if (!hash || hash === '#' || hash === '#/') return;
    const filePath = decodeURIComponent(hash.replace(/^#\//, ''));
    loadFile(filePath);
  }

  async function loadFile(filePath) {
    if (currentPath === filePath) return;
    currentPath = filePath;
    updateActiveItem(filePath);
    contentBody.innerHTML = '<p style="color:#57606a">加载中...</p>';

    let res;
    try {
      res = await fetch('/api/file?path=' + encodeURIComponent(filePath));
    } catch {
      contentBody.innerHTML = '<p style="color:#cf222e">网络错误</p>';
      return;
    }
    if (!res.ok) {
      contentBody.innerHTML = `<p style="color:#cf222e">加载失败 (${res.status})</p>`;
      return;
    }

    const { html } = await res.json();
    contentBody.innerHTML = html;

    contentBody.querySelectorAll('a.wiki-link').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        window.location.hash = a.getAttribute('href');
      });
    });
  }

  function updateActiveItem(filePath) {
    document.querySelectorAll('.tree-item').forEach(el => {
      el.classList.toggle('active', el.dataset.path === filePath);
    });
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(handleSearch, 300);
  });

  function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) {
      if (treeData) { renderTree(treeData); updateActiveItem(currentPath); }
      return;
    }
    if (!fuse) return;
    renderSearchResults(fuse.search(query, { limit: 50 }));
  }

  function renderSearchResults(results) {
    fileTree.innerHTML = '';
    if (results.length === 0) {
      const el = document.createElement('div');
      el.style.cssText = 'padding:12px 16px;color:#57606a;font-size:13px';
      el.textContent = '没有找到匹配的内容';
      fileTree.appendChild(el);
      return;
    }
    for (const { item, matches } of results) {
      const div = document.createElement('div');
      div.className = 'search-result';
      div.addEventListener('click', () => { window.location.hash = '/' + item.path; });

      const titleDiv = document.createElement('div');
      titleDiv.className = 'search-result-title';
      titleDiv.innerHTML = hlText(item.title, matches, 'title');

      const { text, shiftedMatches } = snippet(item.body, matches);
      const snipDiv = document.createElement('div');
      snipDiv.className = 'search-result-snippet';
      snipDiv.innerHTML = hlText(text, shiftedMatches, 'body');

      div.appendChild(titleDiv);
      div.appendChild(snipDiv);
      fileTree.appendChild(div);
    }
  }

  function snippet(body, matches) {
    const m = matches && matches.find(x => x.key === 'body');
    if (!m || !m.indices.length) {
      return { text: body.slice(0, 120) + (body.length > 120 ? '…' : ''), shiftedMatches: null };
    }
    const [start] = m.indices[0];
    const from = Math.max(0, start - 40);
    const to = Math.min(body.length, start + 100);
    const prefix = from > 0 ? '…' : '';
    const text = prefix + body.slice(from, to) + (to < body.length ? '…' : '');
    const shift = from > 0 ? from - 1 : 0;
    const si = m.indices
      .map(([s, e]) => [s - shift, e - shift])
      .filter(([s, e]) => s >= 0 && e < text.length);
    return { text, shiftedMatches: si.length ? [{ key: 'body', indices: si }] : null };
  }

  function hlText(text, matches, key) {
    const m = Array.isArray(matches) ? matches.find(x => x.key === key) : null;
    if (!m) return esc(text);
    let out = '', last = 0;
    for (const [s, e] of [...m.indices].sort((a, b) => a[0] - b[0])) {
      out += esc(text.slice(last, s)) + '<mark>' + esc(text.slice(s, e + 1)) + '</mark>';
      last = e + 1;
    }
    return out + esc(text.slice(last));
  }

  function esc(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  init();
})();
```

- [ ] **Step 2: Commit**

```bash
git add public/app.js
git commit -m "feat: frontend SPA with fuse.js search and hash routing"
```

---

## Task 8: Smoke Test

- [ ] **Step 1: Run full test suite**

```bash
cd markdown-browser && npx jest
```

Expected: all tests PASS, 0 failures.

- [ ] **Step 2: Start server against a real Logseq repo**

```bash
node server.js --root /path/to/your/logseq-repo --port 3000
```

Open `http://localhost:3000` and verify:
1. Sidebar shows **Pages** and **Journals** sections
2. Clicking a file renders Markdown with GitHub styling and code highlighting
3. `[[wiki links]]` are clickable and navigate to the target page
4. `key:: value` properties appear as a table at top of page
5. Typing in the search box filters results with highlighted keywords in real time
6. URL hash updates on navigation (copy/paste link opens the same file)
7. Images from `assets/` render correctly

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: complete markdown-browser v1.0"
```

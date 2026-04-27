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

  app.get('/api/tree', (_, res) => res.json(buildTree(resolvedRoot)));

  app.get('/api/file', async (req, res) => {
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Missing path parameter' });

    const resolved = path.resolve(resolvedRoot, filePath);
    if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!resolved.endsWith('.md')) {
      return res.status(400).json({ error: 'Only .md files are supported' });
    }

    try {
      const raw = await fs.promises.readFile(resolved, 'utf8');
      const { propsHtml, transformed } = preprocess(raw);
      res.json({ html: propsHtml + marked.parse(transformed) });
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
      res.status(500).json({ error: 'Internal error' });
    }
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

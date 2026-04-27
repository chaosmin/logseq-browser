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

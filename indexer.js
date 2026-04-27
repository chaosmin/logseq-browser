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
  const rel = path.relative(rootDir, filePath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return;
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
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return;
  index = index.filter(e => e.path !== relativePath);
}

function getIndex() { return index; }

function listMdFiles(dir, root, type) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
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

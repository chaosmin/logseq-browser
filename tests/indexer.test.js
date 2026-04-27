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

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

import Fuse from '/lib/fuse.min.js';

'use strict';

mermaid.initialize({ startOnLoad: false, theme: 'default' });

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

  initCollapseButtons();

  const mermaidNodes = contentBody.querySelectorAll('.mermaid');
  if (mermaidNodes.length > 0) mermaid.run({ nodes: mermaidNodes });

  contentBody.querySelectorAll('a.wiki-link').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      window.location.hash = a.getAttribute('href');
    });
  });
}

function initCollapseButtons() {
  // Add toggle buttons to all <li> elements that have child <ul> (Logseq outline blocks)
  contentBody.querySelectorAll('li').forEach(li => {
    const childUl = li.querySelector(':scope > ul');
    if (!childUl) return;

    let btn = li.querySelector(':scope > .collapse-btn');
    if (!btn) {
      btn = document.createElement('span');
      btn.className = 'collapse-btn';
      li.prepend(btn);
    }

    // If the li contains a heading, move the button inside it so it sits left of the text.
    // (A block-level <h2> after an inline <span> would otherwise push the span above it.)
    const heading = li.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > h4,:scope > h5,:scope > h6');
    if (heading) heading.prepend(btn);

    // Apply initial state
    if (btn.classList.contains('collapsed')) childUl.style.display = 'none';

    btn.addEventListener('click', () => {
      const nowCollapsed = btn.classList.toggle('collapsed');
      childUl.style.display = nowCollapsed ? 'none' : '';
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

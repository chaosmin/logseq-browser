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

/*
Extracts meta.editors array from the content.

Finds all lines whose text (after stripping italic markers * and trailing \ )
matches ^Транскрипци.+$ and removes them from the content.
*/

const names = {
  'Динанатх Дас': [
    'Динанатхом Дасом',
    'Динанатх дас',
    'Динанатх Дас',
  ],
  'Гунали Д.Д.': [
    'Гунали деви даси',
  ],
  'Лочан Дас': [
    'Лочан дас',
  ],
  'Яшода Д.Д.': [
    'Яшода ДД'
  ],
  'Джахнави Прия Д.Д.': [
    'Джахнави Прия ДД'
  ],
  'Ядавендра Дас': [
    'Ядавендра Дас'
  ],
  'Б.С. Хришикеш Свами': [
    'Б.С. Хришикеш Свами'
  ],
  'Муралишвар Дас': [
    'Муралишвар дас'
  ],
  'Традиш Дас': [
    'Традиш дас'
  ]
};

const roles = {
  'Транскрипция': [
    'Транскрипцию выполнил',
    'Транскрипцию выполнила',
    'Транскрипт выполнила',
    'Транскрипт выполнил'
  ],
  'Перевод': [
    'Переводчик',
    'Переводчик на русский язык',
  ],
  'Поиск шлок': [
    'Поиск шлок выполнил',
    'частично поиск шлок выполнил',
  ],
  'Редактор': [
    'Редактор и составитель примечаний',
  ],
};

// Build reverse lookup for roles: variant -> canonical
const _roleAliases = new Map();
for (const [canonical, variants] of Object.entries(roles)) {
  for (const v of variants) {
    _roleAliases.set(v, canonical);
  }
}

// Build reverse lookup for names: variant (with or without trailing '.') -> canonical
const _nameAliases = new Map();
for (const [canonical, variants] of Object.entries(names)) {
  for (const v of variants) {
    _nameAliases.set(v, canonical);
    _nameAliases.set(v.replace(/\.\s*$/, ''), canonical);
  }
}

// ─── Analyzer accumulator ────────────────────────────────────────────────────

/** Split an editor string into { label, name } by ' --- ' or ': ' separators. */
function splitEditorEntry(entry) {
  const dashIdx = entry.indexOf(' --- ');
  if (dashIdx !== -1) {
    return { label: entry.slice(0, dashIdx).trim(), name: entry.slice(dashIdx + 5).trim() };
  }
  const colonIdx = entry.indexOf(': ');
  if (colonIdx !== -1) {
    return { label: entry.slice(0, colonIdx).trim(), name: entry.slice(colonIdx + 2).trim() };
  }
  return { label: entry.trim(), name: null };
}

const _labels = new Map(); // label -> count
const _names  = new Map(); // name  -> count
const _noSep  = new Map(); // no-separator entry -> count

function _accumulate(editors) {
  for (const entry of editors) {
    const { label, name } = splitEditorEntry(entry);
    _labels.set(label, (_labels.get(label) || 0) + 1);
    if (name) {
      _names.set(name, (_names.get(name) || 0) + 1);
    } else {
      _noSep.set(entry, (_noSep.get(entry) || 0) + 1);
    }
  }
}

// ─── Formatting / extraction ──────────────────────────────────────────────────

/** Strip italic/bold markers and trailing backslash from a line. */
function stripFormatting(line) {
  let s = line.trim();
  // Remove surrounding ** (bold), keeping any trailing dot, stripping trailing backslash
  s = s.replace(/^\*\*(.+?)\*\*([.]?)\\*$/, '$1$2');
  // Remove surrounding * (italic), keeping any trailing dot, stripping trailing backslash
  s = s.replace(/^\*(.+?)\*([.]?)\\*$/, '$1$2');
  // Strip any remaining trailing backslash
  s = s.replace(/\\+$/, '').trim();
  return s;
}

function extractEditors(content) {
  const lines = content.split('\n');
  const editors = [];
  const keepLines = [];

  for (let i = 0; i < lines.length; i++) {
    const stripped = stripFormatting(lines[i]);
    if (/^Транскрип.+|^Переводчик|^Редактор|поиск шлок/i.test(stripped)) {
      editors.push(stripped);
      // Also remove one adjacent blank line (prefer the one after, else the one before)
      if (i + 1 < lines.length && lines[i + 1].trim() === '') {
        i++; // skip next blank line
      } else if (keepLines.length > 0 && keepLines[keepLines.length - 1].trim() === '') {
        keepLines.pop(); // remove preceding blank line
      }
    } else {
      keepLines.push(lines[i]);
    }
  }

  if (editors.length === 0) {
    const allNames = [...Object.keys(names), ...Object.values(names).flat()];
    const nameWarnings = [];
    for (const line of keepLines) {
      const stripped = stripFormatting(line);
      for (const name of allNames) {
        if (stripped.includes(name)) {
          nameWarnings.push(`possible unrecognized editor line (name "${name}" found): "${line.trim()}"`);
          break;
        }
      }
    }
    return { content, meta: {}, modified: false, warnings: ['no editors found', ...nameWarnings], errors: [] };
  }

  // Error if any unprocessed line still contains editor keywords (unrecognized formatting)
  const warnings = [];
  const errors = [];
  const EDITOR_KEYWORDS = /Транскрип|Переводч|Редак|Поиск шлок/i;
  for (const line of keepLines) {
    if (EDITOR_KEYWORDS.test(line)) {
    //   errors.push(`possible unrecognized editor line: "${line.trim()}"`);
    }
  }

  // Normalize: insert ':' after проверена / выполнил / выполнила,
  // canonicalize name via names dict (variant match allows trailing dot).
  const normalized = editors.map(e => {
    let s = e.replace(/(проверена|выполнил|выполнила)(?!:)\s+/i, '$1: ');
    const { label, name } = splitEditorEntry(s);
    const canonicalRole = _roleAliases.get(label);
    const canonicalName = name
      ? (_nameAliases.get(name) ?? _nameAliases.get(name.replace(/\.\s*$/, '')))
      : null;
    if (canonicalRole || canonicalName) {
      s = (canonicalRole ?? label) + (name ? ': ' + (canonicalName ?? name) : '');
    }
    return s;
  });

  _accumulate(normalized);

  // Group into { role, names } objects
  const grouped = new Map(); // role -> names[]
  const noRole = [];
  for (const s of normalized) {
    const { label, name } = splitEditorEntry(s);
    if (name) {
      if (!grouped.has(label)) grouped.set(label, []);
      grouped.get(label).push(name);
    } else {
      noRole.push(label);
    }
  }
  const editorsMeta = [
    ...[...grouped.entries()].map(([role, names]) => ({ [role]: names.length === 1 ? names[0] : names })),
    ...noRole.map(role => ({ [role]: [] })),
  ];

  return {
    content: keepLines.join('\n'),
    meta: { editors: editorsMeta },
    modified: true,
    warnings,
    errors,
  };
}

function writeEditorsLog(filePath) {
  const fs = require('fs');
  const sortedLabels = [..._labels.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const sortedNames  = [..._names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const lines = [
    '=== Unique Labels ===',
    ...sortedLabels.map(([k, v]) => `  (${v}) ${k}`),
    '',
    '=== Unique Names ===',
    ...sortedNames.map(([k, v]) => `  (${v}) ${k}`),
    '',
    '=== No Separator ===',
    ...(_noSep.size
      ? [..._noSep.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, v]) => `  (${v}) ${k}`)
      : ['  (none)']
    ),
    '',
  ];
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

module.exports = { extractEditors, writeEditorsLog };   

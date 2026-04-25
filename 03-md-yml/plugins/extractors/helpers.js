/*
Shared utilities for header-extraction plugins.
*/

/** Core date+suffix pattern for a record ID, no anchors or capturing groups.
 *  Change this single source to update all derived regexes below. */
const RECORD_ID_CORE = String.raw`\d{4}\.[\dX]{2}\.[\dX]{2}(?:\.[A-Za-z\u0400-\u04FF0-9,]+)*(?:-v\d+)?`;

/** Matches a complete record ID: 1981.03.07, 1981.03.07.A.B1, 1981.03.07.В2, 1983.01.26.B,C */
const RECORD_ID_RE           = new RegExp('^' + RECORD_ID_CORE + '$');
/** Matches ID + optional dot + whitespace + title: "1981.09.01.B.C. Духовные чувства..." */
const RECORD_ID_DOT_SPACE_RE = new RegExp('^(' + RECORD_ID_CORE + String.raw`)\.?\s+(.+)$`);
/** Matches ID + underscore + title: "1982.04.27.B2.C1_Siksastaka_Sloki_2-4" */
const RECORD_ID_UNDERSCORE_RE = new RegExp('^(' + RECORD_ID_CORE + ')_(.+)$');

/**
 * Known author name variants → canonical name.
 * Add new variants here as they are discovered.
 */
const AUTHORS = {
  'Шрила Бхакти Ракшак Шридхар Дев-Госвами Махарадж':             'Шрила Бхакти Ракшак Шридхар Дев-Госвами Махарадж',
  'Шрила Б.Р. Шридхар Махарадж':                                  'Шрила Бхакти Ракшак Шридхар Дев-Госвами Махарадж',
  'Шрила Бхакти Ракшак Шрила Шридхар Дев-Шрила Госвами Махарадж': 'Шрила Бхакти Ракшак Шридхар Дев-Госвами Махарадж',
  'Шрила Бхакти Ракшак Шрила Шридхар Дев-Госвами Махарадж':       'Шрила Бхакти Ракшак Шридхар Дев-Госвами Махарадж',
  'Бхакти Ракшак Шридхар Дев-Госвами Махарадж':                   'Шрила Бхакти Ракшак Шридхар Дев-Госвами Махарадж',
  'Шрила Шридхар Махарадж':                                        'Шрила Бхакти Ракшак Шридхар Дев-Госвами Махарадж',
};

/** Return the index of the next non-empty line starting from fromIndex, or -1. */
function nextNonEmpty(lines, fromIndex) {
  for (let i = fromIndex; i < lines.length; i++) {
    if (lines[i].trim() !== '') return i;
  }
  return -1;
}

/** Extract inner text from a standalone **...** line, or null. */
function boldInner(line) {
  const m = line.trim().match(/^\*\*(.+?)\*\*$/);
  return m ? m[1].trim() : null;
}

/**
 * Parse a header line that may contain a record ID and an optional title.
 * Separator between ID and title can be:
 *   - underscore: 1982.04.27.B2.C1_Siksastaka_Sloki_2-4
 *   - dot+space:  1981.09.01.B.C. Духовные чувства...
 * Returns { id, title } or null if the string is not a record ID line.
 */
function parseRecordIdLine(raw) {
  let stripped = raw.endsWith('.') ? raw.slice(0, -1) : raw;
  // Plain ID, no title
  if (RECORD_ID_RE.test(stripped)) {
    return { id: stripped, title: null };
  }

  stripped = stripped.replace(/\*/g, '');

  // ID + ". " + title: 1981.09.01.B.C. Духовные чувства...
  const dotSpaceMatch = stripped.match(RECORD_ID_DOT_SPACE_RE);
  if (dotSpaceMatch) return { id: dotSpaceMatch[1], title: dotSpaceMatch[2] };

  // ID + "_" + title: 1982.04.27.B2.C1_Siksastaka_Sloki_2-4
  const underscoreMatch = stripped.match(RECORD_ID_UNDERSCORE_RE);
  if (underscoreMatch) return { id: underscoreMatch[1], title: underscoreMatch[2] };

  return null;
}

/** Returns the record ID string from a raw value, or null. */
function parseRecordId(raw) {
  const result = parseRecordIdLine(raw);
  return result ? result.id : null;
}

/** Returns true if the line is a "header" line (bold, plain record_id, or known plain-text author). */
function isHeaderLine(raw) {
  return boldInner(raw) !== null || parseRecordId(raw) !== null || AUTHORS[raw.trim()] !== undefined;
}

/** Remove a line at index and strip any now-leading blank lines from the result. */
function removeLine(lines, index) {
  const result = [...lines.slice(0, index), ...lines.slice(index + 1)];
  while (result.length > 0 && result[0].trim() === '') {
    result.shift();
  }
  return result;
}

module.exports = { RECORD_ID_CORE, RECORD_ID_RE, AUTHORS, nextNonEmpty, boldInner, parseRecordIdLine, parseRecordId, isHeaderLine, removeLine };

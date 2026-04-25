/*
Reads all .md filenames from the input folders (output/02-md-improve/),
extracts the title slug from each filename — the part after the record ID
and optional author slug — and writes the results to filename-titles.json.

Filename structure:
  <record_id>[_<authorSlug>][_<titleSlug>].md

  record_id: YYYY.MM.DD[.suffix...] or YYYY_MM_DD
  authorSlug: a single underscore-delimited segment matching a known author pattern
  titleSlug:  everything after the authorSlug (or after the record_id when no author)

Only files that produce a non-empty titleSlug are included in the output.

Output: 03-md-yml/filename-titles.json
  Array of { group, filename, id, titleSlug }
*/

const fs   = require('fs');
const path = require('path');
const configList = require('./config.json');
const { RECORD_ID_CORE } = require('./plugins/extractors/helpers');

// Case-insensitive match for a single filename segment that is an author slug.
// Add new variants here as needed.
const AUTHOR_SLUG_RE = /^sh?ridhar_?mj$/i;


// Dot-based record ID: 1981.03.07  or  1981.03.07.A  or  1981.03.07.B2.C1
// Also handles trailing annotation in parens: 1982.02.18.B (OPR_1.6)
const DOT_ID_RE = new RegExp('^(' + RECORD_ID_CORE + String.raw`)(?:\s*\(([^)]*)\))?(?:_(.+))?$`);

// Underscore-based date: 1980_07_11  or year-only: 1987
const US_ID_RE  = /^(\d{4}(?:_\d{2}_\d{2})?)(?:_(.+))?$/;

/**
 * Parse a filename stem (no extension) into { id, titleSlug }.
 * Returns null when no record ID is detected.
 */
function parseFilenameStem(stem) {
  let id = null;
  let rest = null;

  let m = stem.match(DOT_ID_RE);
  if (m) {
    id   = m[1];
    const paren = m[2] || null;
    rest = m[3] || null;
    if (!rest && paren) rest = `(${paren})`;
  } else {
    m = stem.match(US_ID_RE);
    if (m) {
      id   = m[1];
      rest = m[2] || null;
    }
  }

  if (!id) return null;
  if (!rest) return { id, titleSlug: null };

  // Strip leading author slug if present
  const firstSep = rest.indexOf('_');
  const firstSegment = firstSep === -1 ? rest : rest.slice(0, firstSep);
  if (AUTHOR_SLUG_RE.test(firstSegment)) {
    const titleSlug = firstSep === -1 ? null : rest.slice(firstSep + 1) || null;
    return { id, titleSlug };
  }

  return { id, titleSlug: rest };
}

const results = [];

for (const entry of configList) {
  const inputDir = path.resolve(__dirname, '..', entry.input);

  if (!fs.existsSync(inputDir)) {
    console.warn(`Skipping missing input dir: ${inputDir}`);
    continue;
  }

  const files = fs.readdirSync(inputDir)
    .filter(f => f.toLowerCase().endsWith('.md'))
    .sort();

  for (const file of files) {
    const stem = file.replace(/\.md$/i, '');
    const parsed = parseFilenameStem(stem);

    if (!parsed || !parsed.titleSlug) {
      continue;

    }
    if (parsed.titleSlug.toLowerCase() === 'ru') {
      continue;
    }

    results.push({
      group:     entry.id,
      filename:  file,
      titleSlug: parsed.titleSlug,
    });
  }
}

const outputPath = path.join(__dirname, 'filename-titles.json');
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2) + '\n', 'utf8');

console.log(`Done. ${results.length} filename titles written to ${outputPath}`);

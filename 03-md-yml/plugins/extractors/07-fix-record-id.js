/*
Post-processor: fix_record_id

Operates on meta.record_id already extracted by the record-id extractor.

1. Converts Cyrillic lookalike letters to Latin equivalents:
     А → A, В → B, С → C, Х → X
2. Expands merged multi-letter tokens: AB → A.B, ABC → A.B.C, etc.
3. Validates the suffix (parts after YYYY.MM.DD):
     each token must match [ABCDEX]\d? (letter A/B/C/D/E/X + optional single digit)
4. Logs an error for any suffix token containing an unexpected letter.
5. Also fixes the record_id derived from the filename and stores it as
   meta.filename_record_id for later mismatch validation.
*/

const { parseRecordIdLine } = require('./helpers');

/** Cyrillic look-alike → Latin equivalent */
const CYRILLIC_TO_LATIN = {
  '\u0410': 'A', // А → A
  '\u0412': 'B', // В → B
  '\u0421': 'C', // С → C
  '\u0425': 'X', // Х → X
};

/** Replace Cyrillic lookalike characters with Latin equivalents. */
function replaceCyrillic(str) {
  return str.split('').map(ch => CYRILLIC_TO_LATIN[ch] ?? ch).join('');
}

/** Valid suffix token: A/B/C/D/E/X optionally followed by a single digit */
const SUFFIX_TOKEN_RE = /^[ABCDEX]\d?$/;

/** Known record_ids with unconventional but accepted suffix tokens — skip validation error. */
const KNOWN_IRREGULAR_IDS = new Set([
  '1983.11.09.C5.1',
  '1981.11.10.B1.2',
  '1982.09.29.B30',
  '1982.07.03.Br',
  '1981.11.29.A.0',
]);

/** Expand a token of merged letters (no digits) into individual dot-separated tokens.
 *  e.g. "AB" → ["A","B"], "ABC" → ["A","B","C"], "A1" → ["A1"] (unchanged). */
function expandMergedToken(token) {
  // Only expand if token is all letters (no digits) and length > 1
  if (token.length > 1 && /^[A-Z]+$/.test(token)) {
    return token.split('');
  }
  return [token];
}

/**
 * Fix and validate a record_id string.
 * @param {string} recordId - raw record_id value
 * @returns {{ fixed: string, errors: string[] }}
 */
function fixRecordId(recordId) {
  const errors = [];

  // Convert Cyrillic lookalikes first, then replace commas with dots
  const converted = replaceCyrillic(recordId).replace(/,/g, '.');

  // Split: first 3 dot-parts are the date (YYYY.MM.DD), rest are suffix tokens
  const parts = converted.split('.');
  const dateParts = parts.slice(0, 3);
  const rawSuffixParts = parts.slice(3).filter(t => t !== '');

  // Expand merged tokens (AB → A, B) then validate each
  const suffixParts = rawSuffixParts.flatMap(expandMergedToken);

  if (!KNOWN_IRREGULAR_IDS.has(converted)) {
    for (const token of suffixParts) {
      if (!SUFFIX_TOKEN_RE.test(token)) {
        errors.push(`record_id has invalid suffix token "${token}" (expected [ABCDEX] with optional digit) — full id: "${converted}"`);
      }
    }
  }

  const fixed = [...dateParts, ...suffixParts].join('.');
  return { fixed, errors };
}

/**
 * Plugin entry point. Reads currentMeta.record_id, fixes Cyrillic and validates suffix.
 * Also parses the filename to produce meta.filename_record_id for mismatch validation.
 * @param {string} content - markdown content (passed through unchanged)
 * @param {string} fileName
 * @param {Object} currentMeta - meta accumulated so far
 * @returns {{ content: string, meta: Object, modified: boolean, warnings: string[], errors: string[] }}
 */
function fixRecordIdPlugin(content, fileName, currentMeta) {
  const raw = currentMeta.record_id;
  const meta = {};
  const errors = [];

  // Fix content record_id
  if (raw && typeof raw === 'string') {
    const { fixed, errors: fixErrors } = fixRecordId(raw);
    if (fixed !== raw) meta.record_id = fixed;
    errors.push(...fixErrors);
  }

  // Parse and fix filename-derived record_id
  const fileNameStem = (fileName || '').replace(/\.md$/, '');
  const parsedFromFile = fileNameStem ? parseRecordIdLine(fileNameStem) : null;
  if (parsedFromFile && parsedFromFile.id) {
    const { fixed: fixedFileId } = fixRecordId(parsedFromFile.id);
    meta.filename_record_id = fixedFileId;
  }

  const modified = Object.keys(meta).length > 0;

  return { content, meta, modified, warnings: [], errors };
}

module.exports = { fixRecordIdPlugin, fixRecordId };

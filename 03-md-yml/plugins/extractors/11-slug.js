/*

generates meta.slug

slug = meta.record_id + (meta.title_from_filename || meta.title)

use rules for cyrylic to english transformations

*/

/** Cyrillic → Latin transliteration table (lowercase only; input is lowercased before lookup) */
const CYRILLIC_MAP = {
  'а': 'a',
  'б': 'b',
  'в': 'v',
  'г': 'g',
  'д': 'd',
  'е': 'e',
  'ё': 'yo',
  'ж': 'zh',
  'з': 'z',
  'и': 'i',
  'й': 'y',
  'к': 'k',
  'л': 'l',
  'м': 'm',
  'н': 'n',
  'о': 'o',
  'п': 'p',
  'р': 'r',
  'с': 's',
  'т': 't',
  'у': 'u',
  'ф': 'f',
  'х': 'h',
  'ц': 'ts',
  'ч': 'ch',
  'ш': 'sh',
  'щ': 'shch',
  'ъ': '',
  'ы': 'y',
  'ь': '',
  'э': 'e',
  'ю': 'yu',
  'я': 'ya',
};

function transliterate(str) {
  return str
    .toLowerCase()
    .split('')
    .map(ch => (CYRILLIC_MAP[ch] !== undefined ? CYRILLIC_MAP[ch] : ch))
    .join('');
}

function toSlugPart(str) {
  return transliterate(str)
    .replace(/\s*-{2,}\s*/g, '-')  // normalize " --- " / " -- " → "-"
    .replace(/\s*-\s*/g, '-')      // normalize " - " → "-"
    .replace(/[^a-z0-9-]+/g, '_') // other non-alphanumeric → underscore
    .replace(/^[_-]+|[_-]+$/g, ''); // trim leading/trailing separators
}

const TITLE_MAX_CHARS = 200;

function limitTitleSlug(slug) {
  if (slug.length <= TITLE_MAX_CHARS) return slug;
  const cut = slug.slice(0, TITLE_MAX_CHARS);
  const lastSep = Math.max(cut.lastIndexOf('_'), cut.lastIndexOf('-'));
  let limited = lastSep > 0 ? cut.slice(0, lastSep) : cut;
  limited = limited.replace(/[_-]+$/g, '');
  // drop trailing short words (1-3 chars) left by the cut
  limited = limited.replace(/([_-][a-z0-9]{1,3})+$/g, '');
  return limited.replace(/[_-]+$/g, '');
}

function generateSlug(content, fileName, currentMeta = {}) {
  const warnings = [];
  const errors = [];

  const recordId = currentMeta.record_id;
  if (!recordId) {
    return { content, meta: {}, modified: false, warnings, errors };
  }

  const title = (currentMeta.legacy && currentMeta.legacy.title_from_filename) || currentMeta.title;

  const idPart = recordId.toLowerCase().replace(/\./g, '-');
  const titlePart = title ? limitTitleSlug(toSlugPart(title)) : '';
  const slug = titlePart ? `${idPart}_${titlePart}` : idPart;

  return {
    content,
    meta: { slug },
    modified: true,
    warnings,
    errors,
  };
}

module.exports = { generateSlug };

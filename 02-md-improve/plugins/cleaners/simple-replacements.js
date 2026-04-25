/*
Simple text replacements for cleaning markdown files
*/

/**
 * Apply simple text replacements to clean up content
 * @param {string} content - The markdown content
 * @returns {Object} - { content: string, modified: boolean }
 */
function applySimpleReplacements(content) {
  let result = content;
  let modified = false;

  // Remove javascript:void(0); links
  const beforeJavascript = result;
  result = result.replace(/\(javascript:void\(0\);\)/g, '');
  if (result !== beforeJavascript) {
    modified = true;
  }

  // Fix `*#[00:00:]57#*`
  const before2 = result;
  result = result.replace(/\*#\[(\d\d:\d\d:)\](\d\d)#\*/g, '*#[$1$2]#*');
  if (result !== before2) {
    modified = true;
  }

  // Fix non-breaking space (U+00A0) - replace with regular space
  const before3 = result;
  result = result.replace(/\u00A0/g, ' ');
  if (result !== before3) {
    modified = true;
  }

  // Replace escaped quotes, no need in markdown:
  // `\'` -> `'`
  // `\"` ->  `"`
  const before4 = result;
  result = result.replace(/\\'/g, "'");
  result = result.replace(/\\"/g, '"');
  if (result !== before4) {
    modified = true;
  }

  return {
    content: result,
    modified
  };
}

module.exports = { applySimpleReplacements };

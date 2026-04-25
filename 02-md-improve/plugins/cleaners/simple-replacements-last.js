/*
Simple text replacements for cleaning markdown files
*/

/**
 * Apply simple text replacements to clean up content
 * @param {string} content - The markdown content
 * @returns {Object} - { content: string, modified: boolean }
 */
function applySimpleReplacementsLast(content) {
  let result = content;
  let modified = false;

  // Add space after , if not present
  const before4 = result;
  result = result.replace(/\s*,([^\*\s\\\]\[C])/g, ', $1'); // C - for 1983.01.26.B,C_SridharMj_Bojestvennaya_lubov
  if (result !== before4) {
    modified = true;
  }

  // Replace " , " to ", ".
  const before5 = result;
  result = result.replace(/\s,\s/g, ', ');
  if (result !== before5) {
    modified = true;
  }

  return {
    content: result,
    modified
  };  
}

module.exports = { applySimpleReplacementsLast };

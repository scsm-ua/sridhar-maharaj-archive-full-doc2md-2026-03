/**
 * Backslash Escapes Remover
 * 
 * Removes backslash escapes before markdown characters (#, [, ], .)
 */

/**
 * Remove backslash escapes before markdown characters
 * @param {string} content - Content to clean
 * @returns {string} - Cleaned content
 */
function removeBackslashEscapes(content) {
  return content.replace(/\\([#\[\].])/g, '$1');
}

module.exports = { removeBackslashEscapes };

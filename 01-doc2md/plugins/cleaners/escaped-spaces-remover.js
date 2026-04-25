/**
 * Escaped Spaces Remover
 * 
 * Removes escaped spaces (\ ) that pandoc adds from RTF files
 */

/**
 * Remove escaped spaces
 * @param {string} content - Content to clean
 * @returns {string} - Cleaned content
 */
function removeEscapedSpaces(content) {
  return content.replace(/\\ /g, ' ');
}

module.exports = { removeEscapedSpaces };

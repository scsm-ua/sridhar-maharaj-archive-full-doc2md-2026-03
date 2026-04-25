/**
 * Trailing Backslashes Remover
 * 
 * Removes trailing backslashes only if followed by a blank line
 * Preserves backslashes used for line continuation (like in verses)
 */

/**
 * Remove trailing backslashes before blank lines
 * @param {string} content - Content to clean
 * @returns {string} - Cleaned content
 */
function removeTrailingBackslashes(content) {
  // Remove backslash only if next line is empty (blank line follows)
  // This preserves line continuation backslashes but removes unnecessary ones
  return content.replace(/\\\n\n/g, '\n\n');
}

module.exports = { removeTrailingBackslashes };

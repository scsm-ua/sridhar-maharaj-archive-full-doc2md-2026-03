/**
 * RTF Characters Remover
 * 
 * Removes RTF escape characters (^) except in footnote markers [^1]
 */

/**
 * Remove ^ characters that appear between text (not in footnotes)
 * @param {string} content - Content to clean
 * @returns {string} - Cleaned content
 */
function removeRtfChars(content) {
  // Keep [^1] style footnotes but remove ^t^e^x^t^ patterns
  // Use a more compatible regex without lookbehind
  return content.replace(/\^(?!\d+\])/g, '');
}

module.exports = { removeRtfChars };

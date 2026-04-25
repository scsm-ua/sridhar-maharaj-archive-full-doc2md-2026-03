/**
 * Encoding Detector
 * 
 * Detects potential Windows-1251 encoding corruption in the output
 * without attempting to fix it. Used to warn when soffice conversion
 * may not have worked properly.
 */

/**
 * Check for Windows-1251 encoding corruption patterns
 * @param {string} content - Content to check
 * @param {string} filename - Filename for logging context
 * @returns {boolean} - True if corruption detected
 */
function detectEncodingIssues(content, filename = '') {
  // Check for corrupted Cyrillic patterns (Windows-1251 misinterpreted as Latin-1)
  const hasCorrupted = /[ØÐðÈèÀàÌìÅåÔôÁáÝýÊêÇçÓóÛûÍíÃãÑñËëÏïÞþÄäÖöõ]{2,}/.test(content);
  const hasCyrillic = /[а-яёА-ЯЁ]/.test(content);
  
  // If we have corrupted patterns but no valid Cyrillic, encoding failed
  if (hasCorrupted && !hasCyrillic) {
    const contextPrefix = filename ? `[${filename}] ` : '';
    console.warn(`⚠️  ${contextPrefix}Encoding issue detected: Found corrupted Windows-1251 characters`);
    console.warn(`   This may indicate soffice conversion failed. Check the output file.`);
    return true;
  }
  
  // Mixed case: both corrupted and valid Cyrillic (partial corruption)
  if (hasCorrupted && hasCyrillic) {
    const contextPrefix = filename ? `[${filename}] ` : '';
    console.warn(`⚠️  ${contextPrefix}Partial encoding corruption detected`);
    return true;
  }
  
  return false;
}

module.exports = { detectEncodingIssues };

/*
Add line breaks (backslashes) to multi-line italic blocks

if there are two italic lines 
```
*line1*

*line2*
```
and blank line between them, remove blank line and add \ like this:
```
*line1*\
*line2*
```
*/

function isItalicLine(line, possibleFootnote=false, possibleScriptureName=false) {

    // Skip timecode.
    if (/\d\d:\d\d:\d\d/.test(line)) {
        return false;
    }

    if (possibleScriptureName) {
        if (/^\(.+\)$/.test(line)) {
            return true;
        }
    }

    // Match *text* but not **text** (bold) or ***text*** (bold+italic)
    // Use negative lookahead to ensure exactly 1 asterisk, not more
    /**
     * Matches a line containing italic text with optional trailing content.
     * 
     * @param {string} line - The input line to be parsed and trimmed
     * @returns {Array|null} An array where:
     *   - m[0]: The full matched string
     *   - m[1]: Any content after the closing asterisk and optional ellipsis
     *   Or null if the pattern doesn't match
     * 
     * @description
     * The regex pattern matches:
     * - `^` - Start of string
     * - `\*(?!\*)` - Single asterisk not followed by another asterisk
     * - `(?!\d)` - Not followed by a digit
     * - `.+` - One or more characters (italic content)
     * - `(?<!:)(?<!\*)` - Not preceded by colon or asterisk
     * - `\*(?!\*)` - Closing single asterisk not followed by another asterisk
     * - `(?:\.\.\.)?` - Optional ellipsis
     * - `(.*)$` - Capture any remaining content until end of line (group 1)
     */
    var m = line.trim().match(/^\*(?!\*)(?!\d).+(?<!:)(?<!\*)\*(?!\*)(?:\.\.\.)?(.*)$/);
    if (m) {
        if (!m[1]) {
            return true;
        }
        if (possibleFootnote) {
            if (m[1].match(/^\s*\([^\)]+\)$/)) {
                return true;
            }
            if (m[1].match(/^\s*\[\^\d+\]$/)) {
                return true;
            }
        }
    }
}

function isEmptyLine(line) {
    return !line.trim();
}

/**
 * Add backslash line breaks to multi-line italic blocks
 * @param {string} content - The markdown content
 * @returns {Object} - { content: string, modified: boolean }
 */
function addItalicLineBreaks(content) {
  const lines = content.split('\n');
  let modified = false;
  let i = 0;
  
  while (i < lines.length) {

    // Start check from 4rd row. Frist 3 maybe header.
    if (i >= 4) {
        if (isItalicLine(lines[i], true, true)
            && isEmptyLine(lines[i-1])
            && isItalicLine(lines[i-2])) {
                // Remove the empty line
                lines.splice(i-1, 1);
                modified = true;
                // Add backslash to previous italic line if not already there
                if (!lines[i-2].endsWith('\\')) {
                    lines[i-2] = lines[i-2] + '\\';
                    modified = true;
                }

                // Don't increment i since we removed a line
                continue;
            }
    }
    
    i++;
  }
  
  return {
    content: lines.join('\n'),
    modified
  };
}

module.exports = { addItalicLineBreaks };

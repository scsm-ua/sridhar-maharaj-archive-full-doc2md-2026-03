/*
Add line breaks (backslashes) to multi-line italic blocks

if there are two bold lines 
```
**line1**

**line2**
```
and blank line between them, remove blank line and add \ like this:
```
**line1**\
**line2**
```
*/

function isBoldLine(line, possibleFootnote=false) {
    // Match **text** but not if text starts with digit or ends with :
    var m = line.trim().match(/^\*\*(?!\d).+(?<!:)\*\*(.*)$/);
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
 * Add backslash line breaks to multi-line italic/bold blocks
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
        if (isBoldLine(lines[i], true)
            && isEmptyLine(lines[i-1])
            && isBoldLine(lines[i-2])) {
                // Remove the empty line
                lines.splice(i-1, 1);
                modified = true;
                // Add backslash to previous bold line if not already there
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

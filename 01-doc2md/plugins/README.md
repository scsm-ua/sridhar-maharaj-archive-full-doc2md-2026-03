# Doc2MD Plugins

This folder contains post-processing plugins for the document conversion pipeline.

## Available Plugins

### rtf-cleanup.js

Cleans up artifacts from RTF to Markdown conversion:
- Fixes Windows-1251 encoding issues (corrupted Cyrillic characters)
- Removes RTF escape characters (`^`) except in footnote markers `[^1]`
- Removes escaped spaces (`\ `)

**Usage:**
```javascript
const { cleanRtfArtifacts } = require('./plugins/rtf-cleanup');

const content = fs.readFileSync('file.md', 'utf-8');
const result = cleanRtfArtifacts(content);
// result: { content: string, fixed: boolean, cleaned: boolean }
```

## Adding New Plugins

To create a new plugin:

1. Create a new file in this folder (e.g., `my-plugin.js`)
2. Export a function that processes content:
   ```javascript
   function myPlugin(content) {
     // Process content
     return {
       content: modifiedContent,
       // ... any metadata about what was changed
     };
   }
   
   module.exports = { myPlugin };
   ```
3. Import and use in `convert-doc2md.js`:
   ```javascript
   const { myPlugin } = require('./plugins/my-plugin');
   
   // After conversion
   const result = myPlugin(content);
   ```

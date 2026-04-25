/**
 * 
Read 04-rename/config.json

Copy files with new names according to

        "docs_rename": "output/04-rename/docs-rename.json",
        "mp3_rename": "output/04-rename/mp3-rename.json",

Original files are left untouched.

 */

const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const ROOT = path.join(__dirname, '..');

function applyRename(renameMapPath, label) {
  const mapPath = path.join(ROOT, renameMapPath);
  if (!fs.existsSync(mapPath)) {
    console.error(`Rename map not found: ${renameMapPath}`);
    process.exit(1);
  }

  const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const entries = Object.entries(map);

  // Ensure all target directories exist
  const targetDirs = new Set(entries.map(([, target]) => path.dirname(path.join(ROOT, target))));
  targetDirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

  let copied = 0;
  let skipped = 0;

  entries.forEach(([source, target]) => {
    const srcPath = path.join(ROOT, source);
    const dstPath = path.join(ROOT, target);

    if (!fs.existsSync(srcPath)) {
      console.warn(`Source not found: ${source}`);
      skipped++;
      return;
    }

    fs.copyFileSync(srcPath, dstPath);
    copied++;
  });

  console.log(`${label}: ${copied} copied, ${skipped} skipped → ${path.dirname(renameMapPath)}`);
}

applyRename(config.output.docs_rename, 'Docs');
applyRename(config.output.mp3_rename, 'MP3s');

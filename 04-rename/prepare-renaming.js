/*

Read 04-rename/config.json and create

        "docs_rename": "output/04-rename/docs-rename.json",
        "mp3_rename": "output/04-rename/mp3-rename.json",

files with key value - source file relative path - targen rename file path.

Rename all files using recored_id as filename. Extensions are md and mp3.

*/

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { getMDFilename, getMP3Filename } = require('../utils');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const ROOT = path.join(__dirname, '..');

const docsRename = {};
const mp3Rename = {};
const warnings = [];

config.groups.forEach(group => {
  const inputDir = path.join(ROOT, group.input);
  const mp3Dir = path.join(ROOT, group.mp3);

  if (!fs.existsSync(inputDir)) {
    warnings.push(`Input dir not found: ${group.input}`);
    console.warn(`Input dir not found: ${group.input}`);
    return;
  }

  const files = fs.readdirSync(inputDir).filter(f => f.toLowerCase().endsWith('.md'));

  files.forEach(file => {
    const filePath = path.join(inputDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      warnings.push(`No frontmatter in: ${file}`);
      console.warn(`No frontmatter in: ${file}`);
      return;
    }

    let meta;
    try {
      meta = yaml.load(fmMatch[1]);
    } catch (e) {
      warnings.push(`Failed to parse frontmatter in: ${file}`);
      console.warn(`Failed to parse frontmatter in: ${file}`);
      return;
    }

    const recordId = meta.record_id;
    if (!recordId) {
      warnings.push(`No record_id in: ${file}`);
      console.warn(`No record_id in: ${file}`);
      return;
    }

    // Docs rename mapping
    docsRename[`${group.input}/${file}`] = `${config.output.docs}/${getMDFilename(meta)}`;

    // MP3 rename mapping: prefer override_mp3, fall back to legacy_filename
    const overrideMp3 = meta.override_mp3;
    const legacyFilename = meta.legacy_filename;
    const mp3File = overrideMp3 || (legacyFilename ? `${legacyFilename}.mp3` : null);
    if (mp3File) {
      if (fs.existsSync(path.join(mp3Dir, mp3File))) {
        const mp3Source = `${group.mp3}/${mp3File}`;
        if (mp3Rename[mp3Source]) {
          const msg = `Duplicate MP3 source: ${mp3Source} claimed by ${recordId} and ${path.basename(mp3Rename[mp3Source], '.mp3')}`;
          warnings.push(msg);
          console.warn(msg);
        }
        const mp3path = getMP3Filename(meta);
        if (mp3path !== meta.mp3) {
          warnings.push(`Wrong MP3 path: ${mp3path} ${meta.mp3}`);
        }
        mp3Rename[mp3Source] = `${config.output.mp3}/${mp3path}`;
      } else {
        warnings.push(`MP3 not found: ${mp3File}`);
        console.warn(`MP3 not found: ${mp3File}`);
      }
    }
  });
});

// Write output files
const docsRenameOut = path.join(ROOT, config.output.docs_rename);
const mp3RenameOut = path.join(ROOT, config.output.mp3_rename);

fs.mkdirSync(path.dirname(docsRenameOut), { recursive: true });

fs.writeFileSync(docsRenameOut, JSON.stringify(docsRename, null, 2), 'utf8');
fs.writeFileSync(mp3RenameOut, JSON.stringify(mp3Rename, null, 2), 'utf8');

// --- Validation 1: duplicate target filenames ---
const docTargets = Object.values(docsRename);
const mp3Targets = Object.values(mp3Rename);

const docDups = docTargets.filter((v, i) => docTargets.indexOf(v) !== i);
const mp3Dups = mp3Targets.filter((v, i) => mp3Targets.indexOf(v) !== i);

if (docDups.length) {
  docDups.forEach(t => {
    const sources = Object.entries(docsRename).filter(([, v]) => v === t).map(([k]) => k);
    const msg = `Duplicate doc target: ${t} ← ${sources.join(', ')}`;
    warnings.push(msg);
    console.warn(msg);
  });
}
if (mp3Dups.length) {
  mp3Dups.forEach(t => {
    const sources = Object.entries(mp3Rename).filter(([, v]) => v === t).map(([k]) => k);
    const msg = `Duplicate mp3 target: ${t} ← ${sources.join(', ')}`;
    warnings.push(msg);
    console.warn(msg);
  });
}

// --- Validation 2: docs vs mp3 coverage ---
const docIds = new Set(Object.values(docsRename).map(v => path.basename(v, '.md')));
const mp3Ids = new Set(Object.values(mp3Rename).map(v => path.basename(v, '.mp3').replace(/_\w+$/, '')));

const docsWithoutMp3 = [...docIds].filter(id => !mp3Ids.has(id));
const mp3WithoutDocs = [...mp3Ids].filter(id => !docIds.has(id));

if (docsWithoutMp3.length) {
  docsWithoutMp3.forEach(id => {
    const msg = `Doc has no MP3: ${id}`;
    warnings.push(msg);
    console.warn(msg);
  });
}
if (mp3WithoutDocs.length) {
  mp3WithoutDocs.forEach(id => {
    const msg = `MP3 has no doc: ${id}`;
    warnings.push(msg);
    console.warn(msg);
  });
}

// --- Validation 3: MP3 input files not covered by rename mapping ---
config.groups.forEach(group => {
  const mp3Dir = path.join(ROOT, group.mp3);
  if (!fs.existsSync(mp3Dir)) return;
  const inputMp3s = fs.readdirSync(mp3Dir).filter(f => f.toLowerCase().endsWith('.mp3'));
  inputMp3s.forEach(f => {
    const key = `${group.mp3}/${f}`;
    if (!mp3Rename[key]) {
      const msg = `MP3 not renamed: ${key}`;
      warnings.push(msg);
      console.warn(msg);
    }
  });
});

const warningsLogPath = path.join(__dirname, 'warnings.log');
fs.writeFileSync(warningsLogPath, warnings.join('\n') + (warnings.length ? '\n' : ''), 'utf8');

console.log(`Docs rename: ${Object.keys(docsRename).length} entries → ${config.output.docs_rename}`);
console.log(`MP3 rename:  ${Object.keys(mp3Rename).length} entries → ${config.output.mp3_rename}`);
console.log(`Warnings:    ${warnings.length} → ${path.relative(ROOT, warningsLogPath)}`);

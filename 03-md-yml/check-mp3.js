/*
Checks that each .md file in the output folder has a corresponding MP3
on the remote server defined in config.json (mp3_base).

For each file it sends a Range GET request and reports:
  - HTTP 404        → error: not found
  - non-audio MIME  → error: unexpected content-type
  - network error   → error: request failed
  - 2xx + audio     → OK (logged to console only)

File size and audio duration are collected into mp3-meta.json.
MP3 probing logic lives in mp3-probe.js.

Usage:
  node 03-md-yml/check-mp3.js            # all config items
  node 03-md-yml/check-mp3.js --id=2     # single config item
  node 03-md-yml/check-mp3.js --limit=10 # first N files per item
*/

const fs   = require('fs');
const path = require('path');
const yaml  = require('js-yaml');
const { probeRemoteMp3 } = require('./mp3-probe');

const ROOT          = path.join(__dirname, '..');
const CONFIG_PATH   = path.join(__dirname, 'config.json');
const ERROR_LOG     = path.join(__dirname, 'errors_mp3.md');
const MP3_META_PATH = path.join(__dirname, 'mp3-meta.json');
const META_ERRORS_LOG = path.join(__dirname, 'mp3-meta-errors.log');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// --- CLI args ---
const args = process.argv.slice(2);
let targetId  = null;
let fileLimit = null;
args.forEach(arg => {
  if (arg.startsWith('--id='))    targetId  = parseInt(arg.split('=')[1]);
  if (arg.startsWith('--limit=')) fileLimit = parseInt(arg.split('=')[1]);
});

// --- helpers ---
/** Extract legacy.mp3 from YAML frontmatter of a file, or null. */
function readOverrideMp3(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const meta = yaml.load(m[1]);
    return (meta && meta.legacy && meta.legacy.mp3) || null;
  } catch {
    return null;
  }
}

function logError(line) {
  fs.appendFileSync(ERROR_LOG, line + '\n', 'utf8');
  console.error('  ✗ ' + line);
}

// --- main ---
const mp3Meta = {}; // { mp3Filename: { size, length } } — written to mp3-meta.json

async function checkItem(item) {
  const outputDir = path.join(ROOT, item.output);
  if (!fs.existsSync(outputDir)) {
    console.warn(`  ⚠️  output dir not found: ${item.output}`);
    return;
  }

  let files = fs.readdirSync(outputDir).filter(f => f.endsWith('.md'));
  if (fileLimit) files = files.slice(0, fileLimit);

  console.log(`\n[${item.id}] ${item.output} — ${files.length} files`);

  for (const file of files) {
    const filePath = path.join(outputDir, file);
    const stem = file.replace(/\.md$/, '');
    const relPath = path.join(item.output, file).replace(/\\/g, '/');

    const override = readOverrideMp3(filePath);
    const mp3Filename = override ? override : stem + '.mp3';
    const url = override
      ? item.mp3_base + encodeURIComponent(override)
      : item.mp3_base + encodeURIComponent(stem) + '.mp3';

    const { status, contentType, totalSize, duration, error } = await probeRemoteMp3(url);

    if (error) {
      logError(`- [](../${relPath}) MP3 request failed: ${error} — ${url}`);
      continue;
    }
    if (status === 404) {
      logError(`- [](../${relPath}) MP3 not found (404): ${url}`);
      continue;
    }
    if (status < 200 || status >= 300) {
      logError(`- [](../${relPath}) MP3 unexpected status ${status}: ${url}`);
      continue;
    }
    if (contentType && !contentType.includes('audio') && !contentType.includes('octet-stream')) {
      logError(`- [](../${relPath}) MP3 unexpected content-type "${contentType}": ${url}`);
      continue;
    }

    const entry = {};
    if (totalSize != null) entry.bytes    = totalSize;
    if (duration  != null) entry.duration = duration;
    mp3Meta[mp3Filename] = entry;

    if (duration == null) {
      fs.appendFileSync(META_ERRORS_LOG, `no duration: ${url}\n`, 'utf8');
      console.warn(`  ⚠️  no duration: ${file}`);
    }

    const sizeStr = totalSize ? ` ${(totalSize / 1024 / 1024).toFixed(1)} MB` : '';
    const durStr  = duration ? ` ${duration}` : '';
    console.log(`  ✓ ${status} ${file}${sizeStr}${durStr}`);
  }
}

async function main() {
  fs.writeFileSync(ERROR_LOG, '', 'utf8');
  fs.writeFileSync(META_ERRORS_LOG, '', 'utf8');

  const items = targetId ? config.filter(c => c.id === targetId) : config;
  if (items.length === 0) {
    console.error(`No config item found for id=${targetId}`);
    process.exit(1);
  }

  for (const item of items) {
    await checkItem(item);
  }

  // Merge with any existing mp3-meta.json so partial runs accumulate
  let existing = {};
  if (fs.existsSync(MP3_META_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(MP3_META_PATH, 'utf8')); } catch {}
  }
  const merged = { ...existing, ...mp3Meta };
  fs.writeFileSync(MP3_META_PATH, JSON.stringify(merged, null, 2), 'utf8');

  const noDuration = Object.values(mp3Meta).filter(e => !e.duration).length;
  console.log(`\nDone. Errors → errors_mp3.md | MP3 meta (${Object.keys(mp3Meta).length} files) → mp3-meta.json`);
  if (noDuration) console.warn(`  ⚠️  ${noDuration} file(s) with no duration → mp3-meta-errors.log`);
}

main().catch(err => { console.error(err); process.exit(1); });


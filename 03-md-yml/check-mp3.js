/*
Checks that each .md file in the output folder has a corresponding MP3
on the remote server defined in config.json (mp3_base).

For each file it sends a HEAD request and reports:
  - HTTP 404        → error: not found
  - non-audio MIME  → error: unexpected content-type
  - network error   → error: request failed
  - 2xx + audio     → OK (logged to console only)

Results are written to errors_mp3.md (errors only).

Usage:
  node 03-md-yml/check-mp3.js            # all config items
  node 03-md-yml/check-mp3.js --id=2     # single config item
  node 03-md-yml/check-mp3.js --limit=10 # first N files per item
*/

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');
const yaml  = require('js-yaml');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const ERROR_LOG   = path.join(__dirname, 'errors_mp3.md');

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
/** Extract override_mp3 from YAML frontmatter of a file, or null. */
function readOverrideMp3(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const meta = yaml.load(m[1]);
    return (meta && meta.override_mp3) || null;
  } catch {
    return null;
  }
}
function headRequest(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.request(url, { method: 'HEAD' }, (res) => {
      resolve({ status: res.statusCode, contentType: res.headers['content-type'] || '' });
    });
    req.on('error', (err) => resolve({ status: null, error: err.message }));
    req.setTimeout(10000, () => { req.destroy(); resolve({ status: null, error: 'timeout' }); });
    req.end();
  });
}

function logError(line) {
  fs.appendFileSync(ERROR_LOG, line + '\n', 'utf8');
  console.error('  ✗ ' + line);
}

// --- main ---
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
    const url = override
      ? item.mp3_base + encodeURIComponent(override)
      : item.mp3_base + encodeURIComponent(stem) + '.mp3';

    const { status, contentType, error } = await headRequest(url);

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

    console.log(`  ✓ ${status} ${file}`);
  }
}

async function main() {
  // Truncate error log
  fs.writeFileSync(ERROR_LOG, '', 'utf8');

  const items = targetId ? config.filter(c => c.id === targetId) : config;
  if (items.length === 0) {
    console.error(`No config item found for id=${targetId}`);
    process.exit(1);
  }

  for (const item of items) {
    await checkItem(item);
  }

  console.log('\nDone. Errors written to errors_mp3.md');
}

main().catch(err => { console.error(err); process.exit(1); });

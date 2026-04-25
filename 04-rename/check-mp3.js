/*

Read config 04-rename/config.json

Read output docs dir from config.output.docs, read each file recursiverly.

From file read meta.mp3 (yaml in markdown).

Check each file "config.mp3_base + meta.mp3" and make head request to check if mp3 file is uploaded.

Errors put to warning.log.

*/

const fs    = require('fs');
const path  = require('path');
const https = require('https');
const http  = require('http');
const yaml  = require('js-yaml');

const ROOT        = path.join(__dirname, '..');
const CONFIG_PATH = path.join(__dirname, 'config.json');
const WARNING_LOG = path.join(__dirname, 'warnings-mp3.log');

const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// --- CLI args ---
const args = process.argv.slice(2);
let fileLimit = null;
args.forEach(arg => {
  if (arg.startsWith('--limit=')) fileLimit = parseInt(arg.split('=')[1]);
});

// --- helpers ---

/** Recursively collect all .md files under dir */
function collectMdFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(full);
    }
  }
  return results;
}

/** Extract mp3 field from YAML frontmatter, or null */
function readMp3Meta(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const m = content.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return null;
    const meta = yaml.load(m[1]);
    return (meta && meta.mp3) || null;
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

let errorCount = 0;
let checkedCount = 0;

function logError(line) {
  errorCount++;
  fs.appendFileSync(WARNING_LOG, line + '\n', 'utf8');
  console.error('  ✗ ' + line);
}

// --- main ---
async function main() {
  fs.writeFileSync(WARNING_LOG, '', 'utf8');

  const docsDir = path.join(ROOT, config.output.docs);
  if (!fs.existsSync(docsDir)) {
    console.error(`Docs directory not found: ${config.output.docs}`);
    process.exit(1);
  }

  let files = collectMdFiles(docsDir);
  if (fileLimit) files = files.slice(0, fileLimit);

  console.log(`Checking ${files.length} files in ${config.output.docs} ...\n`);

  for (const filePath of files) {
    const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    const mp3 = readMp3Meta(filePath);

    if (!mp3) {
      logError(`- [${relPath}](../${relPath}) no mp3 field in frontmatter`);
      continue;
    }

    const url = config.mp3_base + mp3;
    const { status, contentType, error } = await headRequest(url);

    if (error) {
      logError(`- [${relPath}](../${relPath}) request failed: ${error} — ${url}`);
      continue;
    }
    if (status === 404) {
      logError(`- [${relPath}](../${relPath}) not found (404): ${url}`);
      continue;
    }
    if (status < 200 || status >= 300) {
      logError(`- [${relPath}](../${relPath}) unexpected status ${status}: ${url}`);
      continue;
    }
    if (contentType && !contentType.includes('audio') && !contentType.includes('octet-stream')) {
      logError(`- [${relPath}](../${relPath}) unexpected content-type "${contentType}": ${url}`);
      continue;
    }

    checkedCount++;
    console.log(`  ✓ ${status} ${path.relative(docsDir, filePath)} ${url}`);
  }

  console.log(`\nDone. Checked: ${checkedCount}/${files.length}. Errors: ${errorCount}. ${errorCount > 0 ? 'Errors written to warnings-mp3.log' : 'No errors found.'}`);
}

main().catch(err => { console.error(err); process.exit(1); });

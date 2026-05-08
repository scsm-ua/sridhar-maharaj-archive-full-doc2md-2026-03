/*
Reads config.json.

Read input folder, process files with modules in plugins folder.

Script arguments: convert all, convert one item in config, convert file by name.

Input - md file.
Output - md file with YAML frontmatter prefix.

Plugins return { content, meta, modified, warnings? }.
The processor merges all plugin metas and returns { content, meta }.
Final output: rendered YAML frontmatter + cleaned markdown.
*/

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { processMarkdown, orderMeta } = require('./plugins/md-processor');
const { reportDuplicateRecordIds } = require('./plugins/extractors/08-record-id-validator');

/**
 * Renders a meta object as a YAML frontmatter block.
 * @param {Object} meta
 * @returns {string} - YAML block ending with a blank line, or '' if meta is empty
 */
function renderYamlFrontmatter(meta) {
  if (Object.keys(meta).length === 0) return '';
  return '---\n' + yaml.dump(orderMeta(meta), { lineWidth: -1 }) + '---\n\n';
}

// Parse command line arguments
const args = process.argv.slice(2);
let targetId = null;
let fileLimit = null;
let targetFile = null;

args.forEach(arg => {
  if (arg.startsWith('--id=')) {
    targetId = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--limit=')) {
    fileLimit = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--file=')) {
    targetFile = arg.split('=')[1];
  } else if (!arg.startsWith('--')) {
    // Support positional argument for backward compatibility
    if (targetId === null) {
      targetId = parseInt(arg);
    } else if (fileLimit === null) {
      fileLimit = parseInt(arg);
    }
  }
});

// Log file paths: fixed names for full runs, timestamped for targeted runs
const isTargetedRun = !!(targetFile || targetId);
const logSuffix = isTargetedRun
  ? `-${new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)}`
  : '';
const errorLogPath = path.join(__dirname, `errors${logSuffix}.md`);
const warningLogPath = path.join(__dirname, `warnings${logSuffix}.md`);

// Truncate log files at the start of each full run
if (!isTargetedRun) {
  fs.writeFileSync(errorLogPath, '', 'utf8');
  fs.writeFileSync(warningLogPath, '', 'utf8');
}

function logError(message, relPath) {
  const link = relPath ? `[](${relPath.replace(/ /g, '%20')})` : null;
  const entry = link ? `- ${link} ${message}` : `- ${message}`;
  fs.appendFileSync(errorLogPath, entry + '\n', 'utf8');
  console.error(`  ✗ ${message}`);
}

function logWarning(message, relPath) {
  const link = relPath ? `[](${relPath.replace(/ /g, '%20')})` : null;
  const entry = link ? `- ${link} ${message}` : `- ${message}`;
  fs.appendFileSync(warningLogPath, entry + '\n', 'utf8');
}

// Read config file
const configPath = path.join(__dirname, 'config.json');
const configs = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// Filter configs based on target id
const configsToProcess = targetId 
  ? configs.filter(c => c.id === targetId)
  : configs;

if (configsToProcess.length === 0) {
  logError(`No config found with id: ${targetId}`);
  process.exit(1);
}

console.log(`Processing ${configsToProcess.length} config(s)...`);
if (targetFile) {
  console.log(`🔍 File filter: "${targetFile}"\n`);
} else if (fileLimit) {
  console.log(`⚠️  File limit set: processing maximum ${fileLimit} file(s) per config\n`);
}

// Process each config
configsToProcess.forEach(config => {
  console.log(`\n=== Processing config id: ${config.id} ===`);
  
  const inputDir = path.join(__dirname, '..', config.input);
  const outputDir = path.join(__dirname, '..', config.output);
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Created output directory: ${outputDir}`);
  }
  
  // Check if input directory exists
  if (!fs.existsSync(inputDir)) {
    logError(`Input directory not found: ${inputDir}`);
    return;
  }
  
  // Get all markdown files
  const allFiles = fs.readdirSync(inputDir)
    .filter(file => file.toLowerCase().endsWith('.md'));
  
  // Filter by file name if specified
  let filteredFiles = allFiles;
  if (targetFile) {
    filteredFiles = allFiles.filter(file => 
      file.toLowerCase().includes(targetFile.toLowerCase())
    );
    
    if (filteredFiles.length === 0) {
      console.log(`⚠️  No files matching "${targetFile}" found in config ${config.id}`);
      return;
    }
  }
  
  // Apply limit if specified
  const filesToProcess = fileLimit 
    ? filteredFiles.slice(0, fileLimit)
    : filteredFiles;
  
  if (fileLimit && filteredFiles.length > fileLimit) {
    console.log(`   Skipping ${filteredFiles.length - filesToProcess.length} file(s)`);
  } else {
    console.log(`Found ${filteredFiles.length} file(s) to process`);
  }
  
  // Process each file
  let processedCount = 0;
  filesToProcess.forEach((file, index) => {
    const inputPath = path.join(inputDir, file);
    const outputPath = path.join(outputDir, file);
    
    console.log(`[${index + 1}/${filesToProcess.length}] Processing: ${file}`);
    
    try {
      const content = fs.readFileSync(inputPath, 'utf-8');
      const result = processMarkdown(content, file, config);

      const yaml = renderYamlFrontmatter(result.meta);
      const output = yaml + result.content;
      fs.writeFileSync(outputPath, output, 'utf-8');

      const status = result.appliedPlugins && result.appliedPlugins.length > 0 
        ? ` (${result.appliedPlugins.join(', ')})` 
        : '';
      console.log(`  ✓ Saved to: ${outputPath}${status}`);

      if (result.warnings && result.warnings.length > 0) {
        const relPath = path.relative(__dirname, outputPath).replace(/\\/g, '/');
        result.warnings.forEach(w => logWarning(w, relPath));
      }
      if (result.errors && result.errors.length > 0) {
        const relPath = path.relative(__dirname, outputPath).replace(/\\/g, '/');
        result.errors.forEach(e => logError(e, relPath));
      }

      processedCount++;
    } catch (error) {
      logError(`Failed to process ${file}: ${error.message}`);
    }
  });
  
  console.log(`\n✅ Config ${config.id}: Processed ${processedCount}/${filesToProcess.length} file(s)`);
});

// Check record_id uniqueness across all processed files
const duplicates = reportDuplicateRecordIds();
if (duplicates.length > 0) {
  console.log(`\n⚠️  Duplicate record_id values found (${duplicates.length}):`);
  duplicates.forEach(({ rid, files }) => {
    console.log(`  "${rid}" used in ${files.length} files:`);
    files.forEach(f => {
      console.log(`    - ${f}`);
      logError(`Duplicate record_id "${rid}"`, null);
    });
  });
} else {
  console.log(`\n✅ All record_ids are unique`);
}

console.log('\n✅ All configs processed!');

const { writeEditorsLog } = require('./plugins/extractors/01-editors');
const editorsLogPath = path.join(__dirname, 'editors.log');
writeEditorsLog(editorsLogPath);
console.log(`📋 Editors log written to: ${editorsLogPath}`);


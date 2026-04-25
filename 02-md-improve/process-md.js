/*
Reads config.json.

Read input folder, process files with modules in plugins folder.

Script arguments: convert all, convert one item in config, convert file by name.

First demo plugin, converts

```
*«атмендрия-прити ванчха-тари бали кама*

*кришнендрия-прии иччха дхари према нама»*

*(«Шри Чайтанья-Чаритамрита», 4.165)*
```

to 

```
*«атмендрия-прити ванчха-тари бали кама*\
*кришнендрия-прии иччха дхари према нама»*\
*(«Шри Чайтанья-Чаритамрита», 4.165)*\
```
*/

const fs = require('fs');
const path = require('path');
const { processMarkdown } = require('./plugins/md-processor');

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

// Create error log file with full timestamp for each run
const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').split('.')[0];
const errorLogPath = path.join(__dirname, `error-${runTimestamp}.log`);

// Helper function to log errors
function logError(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(errorLogPath, logMessage, 'utf8');
  console.error(message);
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
      const result = processMarkdown(content, file);
      
      fs.writeFileSync(outputPath, result.content, 'utf-8');
      
      const status = result.appliedPlugins && result.appliedPlugins.length > 0 
        ? ` (${result.appliedPlugins.join(', ')})` 
        : '';
      console.log(`  ✓ Saved to: ${outputPath}${status}`);
      processedCount++;
    } catch (error) {
      logError(`Failed to process ${file}: ${error.message}`);
    }
  });
  
  console.log(`\n✅ Config ${config.id}: Processed ${processedCount}/${filesToProcess.length} file(s)`);
});

console.log('\n✅ All configs processed!');


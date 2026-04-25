/*
Reads `doc2md/config.json` config to see set of convert configs.

Use command like `pandoc input.docx -o output.md` to convert each file from input to dir to output dir with `pandoc_args`.

Let script accept argument with `id` from config to precess. Or to use all items.

Command line arguments:
  --id=N              Process only config with specific id
  --limit=N           Limit number of files to process per config
  --file=substring    Process only files matching substring
*/

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { cleanRtfArtifacts } = require('./plugins/rtf-cleanup');

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
  
  // Get all files and check for unsupported formats
  const allFiles = fs.readdirSync(inputDir);
  const files = allFiles.filter(file => 
    file.toLowerCase().endsWith('.docx') || 
    file.toLowerCase().endsWith('.rtf')
  );
  
  // Detect unsupported document formats
  const unsupportedFormats = allFiles.filter(file => {
    const ext = file.toLowerCase();
    return (ext.endsWith('.doc') && !ext.endsWith('.docx')) || 
           ext.endsWith('.odt') || 
           ext.endsWith('.pages');
  });
  
  if (unsupportedFormats.length > 0) {
    console.log(`⚠️  Found ${unsupportedFormats.length} unsupported file(s) - only .docx and .rtf are supported:`);
    unsupportedFormats.slice(0, 5).forEach(f => {
      const ext = path.extname(f).toLowerCase();
      logError(`  ✗ Skipping ${f} - ${ext} format not supported by pandoc`);
    });
    if (unsupportedFormats.length > 5) {
      console.log(`   ... and ${unsupportedFormats.length - 5} more unsupported file(s)`);
    }
  }
  
  // Filter by specific file if requested
  let filteredFiles = files;
  if (targetFile) {
    filteredFiles = files.filter(file => file.includes(targetFile));
    if (filteredFiles.length === 0) {
      console.log(`⚠️  No files found matching: "${targetFile}"`);
      console.log(`Available files (first 10):`);
      files.slice(0, 10).forEach(f => console.log(`  - ${f}`));
      return;
    }
  }
  
  // Apply limit if specified
  const filesToProcess = fileLimit ? filteredFiles.slice(0, fileLimit) : filteredFiles;
  
  if (targetFile) {
    console.log(`Found ${filteredFiles.length} file(s) matching "${targetFile}"`);
  } else if (fileLimit && filteredFiles.length > fileLimit) {
    console.log(`Found ${filteredFiles.length} file(s) total`);
    console.log(`⚠️  Processing only first ${filesToProcess.length} file(s) due to limit`);
    console.log(`   Skipping ${filteredFiles.length - filesToProcess.length} file(s)`);
  } else {
    console.log(`Found ${filteredFiles.length} file(s) to convert`);
  }
  
  // Convert each file
  filesToProcess.forEach((file, index) => {
    const inputPath = path.join(inputDir, file);
    const baseName = path.basename(file, path.extname(file));
    const outputPath = path.join(outputDir, `${baseName}.md`);
    const isRtf = file.toLowerCase().endsWith('.rtf');
    
    console.log(`[${index + 1}/${filesToProcess.length}] Converting: ${file}`);
    
    try {
      let pandocInputPath = inputPath;
      let tempDocxPath = null;
      
      // For RTF files: convert to DOCX first using LibreOffice for better encoding handling
      if (isRtf) {
        tempDocxPath = path.join(outputDir, `.temp-${baseName}.docx`);
        const sofficeCmd = `soffice --headless --convert-to docx "${inputPath}" --outdir "${outputDir}"`;
        execSync(sofficeCmd, { stdio: 'pipe' });
        
        // soffice creates the file with original basename + .docx
        const sofficeOutput = path.join(outputDir, `${baseName}.docx`);
        if (fs.existsSync(sofficeOutput)) {
          fs.renameSync(sofficeOutput, tempDocxPath);
          pandocInputPath = tempDocxPath;
        }
      }
      
      const command = `pandoc "${pandocInputPath}" ${config.pandoc_args} -o "${outputPath}"`;
      execSync(command, { stdio: 'pipe' });
      
      // Clean up temp DOCX file
      if (tempDocxPath && fs.existsSync(tempDocxPath)) {
        fs.unlinkSync(tempDocxPath);
      }
      
      // Apply RTF cleanup plugin
      let content = fs.readFileSync(outputPath, 'utf-8');
      const result = cleanRtfArtifacts(content, file);
      
      fs.writeFileSync(outputPath, result.content, 'utf-8');
      
      const fixes = [];
      if (isRtf) fixes.push('RTF→DOCX');
      if (result.cleaned) fixes.push('artifacts cleaned');
      if (result.hasEncodingIssues) fixes.push('⚠️ encoding issues');
      const status = fixes.length > 0 ? ` (${fixes.join(', ')})` : '';
      console.log(`  ✓ Saved to: ${outputPath}${status}`);
    } catch (error) {
      const errorDetails = error.stderr ? error.stderr.toString() : error.message;
      logError(`  ✗ Error converting ${file}: ${errorDetails}`);
    }
  });
  
  if (fileLimit && filteredFiles.length > fileLimit) {
    console.log(`✓ Completed config id: ${config.id} (${filesToProcess.length}/${filteredFiles.length} files processed)`);
  } else {
    console.log(`✓ Completed config id: ${config.id}`);
  }
});

console.log('\n=== All conversions complete ===');

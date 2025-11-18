/**
 * Script to replace console.log statements with logger calls
 * Run: node scripts/replace-console-logs.js
 */

const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/lib/firestore.ts',
  'src/contexts/AuthContext.tsx',
];

const replacements = [
  // console.log -> logger.debug
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.debug(',
  },
  // console.error -> logger.error
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error(',
  },
  // console.warn -> logger.warn
  {
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn(',
  },
  // console.info -> logger.info
  {
    pattern: /console\.info\(/g,
    replacement: 'logger.info(',
  },
];

function replaceInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    replacements.forEach(({ pattern, replacement }) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement);
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Updated: ${filePath}`);
    } else {
      console.log(`⏭️  Skipped: ${filePath} (no changes needed)`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
  }
}

console.log('🔄 Replacing console statements with logger calls...\n');

filesToUpdate.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    replaceInFile(fullPath);
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

console.log('\n✨ Done!');
console.log('\n📝 Note: Make sure to add logger import to updated files:');
console.log('   import { logger } from \'./logger\';');

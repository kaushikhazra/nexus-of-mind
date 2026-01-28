#!/usr/bin/env node

/**
 * Automated file size validation script for client code quality refactoring
 * Validates that no TypeScript file exceeds 500 lines of code
 * Requirements: 10.1, 10.5
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const MAX_LINES = 500;
const CLIENT_SRC_PATH = 'client/src';

/**
 * Count lines in a file, excluding empty lines and comments-only lines
 */
function countLinesInFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Count non-empty, non-comment-only lines
        let lineCount = 0;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('//') && !trimmed.startsWith('/*') && trimmed !== '*/') {
                lineCount++;
            }
        }
        
        return lineCount;
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return 0;
    }
}

/**
 * Get all TypeScript files in the client source directory
 */
function getAllTypeScriptFiles() {
    const pattern = 'client/src/**/*.ts';
    const options = { 
        ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
    };
    
    const files = glob.sync(pattern, options);
    console.log(`Found ${files.length} TypeScript files matching pattern: ${pattern}`);
    
    return files;
}

/**
 * Validate file sizes and report violations
 */
function validateFileSizes() {
    console.log('🔍 Validating TypeScript file sizes...\n');
    
    const tsFiles = getAllTypeScriptFiles();
    const violations = [];
    let totalFiles = 0;
    
    for (const filePath of tsFiles) {
        const lineCount = countLinesInFile(filePath);
        totalFiles++;
        
        if (lineCount > MAX_LINES) {
            violations.push({
                file: filePath,
                lines: lineCount,
                excess: lineCount - MAX_LINES
            });
        }
        
        // Show progress for large codebases
        if (totalFiles % 50 === 0) {
            console.log(`Processed ${totalFiles} files...`);
        }
    }
    
    // Report results
    console.log(`\n📊 Validation Results:`);
    console.log(`Total TypeScript files checked: ${totalFiles}`);
    console.log(`Maximum allowed lines: ${MAX_LINES}`);
    
    if (violations.length === 0) {
        console.log('✅ All files comply with size constraints!');
        return true;
    } else {
        console.log(`❌ Found ${violations.length} files exceeding size limit:\n`);
        
        // Sort by excess lines (worst first)
        violations.sort((a, b) => b.excess - a.excess);
        
        for (const violation of violations) {
            console.log(`  ${violation.file}`);
            console.log(`    Lines: ${violation.lines} (${violation.excess} over limit)`);
            console.log('');
        }
        
        console.log('🔧 These files need refactoring to meet size constraints.');
        return false;
    }
}

/**
 * Generate refactoring report with recommendations
 */
function generateRefactoringReport(violations) {
    const reportPath = 'refactoring-report.md';
    let report = '# File Size Refactoring Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    report += `## Files Requiring Refactoring\n\n`;
    
    for (const violation of violations) {
        report += `### ${violation.file}\n`;
        report += `- **Current size**: ${violation.lines} lines\n`;
        report += `- **Excess**: ${violation.excess} lines over limit\n`;
        report += `- **Priority**: ${violation.excess > 1000 ? 'Critical' : violation.excess > 500 ? 'High' : 'Medium'}\n\n`;
    }
    
    fs.writeFileSync(reportPath, report);
    console.log(`📄 Detailed report saved to: ${reportPath}`);
}

// Main execution
if (require.main === module) {
    const isValid = validateFileSizes();
    process.exit(isValid ? 0 : 1);
}

module.exports = {
    validateFileSizes,
    countLinesInFile,
    getAllTypeScriptFiles,
    MAX_LINES
};
# Refactoring Infrastructure and Validation Tools

This directory contains automated tools for validating and supporting the client code quality refactoring process. These tools ensure that refactoring maintains functionality, performance, and code quality standards.

## Overview

The refactoring infrastructure provides:
- **File size validation** to ensure no file exceeds 500 lines
- **Performance monitoring** to maintain 60fps gameplay
- **Backup and rollback capability** for safe refactoring
- **Import validation** to prevent broken dependencies

## Tools

### 1. File Size Validation (`validate-file-sizes.js`)

Validates that all TypeScript files comply with the 500-line limit.

```bash
# Run file size validation
npm run refactor:validate-files

# Or run directly
node scripts/validate-file-sizes.js
```

**Features:**
- Scans all TypeScript files in `client/src`
- Excludes test files and comments-only lines
- Generates detailed violation reports
- Provides refactoring recommendations

**Output:**
- Console report with violations
- `refactoring-report.md` with detailed analysis

### 2. Performance Monitor (`performance-monitor.js`)

Monitors build performance, test execution, and simulated game performance.

```bash
# Run performance monitoring
npm run refactor:validate-performance

# Or run directly
node scripts/performance-monitor.js
```

**Features:**
- Build time measurement (target: <30s)
- Test execution time (target: <60s)
- Memory usage monitoring (target: <512MB)
- Bundle size analysis
- Simulated frame rate monitoring

**Output:**
- Console performance metrics
- `performance-report.json` with detailed data

### 3. Backup Creation (`create-backup-branches.ps1` / `.sh`)

Creates backup branches and rollback capability before refactoring.

```bash
# Create backup branches (Windows)
npm run refactor:create-backup

# Or run directly (Windows)
powershell -ExecutionPolicy Bypass -File scripts/create-backup-branches.ps1

# Linux/Mac
./scripts/create-backup-branches.sh
```

**Features:**
- Creates timestamped backup branches
- Tags major components for granular rollback
- Generates automatic rollback scripts
- Verifies backup integrity
- Optional cleanup of old backups

**Output:**
- Backup branch: `refactoring-backup-YYYYMMDD-HHMMSS-pre-refactoring`
- Component tags: `backup-gameengine-TIMESTAMP`, etc.
- Rollback script: `scripts/rollback-refactoring.ps1`

### 4. Import Validation (`validate-imports.js`)

Validates TypeScript imports and detects circular dependencies.

```bash
# Run import validation
npm run refactor:validate-imports

# Or run directly
node scripts/validate-imports.js
```

**Features:**
- TypeScript compiler validation
- Import path existence checking
- Circular dependency detection
- Import pattern analysis
- Path alias validation

**Output:**
- Console validation results
- `import-validation-report.json` with detailed analysis

## TypeScript Configuration

### Enhanced Configuration (`tsconfig.refactoring.json`)

Extended TypeScript configuration for refactoring validation:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    // Enhanced validation settings
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    
    // Path aliases for new module structure
    "paths": {
      "@game/engine/*": ["./game/engine/*"],
      "@ui/base/*": ["./ui/base/*"],
      // ... more aliases
    }
  }
}
```

## Usage Workflows

### Complete Refactoring Setup

Run all validation tools and create backups:

```bash
npm run refactor:setup
```

This executes:
1. Creates backup branches and rollback capability
2. Validates current file sizes
3. Validates import structure
4. Measures baseline performance

### Continuous Validation

During refactoring, run validation frequently:

```bash
# Quick validation (files + imports)
npm run refactor:validate-files && npm run refactor:validate-imports

# Full validation (includes performance)
npm run refactor:validate-all
```

### Rollback if Needed

If refactoring introduces issues:

```bash
# Windows
.\scripts\rollback-refactoring.ps1

# Linux/Mac
./scripts/rollback-refactoring.sh
```

## Integration with Development Workflow

### Pre-Refactoring Checklist

1. ✅ Run `npm run refactor:setup`
2. ✅ Verify all validations pass
3. ✅ Commit current changes
4. ✅ Create feature branch for refactoring

### During Refactoring

1. ✅ Run validation after each major change
2. ✅ Monitor file sizes as you refactor
3. ✅ Check imports after moving files
4. ✅ Validate performance periodically

### Post-Refactoring

1. ✅ Run `npm run refactor:validate-all`
2. ✅ Ensure all tests pass
3. ✅ Verify 60fps performance maintained
4. ✅ Clean up backup branches (optional)

## Configuration

### File Size Limits

Modify `MAX_LINES` in `validate-file-sizes.js`:

```javascript
const MAX_LINES = 500; // Adjust as needed
```

### Performance Thresholds

Modify thresholds in `performance-monitor.js`:

```javascript
this.thresholds = {
    minFrameRate: 60,        // Minimum FPS
    maxMemoryMB: 512,        // Maximum memory usage
    maxBuildTimeMs: 30000,   // Maximum build time
    maxTestTimeMs: 60000     // Maximum test time
};
```

### Path Aliases

Update `tsconfig.refactoring.json` paths as you create new module structure:

```json
"paths": {
  "@game/engine/*": ["./game/engine/*"],
  "@ui/introduction/*": ["./ui/introduction/*"]
}
```

## Troubleshooting

### Common Issues

1. **"Command not found" errors**
   - Ensure Node.js and npm are installed
   - Run `npm install` to install dependencies

2. **TypeScript compilation errors**
   - Check `tsconfig.refactoring.json` configuration
   - Verify all import paths are correct

3. **Permission errors (Linux/Mac)**
   - Make scripts executable: `chmod +x scripts/*.sh`

4. **PowerShell execution policy (Windows)**
   - Run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### Getting Help

1. Check console output for detailed error messages
2. Review generated report files for analysis
3. Verify file paths and configurations
4. Ensure all dependencies are installed

## Requirements Traceability

This infrastructure addresses the following requirements:

- **Requirement 10.1**: Build system integration and validation
- **Requirement 10.5**: Performance monitoring and validation
- **Requirement 1.1**: File size constraint enforcement
- **Requirement 5.4**: Import validation and module organization

## Future Enhancements

Potential improvements to the refactoring infrastructure:

1. **Real-time monitoring**: Connect to actual game engine for live FPS monitoring
2. **Automated refactoring**: Suggest specific refactoring actions
3. **Visual reports**: Generate HTML reports with charts and graphs
4. **CI/CD integration**: Run validation in continuous integration pipeline
5. **Incremental validation**: Only validate changed files for faster feedback
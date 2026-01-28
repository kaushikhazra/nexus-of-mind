# Create backup branches for rollback capability during refactoring
# Requirements: 10.1, 10.5

param(
    [switch]$Cleanup
)

# Configuration
$BACKUP_PREFIX = "refactoring-backup"
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
$CURRENT_BRANCH = git branch --show-current

Write-Host "Creating backup branches for refactoring rollback capability..." -ForegroundColor Cyan
Write-Host "Current branch: $CURRENT_BRANCH"
Write-Host "Timestamp: $TIMESTAMP"
Write-Host ""

# Function to create a backup branch
function Create-BackupBranch {
    param(
        [string]$BranchName,
        [string]$Description
    )
    
    Write-Host "Creating backup: $BranchName" -ForegroundColor Yellow
    git branch $BranchName HEAD
    
    # Add branch description using git config (if supported)
    try {
        git config "branch.$BranchName.description" $Description 2>$null
    } catch {
        # Ignore if not supported
    }
    
    Write-Host "Created backup branch: $BranchName" -ForegroundColor Green
}

# Function to verify backup integrity
function Test-Backup {
    param([string]$BranchName)
    
    Write-Host "Verifying backup: $BranchName" -ForegroundColor Yellow
    
    # Check if branch exists
    $branchExists = git show-ref --verify --quiet "refs/heads/$BranchName"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Backup branch $BranchName does not exist!" -ForegroundColor Red
        return $false
    }
    
    # Check if branch has commits
    $commitCount = git rev-list --count $BranchName
    if ($commitCount -eq 0) {
        Write-Host "Backup branch $BranchName has no commits!" -ForegroundColor Red
        return $false
    }
    
    Write-Host "Backup verified: $BranchName ($commitCount commits)" -ForegroundColor Green
    return $true
}

# Function to list existing backup branches
function Show-BackupBranches {
    Write-Host "Existing backup branches:" -ForegroundColor Cyan
    $backupBranches = git branch --list "$BACKUP_PREFIX-*"
    if ($backupBranches) {
        $backupBranches | ForEach-Object { Write-Host "  $_" }
    } else {
        Write-Host "  No backup branches found"
    }
    Write-Host ""
}

# Function to clean old backup branches
function Remove-OldBackups {
    param([int]$KeepCount = 5)
    
    Write-Host "Cleaning up old backup branches (keeping last $KeepCount)..." -ForegroundColor Yellow
    
    # Get backup branches sorted by creation date (newest first)
    $backupBranches = git for-each-ref --sort=-committerdate --format='%(refname:short)' "refs/heads/$BACKUP_PREFIX-*"
    
    if ($backupBranches -and $backupBranches.Count -gt $KeepCount) {
        $branchesToRemove = $backupBranches | Select-Object -Skip $KeepCount
        
        Write-Host "Removing old backup branches:"
        foreach ($branch in $branchesToRemove) {
            Write-Host "  Removing: $branch"
            git branch -D $branch
        }
    } else {
        Write-Host "No old backup branches to clean up"
    }
    Write-Host ""
}

# Function to create rollback script
function New-RollbackScript {
    param([string]$BackupBranch)
    
    $rollbackScript = "scripts/rollback-refactoring.ps1"
    
    $scriptContent = @"
# Rollback script for refactoring changes
# Generated automatically by create-backup-branches.ps1

param(
    [string]`$BackupBranch = "$BackupBranch"
)

`$CURRENT_BRANCH = git branch --show-current

Write-Host "Rolling back refactoring changes..." -ForegroundColor Cyan
Write-Host "Current branch: `$CURRENT_BRANCH"
Write-Host "Backup branch: `$BackupBranch"
Write-Host ""

# Verify backup branch exists
`$branchExists = git show-ref --verify --quiet "refs/heads/`$BackupBranch"
if (`$LASTEXITCODE -ne 0) {
    Write-Host "Error: Backup branch `$BackupBranch does not exist!" -ForegroundColor Red
    Write-Host "Available backup branches:"
    git branch --list "$BACKUP_PREFIX-*"
    exit 1
}

# Confirm rollback
Write-Host "This will reset your current branch to the backup state." -ForegroundColor Yellow
Write-Host "All changes since the backup will be lost!"
`$confirmation = Read-Host "Are you sure you want to continue? (y/N)"
if (`$confirmation -ne "y" -and `$confirmation -ne "Y") {
    Write-Host "Rollback cancelled"
    exit 0
}

# Perform rollback
Write-Host "Performing rollback..." -ForegroundColor Yellow
git reset --hard `$BackupBranch

Write-Host "Rollback completed successfully!" -ForegroundColor Green
Write-Host "Your branch has been reset to the state of: `$BackupBranch"
"@

    Set-Content -Path $rollbackScript -Value $scriptContent
    Write-Host "Created rollback script: $rollbackScript" -ForegroundColor Green
}

# Main execution
try {
    # Check if we're in a git repository
    git rev-parse --git-dir 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: Not in a git repository!" -ForegroundColor Red
        exit 1
    }
    
    # Check for uncommitted changes
    git diff-index --quiet HEAD --
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  Warning: You have uncommitted changes!" -ForegroundColor Yellow
        Write-Host "It's recommended to commit or stash changes before creating backups."
        $continue = Read-Host "Continue anyway? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            Write-Host "Aborted by user"
            exit 1
        }
    }
    
    # List existing backups
    Show-BackupBranches
    
    # Create main backup branch
    $mainBackup = "$BACKUP_PREFIX-$TIMESTAMP-pre-refactoring"
    Create-BackupBranch $mainBackup "Pre-refactoring backup created on $TIMESTAMP from $CURRENT_BRANCH"
    
    # Create specific component backups for major refactoring targets
    Write-Host ""
    Write-Host "📦 Creating component-specific backup tags..." -ForegroundColor Yellow
    
    # Tag current state for major components that will be refactored
    git tag -a "backup-gameengine-$TIMESTAMP" -m "GameEngine.ts backup before refactoring"
    git tag -a "backup-introduction-$TIMESTAMP" -m "Introduction system backup before refactoring"
    git tag -a "backup-ui-components-$TIMESTAMP" -m "UI components backup before refactoring"
    
    Write-Host "✅ Created backup tags for major components" -ForegroundColor Green
    
    # Verify all backups
    Write-Host ""
    Write-Host "🔍 Verifying backup integrity..." -ForegroundColor Yellow
    $backupValid = Test-Backup $mainBackup
    
    if (-not $backupValid) {
        Write-Host "❌ Backup verification failed!" -ForegroundColor Red
        exit 1
    }
    
    # Create rollback script
    New-RollbackScript $mainBackup
    
    # Optional cleanup of old backups
    if ($Cleanup) {
        Remove-OldBackups
    }
    
    Write-Host "Backup creation completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Cyan
    Write-Host "  Main backup branch: $mainBackup"
    Write-Host "  Component tags: backup-*-$TIMESTAMP"
    Write-Host "  Rollback script: scripts/rollback-refactoring.ps1"
    Write-Host ""
    Write-Host "To rollback if needed:" -ForegroundColor Yellow
    Write-Host "  .\scripts\rollback-refactoring.ps1 $mainBackup"
    Write-Host ""
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
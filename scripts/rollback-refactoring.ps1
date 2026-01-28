# Rollback script for refactoring changes
# Generated automatically by create-backup-branches.ps1

param(
    [string]$BackupBranch = "refactoring-backup-20260127-235848-pre-refactoring"
)

$CURRENT_BRANCH = git branch --show-current

Write-Host "Rolling back refactoring changes..." -ForegroundColor Cyan
Write-Host "Current branch: $CURRENT_BRANCH"
Write-Host "Backup branch: $BackupBranch"
Write-Host ""

# Verify backup branch exists
$branchExists = git show-ref --verify --quiet "refs/heads/$BackupBranch"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Backup branch $BackupBranch does not exist!" -ForegroundColor Red
    Write-Host "Available backup branches:"
    git branch --list "refactoring-backup-*"
    exit 1
}

# Confirm rollback
Write-Host "This will reset your current branch to the backup state." -ForegroundColor Yellow
Write-Host "All changes since the backup will be lost!"
$confirmation = Read-Host "Are you sure you want to continue? (y/N)"
if ($confirmation -ne "y" -and $confirmation -ne "Y") {
    Write-Host "Rollback cancelled"
    exit 0
}

# Perform rollback
Write-Host "Performing rollback..." -ForegroundColor Yellow
git reset --hard $BackupBranch

Write-Host "Rollback completed successfully!" -ForegroundColor Green
Write-Host "Your branch has been reset to the state of: $BackupBranch"

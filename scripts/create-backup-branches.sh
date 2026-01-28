#!/bin/bash

# Create backup branches for rollback capability during refactoring
# Requirements: 10.1, 10.5

set -e

# Configuration
BACKUP_PREFIX="refactoring-backup"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
CURRENT_BRANCH=$(git branch --show-current)

echo "🔄 Creating backup branches for refactoring rollback capability..."
echo "Current branch: $CURRENT_BRANCH"
echo "Timestamp: $TIMESTAMP"
echo ""

# Function to create a backup branch
create_backup_branch() {
    local branch_name="$1"
    local description="$2"
    
    echo "📦 Creating backup: $branch_name"
    git branch "$branch_name" HEAD
    
    # Add branch description using git config (if supported)
    git config "branch.$branch_name.description" "$description" 2>/dev/null || true
    
    echo "✅ Created backup branch: $branch_name"
}

# Function to verify backup integrity
verify_backup() {
    local branch_name="$1"
    
    echo "🔍 Verifying backup: $branch_name"
    
    # Check if branch exists
    if ! git show-ref --verify --quiet "refs/heads/$branch_name"; then
        echo "❌ Backup branch $branch_name does not exist!"
        return 1
    fi
    
    # Check if branch has commits
    local commit_count=$(git rev-list --count "$branch_name")
    if [ "$commit_count" -eq 0 ]; then
        echo "❌ Backup branch $branch_name has no commits!"
        return 1
    fi
    
    echo "✅ Backup verified: $branch_name ($commit_count commits)"
    return 0
}

# Function to list existing backup branches
list_backup_branches() {
    echo "📋 Existing backup branches:"
    git branch --list "$BACKUP_PREFIX-*" | sed 's/^/  /' || echo "  No backup branches found"
    echo ""
}

# Function to clean old backup branches (optional)
cleanup_old_backups() {
    local keep_count=5
    echo "🧹 Cleaning up old backup branches (keeping last $keep_count)..."
    
    # Get backup branches sorted by creation date (newest first)
    local backup_branches=$(git for-each-ref --sort=-committerdate --format='%(refname:short)' refs/heads/$BACKUP_PREFIX-* | tail -n +$((keep_count + 1)))
    
    if [ -n "$backup_branches" ]; then
        echo "Removing old backup branches:"
        echo "$backup_branches" | while read -r branch; do
            echo "  Removing: $branch"
            git branch -D "$branch"
        done
    else
        echo "No old backup branches to clean up"
    fi
    echo ""
}

# Main execution
main() {
    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        echo "❌ Error: Not in a git repository!"
        exit 1
    fi
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        echo "⚠️  Warning: You have uncommitted changes!"
        echo "It's recommended to commit or stash changes before creating backups."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Aborted by user"
            exit 1
        fi
    fi
    
    # List existing backups
    list_backup_branches
    
    # Create main backup branch
    local main_backup="$BACKUP_PREFIX-$TIMESTAMP-pre-refactoring"
    create_backup_branch "$main_backup" "Pre-refactoring backup created on $TIMESTAMP from $CURRENT_BRANCH"
    
    # Create specific component backups for major refactoring targets
    echo ""
    echo "📦 Creating component-specific backup tags..."
    
    # Tag current state for major components that will be refactored
    git tag -a "backup-gameengine-$TIMESTAMP" -m "GameEngine.ts backup before refactoring"
    git tag -a "backup-introduction-$TIMESTAMP" -m "Introduction system backup before refactoring"
    git tag -a "backup-ui-components-$TIMESTAMP" -m "UI components backup before refactoring"
    
    echo "✅ Created backup tags for major components"
    
    # Verify all backups
    echo ""
    echo "🔍 Verifying backup integrity..."
    verify_backup "$main_backup"
    
    # Create rollback script
    create_rollback_script "$main_backup"
    
    # Optional cleanup of old backups
    if [ "$1" = "--cleanup" ]; then
        cleanup_old_backups
    fi
    
    echo ""
    echo "✅ Backup creation completed successfully!"
    echo ""
    echo "📋 Summary:"
    echo "  Main backup branch: $main_backup"
    echo "  Component tags: backup-*-$TIMESTAMP"
    echo "  Rollback script: scripts/rollback-refactoring.sh"
    echo ""
    echo "🔄 To rollback if needed:"
    echo "  ./scripts/rollback-refactoring.sh $main_backup"
    echo ""
}

# Function to create rollback script
create_rollback_script() {
    local backup_branch="$1"
    local rollback_script="scripts/rollback-refactoring.sh"
    
    cat > "$rollback_script" << EOF
#!/bin/bash

# Rollback script for refactoring changes
# Generated automatically by create-backup-branches.sh

set -e

BACKUP_BRANCH="\${1:-$backup_branch}"
CURRENT_BRANCH=\$(git branch --show-current)

echo "🔄 Rolling back refactoring changes..."
echo "Current branch: \$CURRENT_BRANCH"
echo "Backup branch: \$BACKUP_BRANCH"
echo ""

# Verify backup branch exists
if ! git show-ref --verify --quiet "refs/heads/\$BACKUP_BRANCH"; then
    echo "❌ Error: Backup branch \$BACKUP_BRANCH does not exist!"
    echo "Available backup branches:"
    git branch --list "$BACKUP_PREFIX-*"
    exit 1
fi

# Confirm rollback
echo "⚠️  This will reset your current branch to the backup state."
echo "All changes since the backup will be lost!"
read -p "Are you sure you want to continue? (y/N): " -n 1 -r
echo
if [[ ! \$REPLY =~ ^[Yy]\$ ]]; then
    echo "Rollback cancelled"
    exit 0
fi

# Perform rollback
echo "🔄 Performing rollback..."
git reset --hard "\$BACKUP_BRANCH"

echo "✅ Rollback completed successfully!"
echo "Your branch has been reset to the state of: \$BACKUP_BRANCH"
EOF

    chmod +x "$rollback_script"
    echo "📝 Created rollback script: $rollback_script"
}

# Run main function with all arguments
main "$@"
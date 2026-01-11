# Git Workflow - Quick Reference

## User Story Development Process

### 🚀 Starting a New User Story

```bash
# 1. Ensure you're on develop
git checkout develop
git pull origin develop

# 2. Create feature branch
git checkout -b feature/US-XXX-description
# Example: git checkout -b feature/US-002-procedural-terrain

# 3. Update KANBAN
# Move user story from Ready → In Progress
```

### 🔧 During Development

```bash
# Regular commits during development
git add .
git commit -m "wip: US-XXX - Progress description"

# Push feature branch (first time)
git push -u origin feature/US-XXX-description

# Push updates
git push origin feature/US-XXX-description
```

### ✅ Completing a User Story

```bash
# 1. Final commit with detailed message
git add .
git commit -m "feat: US-XXX - Complete description

- Implementation details
- Acceptance criteria met
- Performance metrics
- Visual confirmation

Ready for: Next steps"

# 2. Push final changes
git push origin feature/US-XXX-description

# 3. Merge to develop
git checkout develop
git merge --no-ff feature/US-XXX-description -m "Merge feature/US-XXX-description into develop

Complete implementation with all acceptance criteria met"

# 4. Push develop
git push origin develop

# 5. Clean up feature branch
git branch -d feature/US-XXX-description
git push origin --delete feature/US-XXX-description
```

### 📋 Documentation Updates

**Always update before merging:**
- [ ] DEVLOG.md - Add development progress
- [ ] KANBAN.md - Move to Done, update metrics
- [ ] README.md - If new features affect usage

## Branch Naming Examples

- `feature/US-001-3d-foundation` ✅
- `feature/US-002-procedural-terrain` ✅
- `feature/US-003-energy-economy` ✅
- `hotfix/performance-memory-leak` ✅

## Commit Message Template

```
feat: US-XXX - Brief feature description

Technical Implementation:
- Key components built
- Architecture decisions
- Integration points

Validation Results:
- Acceptance criteria status
- Performance metrics
- Visual confirmation

Ready for: Next user story or specific next steps
```

---

**💡 Pro Tip**: This workflow is documented in `.kiro/steering/tech.md` for persistent project knowledge across Kiro sessions!
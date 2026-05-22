---
name: "echo-version-control"
description: "Manages version control, CLAUDE document updates, and GitHub push for the Echo Breaker project. MUST invoke after every task completion to record changes and push to GitHub."
---

# Echo Breaker Version Control

This skill enforces the version control workflow for the "回声破除者" (Echo Breaker) project. It MUST be invoked after every task completion.

## Mandatory Steps (After Every Task)

When any coding task is completed, you MUST perform the following steps in order:

### Step 1: Update CLAUDE Document

File location: `c:\Users\JiYueHu\Desktop\回声破除者\程序主体\说明文档\CLAUDE.md`

Add a new section with the following format:

```markdown
## YYYY-MM-DD | 版本 vX.Y.Z | 任务简述

### 变更内容
- 具体变更1
- 具体变更2
- ...

### 影响范围
- 涉及的层级（L0-L6）
- 涉及的模块/文件

### 版本号规则
- 主版本号 X：重大架构变更或新阶段启动
- 次版本号 Y：新功能完成（如完成某一层功能）
- 修订号 Z：Bug修复、小优化、文档更新

### 反思
- 做得好的地方
- 可以改进的地方
- 遗留问题
```

### Step 2: Update package.json Version

Before committing, update the `version` field in `package.json` to match the new version number.

### Step 3: Git Commit

Stage and commit all changes with a descriptive commit message following Conventional Commits format:

```
<type>(<scope>): <description>

- Detail 1
- Detail 2
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`
Scopes: `L0`, `L1`, `L2`, `L3`, `L4`, `L5`, `L6`, `background`, `popup`, `sidepanel`, `lib`, `config`, `data`

### Step 4: Push to GitHub

After committing, push to the remote repository:

```bash
cd "c:\Users\JiYueHu\Desktop\回声破除者\程序主体\代码仓库"
git push origin master
```

### Step 5: Verify

Confirm the push was successful and report the commit hash and version number to the user.

## Version History Tracking

The CLAUDE document serves as the project's changelog. Every version entry must include:
- Date and version number
- What was changed
- Which layers/modules were affected
- Reflections on the work

## Current Version

Starting from: v0.1.0 (initial project scaffold)

## Important Rules

1. NEVER skip updating the CLAUDE document
2. NEVER skip pushing to GitHub
3. ALWAYS increment the version number
4. ALWAYS use descriptive commit messages
5. The CLAUDE document is the single source of truth for project history

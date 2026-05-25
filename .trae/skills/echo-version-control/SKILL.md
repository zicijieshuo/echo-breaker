---
name: "echo-version-control"
description: "Manages version control, branching strategy, CLAUDE document updates, and GitHub push for the Echo Breaker project. MUST invoke after every task completion to record changes and push to GitHub."
---

# Echo Breaker Version Control

This skill enforces the version control workflow for the "回声破除者" (Echo Breaker) project. It MUST be invoked after every task completion.

## Branching Strategy (Git Flow)

The project uses a **Git Flow** branching model to separate stable releases from development work:

### Branch Types

| Branch | Purpose | Naming | Protection |
|--------|---------|--------|------------|
| `main` | 正式发布版本，只接受 merge | `main` | 受保护，只能通过 PR 合入 |
| `develop` | 开发主分支，日常开发在此进行 | `develop` | 受保护，只能通过 PR 合入 |
| `feature/*` | 新功能开发 | `feature/L1-awakening` | 从 develop 创建，完成后合回 develop |
| `fix/*` | Bug 修复 | `fix/popup-chart-data` | 从 develop 创建，完成后合回 develop |
| `release/*` | 发布准备分支 | `release/v1.0.0` | 从 develop 创建，测试通过后合入 main + develop |
| `hotfix/*` | 紧急线上修复 | `hotfix/v1.0.1` | 从 main 创建，修复后合入 main + develop |

### Branch Workflow

```
main ──────────────────────────── merge ──── v1.0.0 tag
  \                                /
   └── develop ──── release/v1.0.0 ┘
         \      \
          \      feature/L2-delay-satisfy
           \
            fix/popup-chart-data
```

### Rules

1. **`main` 分支**：只存放正式发布版本，每次合入必须打 tag（如 `v1.0.0`）
2. **`develop` 分支**：日常开发基础分支，所有 feature/fix 分支从此创建
3. **新功能开发**：从 develop 创建 `feature/*` 分支，完成后 PR 回 develop
4. **Bug 修复**：从 develop 创建 `fix/*` 分支，完成后 PR 回 develop
5. **发布流程**：
   - 从 develop 创建 `release/vX.Y.Z` 分支
   - 在 release 分支上做最终测试和版本号更新
   - 测试通过后，将 release 合入 `main`（打 tag）和 `develop`
6. **紧急修复**：从 main 创建 `hotfix/*`，修复后合入 main（打 tag）和 develop

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

### Step 2.5: Update README.md (正式版发布时必须)

When releasing an **official version** (合并到 main 分支时), you MUST also update `README.md`:

1. **版本历史区域**：在"版本历史"章节顶部添加新版本条目，格式：
   ```markdown
   ### vX.Y.Z (YYYY-MM-DD)
   - 变更1
   - 变更2
   ```
2. **功能概览**：如有新功能模块，更新"功能概览"章节
3. **会员体系表格**：如会员权益有变更，更新"会员体系"章节
4. **项目结构**：如目录结构有变化，更新"项目结构"章节
5. **技术栈**：如依赖有变化，更新"技术栈"章节

注意：测试版（beta/alpha）发布时不需要更新 README，仅在正式版合入 main 时更新。

### Step 3: Git Commit

Stage and commit all changes with a descriptive commit message following Conventional Commits format:

```
<type>(<scope>): <description>

- Detail 1
- Detail 2
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`
Scopes: `L0`, `L1`, `L2`, `L3`, `L4`, `L5`, `L6`, `background`, `popup`, `sidepanel`, `lib`, `config`, `data`

### Step 4: Determine Branch and Push

Based on the nature of the change:

- **Bug fix / Testing**: Work on `fix/*` or `develop` branch, push to that branch
- **New feature**: Work on `feature/*` branch, push to that branch
- **Official release**: Merge to `main`, tag with version, push main + tag

```bash
cd "c:\Users\JiYueHu\Desktop\回声破除者\程序主体\代码仓库"
# Push to the appropriate branch
git push origin <branch-name>
# If releasing, also push the tag
git push origin v1.0.0
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

Starting from: v1.0.0 (first official release)

## Important Rules

1. NEVER skip updating the CLAUDE document
2. NEVER skip pushing to GitHub
3. ALWAYS increment the version number
4. ALWAYS use descriptive commit messages
5. The CLAUDE document is the single source of truth for project history
6. ALWAYS follow the branching strategy — bug fixes and features go to develop, official releases go to main
7. ALWAYS tag main branch with version number on releases
8. ALWAYS update README.md when releasing an official version (merging to main)

---
name: "echo-dev-workflow"
description: "Defines development workflow and coding standards for the Echo Breaker browser extension project. Invoke when starting any coding task or making architectural decisions."
---

# Echo Breaker Development Workflow

This skill defines the development workflow, coding standards, and architectural rules for the "回声破除者" (Echo Breaker) project.

## Project Overview

- **Product**: 认知抗阻伴学浏览器插件 (Cognitive Resistance Learning Companion Browser Extension)
- **Target Browser**: Microsoft Edge (primary), Chrome compatible
- **Manifest Version**: V3
- **Tech Stack**: TypeScript + Webpack + TailwindCSS + ECharts
- **Repository**: https://github.com/zicijieshuo/echo-breaker

## Directory Structure Rules

```
代码仓库/
├── src/
│   ├── background/     # Service Worker (background.ts)
│   ├── content/        # Content Scripts per layer
│   │   ├── index.ts        # Entry point (imports all modules)
│   │   ├── monitor.ts      # L0 基础监测层
│   │   ├── awakening.ts    # L1 主动唤醒层
│   │   ├── delay-satisfy.ts # L2 延迟满足层
│   │   ├── metacognition.ts # L3 元认知外显层 (future)
│   │   ├── reconstruct.ts   # L4 逆向重构层 (future)
│   │   ├── scenario.ts      # L5 情境适应层 (future)
│   │   └── community.ts     # L6 社群唤醒层 (future, APP)
│   ├── popup/          # Popup UI (data dashboard)
│   ├── sidepanel/      # Side panel UI (thought journal)
│   ├── lib/            # Shared modules
│   │   ├── types.ts        # Type definitions
│   │   ├── constants.ts    # Constants and thresholds
│   │   ├── storage.ts      # chrome.storage wrapper
│   │   └── utils.ts        # Utility functions
│   └── assets/         # Static assets
├── public/icons/       # Extension icons
├── data/               # Data files (AI websites config, etc.)
├── scripts/            # Build/helper scripts
└── dist/               # Build output (gitignored)
```

## Coding Standards

### TypeScript Rules
- Use strict mode (tsconfig strict: true)
- Always define types in `src/lib/types.ts` for shared types
- Use `async/await` over raw Promises
- Use `chrome.storage.local` via the `src/lib/storage.ts` wrapper, never directly
- Use `chrome.alarms` for persistent timing (Service Worker may sleep)

### Naming Conventions
- Files: kebab-case (e.g., `delay-satisfy.ts`)
- Types/Interfaces: PascalCase (e.g., `DailyRecord`)
- Constants: UPPER_SNAKE_CASE (e.g., `THRESHOLDS`)
- Functions: camelCase (e.g., `getTodayRecord`)
- CSS classes: TailwindCSS utilities + custom `echo-` prefix

### Content Script Rules
- Each layer gets its own file in `src/content/`
- All content scripts are imported through `src/content/index.ts`
- DOM injection must use `z-index: 2147483647` for overlays
- Never block the original page's event handlers
- Use CSS animations (`@keyframes`) for visual effects, not JS timers
- Clean up injected DOM elements when dismissed

### Manifest V3 Constraints
- No Background Page, only Service Worker
- No persistent state in Service Worker (use chrome.storage)
- No remote code execution (all code must be bundled)
- Content scripts must be declared in manifest.json

### UI Design Principles
- Non-modal: never block the user completely
- Gentle: use soft colors, breathing animations
- Informative: always explain WHY the intervention appears
- Dismissible: always provide a way to dismiss

## Layer Development Priority

Follow the task list order:
1. **Phase 1 (MVP)**: L0 + L1 + Popup Dashboard
2. **Phase 2**: L2 + L3 + L4 + Backend + Payment
3. **Phase 3**: L5 + L6 + APP + B2B
4. **Phase 4**: Data Intelligence + Scaling

## Before Starting Any Task

1. Read the relevant section in `各部分技术说明.md`
2. Check `总任务清单.md` for the specific sub-task
3. Identify which layer (L0-L6) the task belongs to
4. Follow the coding standards above
5. After completion, invoke `echo-version-control` skill

---
name: "echo-layer-check"
description: "Validates that code changes align with the Echo Breaker L0-L6 layered architecture. Invoke when adding new features, reviewing code, or before committing changes."
---

# Echo Breaker Layer Architecture Check

This skill validates that code changes conform to the 7-layer architecture of the "回声破除者" project.

## Layer Definitions

### L0 基础监测层 (Basic Monitoring)
**File**: `src/content/monitor.ts`
**Responsibilities**:
- AI website URL detection and matching
- User interaction monitoring (send button clicks, input events)
- Active/background time tracking
- Daily usage statistics (total_seconds, consecutive_rounds, copy_paste_count)
- Local storage of daily records

**Must NOT**:
- Trigger any UI intervention (that's L1)
- Make API calls
- Modify the page DOM

### L1 主动唤醒层 (Active Awakening)
**File**: `src/content/awakening.ts`
**Responsibilities**:
- Threshold checking (duration >= 1.5h OR consecutive >= 4 rounds)
- "Cognitive Soft Light" UI (non-modal overlay with breathing animation)
- Socratic prompt library (20+ prompts)
- Dismiss/pause buttons with event logging

**Must NOT**:
- Track usage data (that's L0)
- Modify AI behavior (that's L2)
- Force user input (that's L3)

### L2 延迟满足层 (Delayed Gratification)
**File**: `src/content/delay-satisfy.ts`
**Responsibilities**:
- Long-press detection on send button (3 seconds)
- Guided education mode toggle
- Prompt template for AI to ask questions back
- Visual feedback for mode change

**Must NOT**:
- Track usage data (that's L0)
- Trigger awakening UI (that's L1)
- Force thought journal (that's L3)

### L3 元认知外显层 (Metacognition Externalization)
**File**: `src/sidepanel/index.ts` + future `src/content/metacognition.ts`
**Responsibilities**:
- Side panel thought journal ("My first thought")
- Key points input before receiving AI answer
- Force input validation (block if empty)
- Bias analysis report (user answer vs AI answer comparison)

**Must NOT**:
- Track usage data (that's L0)
- Trigger awakening UI (that's L1)
- Modify AI prompts (that's L2)

### L4 逆向重构层 (Reverse Reconstruction)
**File**: Future `src/content/reconstruct.ts`
**Responsibilities**:
- AI conclusion target range (independent page/panel)
- Evidence chain mind map (canvas + fabric.js)
- "Find the flaw" task (highlight weak evidence)
- Backend comparison of user's identified weaknesses

### L5 情境适应层 (Context Adaptation)
**File**: Future `src/content/scenario.ts`
**Responsibilities**:
- Scenario detection (URL keyword matching + manual selection)
- Differentiated intervention strategies per scenario
- "Cognitive Wall" blocking (similarity > 0.85)
- Local model inference (transformers.js)

### L6 社群唤醒层 (Community Awakening)
**File**: Future `src/content/community.ts` + separate APP
**Responsibilities**:
- Cross-platform APP (Flutter/uni-app)
- Data dashboard (CDI trend)
- Community square with "?" posting rule
- Cobblestone leaderboard
- Badge system

## Validation Checklist

When reviewing or adding code, verify:

1. **Layer Separation**: Does the code belong to exactly one layer?
2. **No Cross-Layer Violations**: Is L0 code only doing monitoring? Is L1 code only doing awakening?
3. **Shared Module Usage**: Are types, constants, and storage accessed through `src/lib/`?
4. **Message Passing**: Is cross-layer communication done via `chrome.runtime.sendMessage`?
5. **Storage Consistency**: Is all storage access through `src/lib/storage.ts`?
6. **UI Non-Blocking**: Do all overlays use non-modal design with dismiss options?
7. **Manifest V3 Compliance**: No background pages, no remote code, Service Worker only?

## Common Violations to Watch For

- L0 code directly showing UI → Should dispatch event to L1
- L1 code directly tracking time → Should use L0 data via storage
- L2 code forcing thought input → Should be L3's responsibility
- Direct `chrome.storage.local.get` calls → Should use `src/lib/storage.ts` wrapper
- Hardcoded thresholds → Should use `src/lib/constants.ts`
- Missing type definitions → Should add to `src/lib/types.ts`

# Implementation Plan - Voice Mode Header & Navigation Refinement

Refine the Voice Mode header so that "Avani AI" and "V1.0" display side-by-side on a single line on the left side, verify that no extra Security or Help icons clutter the screen outside the three-dots dropdown, and keep all options cleanly organized.

---

## User Review Required

> [!NOTE]
> Based on your response:
> - **Left Header Title:** "Avani AI" and "V1.0" will be rendered on a **single line** (inline badge/tag format next to the title) on the left side of the Voice Mode header.
> - **Right Header Options:** Kept streamlined with the **Three-Dots Menu (`...`)**, containing Contact Creator, AI Memory Bank, Security Status, and Help/Instructions.

---

## Proposed Changes

### 1. Voice Mode Header (`src/App.tsx`)

#### Single-Line Header Title
- Update the left side of the Voice Mode `<header>` (lines 1625–1636):
  - Replace the 2-row layout with an inline flex container (`flex items-center gap-2 md:gap-2.5`).
  - Display **"Avani AI"** with the vibrant gradient styling (`bg-clip-text bg-gradient-to-r from-rose-400 via-pink-400 to-indigo-400 font-extrabold`).
  - Place **"V1.0"** directly next to it on the same line in a polished mono badge (`text-[10px] md:text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 tracking-wider`).
  - Keep the animated live indicator dot beside the title.

#### Screen Cleanup & Icon Audit
- Confirm that no extra floating or standalone Security (`Shield`) or Help (`HelpCircle`) buttons are rendered directly on the Voice Mode screen.
- Verify that both "Security & Integrity" and "Help & Instructions" remain accessible exclusively inside the Voice Mode three-dots dropdown menu.
- Ensure consistent styling and layout between Voice Mode and Chat Mode headers for an integrated experience.

---

## Verification Plan

### Automated Checks
- Run `compile_applet` to ensure TypeScript compilation passes without errors.
- Run `lint_applet` to check for syntax issues.

### Manual Verification in Preview
- Load the application in Voice Mode:
  - Check that the header displays **Avani AI** and **V1.0** side-by-side in one single row on the left.
  - Verify that the right side only displays the clean three-dots icon button without redundant standalone security or help icons on the screen.
  - Click the three-dots icon: confirm all four menu items (Contact Creator, AI Memory Bank, Security & Integrity, Help & Instructions) open smoothly.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository is a personal collection of Adobe Illustrator scripts (ExtendScript / `.jsx`), synced across multiple machines by cloning/pulling this repo. There is no build system, package manager, or test suite — each file in `scripts/` is a standalone script installed directly into Illustrator's Scripts folder and run from Illustrator's `File > Scripts` menu. Rarely-used scripts live in `scripts/extra/` (documented in their own separate section in `README.md`) rather than being deleted.

- Target environment: Adobe Illustrator CS6 (ExtendScript engine, roughly ES3/JS1.5 — no `let`/`const`, arrow functions, template literals, or other modern ES syntax)
- Install path (copy `.jsx` files here, then restart Illustrator):
  - macOS: `/Applications/Adobe Illustrator CS6/Presets.localized/en_US/Scripts/`
  - Windows: `C:\Program Files\Adobe\Adobe Illustrator CS6\Presets\ja_JP\スクリプト\` (path varies by version/language)
- There is no way to run or test these scripts from this environment (no headless Illustrator, no VM/GUI control available here) — changes must be tested manually by the user inside Illustrator.

## Critical: file encoding

Scripts contain Japanese comments and must be saved as **UTF-8 with BOM**. Without the BOM, Illustrator's CS6 ExtendScript engine can misinterpret multi-byte characters in comments and throw spurious syntax errors (e.g. `';' が必要です。`). When creating or editing a `.jsx` file here, always verify/add the UTF-8 BOM (`EF BB BF`) before considering the change done — the Write tool does not preserve an existing BOM on overwrite, so re-check after every full rewrite.

## Editor configuration

`.vscode/settings.json` sets `"javascript.validate.enable": false`. This is required because VSCode's built-in TypeScript language service treats `.jsx` files as JavaScript/JSX and reports a syntax error on the ExtendScript-only `#target` (and `#include`) preprocessor pragma at the top of every script — a false positive with no effect on how Illustrator actually runs the file. Don't try to "fix" that pragma; it's correct ExtendScript.

## Script structure convention

Each script (see `scripts/CreateCornerTombo.jsx` or `scripts/NestShapesInArtboard.jsx` as reference examples) follows the same shape:

- `#target illustrator` pragma at the top, whole file wrapped in an IIFE
- Tunable constants (e.g. bleed/arm length/gap/stroke width in mm or pt) declared at the top of the IIFE for easy editing without touching logic
- A `mm2pt()` helper for unit conversion, since Illustrator's scripting DOM works in points
- Guard clauses in `main()` for no open document / empty selection, using `alert()` to message the user
- Runtime parameters the user might want to change per-run (not just per-edit) are collected via ExtendScript's `prompt()`, not hardcoded
- Idempotent lookup-or-create helpers for layers/swatches (`try { getByName(...) } catch (e) { create it }`), rather than assuming a fresh document state
- Generated art is grouped and placed on a dedicated named layer (Japanese name, e.g. `"トンボ"`) rather than mixed into existing content

New scripts should follow this same pattern unless there's a specific reason not to.

When a script needs to match an exact native Illustrator visual (e.g. the precise geometry of a built-in mark or effect), don't guess the coordinates from memory or documentation — write a throwaway diagnostic script that runs the native feature (`app.executeMenuCommand("<internal command id>")`) and dumps the resulting path anchor points (relative to a known reference like the selection's bounding box), then have the user run it once in Illustrator and report the numbers back. Reproduce that measured geometry by hand rather than depending on the native command at runtime, so the result stays deterministic and inspectable. Delete the diagnostic script once its numbers are captured.

## Documentation

`README.md` (Japanese) is the source of truth for what each script does, its default parameter values, and usage instructions. When adding or changing a script's behavior or defaults, update `README.md`'s per-script section to match.

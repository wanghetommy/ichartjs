# iChart.js 2.0.0-rc.1 Acceptance Report

Date: 2026-09-14

## Runtime gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Unit tests | Pass | `npm test`, 33/33 tests |
| Syntax checks | Pass | `npm run check` |
| Diff whitespace | Pass | `git diff --check` |
| Combined RC command | Pass | `npm run rc:check` |
| Headless JSON export | Pass | `Chart.export({ type: 'json' })` |
| Headless raster export | Explicit unsupported result | `HEADLESS_EXPORT_UNSUPPORTED` |
| Guarded edit commit | Pass | Preview, confirmation, revision and audit tests |
| Undo/redo | Pass | History and stale-history tests |
| Recipe validation | Pass | `validateRecipe()` regression coverage |

## HTTP demo gates

- `http://localhost:3000/playground/editing` loads over HTTP.
- Preview shows deterministic before/after values and affected records.
- Commit requires the exact preview and confirmation.
- Commit updates local chart state and revision.
- Undo and redo controls become available after commit.
- Demo states clearly that external persistence is not performed.
- `http://127.0.0.1:3000/playground/diagram-editor.html` exposes Iteration 5 group lifecycle, group resize, pointer/keyboard port connection, and shared history behavior.
- `http://127.0.0.1:3000/playground/project-gallery.html` exposes the Iteration 5 Flow model and links to the editor.

## Deferred host/device gates

These are not claimed as complete by the local runtime:

- Physical-device touch testing across iOS and Android.
- Full browser matrix testing outside the current in-app browser.
- Host authentication, authorization, approval, and durable persistence.
- Durable server-side audit storage.
- Large-data performance budgets on representative hardware.
- Full ARIA audit and keyboard-only editing review.

## Release decision

The repository is functionally ready for `2.0.0-rc.1` review. Do not label it a final production release until the deferred host/device gates are accepted by the integrating application.

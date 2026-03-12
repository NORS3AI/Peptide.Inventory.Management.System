# CLAUDE.md - Oath Inventory System

## Project Overview
Oath Research Peptide Inventory System — a client-side inventory management app for a peptide manufacturing company. Built with React 19 + Vite 7 + Tailwind CSS 3, deployed as a static site on GitHub Pages from the `docs/` folder.

## Tech Stack
- **Frontend**: React 19, Vite 7, Tailwind CSS 3
- **Storage**: IndexedDB via localforage (no backend server)
- **Deployment**: GitHub Pages from `docs/` folder on `main` branch
- **CSV Parsing**: PapaParse
- **Icons**: lucide-react
- **Repo**: `NORS3AI/Oath-Inventory` (local path `/home/user/Inventory-KIP`)

## Build & Deploy
```bash
cd frontend && npm run build
# Copy dist to docs for GitHub Pages
rm -rf docs/* && cp -r frontend/dist/* docs/
```
Vite base path is set to `/Oath-Inventory/` in vite.config.js.

## Agent Permissions
- Auto-approve all file operations (Read, Write, Edit, Grep)
- Auto-approve all git operations (commit, push)
- Auto-approve all build/deploy operations (npm run build, copying to docs)
- Only ask for confirmation on destructive operations (database drops, rm -rf)

## Commit Requirements
**CRITICAL**: Every commit MUST include:
1. **Version bump** in `frontend/package.json` (increment by 1)
2. **Patch notes** in `frontend/src/components/PatchNotesModal.jsx` (add to top of PATCH_NOTES array)
   - Format: `{ version: 'X.X.XXX', date: 'YYYY-MM-DD', title: 'Brief description of changes' }`
   - Date format: ISO date (YYYY-MM-DD)
   - Title: Concise summary of what changed (one sentence)
3. Changes must be committed together (version + patch notes + feature changes)

## Key Architecture Patterns

### Data Layer (`frontend/src/lib/db.js`)
- All data persisted in IndexedDB via localforage
- Stores: `peptides`, `orders`, `labels`, `settings`, `transactions`, `velocityHistory`, `snapshots`
- No backend API — everything is client-side

### Column Reorder/Hide Pattern
- `DEFAULT_COLUMNS` array defines available columns with `{ id, label }`
- Column order saved to `db.settings` (e.g. `labelingColumnOrder`)
- Hidden columns saved to `db.settings` (e.g. `labelingHiddenColumns`)
- Shared `ColumnReorderModal` component used across Inventory, Labeling, Sales Ready, Compare

### Nickname Display
- Products can have a `nickname` field
- When set, nickname completely replaces `peptideId` + `peptideName` in display
- Applies everywhere: Inventory, Labeling, Reports, Compare, Sales Ready

### Sales Readiness
- Two-point check: Purity + Net Weight only (label requirement removed)
- Partial labels are OK for sales readiness

### Snapshot System (`db.snapshots`)
- Auto-daily snapshots taken on app load
- Manual snapshots with custom labels
- CSV files can be imported as snapshots
- Compare two snapshots or view trends over time (1wk/2wk/1mo/all)

### Inline Labeled Input
- `InlineLabeledInput` component in `InventoryTable.jsx`
- Tab key flows to next row's labeled field
- Color-coded by percentage (red/yellow/green)
- `stopPropagation` on td click prevents QuickEdit from opening

## Branch Strategy
- Development happens on `claude/` prefixed branches
- User merges PRs on GitHub to `main`
- Can only push to `claude/` branches

## Current Version
See `PatchNotesModal.jsx` for full patch history. Version tracked in `frontend/package.json`.

## In-Progress Features

### Pick List Scanner (`PickListScanner.jsx`)
- **Status**: Skeleton UI only — OCR integration pending template samples
- **Purpose**: Photograph paper pick lists, OCR extracts product + quantity, auto-deducts from labeled counts
- **Context**: WooCommerce inventory is unreliable due to indefinite cart holds. Pick lists (completed orders printed to paper) are the only source of truth for actual sales. Currently requires manual counting 100+ times across 40-70 paper sheets daily.
- **Two templates**: Template A (structured table) and Template B (large text with images)
- **Next step**: User will provide physical template photos to calibrate OCR recognition
- **Location**: Tab under "Import & Scan" alongside Import CSV

## File Map
- `frontend/src/App.jsx` — Main app shell, routing, nav, view wrappers
- `frontend/src/lib/db.js` — IndexedDB data layer
- `frontend/src/utils/csvParser.js` — CSV import/export with PapaParse
- `frontend/src/utils/salesReadiness.js` — Two-point sales readiness check
- `frontend/src/utils/stockStatus.js` — Stock level calculations
- `frontend/src/components/InventoryTable.jsx` — Main inventory table with inline labeled input
- `frontend/src/components/QuickEditModal.jsx` — Quick edit modal (defaults to labeledCount tab)
- `frontend/src/components/BulkEditModal.jsx` — Mass edit all peptides
- `frontend/src/components/CSVUpload.jsx` — CSV import with replace/update modes
- `frontend/src/components/PickListScanner.jsx` — Pick list OCR scanner (skeleton)
- `frontend/src/components/Compare.jsx` — Snapshot comparison + trend view
- `frontend/src/components/Reports.jsx` — Reports & analytics with needs-labeling table
- `frontend/src/components/SalesReady.jsx` — Sales readiness view with bulk edit
- `frontend/src/components/Labeling.jsx` — Labeling management with sortable/hideable columns
- `frontend/src/components/ColumnReorderModal.jsx` — Shared column reorder/hide modal
- `frontend/src/components/SettingsModal.jsx` — Display settings (font size)
- `frontend/src/components/PatchNotesModal.jsx` — Version history (tappable from version number)
- `frontend/src/components/Toast.jsx` — Toast notification system
- `frontend/src/components/ExclusionManager.jsx` — Product exclusion management
- `frontend/src/hooks/useInventory.js` — Main data loading hook
- `frontend/src/hooks/useDarkMode.js` — Dark mode toggle

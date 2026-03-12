import { useEffect, useRef } from 'react';
import { X, Sparkles, Bug, Wrench, Rocket, Layers, Shield, Palette, Zap } from 'lucide-react';

const PATCH_NOTES = [
  { version: '0.0.138', date: '2026-03-12', title: 'Team Minutes: Password-protected meeting minutes system (password: 1337) - track meetings, notes, attendees, action items per team member, accessible from Daily tab' },
  { version: '0.0.137', date: '2026-03-11', title: 'Daily Tasks: Comprehensive task management system with daily/weekly tasks, expiration dates, priority levels, rich text notes, and urgent task activity log on Dashboard' },
  { version: '0.0.136', date: '2026-03-07', title: 'Prices Export Text: Plain text table export with aligned columns - download as .txt for easy copy/paste or conversion' },
  { version: '0.0.135', date: '2026-03-07', title: 'Prices Export CSV: Add instant CSV download button - bypasses print issues, export all pricing data to file for PDF conversion' },
  { version: '0.0.134', date: '2026-03-07', title: 'Prices Print FIX: Remove overflow-hidden containers causing blank print - force all content visible with comprehensive print styles' },
  { version: '0.0.133', date: '2026-03-07', title: 'Prices Print: Add multi-page support - ALL products print across multiple pages, headers repeat, proper pagination' },
  { version: '0.0.132', date: '2026-03-07', title: 'Parser Fix: Allow multi-word product names with spaces - "Melanotan I (10mg)", "Thymosin Alpha-1 (10mg)", "TB-500 (5mg) short chain"' },
  { version: '0.0.131', date: '2026-03-07', title: 'Parser Debug: Add console logging to diagnose "only 1 item imported" issue - check browser console (F12) after paste' },
  { version: '0.0.130', date: '2026-03-07', title: 'Print: Fix multi-page printing - table headers repeat on each page, no page breaks mid-row, proper pagination' },
  { version: '0.0.129', date: '2026-03-07', title: 'Invoice Parser: Keep blend products together - "Tesamorelin (6mg) / Ipamorelin (2mg) Blend (8mg)" stays as ONE item, not split into two' },
  { version: '0.0.128', date: '2026-03-07', title: 'Invoice Parser: Fix "Product (Xmg) 3ML Vial QTY RATE AMOUNT" format - extract product name before "3ML Vial", handle inline descriptions' },
  { version: '0.0.127', date: '2026-03-07', title: 'Prices: Add print button - save as PDF or print price table with visible columns only, clean formatting for paper' },
  { version: '0.0.126', date: '2026-03-07', title: 'Invoice Import: Default to "Paste Text" mode - faster mobile workflow, skip PDF upload step' },
  { version: '0.0.125', date: '2026-03-07', title: 'Invoice Parser: Fix concatenated PDF text - extract product names "(Xmg)" from one line, pair with number-only lines, handle split tables' },
  { version: '0.0.124', date: '2026-03-07', title: 'Invoice Parser: Add "QTY RATE AMOUNT" format support - extract RATE from middle column, handles comma-separated quantities, skip headers/footers' },
  { version: '0.0.123', date: '2026-03-07', title: 'Invoice Import: Add "Paste Text" mode - bypass PDF parsing entirely, copy text from PDF and paste directly, instant processing on mobile' },
  { version: '0.0.122', date: '2026-03-07', title: 'PDF Import: Fix iPad/mobile loading - force HTTPS worker URL, 30s timeout, better status messages, show file size during processing' },
  { version: '0.0.121', date: '2026-03-07', title: 'PDF Import: Performance tuning - 2.5x batch size, cache toLowerCase, early-exit per field, reduce setTimeout calls, detailed console logging' },
  { version: '0.0.120', date: '2026-03-07', title: 'Fix zoom issue: Prevent browser from zooming in/out when alt-tabbing - disable user-scalable, lock zoom to 1.0x' },
  { version: '0.0.119', date: '2026-03-07', title: 'Prices: Fix table width - columns no longer stretch to fill screen, fixed widths (product=140px, prices=100px), empty space on right' },
  { version: '0.0.118', date: '2026-03-07', title: 'PDF Import: Fix UI freezing - async batch processing, live progress, fast substring pre-filter before fuzzy matching, skip very different lengths' },
  { version: '0.0.117', date: '2026-03-07', title: 'Prices: Add sortable columns (click headers to sort asc/desc), left-align all columns, ultra-compact layout (product=128px, prices=112px)' },
  { version: '0.0.116', date: '2026-03-07', title: 'Performance: Optimize PDF invoice import (5-10x faster), tighten Prices table columns for compact view' },
  { version: '0.0.115', date: '2026-03-07', title: 'Backup & Restore: Complete data export/import in Settings (Inventory, Prices, Snapshots, Labels, all data) - protect against cache clears' },
  { version: '0.0.114', date: '2026-03-07', title: 'PDF Invoice Import: Upload invoices, auto-match products with fuzzy matching, choose price column (Price/Axx26/Bxx26/Cxx26)' },
  { version: '0.0.113', date: '2026-03-07', title: 'Prices: Add column reordering and hiding (same as Inventory, Labeling, Sales Ready)' },
  { version: '0.0.112', date: '2026-02-16', title: 'Removed Manual Labels column - not required per user request' },
  { version: '0.0.111', date: '2026-02-16', title: 'OCR Scanner: Improved error handling with detailed messages, troubleshooting tips, and CDN configuration for worker files' },
  { version: '0.0.110', date: '2026-02-16', title: 'NEW COLUMN: Manual Labels - fully manual field that NEVER changes during CSV import (unlike Labeled which auto-adjusts)' },
  { version: '0.0.109', date: '2026-02-16', title: 'CSV Import: Labeled counts now auto-adjust with quantity changes (if qty -100, labeled also -100)' },
  { version: '0.0.108', date: '2026-02-16', title: 'LIVE: Full OCR integration with Tesseract.js - Pick List Scanner now extracts products and quantities, auto-deducts from labeled counts' },
  { version: '0.0.107', date: '2026-02-16', title: 'Fix build error: handle missing template images gracefully with placeholder UI' },
  { version: '0.0.106', date: '2026-02-16', title: 'Add Template Preview section to Pick List Scanner with collapsible image display and photo library support' },
  { version: '0.0.105', date: '2026-02-15', title: 'Add Pick List Scanner skeleton (OCR-based pick list reading, template selection, running tally UI)' },
  { version: '0.0.104', date: '2026-02-14', title: 'Compare: CSV import for snapshots, multi-day trend view (1wk/2wk/1mo), 1000-item limit' },
  { version: '0.0.103', date: '2026-02-11', title: 'Add sortable/hideable columns to Labeling tab, add Top 100 Needs Labeling report' },
  { version: '0.0.102', date: '2026-02-10', title: 'Add nickname field for products - displays under product name, used as display name when set' },
  { version: '0.0.101', date: '2026-02-10', title: 'Add bulk edit modal for mass editing all peptides at once' },
  { version: '0.0.100', date: '2026-02-10', title: 'Update docs/ build to match IndexedDB-only frontend' },
  { version: '0.0.99', date: '2026-02-10', title: 'Revert frontend to IndexedDB storage, remove backend API/auth dependency' },
  { version: '0.0.98', date: '2026-02-09', title: 'Claude/oath peptide inventory system merge (#36)' },
  { version: '0.0.97', date: '2026-02-09', title: 'Add comprehensive security documentation' },
  { version: '0.0.96', date: '2026-02-09', title: 'Add password authentication system (v0.0.100-alpha)' },
  { version: '0.0.95', date: '2026-02-09', title: 'Add deployment documentation and development startup script' },
  { version: '0.0.94', date: '2026-02-09', title: 'Migrate from browser storage to permanent backend database' },
  { version: '0.0.93', date: '2026-02-09', title: 'Merge main into feature branch and resolve version conflict' },
  { version: '0.0.92', date: '2026-02-09', title: 'Revert "Improve ExclusionManager display for better visibility"' },
  { version: '0.0.91', date: '2026-02-09', title: 'Fix overly broad exclusion matching that was hiding products' },
  { version: '0.0.90', date: '2026-02-09', title: 'Improve ExclusionManager display for better visibility' },
  { version: '0.0.89', date: '2026-02-08', title: 'Persist sort order across page refreshes in Inventory' },
  { version: '0.0.88', date: '2026-02-09', title: 'Persist sort order across page refreshes in Inventory' },
  { version: '0.0.87', date: '2026-02-09', title: 'Add ability to create new product rows in Inventory' },
  { version: '0.0.86', date: '2026-02-09', title: 'Fix OFF BOOKS calculation for negative quantities (backorders)' },
  { version: '0.0.85', date: '2026-02-08', title: 'Fix OFF BOOKS calculation for zero quantity items' },
  { version: '0.0.84', date: '2026-02-09', title: 'Add OFF BOOKS column to track extra labeled inventory' },
  { version: '0.0.83', date: '2026-02-08', title: 'Persist search terms across page refreshes' },
  { version: '0.0.82', date: '2026-02-08', title: 'Persist search terms across page refreshes' },
  { version: '0.0.81', date: '2026-02-08', title: 'Add automatic version tracking and bump script' },
  { version: '0.0.80', date: '2026-02-08', title: 'Disable autocorrect on all search inputs' },
  { version: '0.0.79', date: '2026-02-08', title: 'Disable autocorrect on all search inputs' },
  { version: '0.0.78', date: '2026-02-08', title: 'Add Labeling tab with comprehensive tracking and management' },
  { version: '0.0.77', date: '2026-02-08', title: 'Add Labeling tab with comprehensive tracking and management' },
  { version: '0.0.76', date: '2026-02-08', title: 'Implement bulk exclusion with checkboxes and site-wide filtering' },
  { version: '0.0.75', date: '2026-02-08', title: 'Merge main into feature branch' },
  { version: '0.0.74', date: '2026-02-08', title: 'Implement bulk exclusion with checkboxes and site-wide filtering' },
  { version: '0.0.73', date: '2026-02-08', title: 'Remove labeling page, fix dashboard actions, improve mobile scrolling' },
  { version: '0.0.72', date: '2026-02-08', title: 'Remove labeling page, fix dashboard actions, improve mobile scrolling' },
  { version: '0.0.71', date: '2026-02-08', title: 'Enhance Sales Ready and Reports pages with sorting and dark mode' },
  { version: '0.0.70', date: '2026-02-08', title: 'Enhance Sales Ready and Reports pages with sorting and dark mode' },
  { version: '0.0.69', date: '2026-02-08', title: 'Move Import CSV to last menu item and add Labeling debug' },
  { version: '0.0.68', date: '2026-02-08', title: 'Fix label color for negative quantities' },
  { version: '0.0.67', date: '2026-02-08', title: 'Make app mobile/iPhone friendly with horizontal navigation scrolling' },
  { version: '0.0.66', date: '2026-02-08', title: 'Make app mobile/iPhone friendly with horizontal navigation scrolling' },
  { version: '0.0.65', date: '2026-02-08', title: 'Fix labeledCount to always display as numbers, not text' },
  { version: '0.0.64', date: '2026-02-08', title: 'Update README with comprehensive documentation and GitHub Pages link' },
  { version: '0.0.63', date: '2026-02-08', title: 'Update README with comprehensive documentation and GitHub Pages link' },
  { version: '0.0.62', date: '2026-02-06', title: 'Persist active tab across page refreshes' },
  { version: '0.0.61', date: '2026-02-07', title: 'Persist active tab across page refreshes' },
  { version: '0.0.60', date: '2026-02-06', title: 'Redesign Labeling tab with better focus and visuals' },
  { version: '0.0.59', date: '2026-02-07', title: 'Redesign Labeling tab with better focus and visuals' },
  { version: '0.0.58', date: '2026-02-06', title: 'Show gray label color when quantity is zero' },
  { version: '0.0.57', date: '2026-02-07', title: 'Show gray label color when quantity is zero' },
  { version: '0.0.56', date: '2026-02-06', title: 'Preserve scroll position when closing modals and refreshing' },
  { version: '0.0.55', date: '2026-02-07', title: 'Preserve scroll position when closing modals and refreshing' },
  { version: '0.0.54', date: '2026-02-06', title: 'Prevent page jump on label update and add scroll controls' },
  { version: '0.0.53', date: '2026-02-07', title: 'Prevent page jump on label update and add scroll controls' },
  { version: '0.0.52', date: '2026-02-06', title: 'Change default import mode to Update and add Replace All confirmation' },
  { version: '0.0.51', date: '2026-02-07', title: 'Change default import mode to Update and add Replace All confirmation' },
  { version: '0.0.50', date: '2026-02-06', title: 'Fix label column position and add velocity history tracking' },
  { version: '0.0.49', date: '2026-02-07', title: 'Fix label column position to be after quantity column' },
  { version: '0.0.48', date: '2026-02-07', title: 'Add velocity history tracking for sales velocity analysis' },
  { version: '0.0.47', date: '2026-02-06', title: 'Update label field colors to percentage-based thresholds' },
  { version: '0.0.46', date: '2026-02-07', title: 'Update label field colors to percentage-based thresholds' },
  { version: '0.0.45', date: '2026-02-06', title: 'Preserve manually edited fields during CSV update imports' },
  { version: '0.0.44', date: '2026-02-07', title: 'Preserve manually edited fields during CSV update imports' },
  { version: '0.0.43', date: '2026-02-06', title: 'Fix Quick Edit modal behavior and reorder Labeled column' },
  { version: '0.0.42', date: '2026-02-07', title: 'Fix Quick Edit modal behavior and reorder Labeled column' },
  { version: '0.0.41', date: '2026-02-06', title: 'Add dark mode support to Dashboard status cards' },
  { version: '0.0.40', date: '2026-02-07', title: 'Add dark mode support to Dashboard status cards and stat squares' },
  { version: '0.0.39', date: '2026-02-06', title: 'Fix GitHub Pages deployment with proper workflow permissions' },
  { version: '0.0.38', date: '2026-02-07', title: 'Fix GitHub Pages deployment with proper workflow permissions' },
  { version: '0.0.37', date: '2026-02-07', title: 'Add sales velocity tracking and analytics system' },
  { version: '0.0.36', date: '2026-02-06', title: 'Convert Labeled column from boolean to numeric count' },
  { version: '0.0.35', date: '2026-02-07', title: 'Convert Labeled column from boolean to numeric count with percentage-based color coding' },
  { version: '0.0.34', date: '2026-02-06', title: 'Add interactive charts and complete dark mode support' },
  { version: '0.0.33', date: '2026-02-07', title: 'Add interactive charts and complete dark mode support' },
  { version: '0.0.32', date: '2026-02-06', title: 'Add Import CSV tab with Replace/Update modes' },
  { version: '0.0.31', date: '2026-02-07', title: 'Add Import CSV tab with Replace/Update modes' },
  { version: '0.0.30', date: '2026-02-06', title: 'Deploy dark mode fixes to GitHub Pages' },
  { version: '0.0.29', date: '2026-02-07', title: 'Deploy dark mode fixes to GitHub Pages' },
  { version: '0.0.28', date: '2026-02-07', title: 'Merge dark mode branch' },
  { version: '0.0.27', date: '2026-02-07', title: 'Complete dark mode support across all components' },
  { version: '0.0.26', date: '2026-02-07', title: 'Add dark mode support to CSVUpload component' },
  { version: '0.0.25', date: '2026-02-06', title: 'Merge feature branch with core improvements' },
  { version: '0.0.24', date: '2026-02-07', title: 'Remove Import CSV navigation tab' },
  { version: '0.0.23', date: '2026-02-07', title: 'CRITICAL FIX: ExclusionManager modal control and closing' },
  { version: '0.0.22', date: '2026-02-07', title: 'Fix: ExclusionManager modal not closing' },
  { version: '0.0.21', date: '2026-02-07', title: 'Add Labeled column and enable sorting for all columns' },
  { version: '0.0.20', date: '2026-02-07', title: 'Add deploy script for GitHub Pages' },
  { version: '0.0.19', date: '2026-02-07', title: 'Fix: ExclusionManager auto-opening on Import CSV tab' },
  { version: '0.0.18', date: '2026-02-06', title: 'Complete Phase 9: E2E Testing & UAT Framework' },
  { version: '0.0.17', date: '2026-02-06', title: 'Add comprehensive testing documentation' },
  { version: '0.0.16', date: '2026-02-06', title: 'Add comprehensive testing infrastructure - Phase 9' },
  { version: '0.0.15', date: '2026-02-06', title: 'Complete Phase 5: Label Management System' },
  { version: '0.0.14', date: '2026-02-06', title: 'Complete Phase 8: Reporting & Analytics' },
  { version: '0.0.13', date: '2026-02-06', title: 'Complete Phase 7: UI/UX Enhancement' },
  { version: '0.0.12', date: '2026-02-06', title: 'Complete Phase 6: Sales Readiness Validation' },
  { version: '0.0.11', date: '2026-02-06', title: 'Add column visibility controls to Reorder modal' },
  { version: '0.0.10', date: '2026-02-06', title: 'Add inline exclusion feature and Exclusions management button' },
  { version: '0.0.9', date: '2026-02-06', title: 'Add mobile-friendly column reordering with up/down buttons' },
  { version: '0.0.8', date: '2026-02-06', title: 'Add Quick Edit functionality for inline row editing' },
  { version: '0.0.7', date: '2026-02-06', title: 'Add GitHub Pages deployment in docs folder' },
  { version: '0.0.6', date: '2026-02-06', title: 'Complete Phase 2: CSV Import & Basic Display' },
  { version: '0.0.5', date: '2026-02-06', title: 'Complete Phase 2: CSV Import & Basic Display' },
  { version: '0.0.4', date: '2026-02-06', title: 'Merge: Project Setup & Foundation' },
  { version: '0.0.3', date: '2026-02-06', title: 'Complete Phase 1: Project Setup & Foundation' },
  { version: '0.0.2', date: '2026-02-06', title: 'Add comprehensive project documentation' },
  { version: '0.0.1', date: '2026-02-06', title: 'Initial commit' },
];

// Categorize patch by title keywords
function getCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('fix') || t.includes('revert') || t.includes('critical')) return 'fix';
  if (t.includes('add') || t.includes('complete') || t.includes('implement') || t.includes('new')) return 'feature';
  if (t.includes('merge') || t.includes('deploy') || t.includes('update') || t.includes('migrate')) return 'infra';
  if (t.includes('dark mode') || t.includes('mobile') || t.includes('ui') || t.includes('redesign') || t.includes('enhance')) return 'ui';
  if (t.includes('persist') || t.includes('preserve') || t.includes('improve') || t.includes('disable')) return 'improve';
  if (t.includes('security') || t.includes('auth') || t.includes('password')) return 'security';
  return 'other';
}

const CATEGORY_CONFIG = {
  feature:  { icon: Sparkles, gradient: 'from-violet-500 to-purple-600',  badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',  dot: 'bg-violet-500' },
  fix:      { icon: Bug,      gradient: 'from-rose-500 to-red-600',      badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',          dot: 'bg-rose-500' },
  ui:       { icon: Palette,   gradient: 'from-amber-500 to-orange-600',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',      dot: 'bg-amber-500' },
  infra:    { icon: Rocket,    gradient: 'from-sky-500 to-blue-600',      badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',              dot: 'bg-sky-500' },
  improve:  { icon: Zap,       gradient: 'from-emerald-500 to-green-600', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500' },
  security: { icon: Shield,    gradient: 'from-cyan-500 to-teal-600',     badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',          dot: 'bg-cyan-500' },
  other:    { icon: Layers,    gradient: 'from-gray-500 to-slate-600',    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',             dot: 'bg-gray-500' },
};

const CATEGORY_LABELS = {
  feature: 'Feature',
  fix: 'Bug Fix',
  ui: 'UI/UX',
  infra: 'Infrastructure',
  improve: 'Improvement',
  security: 'Security',
  other: 'Other',
};

export default function PatchNotesModal({ isOpen, onClose, currentVersion }) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClickOutside), 100);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClickOutside); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Group patches by date
  const grouped = {};
  for (const p of PATCH_NOTES) {
    if (!grouped[p.date]) grouped[p.date] = [];
    grouped[p.date].push(p);
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
      >
        {/* Header with gradient */}
        <div className="relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 opacity-90" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxIiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiLz48L3N2Zz4=')] opacity-50" />
          <div className="relative px-6 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Patch Notes</h2>
              <p className="text-sm text-white/70 mt-0.5">
                {PATCH_NOTES.length} updates since v0.0.1
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-sm font-semibold text-white">
                v{currentVersion}
              </span>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex gap-3 flex-wrap flex-shrink-0 bg-gray-50 dark:bg-gray-800/50 select-none">
          {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
            <span key={key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.badge}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {CATEGORY_LABELS[key]}
            </span>
          ))}
        </div>

        {/* Timeline Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 select-none" style={{ userSelect: 'none', WebkitUserSelect: 'none' }}>
          {sortedDates.map((date, dateIdx) => (
            <div key={date} className="relative">
              {/* Date Header */}
              <div className="sticky top-0 z-10 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm py-2 mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    {formatDate(date)}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-gray-200 dark:from-gray-700 to-transparent" />
                  <span className="text-xs text-gray-400 dark:text-gray-600 font-medium">
                    {grouped[date].length} {grouped[date].length === 1 ? 'patch' : 'patches'}
                  </span>
                </div>
              </div>

              {/* Patches for this date */}
              <div className="space-y-2 mb-6 ml-2">
                {grouped[date].map((patch, patchIdx) => {
                  const cat = getCategory(patch.title);
                  const cfg = CATEGORY_CONFIG[cat];
                  const Icon = cfg.icon;
                  const isLatest = dateIdx === 0 && patchIdx === 0;

                  return (
                    <div
                      key={patch.version}
                      className={`relative flex items-start gap-3 px-4 py-3 rounded-xl transition-all pointer-events-none ${
                        isLatest
                          ? 'bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 border border-violet-200 dark:border-violet-800 ring-2 ring-violet-300/50 dark:ring-violet-700/50'
                          : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800'
                      }`}
                    >
                      {/* Icon */}
                      <div className={`flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-sm`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                            v{patch.version}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cfg.badge}`}>
                            {CATEGORY_LABELS[cat]}
                          </span>
                          {isLatest && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm">
                              Latest
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                          {patch.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Origin footer */}
          <div className="text-center py-6 border-t border-gray-200 dark:border-gray-700">
            <div className="inline-flex items-center gap-2 text-sm text-gray-400 dark:text-gray-600">
              <Rocket className="w-4 h-4" />
              <span>Oath Inventory System - Born Feb 6, 2026</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

# Label Management System - Design Document

## Overview
The Label Management page is designed to streamline the physical labeling process for peptide inventory. It manages label inventory, prioritizes products for labeling, and tracks labeling progress.

## Core Functionality

### 1. Label Inventory Management
- **Purpose**: Track available physical labels in stock
- **Features**:
  - Add labels to inventory (when new labels arrive)
  - Remove labels from inventory (when labels are discarded/damaged)
  - Display current label count prominently
  - Prevent applying labels when inventory is zero

### 2. Priority Queue System
The system automatically prioritizes which products should be labeled first based on a scoring algorithm:

**Priority Score Calculation**:
- **Quantity** (×2): Higher stock = higher priority (more product to sell)
- **Has Purity** (+100): Product closer to being sales-ready
- **Has Net Weight** (+100): Product closer to being sales-ready
- **Low Stock** (+50 for ≤10 units, +25 for ≤25 units): Urgent to label what's left
- **Has Velocity Data** (+30): Known sellers get priority

**Filtering**:
- Only shows products with quantity > 0 (excludes out-of-stock items)
- Only shows products that aren't fully labeled (labeledCount < quantity)

### 3. Labeling Workflow

**Apply Label Action**:
1. User clicks "Apply Label" button for a product
2. System checks if labels are available in inventory
3. If available:
   - Increments the product's `labeledCount` by 1
   - Decrements label inventory by 1
   - Updates `isLabeled` flag to true when labeledCount reaches quantity
   - Records `dateLabeled` timestamp
   - Updates local state to prevent page refresh and maintain scroll position

**Remove Label Action**:
1. User clicks "Remove Label" for a recently labeled product
2. System:
   - Decrements the product's `labeledCount` by 1
   - Increments label inventory by 1 (returns label to stock)
   - Updates `isLabeled` flag if needed
   - Clears `dateLabeled` if labeledCount reaches 0

### 4. Progress Tracking

**Overall Progress Bar**:
- Shows percentage of products (with stock) that are fully labeled
- Formula: (Fully Labeled Products / Total Products with Stock) × 100

**Statistics Display**:
- **Need Labels**: Count of products not yet fully labeled
- **Fully Labeled**: Count of products with labeledCount = quantity
- **Labels Available**: Current label inventory count
- **Ready for Sales**: Products that will be sales-ready after labeling (have purity + net weight)

### 5. Recently Labeled Section
- Displays top 10 most recently labeled products
- Sorted by `dateLabeled` (most recent first)
- Allows quick label removal if mistakes were made
- Only shows products with quantity > 0

## UI/UX Features

### Scroll Controls
- **Purpose**: Navigate long priority queue without losing context
- Up/Down buttons scroll approximately 10 rows at a time
- Fixed position on right side of screen
- Only appears when queue has more than 10 items

### Local State Management
- Uses local state (`localPeptides`) to avoid full page refresh
- Prevents scroll position jumping when applying/removing labels
- Optimized for mobile/tablet use (especially iPad)

### Visual Indicators
- **Top 3 Priority**: Red badge
- **Priority 4-10**: Orange badge
- **Lower Priority**: Gray badge
- **Sales Ready**: Green checkmark icon
- **Progress Bar**: Gradient from purple to blue

## Data Structure

### Label Inventory
Stored in: `db.labels.getInventory()` / `db.labels.setInventory(count)`

### Product Fields Used
- `peptideId`: Unique identifier
- `peptideName`: SKU
- `quantity`: Total units in stock
- `labeledCount`: Number of units labeled (0 to quantity)
- `isLabeled`: Boolean flag (true when labeledCount >= quantity)
- `dateLabeled`: ISO timestamp of last labeling action
- `purity`: Used for sales-ready check
- `netWeight`: Used for sales-ready check
- `velocity`: Used for priority scoring

## Database Operations

### Read Operations
- Load label inventory on mount
- Sync peptides from props to local state

### Write Operations
- Update label inventory (add/remove labels)
- Update peptide labeling status (apply/remove label)
- Update `labeledCount`, `isLabeled`, `dateLabeled` fields

## Future Improvements (When Re-implementing)

1. **Batch Labeling**: Allow labeling multiple units at once
2. **Barcode Scanning**: Integrate with barcode scanner for faster workflow
3. **Labeling History**: Track who labeled what and when
4. **Label Templates**: Different label types for different product categories
5. **Print Integration**: Direct printing of labels from the system
6. **Undo/Redo**: Multi-level undo for labeling operations
7. **Label Expiration**: Track label shelf life and expiration
8. **Mobile-First Design**: Optimize for handheld devices used in warehouse
9. **Offline Support**: PWA functionality for offline labeling
10. **Audio/Haptic Feedback**: Confirm successful labeling with sound/vibration

## Technical Implementation Notes

### Performance Optimizations
- useMemo for expensive calculations (priority queue, stats, labeled peptides)
- useRef for scroll container to avoid re-renders
- Local state updates to prevent full page refresh
- Smooth scrolling for better UX

### Accessibility
- Keyboard navigation support
- ARIA labels for screen readers
- High contrast colors for visibility
- Clear visual feedback for all actions

### Mobile Considerations
- Touch-friendly button sizes
- Scroll controls for one-handed operation
- Prevent page jumping on state updates
- Responsive grid layouts

## Integration Points

### Database (db.js)
- `db.labels.getInventory()`: Get current label count
- `db.labels.setInventory(count)`: Set label count
- `db.peptides.update(id, data)`: Update peptide labeling status

### Toast Notifications
- Success: Label applied/removed
- Error: No labels available, invalid input
- Informative messages for user actions

### Parent Component
- Receives `peptides` array as prop
- Receives `onRefresh` callback (though avoided to prevent scroll jump)
- Manages its own state to minimize parent re-renders

## Business Logic

### Why This Matters
Physical labeling is a critical bottleneck in the peptide fulfillment process. Without proper labels:
- Products cannot be sold (not sales-ready)
- Inventory tracking becomes unreliable
- Compliance requirements may not be met
- Customer shipments are delayed

The priority system ensures:
1. High-value inventory is labeled first
2. Products closest to being sales-ready are prioritized
3. Limited labels are used optimally
4. Warehouse staff have clear direction on what to label next

### Workflow Integration
1. Import inventory via CSV
2. Check Sales Ready page to see what's blocked
3. Use Labeling page to systematically apply labels
4. Products automatically become sales-ready once labeled (if purity + net weight exist)
5. Reports page shows labeling progress and impact

## Error Handling

- Validates label inventory before allowing labeling
- Prevents removing more labels than in stock
- Handles invalid input gracefully
- Shows clear error messages to user
- Fails gracefully if database operations fail

## State Management

### Component State
- `labelInventory`: Current count of available labels
- `adjustAmount`: Input for add/remove operations
- `localPeptides`: Local copy to prevent refresh
- `priorityQueueRef`: Reference to scrollable container

### Derived State (useMemo)
- `priorityQueue`: Sorted list of unlabeled products
- `labeledPeptides`: Recently labeled products
- `stats`: Calculated statistics and progress

## Security & Data Integrity

- No direct database manipulation from UI
- All updates go through controlled functions
- Input validation for label adjustments
- Atomic updates for label inventory changes
- Prevents negative label counts
- Prevents labeling more than quantity

---

**Status**: Temporarily removed from application (will be re-implemented later)
**Last Updated**: 2026-02-08
**Component File**: `frontend/src/components/LabelManagement.jsx` (archived)

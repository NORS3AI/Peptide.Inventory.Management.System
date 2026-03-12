# Oath Research Peptide Inventory System - Features

## Overview
A comprehensive inventory management system for Oath Research, a peptide manufacturing company. The system manages peptide inventory, tracks lifecycle from ordering through testing to labeling, and provides visual indicators for stock levels and operational priorities.

---

## Core Features

### 1. CSV Import & Inventory Management

#### 1.1 CSV Import
- Import standardized CSV files from existing inventory system
- Parse specific, consistent header structure
- Validate data integrity on import
- Handle errors gracefully with user feedback

#### 1.2 Inventory Display & Filtering
- Filter and display only relevant columns
- Modern, responsive UI design
- Quick search and filtering capabilities
- Sortable columns

#### 1.3 Color-Coded Stock Status
Visual indicators for inventory levels:
- **RED**: Out of stock - immediate ordering required
- **ORANGE**: Nearly out of stock - urgent ordering needed
- **YELLOW**: Low stock - ordering recommended
- **GREEN**: Good stock levels - no action needed
- **TEAL**: Already ordered - shipment in transit

### 2. Peptide Lifecycle Tracking

#### 2.1 Order Management
- Track date ordered
- Record supplier/lab information
- Monitor expected delivery dates
- Update status when shipment arrives

#### 2.2 Receiving & Initial Processing
- Log date arrived from lab
- Record batch number
- Initial MG quantity
- Glass vial tracking

#### 2.3 Testing Workflow
- Track date sent for testing
- Record testing facility
- Monitor testing turnaround time
- Log date results received
- Store test results:
  - Purity percentage
  - Net weight (actual weight vs. expected)

#### 2.4 Peptide Information
- Peptide ID (unique identifier)
- Peptide name (commercial/chemical name)
- MG quantity
- Batch number
- Current location/status

### 3. Label Management System

#### 3.1 Label Inventory Tracking
- Track total labels available
- Monitor label usage rate
- Alert when label stock is low
- Periodic manual entry for label counts

#### 3.2 Labeling Priority Queue
- Visual priority indicators (icons/colors)
- Automatic prioritization algorithm:
  - Peptides with test results (ready to sell)
  - Peptides with existing inventory
  - Oldest received items first
  - Highest demand items prioritized
- Most pressing needs displayed at top
- Hide peptides with no inventory

#### 3.3 Labeling Status
- Track labeled vs. unlabeled inventory
- Record date labeled
- Associate labels with specific batches
- Track who performed labeling

### 4. Sales Readiness Validation

#### 4.1 Three-Point Check System
Before a peptide can be sold, it must have:
1. **Purity results** - Test results showing acceptable purity
2. **Net weight** - Confirmed actual weight from testing
3. **Label** - Physical vial has been labeled

#### 4.2 Sales Dashboard
- Display only sales-ready inventory
- Show which peptides are blocked (missing requirements)
- Indicate what's missing for each blocked peptide
- Estimated time to sales-ready status

### 5. Reporting & Analytics

#### 5.1 Inventory Reports
- Current stock levels across all peptides
- Items needing immediate attention
- Ordering recommendations
- Historical inventory trends

#### 5.2 Operational Metrics
- Average time from order to receipt
- Testing turnaround times
- Labeling throughput
- Bottleneck identification

#### 5.3 Financial Insights
- Inventory value by status
- Pending orders value
- Sales-ready inventory value
- Cost of stock-outs

### 6. Data Management

#### 6.1 Data Persistence
- Local database for all records
- Automatic backups
- Export capabilities (CSV, Excel, PDF)
- Import historical data

#### 6.2 Data Integrity
- Validation rules for all inputs
- Audit trail for changes
- Date/time stamps for all actions
- User attribution for manual entries

---

## User Interface Features

### Modern Design Principles
- Clean, intuitive interface
- Responsive design (desktop/tablet/mobile)
- Dark/light mode support
- Accessibility compliant

### Visual Indicators
- Color-coded status badges
- Icon system for quick recognition
- Progress bars for multi-step processes
- Toast notifications for updates

### Quick Actions
- One-click status updates
- Batch operations support
- Keyboard shortcuts
- Drag-and-drop file upload

---

## Technical Features

### Performance
- Fast data loading and filtering
- Real-time updates
- Efficient search algorithms
- Optimized for large datasets

### Security
- Secure file upload
- Client-side data persistence (IndexedDB)

### Data Storage
- Browser-based IndexedDB via localforage
- No external server required
- Works as a static site on GitHub Pages
- Export/import standardization
- Extensible architecture

---

## Future Enhancements (Post-MVP)

### 7. Pick List Scanner (In Progress)

#### 7.1 Overview
OCR-based scanner to photograph paper pick lists and automatically deduct sold quantities from labeled inventory counts. Eliminates manual counting of 40-70+ paper pick lists each morning.

#### 7.2 Template Support
Two pick list formats from WooCommerce fulfillment:
- **Template A (Structured)**: Table/grid layout with product name, net weight, quantity columns
- **Template B (Visual)**: Large text format, sometimes includes product images

#### 7.3 Workflow
1. Select pick list template (A or B)
2. Photograph each pick list sheet (camera or gallery upload)
3. OCR extracts product names and quantities from each photo
4. System aggregates totals across all scanned sheets automatically
5. User reviews running tally, corrects any OCR misreads
6. One-tap "Apply" deducts totals from labeled inventory counts

#### 7.4 Problem Solved
- WooCommerce inventory numbers are unreliable due to indefinite cart holds
- Pick lists (completed orders) are the source of truth for actual sales
- Currently requires manual counting 100+ times across 40-70 paper sheets daily
- Scanner automates aggregation — user just photographs and taps Apply

#### 7.5 Status
- Skeleton UI complete with template selection, scan area, running tally, and apply button
- OCR integration pending — needs physical template samples to calibrate recognition
- Will match OCR-extracted product names against existing inventory product list

### 8. Inventory Comparison & Snapshots

#### 8.1 Snapshot System
- Automatic daily snapshots of inventory state
- Manual snapshots with custom labels
- CSV import as snapshots for comparing older inventory data
- Max 1000 items per comparison

#### 8.2 Compare Two Snapshots
- Side-by-side comparison of any two snapshots
- Summary cards: Units Sold, Restocked, New Products, Removed
- Filter by change type (Decreased, Increased, New, Removed, Unchanged)
- Sortable, reorderable columns

#### 8.3 Trend Over Time
- Multi-snapshot trend view across selectable time ranges (1wk, 2wk, 1mo, all)
- Color-coded quantity changes between consecutive snapshots
- Net change column showing overall movement per product

---

## Future Enhancements (Post-MVP)

### Phase 2+ Features
- **Backend API server** (Express.js + SQLite)
- **User authentication** (JWT-based login)
- **Role-based access control**
- **Cloudflare/CDN integration**
- **Webhook support for notifications**
- Barcode/QR code scanning for vials
- Automated email notifications
- Integration with testing labs
- Customer order management
- Shipping/fulfillment tracking
- Automated reordering based on demand forecasting
- Mobile app for warehouse operations
- Multi-user collaboration
- Advanced analytics dashboard
- Integration with accounting software

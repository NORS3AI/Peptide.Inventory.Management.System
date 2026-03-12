# User Acceptance Testing Checklist

## Overview

This document provides a comprehensive checklist for performing User Acceptance Testing (UAT) on the Oath Research Peptide Inventory System. Complete all sections to ensure the system meets business requirements and user expectations.

**Testing Date**: _________________
**Tester Name**: _________________
**Browser/Device**: _________________
**Test Environment**: https://nors3ai.github.io/Oath-Inventory/

---

## 1. Initial Setup & Access

- [ ] Application loads successfully
- [ ] No console errors in browser developer tools
- [ ] All navigation tabs are visible
- [ ] Header displays "Oath Research" and "Peptide Inventory System"
- [ ] Footer displays copyright notice
- [ ] Version number (v1.0.0) is visible

---

## 2. CSV Import Workflow

### 2.1 Navigation
- [ ] Click "Import CSV" tab
- [ ] Page displays "Import CSV" heading
- [ ] Drag-and-drop area is visible
- [ ] Field mapping guide is displayed

### 2.2 Import Modes
- [ ] "Replace All" option is available
- [ ] "Update Existing" option is available
- [ ] Can switch between import modes

### 2.3 Product Exclusions
- [ ] "Manage Exclusions" button is visible
- [ ] Clicking button opens exclusion modal
- [ ] Can add products to exclusion list
- [ ] Can remove products from exclusion list
- [ ] Excluded products are not imported

### 2.4 CSV Upload
- [ ] Can drag and drop CSV file
- [ ] Can click to browse for file
- [ ] File upload shows progress indicator
- [ ] Success message appears after import
- [ ] Data appears in Inventory tab after import

### 2.5 Field Mapping Validation
Test with CSV containing these columns:
- [ ] "Product" maps to Peptide ID
- [ ] "SKU" maps to Peptide Name
- [ ] "Size" maps to Net Weight
- [ ] "Status" maps to Notes
- [ ] "Incoming Arrival" maps to Ordered Date
- [ ] "Incoming Qty" maps to Ordered Qty
- [ ] Case-insensitive header matching works

### 2.6 Data Validation
- [ ] Negative quantities are accepted (back-ordering)
- [ ] Empty rows are filtered out
- [ ] Missing Peptide ID shows error
- [ ] Quantity defaults to 0 if missing

### 2.7 Clear All Data
- [ ] "Clear All Data" button is visible
- [ ] Clicking shows confirmation dialog
- [ ] Confirming clears all inventory
- [ ] Canceling preserves data

---

## 3. Dashboard View

### 3.1 Display
- [ ] Dashboard heading is visible
- [ ] Overview description is shown
- [ ] Stock Status Legend is displayed
- [ ] All 5 status types are shown (Red, Orange, Yellow, Green, Teal)
- [ ] Each status shows correct action label

### 3.2 Quick Stats
- [ ] "Total Peptides" card shows count
- [ ] "Need Ordering" card shows count
- [ ] "Need Labeling" card shows count
- [ ] Numbers update after import

### 3.3 Action Items
- [ ] If inventory is empty, "Getting Started" guide appears
- [ ] If inventory exists, "Action Items" section appears
- [ ] Items needing ordering are highlighted
- [ ] "All adequate stock" message shows when appropriate

---

## 4. Inventory Management

### 4.1 Navigation & Display
- [ ] Click "Inventory" tab
- [ ] Inventory heading is visible
- [ ] Search box is functional
- [ ] Filter controls work

### 4.2 Table Display
- [ ] All peptides are listed
- [ ] Columns: Peptide ID, Name, Quantity, Net Weight, Status, etc.
- [ ] Status badges show correct colors
- [ ] Row data is accurate

### 4.3 Search Functionality
- [ ] Can search by Peptide ID
- [ ] Can search by Peptide Name
- [ ] Search is case-insensitive
- [ ] Results update in real-time

### 4.4 Filter & Sort
- [ ] Can filter by status
- [ ] Can sort by any column
- [ ] Sort direction toggles (ascending/descending)
- [ ] Multiple filters can be combined

### 4.5 Quick Edit
- [ ] Click on a row to open quick edit modal
- [ ] All fields are editable
- [ ] Changes save automatically
- [ ] Updates reflect immediately in table
- [ ] "Exclude" checkbox is available
- [ ] Excluding a product removes it from view

### 4.6 Column Management
- [ ] "Reorder Columns" button is visible
- [ ] Clicking opens column reorder modal
- [ ] Can move columns up/down with arrows
- [ ] Can hide/show columns with checkboxes
- [ ] Hidden columns are greyed out
- [ ] Column order persists after reload
- [ ] Works on iPad/mobile (touch-friendly)

### 4.7 Order Management
- [ ] "Manage" button appears for each peptide
- [ ] Clicking opens order workflow modal
- [ ] Can place order (Step 1)
- [ ] Can record shipment arrival (Step 2)
- [ ] Can record testing submission (Step 3)
- [ ] Can record test results (Step 4)
- [ ] TEAL status appears when order is active
- [ ] Status updates after receiving results

### 4.8 Export
- [ ] "Export" button is visible
- [ ] Clicking exports CSV file
- [ ] Exported file contains all data
- [ ] File downloads successfully

---

## 5. Label Management

### 5.1 Navigation & Display
- [ ] Click "Labeling" tab
- [ ] Label Management heading is visible
- [ ] Three sections are displayed (Inventory, Queue, Labeled)

### 5.2 Label Inventory
- [ ] Current label count is displayed
- [ ] Can add labels (increase count)
- [ ] Can remove labels (decrease count)
- [ ] Count cannot go below 0
- [ ] Changes save immediately

### 5.3 Labeling Priority Queue
- [ ] Only peptides with inventory > 0 are shown
- [ ] Peptides without labels are listed
- [ ] Priority score is calculated correctly
- [ ] Higher priority items appear first
- [ ] Items with purity/net weight score higher
- [ ] Low stock items score higher

### 5.4 Apply Label
- [ ] "Apply Label" button appears for each peptide
- [ ] Clicking decrements label inventory
- [ ] Peptide moves to "Labeled" section
- [ ] Cannot apply label if label count is 0
- [ ] Toast notification confirms action

### 5.5 Labeled Peptides
- [ ] All labeled peptides are listed
- [ ] Date labeled is shown
- [ ] Can remove label from peptide
- [ ] Removing label increments label inventory
- [ ] Peptide returns to priority queue

---

## 6. Sales Readiness Validation

### 6.1 Navigation & Display
- [ ] Click "Sales Ready" tab
- [ ] Sales Ready Validation heading is visible
- [ ] Three-point check description is shown
- [ ] Requirements are listed (Purity, Net Weight, Label)

### 6.2 Filter Options
- [ ] "All" filter shows all peptides
- [ ] "Ready" filter shows only sales-ready items
- [ ] "Blocked" filter shows only blocked items
- [ ] Active filter is highlighted

### 6.3 Validation Status
- [ ] Each peptide shows status (Ready or Blocked)
- [ ] Ready items have green badge
- [ ] Blocked items have red badge
- [ ] Missing requirements are listed
- [ ] Peptides with all 3 requirements show "Sales Ready"

### 6.4 Three-Point Check
- [ ] Purity requirement is checked
- [ ] Net Weight requirement is checked
- [ ] Label requirement is checked
- [ ] All three must be met for "Ready" status
- [ ] Missing any requirement shows "Blocked"

---

## 7. Reports & Analytics

### 7.1 Navigation & Display
- [ ] Click "Reports" tab
- [ ] Reports & Analytics heading is visible
- [ ] All report sections are displayed

### 7.2 Inventory Summary
- [ ] Total peptides count is shown
- [ ] Total value (if applicable) is shown
- [ ] Summary statistics are accurate

### 7.3 Operational Metrics
- [ ] Average order-to-delivery time is calculated
- [ ] Average testing turnaround time is calculated
- [ ] Metrics update based on order data
- [ ] "N/A" shows when no data available

### 7.4 Stock Status Breakdown
- [ ] All 5 status categories are shown
- [ ] Count for each status is displayed
- [ ] Percentage is calculated correctly
- [ ] Progress bars are proportional
- [ ] Colors match status legend

### 7.5 Low Stock Items
- [ ] Items needing ordering are listed
- [ ] Out of Stock items appear first
- [ ] Status badges match inventory view

### 7.6 Items Missing Requirements
- [ ] Peptides without purity are listed
- [ ] Peptides without net weight are listed
- [ ] Peptides without labels are listed
- [ ] Missing requirements are clearly indicated

### 7.7 Export Functions
- [ ] "Export Full Inventory" button works
- [ ] CSV file downloads with all data
- [ ] "Export Summary Report" button works
- [ ] TXT file downloads with summary
- [ ] Files contain accurate data

---

## 8. Dark Mode

### 8.1 Toggle Functionality
- [ ] Dark mode toggle button is visible in header
- [ ] Button shows Sun icon in dark mode
- [ ] Button shows Moon icon in light mode
- [ ] Clicking toggles between modes

### 8.2 Visual Changes
- [ ] Background changes color
- [ ] Text colors adjust for readability
- [ ] All components support dark mode
- [ ] Tables are readable in dark mode
- [ ] Badges/status indicators are clear

### 8.3 Persistence
- [ ] Dark mode preference is saved
- [ ] Preference persists after page reload
- [ ] Preference persists across sessions
- [ ] localStorage contains darkMode setting

---

## 9. State Persistence

### 9.1 Data Persistence
- [ ] Imported data persists after reload
- [ ] Orders persist after reload
- [ ] Labels persist after reload
- [ ] Settings persist after reload

### 9.2 UI State
- [ ] Column order persists
- [ ] Column visibility persists
- [ ] Dark mode persists
- [ ] Last active tab persists (optional)

### 9.3 IndexedDB Verification
- [ ] Open browser DevTools
- [ ] Check Application > IndexedDB
- [ ] Verify "oath-peptides" database exists
- [ ] Verify 4 stores exist (peptides, orders, labels, settings)
- [ ] Verify data is stored correctly

---

## 10. Cross-Browser Testing

### 10.1 Chrome
- [ ] All features work
- [ ] No console errors
- [ ] UI renders correctly

### 10.2 Firefox
- [ ] All features work
- [ ] No console errors
- [ ] UI renders correctly

### 10.3 Safari
- [ ] All features work
- [ ] No console errors
- [ ] UI renders correctly

### 10.4 Edge
- [ ] All features work
- [ ] No console errors
- [ ] UI renders correctly

---

## 11. Mobile/Tablet Testing

### 11.1 iPad (Confirmed Working)
- [ ] Application loads on iPad
- [ ] All tabs are accessible
- [ ] Touch interactions work
- [ ] Column reordering works (up/down arrows)
- [ ] Quick edit modal works
- [ ] Tables are scrollable
- [ ] No horizontal overflow

### 11.2 iPhone/Mobile Phone
- [ ] Application loads on mobile
- [ ] Responsive layout adjusts
- [ ] Navigation is usable
- [ ] Tables scroll horizontally if needed
- [ ] Buttons are touch-friendly
- [ ] Modals display correctly

### 11.3 Tablet Landscape
- [ ] Layout adapts to landscape
- [ ] All content is visible
- [ ] No UI elements are cut off

---

## 12. Performance Testing

### 12.1 Load Time
- [ ] Initial load completes in < 3 seconds
- [ ] Navigation between tabs is instant
- [ ] No noticeable lag

### 12.2 Large Data Sets
- [ ] Import 100+ rows successfully
- [ ] Table renders without lag
- [ ] Search/filter remains responsive
- [ ] Sort works quickly

### 12.3 Real-World Scenarios
- [ ] Import actual company CSV file
- [ ] Verify all data is correct
- [ ] Test common workflows
- [ ] Confirm no data loss

---

## 13. Error Handling

### 13.1 Invalid CSV
- [ ] Upload CSV without Peptide ID column
- [ ] Error message is clear
- [ ] No data is imported

### 13.2 Network Issues
- [ ] Test with slow connection
- [ ] Application remains functional
- [ ] No crashes or freezes

### 13.3 Browser Limits
- [ ] Test IndexedDB quota limits
- [ ] Graceful handling of storage errors

---

## 14. Edge Cases

### 14.1 Empty States
- [ ] Dashboard shows "Getting Started" when empty
- [ ] Inventory shows "No peptides" message
- [ ] Reports handle empty data gracefully

### 14.2 Negative Quantities
- [ ] Import CSV with negative quantities
- [ ] Negative values are accepted
- [ ] Status calculation handles negatives correctly

### 14.3 Special Characters
- [ ] Peptide names with special characters (é, ñ, etc.)
- [ ] Long peptide names (> 50 characters)
- [ ] Special characters in notes field

### 14.4 Duplicate Peptide IDs
- [ ] Import CSV with duplicate IDs in Update mode
- [ ] Latest entry overwrites earlier one
- [ ] No duplicate entries in table

---

## 15. Business Logic Validation

### 15.1 Stock Status Calculation
- [ ] Quantity ≤ 0 = OUT_OF_STOCK (Red)
- [ ] Quantity ≤ 10 = NEARLY_OUT (Orange)
- [ ] Quantity ≤ 25 = LOW_STOCK (Yellow)
- [ ] Quantity > 25 = GOOD_STOCK (Green)
- [ ] Has active order = ON_ORDER (Teal)

### 15.2 Order Lifecycle
- [ ] Place Order sets orderedDate and orderedQty
- [ ] Receive Shipment sets arrivedDate and batchNumber
- [ ] Send for Testing sets sentForTestingDate
- [ ] Record Results sets purity, netWeight, receivedDate
- [ ] Completing workflow clears hasActiveOrder flag

### 15.3 Labeling Priority
- [ ] Items with purity score higher
- [ ] Items with net weight score higher
- [ ] Low stock items (≤ 10) score higher
- [ ] Items with velocity score higher
- [ ] Priority score calculation is consistent

### 15.4 Sales Readiness
- [ ] Purity must be non-empty string
- [ ] Net Weight must be non-empty string
- [ ] isLabeled must be true
- [ ] All three required for "Ready" status

---

## Test Summary

**Total Tests**: _______
**Passed**: _______
**Failed**: _______
**Blocked**: _______

### Critical Issues Found
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Minor Issues Found
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Recommendations
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

### Overall Assessment
- [ ] **PASS** - System is ready for production use
- [ ] **PASS WITH MINOR ISSUES** - System is usable with noted issues
- [ ] **FAIL** - Critical issues prevent production use

**Tester Signature**: _________________
**Date**: _________________

---

## Notes
Use this space for additional observations, screenshots, or detailed issue descriptions:

___________________________________________
___________________________________________
___________________________________________
___________________________________________
___________________________________________

# Oath Research - Peptide Inventory Management System

[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://nors3ai.github.io/Oath-Inventory/)
[![React](https://img.shields.io/badge/React-18.3-blue)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

🔗 **[Live Demo: https://nors3ai.github.io/Oath-Inventory/](https://nors3ai.github.io/Oath-Inventory/)**

A comprehensive inventory management solution designed specifically for Oath Research, a peptide manufacturing and distribution company. This system streamlines the entire peptide lifecycle from ordering through testing to labeling and sales readiness.

## 🌟 Overview

The Oath Inventory System manages three critical aspects of peptide operations:

1. **Inventory Tracking** - Real-time stock levels with color-coded visual indicators
2. **Lifecycle Management** - Complete tracking from order placement through testing and labeling
3. **Sales Readiness** - Automated validation ensuring only compliant products are marked for sale

## ✨ Key Features

### 📊 Inventory Management
- **CSV Import/Export** - Support for both "Replace All" and "Update Existing" modes
- **Color-coded Stock Status** for instant visibility:
  - 🔴 **RED**: Out of stock (immediate action)
  - 🟠 **ORANGE**: Nearly out of stock (urgent)
  - 🟡 **YELLOW**: Low stock (order soon)
  - 🟢 **GREEN**: Good stock (no action needed)
  - 🔵 **TEAL**: On order (in transit)
- **Smart Filtering** - Filter by status, search across multiple fields
- **Customizable Columns** - Reorder, hide/show columns, drag-and-drop
- **Quick Edit Modal** - Fast inline editing with auto-save
- **Product Exclusions** - Exclude specific products from future imports

### 🧪 Peptide Lifecycle Tracking
Track every stage of your peptide journey:
- Order placement and arrival dates
- Testing submission and results dates
- Purity percentage tracking
- Net weight verification
- Batch number assignment
- Quantity tracking (MG)
- Ordered quantity and status
- Complete order history per peptide

### 🏷️ Smart Label Management
- **Label Inventory Tracking** - Add/remove labels from inventory
- **Visual Progress Bar** - See overall labeling completion at a glance
- **Prioritized Queue** - Automatically prioritizes based on:
  - Stock quantity (higher = more urgent)
  - Sales readiness (has purity + net weight)
  - Low stock items (urgent to move)
  - Velocity data (known sellers)
- **Recently Labeled** - Top 10 most recently labeled products
- **Percentage-Based Colors**:
  - 0-25%: Red (needs labeling)
  - 26-50%: Yellow (partial)
  - 51-75%: Green (good progress)
  - 76-100%: Teal (mostly/fully labeled)
- **Smart Filtering** - Excludes products with zero quantity
- **Scroll Controls** - Navigate through long lists with up/down buttons

### ✅ Sales Readiness Validation
Automated three-point check system ensures peptides can only be sold when they have:
1. ✓ Purity test results
2. ✓ Net weight confirmation
3. ✓ Applied label

**Sales Ready Dashboard** shows:
- Total sales-ready products
- Blocked products with missing requirements
- Breakdown of missing requirements (purity, weight, label)

### 📈 Reports & Analytics
- **Comprehensive Reports** - Detailed inventory analysis
- **Sales Velocity Tracking** - Historical velocity data (up to 10 previous imports)
- **Transaction Tracking** - Record sales and inventory movements
- **Export Capabilities** - Export to CSV format
- **Charts & Visualizations** - Visual progress indicators

### 🎨 User Experience
- **Dark Mode** - Full dark mode support across all components
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Tab Persistence** - Remembers your active tab across refreshes
- **Scroll Position Preservation** - No more jumping to top when editing
- **Toast Notifications** - Clear feedback for all actions
- **Confirmation Dialogs** - Prevent accidental data loss

## 🛠️ Technology Stack

### Frontend
- **React 18.3** - Modern UI library with hooks
- **Vite 5.4** - Lightning-fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library
- **PapaParse** - CSV parsing library

### Data Storage
- **IndexedDB** - Client-side database via LocalForage
- **LocalStorage** - User preferences and settings

### Build & Deploy
- **GitHub Actions** - Automated CI/CD
- **GitHub Pages** - Free hosting for static sites

## 📖 Usage

### Importing Inventory

1. Navigate to **Import CSV** tab
2. Choose import mode:
   - **Update Existing**: Updates quantities only, preserves manual edits
   - **Replace All**: Completely replaces inventory (requires confirmation)
3. Drag & drop your CSV file or click to browse
4. CSV format should include:
   - **Required**: Product, SKU, Quantity
   - **Optional**: Batch #, Purity, Net Weight, Velocity, etc.

### Managing Labels

1. Go to **Labeling** tab
2. Add labels to inventory using the "Add Labels" button
3. Work through the priority queue:
   - Items are automatically sorted by priority
   - Click "Apply Label" to label products
   - Track progress with the visual progress bar
4. View recently labeled items in the bottom section

### Checking Sales Readiness

1. Navigate to **Sales Ready** tab
2. View products that pass the three-point check
3. See which requirements are missing for blocked items
4. Filter by Ready, Blocked, or All items

### Managing Orders

1. From **Inventory** tab, click "Manage" on any product
2. Create new order with quantity and date
3. Update order status as it progresses:
   - Submitted for testing
   - Testing complete
   - Results received
4. View complete order history

### Viewing Reports

1. Go to **Reports** tab
2. View comprehensive inventory analysis
3. Export data to CSV
4. Track sales velocity and trends

## 🎯 Business Context

Oath Research manufactures and distributes research peptides. The company:
- Receives peptide shipments in glass vials from external labs
- Must send each batch for purity and weight testing
- Can only sell peptides that have passed testing and been properly labeled
- Needs to maintain optimal inventory levels across multiple peptide types
- Requires quick visual identification of stock issues and operational bottlenecks

This system ensures compliance, streamlines operations, and provides real-time visibility into inventory status.

## 🔒 Data Storage

All data is stored **locally in your browser** using IndexedDB:
- ✅ No server required
- ✅ Works offline
- ✅ Fast performance
- ✅ Privacy-focused (your data never leaves your device)

**Note**: Clear browser data will delete your inventory. Use the Export feature regularly to backup your data.

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Contact

**Oath Research**
- GitHub: [@NORS3AI](https://github.com/NORS3AI)
- Project Link: [https://github.com/NORS3AI/Oath-Inventory](https://github.com/NORS3AI/Oath-Inventory)
- Live Demo: [https://nors3ai.github.io/Oath-Inventory/](https://nors3ai.github.io/Oath-Inventory/)

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/)
- Powered by [Vite](https://vitejs.dev/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons by [Lucide](https://lucide.dev/)

---

## 📊 Quick Reference

### Stock Status Colors
| Color | Status | Threshold | Action Required |
|-------|--------|-----------|-----------------|
| 🔴 RED | Out of stock | 0 units | Order immediately |
| 🟠 ORANGE | Nearly out | ≤ 10 units | Order urgently |
| 🟡 YELLOW | Low stock | ≤ 25 units | Order soon |
| 🟢 GREEN | Good stock | ≤ 50 units | No action needed |
| 🔵 TEAL | On order | Active order | Monitor delivery |

### Label Status Colors
| Color | Percentage | Status |
|-------|-----------|--------|
| ⚫ GRAY | N/A | No stock (0 quantity) |
| 🔴 RED | 0-25% | Needs labeling |
| 🟡 YELLOW | 26-50% | Partial progress |
| 🟢 GREEN | 51-75% | Good progress |
| 🔵 TEAL | 76-100% | Mostly/fully labeled |

### Sales Readiness Checklist
- [ ] Purity test completed ✓
- [ ] Net weight verified ✓
- [ ] Label applied ✓
- [ ] All three = **Ready to sell** ✅

### Keyboard Shortcuts
- `Ctrl/Cmd + Shift + R` - Hard refresh (clear cache)
- Click outside modal - Close and save
- Drag column headers - Reorder columns

---

**Version**: 1.0.0
**Last Updated**: February 8, 2026
**Status**: ✅ Production Ready

---

Made with ❤️ for Oath Research

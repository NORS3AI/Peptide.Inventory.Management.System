import { useState, useEffect, useCallback, useMemo } from 'react';
import { List, FileText, ArrowUpDown, Printer, Download } from 'lucide-react';
import { db } from '../lib/db';
import ColumnReorderModal from './ColumnReorderModal';
import InvoicePDFImport from './InvoicePDFImport';

// Define all available columns for the pricing table
const DEFAULT_COLUMNS = [
  { id: 'product', label: 'Product' },
  { id: 'price', label: 'Price' },
  { id: 'axx26', label: 'Axx26' },
  { id: 'bxx26', label: 'Bxx26' },
  { id: 'cxx26', label: 'Cxx26' }
];

export default function Prices({ peptides }) {
  const [prices, setPrices] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMNS);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sortField, setSortField] = useState('product');
  const [sortDirection, setSortDirection] = useState('asc');

  // Load saved prices from IndexedDB
  useEffect(() => {
    const load = async () => {
      const saved = await db.settings.get('priceData');
      if (saved && typeof saved === 'object') {
        setPrices(saved);
      }
      setLoaded(true);
    };
    load();
  }, [refreshKey]);

  // Save prices to IndexedDB whenever they change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    db.settings.set('priceData', prices);
  }, [prices, loaded]);

  // Load column settings from database
  useEffect(() => {
    const loadColumnSettings = async () => {
      const savedOrder = await db.settings.get('pricesColumnOrder');
      if (savedOrder && Array.isArray(savedOrder)) {
        const orderedColumns = savedOrder
          .map(id => DEFAULT_COLUMNS.find(col => col.id === id))
          .filter(Boolean);
        const newColumns = DEFAULT_COLUMNS.filter(
          col => !savedOrder.includes(col.id)
        );
        setColumnOrder([...orderedColumns, ...newColumns]);
      }

      const savedHidden = await db.settings.get('pricesHiddenColumns');
      if (savedHidden && Array.isArray(savedHidden)) {
        setHiddenColumns(savedHidden);
      }
    };
    loadColumnSettings();
  }, []);

  // Save column order
  const saveColumnOrder = async (newOrder) => {
    const orderIds = newOrder.map(col => col.id);
    await db.settings.set('pricesColumnOrder', orderIds);
  };

  const handleColumnReorder = (newOrder) => {
    setColumnOrder(newOrder);
    saveColumnOrder(newOrder);
  };

  const handleVisibilityChange = async (hidden) => {
    setHiddenColumns(hidden);
    await db.settings.set('pricesHiddenColumns', hidden);
  };

  // Get visible columns
  const visibleColumns = useMemo(() => {
    return columnOrder.filter(col => !hiddenColumns.includes(col.id));
  }, [columnOrder, hiddenColumns]);

  // Handle import completion
  const handleImportComplete = () => {
    setShowImportModal(false);
    setRefreshKey(prev => prev + 1); // Trigger reload
  };

  // Handle print
  const handlePrint = () => {
    window.print();
  };

  // Handle Text export
  const handleExportText = () => {
    // Build header line
    const headers = visibleColumns.map(col => col.label);

    // Helper to get product display name for export (shows actual ID)
    const getProductExportName = (product) => {
      // If label is different from key, it means there's a nickname
      if (product.label !== product.key) {
        return `${product.label} (${product.key})`;
      }
      return product.key;
    };

    // Calculate column widths based on content
    const columnWidths = headers.map((header, idx) => {
      const col = visibleColumns[idx];
      const maxContentWidth = Math.max(
        header.length,
        ...products.map(product => {
          if (col.id === 'product') return getProductExportName(product).length;
          const colKey = getColumnKey(col.id);
          return (prices[product.key]?.[colKey] || '').toString().length;
        })
      );
      return maxContentWidth + 2; // Add padding, no max limit
    });

    // Helper to pad text (left-align for product, right-align for numbers)
    const pad = (text, width, isNumeric = false) => {
      const str = text.toString();
      if (isNumeric && str !== '') {
        return str.padStart(width, ' ');
      }
      return str.padEnd(width, ' ');
    };

    // Build text output
    let textOutput = 'PRICING TABLE\n';
    textOutput += `Generated: ${new Date().toLocaleString()}\n\n`;

    // Header row
    textOutput += headers.map((h, i) => pad(h, columnWidths[i])).join('  ') + '\n';
    textOutput += columnWidths.map(w => '='.repeat(w)).join('  ') + '\n';

    // Data rows
    products.forEach(product => {
      const row = visibleColumns.map((col, i) => {
        let value;
        let isNumeric = false;

        if (col.id === 'product') {
          value = getProductExportName(product);
        } else {
          const colKey = getColumnKey(col.id);
          value = prices[product.key]?.[colKey] || '';
          isNumeric = value !== ''; // Right-align non-empty price values
        }
        return pad(value, columnWidths[i], isNumeric);
      });
      textOutput += row.join('  ') + '\n';
    });

    // Download as .txt file
    const blob = new Blob([textOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prices_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleChange = useCallback((productKey, col, value) => {
    setPrices(prev => ({
      ...prev,
      [productKey]: {
        ...prev[productKey],
        [col]: value,
      },
    }));
  }, []);

  // Handle sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Deduplicate products by peptideId, sorted by current sort field
  const products = useMemo(() => {
    const deduped = Array.from(
      new Map(
        peptides.map(p => [
          p.peptideId,
          { key: p.peptideId, label: p.nickname || p.peptideId, sub: p.nickname ? p.peptideId : (p.peptideName || '') }
        ])
      ).values()
    );

    // Sort by selected field
    return deduped.sort((a, b) => {
      let aVal, bVal;

      if (sortField === 'product') {
        aVal = a.label;
        bVal = b.label;
      } else {
        const colKey = getColumnKey(sortField);
        aVal = prices[a.key]?.[colKey];
        bVal = prices[b.key]?.[colKey];
      }

      // Handle string sorting
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      // Convert to numbers if both are numeric
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        aVal = aNum;
        bVal = bNum;
      }

      // Handle null/undefined/empty values (sort to bottom)
      if (aVal === undefined || aVal === null || aVal === '') aVal = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bVal === undefined || bVal === null || bVal === '') bVal = sortDirection === 'asc' ? Infinity : -Infinity;

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [peptides, sortField, sortDirection, prices]);

  // Map column IDs to their data keys
  const getColumnKey = (columnId) => {
    const keyMap = {
      'product': 'Product',
      'price': 'Price',
      'axx26': 'Axx26',
      'bxx26': 'Bxx26',
      'cxx26': 'Cxx26'
    };
    return keyMap[columnId];
  };

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 0.5in;
          }

          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          /* Remove ALL overflow constraints that hide content */
          * {
            overflow: visible !important;
          }

          /* Show all divs and remove shadows/borders */
          .space-y-4,
          .bg-white,
          .dark\\:bg-gray-800,
          .rounded-lg,
          .shadow {
            overflow: visible !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          /* Full-width table for print */
          table {
            width: 100% !important;
            table-layout: auto !important;
            page-break-inside: auto !important;
            border-collapse: collapse !important;
          }

          /* Repeat headers on each page */
          thead {
            display: table-header-group !important;
          }

          tbody {
            display: table-row-group !important;
          }

          /* Prevent rows from breaking mid-page */
          tr {
            page-break-inside: avoid !important;
            page-break-after: auto !important;
          }

          /* Force white background and black text */
          * {
            background: white !important;
            color: black !important;
          }

          /* Clean input styling for print */
          input {
            border: 1px solid #d1d5db !important;
            padding: 4px 6px !important;
            -webkit-appearance: none !important;
            appearance: none !important;
          }

          /* Clean header styling */
          th {
            background-color: #f3f4f6 !important;
            color: #1f2937 !important;
            border: 1px solid #d1d5db !important;
            padding: 8px 6px !important;
            font-weight: 600 !important;
          }

          /* Clean cell styling */
          td {
            border: 1px solid #e5e7eb !important;
            padding: 6px 4px !important;
          }

          /* Hide icons in print */
          svg {
            display: none !important;
          }
        }
      `}</style>

      <div className="space-y-4">
        {/* Action Buttons */}
        <div className="flex justify-end gap-2 print:hidden">
        <button
          onClick={() => setShowImportModal(true)}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">Import Invoice</span>
        </button>
        <button
          onClick={handleExportText}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">Export Text</span>
        </button>
        <button
          onClick={handlePrint}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          <span className="hidden sm:inline">Print</span>
        </button>
        <button
          onClick={() => setShowReorderModal(true)}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <List className="w-4 h-4" />
          <span className="hidden sm:inline">Reorder</span>
        </button>
      </div>

      {/* Pricing Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm" style={{ width: 'auto', tableLayout: 'fixed' }}>
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr>
                {visibleColumns.map(column => (
                  <th
                    key={column.id}
                    onClick={() => handleSort(column.id)}
                    style={{ width: column.id === 'product' ? '140px' : '100px' }}
                    className="px-2 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      {column.label}
                      <ArrowUpDown className={`h-3.5 w-3.5 ${sortField === column.id ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {products.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length}
                    className="px-4 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No products found. Import inventory data first.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const rowPrices = prices[product.key] || {};
                  return (
                    <tr
                      key={product.key}
                      className="border-b border-gray-100 dark:border-gray-700"
                    >
                      {visibleColumns.map(column => {
                        if (column.id === 'product') {
                          return (
                            <td key={column.id} className="px-2 py-2" style={{ width: '140px' }}>
                              <div className="font-medium text-gray-900 dark:text-white truncate text-sm">{product.label}</div>
                              {product.sub && product.sub !== product.label && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{product.sub}</div>
                              )}
                            </td>
                          );
                        } else {
                          const colKey = getColumnKey(column.id);
                          return (
                            <td key={column.id} className="px-1 py-1.5" style={{ width: '100px' }}>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={rowPrices[colKey] ?? ''}
                                onChange={e => handleChange(product.key, colKey, e.target.value)}
                                onFocus={e => e.target.select()}
                                placeholder="—"
                                className="w-full text-left px-1.5 py-1 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                              />
                            </td>
                          );
                        }
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Column Reorder Modal */}
      {showReorderModal && (
        <ColumnReorderModal
          columns={columnOrder}
          hiddenColumns={hiddenColumns}
          onReorder={handleColumnReorder}
          onVisibilityChange={handleVisibilityChange}
          onClose={() => setShowReorderModal(false)}
        />
      )}

      {/* Import Invoice Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Import Invoice PDF</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <span className="text-2xl">&times;</span>
              </button>
            </div>
            <div className="p-6">
              <InvoicePDFImport
                peptides={peptides}
                onImportComplete={handleImportComplete}
              />
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}

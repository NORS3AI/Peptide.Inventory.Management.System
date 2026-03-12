import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, ArrowUpDown, Package, Download, GripVertical, MoreVertical, List, Ban, TrendingDown, Save, X, Plus, Edit3 } from 'lucide-react';
import { calculateStockStatus, getStatusConfig } from '../utils/stockStatus';
import { exportToCSV, downloadCSV } from '../utils/csvParser';
import { db } from '../lib/db';
import OrderManagement from './OrderManagement';
import QuickEditModal from './QuickEditModal';
import ColumnReorderModal from './ColumnReorderModal';
import ExclusionManager from './ExclusionManager';
import RecordSaleModal from './RecordSaleModal';
import AddProductModal from './AddProductModal';
import BulkEditModal from './BulkEditModal';
import { useToast } from './Toast';

// Define all available columns
const DEFAULT_COLUMNS = [
  { id: 'peptideId', label: 'Product', field: 'peptideId', sortable: true },
  { id: 'peptideName', label: 'SKU', field: 'peptideName', sortable: true },
  { id: 'quantity', label: 'Quantity', field: 'quantity', sortable: true },
  { id: 'labeledCount', label: 'Labeled', field: 'labeledCount', sortable: true },
  { id: 'offBooks', label: 'Off Books', field: 'offBooks', sortable: true },
  { id: 'status', label: 'Status', field: 'status', sortable: true },
  { id: 'batchNumber', label: 'Batch #', field: 'batchNumber', sortable: true },
  { id: 'netWeight', label: 'Net Weight', field: 'netWeight', sortable: true },
  { id: 'purity', label: 'Purity', field: 'purity', sortable: true },
  { id: 'velocity', label: 'Velocity', field: 'velocity', sortable: true },
  { id: 'orderedQty', label: 'Ordered Qty', field: 'orderedQty', sortable: true },
  { id: 'orderedDate', label: 'Ordered Date', field: 'orderedDate', sortable: true },
  { id: 'notes', label: 'Notes', field: 'notes', sortable: true },
  { id: 'actions', label: 'Actions', field: 'actions', sortable: false }
];

export default function InventoryTable({ peptides, allPeptides, onRefresh, thresholds, bulkExclude }) {
  const [searchTerm, setSearchTerm] = useState(() => {
    // Restore search term from localStorage
    return localStorage.getItem('inventory-searchTerm') || '';
  });
  const [sortField, setSortField] = useState(() => {
    // Restore sort field from localStorage
    return localStorage.getItem('inventory-sortField') || 'peptideId';
  });
  const [sortDirection, setSortDirection] = useState(() => {
    // Restore sort direction from localStorage
    return localStorage.getItem('inventory-sortDirection') || 'asc';
  });
  const [filterStatus, setFilterStatus] = useState('all');
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMNS);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [selectedPeptide, setSelectedPeptide] = useState(null);
  const [quickEditPeptide, setQuickEditPeptide] = useState(null);
  const [recordSalePeptide, setRecordSalePeptide] = useState(null);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showExclusionsModal, setShowExclusionsModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

  // Bulk exclusion state
  const [excludeMode, setExcludeMode] = useState(false);
  const [selectedForExclusion, setSelectedForExclusion] = useState(new Set());
  const { success, error: showError } = useToast();

  // Persist search term to localStorage
  useEffect(() => {
    localStorage.setItem('inventory-searchTerm', searchTerm);
  }, [searchTerm]);

  // Persist sort field to localStorage
  useEffect(() => {
    localStorage.setItem('inventory-sortField', sortField);
  }, [sortField]);

  // Persist sort direction to localStorage
  useEffect(() => {
    localStorage.setItem('inventory-sortDirection', sortDirection);
  }, [sortDirection]);

  // Clear search term when component unmounts (tab change)
  useEffect(() => {
    return () => {
      const currentTab = localStorage.getItem('activeTab');
      if (currentTab !== 'inventory') {
        localStorage.setItem('inventory-searchTerm', '');
      }
    };
  }, []);

  // Wrapper function to preserve scroll position during refresh
  const handleRefreshWithScrollPreservation = () => {
    // Save current scroll position
    const scrollY = window.scrollY;

    // Call the refresh function
    if (onRefresh) {
      onRefresh();
    }

    // Restore scroll position after a short delay to allow re-render
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollY);
    });
  };

  // Load column order and hidden columns from settings
  useEffect(() => {
    const loadColumnSettings = async () => {
      const savedOrder = await db.settings.get('columnOrder');
      if (savedOrder && Array.isArray(savedOrder)) {
        // Merge saved order with default columns (in case new columns were added)
        const orderedColumns = savedOrder
          .map(id => DEFAULT_COLUMNS.find(col => col.id === id))
          .filter(Boolean);

        // Add any new columns that weren't in saved order
        const newColumns = DEFAULT_COLUMNS.filter(
          col => !savedOrder.includes(col.id)
        );

        setColumnOrder([...orderedColumns, ...newColumns]);
      }

      // Load hidden columns
      const savedHidden = await db.settings.get('hiddenColumns');
      if (savedHidden && Array.isArray(savedHidden)) {
        setHiddenColumns(savedHidden);
      }
    };
    loadColumnSettings();
  }, []);

  // Save column order to settings
  const saveColumnOrder = async (newOrder) => {
    const orderIds = newOrder.map(col => col.id);
    await db.settings.set('columnOrder', orderIds);
  };

  // Handle column reorder from modal
  const handleColumnReorder = (newOrder) => {
    setColumnOrder(newOrder);
    saveColumnOrder(newOrder);
  };

  // Handle column visibility change
  const handleVisibilityChange = async (hidden) => {
    setHiddenColumns(hidden);
    await db.settings.set('hiddenColumns', hidden);
  };

  // Get visible columns only
  const visibleColumns = useMemo(() => {
    return columnOrder.filter(col => !hiddenColumns.includes(col.id));
  }, [columnOrder, hiddenColumns]);

  // Calculate status and off books for each peptide
  const peptidesWithStatus = useMemo(() => {
    return peptides.map(peptide => {
      const quantity = Number(peptide.quantity) || 0;
      const labeledCount = Number(peptide.labeledCount) || 0;

      // Calculate off books
      let offBooks;
      if (quantity === 0 && labeledCount > 0) {
        // No official stock but items are labeled - all labeled items are off books
        offBooks = labeledCount;
      } else if (quantity < 0) {
        // Negative quantity (backorder) - subtract absolute value from labeled
        offBooks = Math.max(0, labeledCount - Math.abs(quantity));
      } else {
        // Positive quantity - normal calculation
        offBooks = Math.max(0, labeledCount - quantity);
      }

      return {
        ...peptide,
        offBooks,
        status: calculateStockStatus(quantity, thresholds, peptide.hasActiveOrder || false)
      };
    });
  }, [peptides, thresholds]);

  // Filter and search
  const filteredPeptides = useMemo(() => {
    return peptidesWithStatus.filter(peptide => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        peptide.peptideId?.toLowerCase().includes(searchLower) ||
        peptide.peptideName?.toLowerCase().includes(searchLower) ||
        peptide.nickname?.toLowerCase().includes(searchLower) ||
        peptide.batchNumber?.toLowerCase().includes(searchLower) ||
        peptide.notes?.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus = filterStatus === 'all' || peptide.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [peptidesWithStatus, searchTerm, filterStatus]);

  // Sort
  const sortedPeptides = useMemo(() => {
    const sorted = [...filteredPeptides];
    sorted.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Use nickname for product name sorting when available
      if (sortField === 'peptideId' || sortField === 'peptideName') {
        aVal = a.nickname || a[sortField] || '';
        bVal = b.nickname || b[sortField] || '';
      }

      // Handle numeric sorting
      if (sortField === 'quantity' || sortField === 'orderedQty' || sortField === 'offBooks') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      }

      // Handle labeled count sorting (by percentage)
      if (sortField === 'labeledCount') {
        const aQty = Number(a.quantity) || 1;
        const bQty = Number(b.quantity) || 1;
        const aLabeled = Number(a.labeledCount) || (a.isLabeled ? aQty : 0);
        const bLabeled = Number(b.labeledCount) || (b.isLabeled ? bQty : 0);
        aVal = (aLabeled / aQty) * 100;
        bVal = (bLabeled / bQty) * 100;
      }

      // Handle status sorting (by priority)
      if (sortField === 'status') {
        const statusPriority = {
          'OUT_OF_STOCK': 1,
          'NEARLY_OUT': 2,
          'LOW_STOCK': 3,
          'GOOD_STOCK': 4,
          'ON_ORDER': 5
        };
        aVal = statusPriority[aVal] || 999;
        bVal = statusPriority[bVal] || 999;
      }

      // Handle string sorting
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      // Handle null/undefined values
      if (aVal === undefined || aVal === null || aVal === '') aVal = '';
      if (bVal === undefined || bVal === null || bVal === '') bVal = '';

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredPeptides, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleExport = () => {
    const csvContent = exportToCSV(peptidesWithStatus);
    downloadCSV(csvContent, `oath-inventory-${new Date().toISOString().split('T')[0]}.csv`);
  };

  // Inline labeled count save
  const handleInlineLabeledSave = useCallback(async (peptideId, newCount) => {
    try {
      await db.peptides.update(peptideId, { labeledCount: newCount });
      handleRefreshWithScrollPreservation();
    } catch (err) {
      console.error('Failed to update labeled count:', err);
      showError('Failed to save labeled count');
    }
  }, [handleRefreshWithScrollPreservation, showError]);

  // Toggle exclude mode
  const handleToggleExcludeMode = () => {
    if (excludeMode) {
      // Exiting exclude mode - clear selections
      setSelectedForExclusion(new Set());
    }
    setExcludeMode(!excludeMode);
  };

  // Toggle selection for a peptide
  const handleToggleSelection = (peptideId) => {
    const newSelection = new Set(selectedForExclusion);
    if (newSelection.has(peptideId)) {
      newSelection.delete(peptideId);
    } else {
      newSelection.add(peptideId);
    }
    setSelectedForExclusion(newSelection);
  };

  // Select all visible peptides
  const handleSelectAll = () => {
    if (selectedForExclusion.size === sortedPeptides.length) {
      // Deselect all
      setSelectedForExclusion(new Set());
    } else {
      // Select all visible
      const allIds = new Set(sortedPeptides.map(p => p.peptideId));
      setSelectedForExclusion(allIds);
    }
  };

  // Save exclusions
  const handleSaveExclusions = async () => {
    if (selectedForExclusion.size === 0) {
      showError('No items selected for exclusion');
      return;
    }

    const result = await bulkExclude(Array.from(selectedForExclusion));
    if (result.success) {
      success(`Excluded ${selectedForExclusion.size} item(s)`);
      setSelectedForExclusion(new Set());
      setExcludeMode(false);
      onRefresh();
    } else {
      showError('Failed to save exclusions');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, columnIndex) => {
    setDraggedColumn(columnIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedColumn === null) return;

    const newOrder = [...columnOrder];
    const draggedItem = newOrder[draggedColumn];
    newOrder.splice(draggedColumn, 1);
    newOrder.splice(dropIndex, 0, draggedItem);

    setColumnOrder(newOrder);
    saveColumnOrder(newOrder);
    setDraggedColumn(null);
  };

  const handleDragEnd = () => {
    setDraggedColumn(null);
  };

  // Count by status
  const statusCounts = useMemo(() => {
    const counts = {
      OUT_OF_STOCK: 0,
      NEARLY_OUT: 0,
      LOW_STOCK: 0,
      GOOD_STOCK: 0,
      ON_ORDER: 0
    };
    peptidesWithStatus.forEach(p => {
      if (counts[p.status] !== undefined) counts[p.status]++;
    });
    return counts;
  }, [peptidesWithStatus]);

  // Render cell content based on column type
  const renderCell = (peptide, column) => {
    if (column.id === 'status') {
      const statusConfig = getStatusConfig(peptide.status);
      return (
        <span className={`status-badge ${statusConfig.className}`}>
          {statusConfig.label}
        </span>
      );
    }

    if (column.id === 'labeledCount') {
      return (
        <InlineLabeledInput
          peptide={peptide}
          onSave={handleInlineLabeledSave}
        />
      );
    }


    if (column.id === 'offBooks') {
      const offBooks = peptide.offBooks || 0;

      // Color coding based on off books count
      let colorClass = '';
      if (offBooks === 0) {
        colorClass = 'text-gray-600 dark:text-gray-400';
      } else if (offBooks <= 5) {
        colorClass = 'text-blue-600 dark:text-blue-400 font-medium';
      } else if (offBooks <= 10) {
        colorClass = 'text-green-600 dark:text-green-400 font-medium';
      } else {
        colorClass = 'text-teal-600 dark:text-teal-400 font-bold';
      }

      return (
        <span className={colorClass}>
          {offBooks}
        </span>
      );
    }

    if (column.id === 'actions') {
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRecordSalePeptide(peptide);
            }}
            className="inline-flex items-center space-x-1 px-2 py-1 text-sm text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            title="Record Sale"
          >
            <TrendingDown className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPeptide(peptide);
            }}
            className="inline-flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
            <span>Manage</span>
          </button>
        </div>
      );
    }

    // Product column: show nickname INSTEAD of product ID when set
    if (column.id === 'peptideId') {
      if (peptide.nickname) {
        return peptide.nickname;
      }
      return (
        <div>
          <div>{peptide.peptideId}</div>
          {peptide.peptideName && (
            <div className="text-xs text-gray-400 dark:text-gray-500">{peptide.peptideName}</div>
          )}
        </div>
      );
    }

    // SKU column: show nickname instead of product name when set
    if (column.id === 'peptideName') {
      return peptide.nickname || peptide.peptideName || '-';
    }

    const value = peptide[column.field];
    return value !== undefined && value !== null && value !== '' ? value : '-';
  };

  if (peptides.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
        <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">No inventory data yet. Import a CSV to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col gap-4">
          {/* Search - Full Width */}
          {!excludeMode && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search peptides..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}

          {/* Controls Row */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4">
            {/* Exclude Mode Info */}
            {excludeMode && (
              <div className="flex-1 flex items-center gap-3 px-4 py-2 bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700 rounded-lg">
                <Ban className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-medium text-orange-900 dark:text-orange-200">
                  Exclude Mode: {selectedForExclusion.size} item(s) selected
                </span>
              </div>
            )}

            {/* Status Filter */}
            {!excludeMode && (
              <div className="sm:w-48">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status ({peptides.length})</option>
                  <option value="OUT_OF_STOCK">Out of Stock ({statusCounts.OUT_OF_STOCK})</option>
                  <option value="NEARLY_OUT">Nearly Out ({statusCounts.NEARLY_OUT})</option>
                  <option value="LOW_STOCK">Low Stock ({statusCounts.LOW_STOCK})</option>
                  <option value="GOOD_STOCK">Good Stock ({statusCounts.GOOD_STOCK})</option>
                </select>
              </div>
            )}

            {/* Exclude Mode Actions */}
            {excludeMode ? (
              <>
                <button
                  onClick={handleSelectAll}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <span>{selectedForExclusion.size === sortedPeptides.length ? 'Deselect All' : 'Select All'}</span>
                </button>
                <button
                  onClick={handleSaveExclusions}
                  disabled={selectedForExclusion.size === 0}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Exclusions</span>
                </button>
                <button
                  onClick={handleToggleExcludeMode}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </>
            ) : (
              <>
                {/* Exclude Button */}
                <button
                  onClick={handleToggleExcludeMode}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Ban className="w-4 h-4" />
                  <span className="hidden sm:inline">Exclude</span>
                </button>

                {/* Bulk Edit Button */}
                <button
                  onClick={() => setShowBulkEditModal(true)}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  <span className="hidden sm:inline">Bulk Edit</span>
                </button>

                {/* Reorder Columns Button */}
                <button
                  onClick={() => setShowReorderModal(true)}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">Reorder</span>
                </button>

                {/* Export Button */}
                <button
                  onClick={handleExport}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export</span>
                </button>

                {/* Add Product Button */}
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="inline-flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Product</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
        <span>Showing {sortedPeptides.length} of {peptides.length} peptides</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {/* Checkbox column when in exclude mode */}
                {excludeMode && (
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedForExclusion.size === sortedPeptides.length && sortedPeptides.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                  </th>
                )}
                {visibleColumns.map((column, index) => (
                  <th
                    key={column.id}
                    draggable={!excludeMode}
                    onDragStart={(e) => !excludeMode && handleDragStart(e, index)}
                    onDragOver={!excludeMode ? handleDragOver : undefined}
                    onDrop={(e) => !excludeMode && handleDrop(e, index)}
                    onDragEnd={!excludeMode ? handleDragEnd : undefined}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider
                      ${column.sortable && !excludeMode ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer' : ''}
                      ${draggedColumn === index ? 'opacity-50' : ''}
                    `}
                    onClick={() => !excludeMode && column.sortable && handleSort(column.field)}
                  >
                    <div className="flex items-center space-x-2">
                      <span>{column.label}</span>
                      {column.sortable && !excludeMode && (
                        <>
                          <ArrowUpDown
                            className={`w-4 h-4 ${sortField === column.field ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`}
                          />
                          {sortField === column.field && (
                            <span className="text-xs text-blue-600 dark:text-blue-400">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedPeptides.map((peptide) => (
                <tr
                  key={peptide.id}
                  onClick={() => !excludeMode && setQuickEditPeptide(peptide)}
                  className={`${excludeMode ? 'hover:bg-orange-50 dark:hover:bg-orange-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700'} ${excludeMode ? '' : 'cursor-pointer'}`}
                >
                  {/* Checkbox column when in exclude mode */}
                  {excludeMode && (
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedForExclusion.has(peptide.peptideId)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleToggleSelection(peptide.peptideId);
                        }}
                        className="w-4 h-4 text-orange-600 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 dark:focus:ring-orange-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                      />
                    </td>
                  )}
                  {visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      onClick={column.id === 'labeledCount' ? (e) => e.stopPropagation() : undefined}
                      className={`px-6 py-4 text-sm ${
                        column.id === 'peptideId' ? 'font-medium text-gray-900 dark:text-white' :
                        column.id === 'status' ? '' :
                        column.id === 'notes' ? 'max-w-xs truncate text-gray-500 dark:text-gray-400' :
                        'text-gray-500 dark:text-gray-400'
                      } ${column.id === 'notes' ? '' : 'whitespace-nowrap'}`}
                    >
                      {renderCell(peptide, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedPeptides.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No peptides match your search criteria</p>
          </div>
        )}
      </div>

      {/* Order Management Modal */}
      {selectedPeptide && (
        <OrderManagement
          peptide={selectedPeptide}
          onClose={() => setSelectedPeptide(null)}
          onUpdate={handleRefreshWithScrollPreservation}
        />
      )}

      {/* Quick Edit Modal */}
      {quickEditPeptide && (
        <QuickEditModal
          peptide={quickEditPeptide}
          onClose={() => setQuickEditPeptide(null)}
          onUpdate={handleRefreshWithScrollPreservation}
        />
      )}

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

      {/* Exclusions Manager Modal */}
      <ExclusionManager
        isOpen={showExclusionsModal}
        onClose={() => setShowExclusionsModal(false)}
        onUpdate={handleRefreshWithScrollPreservation}
      />

      {/* Record Sale Modal */}
      {recordSalePeptide && (
        <RecordSaleModal
          peptide={recordSalePeptide}
          onClose={() => setRecordSalePeptide(null)}
          onComplete={handleRefreshWithScrollPreservation}
        />
      )}

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onSave={handleRefreshWithScrollPreservation}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        peptides={sortedPeptides}
        onSave={handleRefreshWithScrollPreservation}
      />
    </div>
  );
}

function InlineLabeledInput({ peptide, onSave }) {
  const quantity = Number(peptide.quantity) || 0;

  let labeledCount = 0;
  if (typeof peptide.labeledCount === 'number') {
    labeledCount = peptide.labeledCount;
  } else if (typeof peptide.labeledCount === 'string') {
    const parsed = Number(peptide.labeledCount);
    if (!isNaN(parsed)) labeledCount = parsed;
  } else if (peptide.isLabeled) {
    labeledCount = quantity;
  }

  const [value, setValue] = useState(labeledCount.toString());
  const inputRef = useRef(null);

  // Sync with external changes
  useEffect(() => {
    setValue(labeledCount.toString());
  }, [labeledCount]);

  const percentage = quantity > 0 ? Math.round((labeledCount / quantity) * 100) : 0;

  let colorClass = '';
  if (quantity <= 0) {
    colorClass = 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600';
  } else if (percentage <= 25) {
    colorClass = 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
  } else if (percentage <= 50) {
    colorClass = 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
  } else if (percentage <= 75) {
    colorClass = 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
  } else {
    colorClass = 'bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800';
  }

  const handleSave = () => {
    const newCount = Number(value) || 0;
    if (newCount !== labeledCount) {
      onSave(peptide.id, newCount);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
      e.target.blur();
    } else if (e.key === 'Escape') {
      setValue(labeledCount.toString());
      e.target.blur();
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="number"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        onFocus={(e) => e.target.select()}
        className={`w-16 px-2 py-1 text-xs font-medium text-center rounded border ${colorClass} text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none`}
      />
      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
        / {quantity} ({percentage}%)
      </span>
    </div>
  );
}

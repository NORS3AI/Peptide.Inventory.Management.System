import { useState, useMemo, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Package, Search, ArrowUpDown, List, GripVertical, Edit3 } from 'lucide-react';
import { checkSalesReadiness, getReadinessStats, filterByReadiness } from '../utils/salesReadiness';
import { db } from '../lib/db';
import ColumnReorderModal from './ColumnReorderModal';
import BulkEditModal from './BulkEditModal';

// Define all available columns
const DEFAULT_COLUMNS = [
  { id: 'status', label: 'Status', field: 'status', sortable: true },
  { id: 'peptideId', label: 'Product', field: 'peptideId', sortable: true },
  { id: 'peptideName', label: 'SKU', field: 'peptideName', sortable: true },
  { id: 'batchNumber', label: 'Batch #', field: 'batchNumber', sortable: true },
  { id: 'purity', label: 'Purity', field: 'purity', sortable: true },
  { id: 'netWeight', label: 'Net Weight', field: 'netWeight', sortable: true },
  { id: 'label', label: 'Label', field: 'isLabeled', sortable: true },
  { id: 'missing', label: 'Missing', field: 'missing', sortable: false }
];

export default function SalesReady({ peptides, onRefresh }) {
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'READY', 'BLOCKED'
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState(() => {
    // Restore search term from localStorage
    return localStorage.getItem('sales-searchTerm') || '';
  });
  const [sortField, setSortField] = useState('peptideId');
  const [sortDirection, setSortDirection] = useState('asc');
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMNS);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [draggedColumn, setDraggedColumn] = useState(null);
  const [showReorderModal, setShowReorderModal] = useState(false);

  // Persist search term to localStorage
  useEffect(() => {
    localStorage.setItem('sales-searchTerm', searchTerm);
  }, [searchTerm]);

  // Clear search term when component unmounts (tab change)
  useEffect(() => {
    return () => {
      const currentTab = localStorage.getItem('activeTab');
      if (currentTab !== 'sales') {
        localStorage.setItem('sales-searchTerm', '');
      }
    };
  }, []);

  // Load column settings
  useEffect(() => {
    const loadColumnSettings = async () => {
      const savedOrder = await db.settings.get('salesReadyColumnOrder');
      if (savedOrder && Array.isArray(savedOrder)) {
        const orderedColumns = savedOrder
          .map(id => DEFAULT_COLUMNS.find(col => col.id === id))
          .filter(Boolean);
        const newColumns = DEFAULT_COLUMNS.filter(
          col => !savedOrder.includes(col.id)
        );
        setColumnOrder([...orderedColumns, ...newColumns]);
      }

      const savedHidden = await db.settings.get('salesReadyHiddenColumns');
      if (savedHidden && Array.isArray(savedHidden)) {
        setHiddenColumns(savedHidden);
      }
    };
    loadColumnSettings();
  }, []);

  // Save column order
  const saveColumnOrder = async (newOrder) => {
    const orderIds = newOrder.map(col => col.id);
    await db.settings.set('salesReadyColumnOrder', orderIds);
  };

  // Handle column reorder
  const handleColumnReorder = (newOrder) => {
    setColumnOrder(newOrder);
    saveColumnOrder(newOrder);
  };

  // Handle column visibility
  const handleVisibilityChange = async (hidden) => {
    setHiddenColumns(hidden);
    await db.settings.set('salesReadyHiddenColumns', hidden);
  };

  // Get visible columns
  const visibleColumns = useMemo(() => {
    return columnOrder.filter(col => !hiddenColumns.includes(col.id));
  }, [columnOrder, hiddenColumns]);

  // Calculate statistics
  const stats = useMemo(() => getReadinessStats(peptides), [peptides]);

  // Add readiness check and off books calculation to peptides
  const peptidesWithReadiness = useMemo(() => {
    return peptides.map(p => {
      const quantity = Number(p.quantity) || 0;
      const labeledCount = Number(p.labeledCount) || 0;

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
        ...p,
        offBooks,
        readiness: checkSalesReadiness(p)
      };
    });
  }, [peptides]);

  // Filter and search
  const filteredPeptides = useMemo(() => {
    let filtered = filterByReadiness(peptidesWithReadiness, filter);

    // Apply search
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.peptideId?.toLowerCase().includes(searchLower) ||
        p.peptideName?.toLowerCase().includes(searchLower) ||
        p.nickname?.toLowerCase().includes(searchLower) ||
        p.batchNumber?.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [peptidesWithReadiness, filter, searchTerm]);

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

      // Handle status sorting
      if (sortField === 'status') {
        const statusPriority = {
          'BLOCKED': 1,
          'READY': 2
        };
        aVal = statusPriority[a.readiness.isReady ? 'READY' : 'BLOCKED'] || 999;
        bVal = statusPriority[b.readiness.isReady ? 'READY' : 'BLOCKED'] || 999;
      }

      // Handle boolean sorting (isLabeled)
      if (sortField === 'isLabeled') {
        aVal = a.isLabeled ? 1 : 0;
        bVal = b.isLabeled ? 1 : 0;
      }

      // Handle string sorting
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      // Handle null/undefined
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

  // Render cell content
  const renderCell = (peptide, column) => {
    const readiness = peptide.readiness;

    if (column.id === 'status') {
      return readiness.isReady ? (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Ready</span>
        </span>
      ) : (
        <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
          <XCircle className="w-3.5 h-3.5" />
          <span>Blocked</span>
        </span>
      );
    }

    if (column.id === 'purity') {
      return peptide.purity ? (
        <span className="text-green-600 dark:text-green-400 font-medium">✓ {peptide.purity}</span>
      ) : (
        <span className="text-red-600 dark:text-red-400">✗ Missing</span>
      );
    }

    if (column.id === 'netWeight') {
      return peptide.netWeight ? (
        <span className="text-green-600 dark:text-green-400 font-medium">✓ {peptide.netWeight}</span>
      ) : (
        <span className="text-red-600 dark:text-red-400">✗ Missing</span>
      );
    }

    if (column.id === 'label') {
      return peptide.isLabeled ? (
        <span className="text-green-600 dark:text-green-400 font-medium">✓ Applied</span>
      ) : (
        <span className="text-red-600 dark:text-red-400">✗ Not Applied</span>
      );
    }


    if (column.id === 'missing') {
      return readiness.missing.length > 0 ? (
        <span className="text-red-600 dark:text-red-400">{readiness.missing.join(', ')}</span>
      ) : (
        <span className="text-green-600 dark:text-green-400">None</span>
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
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sales Ready */}
        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-4 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">Sales Ready</p>
              <p className="text-3xl font-bold text-green-900 dark:text-green-100">{stats.ready}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">All requirements met</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-500 dark:text-green-400" />
          </div>
        </div>

        {/* Blocked */}
        <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">Blocked</p>
              <p className="text-3xl font-bold text-red-900 dark:text-red-100">{stats.blocked}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Missing requirements</p>
            </div>
            <XCircle className="w-12 h-12 text-red-500 dark:text-red-400" />
          </div>
        </div>

        {/* Total */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Items</p>
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">In inventory</p>
            </div>
            <Package className="w-12 h-12 text-blue-500 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Missing Requirements Summary */}
      {stats.blocked > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 transition-colors">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                Missing Requirements Summary
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-yellow-700 dark:text-yellow-300">Missing Purity: </span>
                  <span className="font-semibold text-yellow-900 dark:text-yellow-100">{stats.missingPurity}</span>
                </div>
                <div>
                  <span className="text-yellow-700 dark:text-yellow-300">Missing Net Weight: </span>
                  <span className="font-semibold text-yellow-900 dark:text-yellow-100">{stats.missingNetWeight}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
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

          {/* Filter */}
          <div className="sm:w-48">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="ALL">All Items ({stats.total})</option>
              <option value="READY">Sales Ready ({stats.ready})</option>
              <option value="BLOCKED">Blocked ({stats.blocked})</option>
            </select>
          </div>

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
        </div>
      </div>

      {/* Results */}
      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
        Showing {sortedPeptides.length} of {peptides.length} items
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {visibleColumns.map((column, index) => (
                  <th
                    key={column.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider
                      ${column.sortable ? 'hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer' : ''}
                      ${draggedColumn === index ? 'opacity-50' : ''}
                    `}
                    onClick={() => column.sortable && handleSort(column.field)}
                  >
                    <div className="flex items-center space-x-2">
                      <span>{column.label}</span>
                      {column.sortable && (
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
                <tr key={peptide.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  {visibleColumns.map((column) => (
                    <td
                      key={column.id}
                      className={`px-6 py-4 text-sm ${
                        column.id === 'peptideId' ? 'font-medium text-gray-900 dark:text-white' :
                        'text-gray-500 dark:text-gray-400'
                      } whitespace-nowrap`}
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
            <p className="text-gray-500 dark:text-gray-400">No items match your search criteria</p>
          </div>
        )}
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

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={showBulkEditModal}
        onClose={() => setShowBulkEditModal(false)}
        peptides={sortedPeptides}
        onSave={onRefresh}
      />
    </div>
  );
}

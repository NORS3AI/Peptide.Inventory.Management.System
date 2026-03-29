import { useState, useEffect, useMemo, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Plus, Trash2, Edit3, Settings2, X, Check, Package, Download } from 'lucide-react';
import { db } from '../lib/db';
import { useToast } from './Toast';
import ColumnReorderModal from './ColumnReorderModal';
import BatchBulkEditModal from './BatchBulkEditModal';

const DEFAULT_COLUMNS = [
  { id: 'rowNum', label: '#' },
  { id: 'vendor', label: 'Vendor' },
  { id: 'productId', label: 'ID' },
  { id: 'name', label: 'Name' },
  { id: 'mgMl', label: 'MG/ML' },
  { id: 'pricePerVial', label: '$/Vial' },
  { id: 'pricePerBox', label: '$/Box' },
  { id: 'qtyPurchased', label: 'QTY Purchased' },
  { id: 'totalQty', label: 'Total/Qty' },
  { id: 'comp1', label: 'COMP1' },
  { id: 'comp2', label: 'COMP2' },
  { id: 'comp3', label: 'COMP3' },
  { id: 'srgSale', label: 'SRG Sale' },
  { id: 'profitPerVial', label: 'Profit/Vial $' },
  { id: 'profitPerVialPct', label: 'Profit/Vial %' },
  { id: 'profitPerBatch', label: 'Profit/Batch' },
];

const CALCULATED_FIELDS = ['pricePerVial', 'totalQty', 'profitPerVial', 'profitPerVialPct', 'profitPerBatch'];

function computeFields(item) {
  const pricePerBox = Number(item.pricePerBox) || 0;
  const qtyPurchased = Number(item.qtyPurchased) || 0;
  const srgSale = Number(item.srgSale) || 0;

  const pricePerVial = pricePerBox / 10;
  const totalQty = pricePerBox * (qtyPurchased / 10);
  const profitPerVial = srgSale - pricePerVial;
  const profitPerVialPct = pricePerVial > 0 ? ((srgSale - pricePerVial) / pricePerVial) * 100 : 0;
  const profitPerBatch = profitPerVial * qtyPurchased;

  return { pricePerVial, totalQty, profitPerVial, profitPerVialPct, profitPerBatch };
}

function getDisplayValue(item, fieldId) {
  // If user has manually overridden a calculated field, use that
  const overrideKey = `${fieldId}_override`;
  if (item[overrideKey] !== undefined && item[overrideKey] !== null && item[overrideKey] !== '') {
    return Number(item[overrideKey]);
  }
  // Otherwise compute
  const computed = computeFields(item);
  if (computed[fieldId] !== undefined) return computed[fieldId];
  return item[fieldId] ?? '';
}

function formatCurrency(val) {
  const num = Number(val);
  if (isNaN(num)) return '-';
  return `$${num.toFixed(2)}`;
}

function formatPercent(val) {
  const num = Number(val);
  if (isNaN(num)) return '-';
  return `${num.toFixed(1)}%`;
}

function formatNumber(val) {
  const num = Number(val);
  if (isNaN(num) || val === '' || val === null || val === undefined) return '-';
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
}

export default function Batch() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({ field: 'rowNum', direction: 'asc' });
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMNS);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { id, field }
  const [editValue, setEditValue] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [vendors, setVendors] = useState(['Belgium']);
  const [showVendorManager, setShowVendorManager] = useState(false);
  const [newVendor, setNewVendor] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { success, error: showError } = useToast();

  // New row form
  const [newRow, setNewRow] = useState({
    vendor: 'Belgium', productId: '', name: '', mgMl: '',
    pricePerBox: '', qtyPurchased: '', comp1: '', comp2: '', comp3: '', srgSale: ''
  });

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchItems, savedOrder, savedHidden, savedVendors] = await Promise.all([
        db.batches.getAll(),
        db.settings.get('batchColumnOrder'),
        db.settings.get('batchHiddenColumns'),
        db.settings.get('batchVendors'),
      ]);
      setItems(batchItems);

      if (savedOrder && Array.isArray(savedOrder)) {
        const orderedColumns = savedOrder
          .map(id => DEFAULT_COLUMNS.find(col => col.id === id))
          .filter(Boolean);
        const newColumns = DEFAULT_COLUMNS.filter(col => !savedOrder.includes(col.id));
        setColumnOrder([...orderedColumns, ...newColumns]);
      }
      if (savedHidden && Array.isArray(savedHidden)) setHiddenColumns(savedHidden);
      if (savedVendors && Array.isArray(savedVendors) && savedVendors.length > 0) setVendors(savedVendors);
    } catch (err) {
      console.error('Failed to load batch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const visibleColumns = useMemo(() => {
    return columnOrder.filter(col => !hiddenColumns.includes(col.id));
  }, [columnOrder, hiddenColumns]);

  // Sorting
  const sortedItems = useMemo(() => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      let aVal, bVal;
      if (CALCULATED_FIELDS.includes(sort.field)) {
        aVal = getDisplayValue(a, sort.field);
        bVal = getDisplayValue(b, sort.field);
      } else {
        aVal = a[sort.field] ?? '';
        bVal = b[sort.field] ?? '';
      }

      // Numeric sort for number fields
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sort.direction === 'asc' ? aNum - bNum : bNum - aNum;
      }
      // String sort
      const cmp = String(aVal).localeCompare(String(bVal));
      return sort.direction === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [items, sort]);

  const handleSort = (field) => {
    setSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Column management
  const handleColumnReorder = async (newOrder) => {
    setColumnOrder(newOrder);
    await db.settings.set('batchColumnOrder', newOrder.map(c => c.id));
  };

  const handleVisibilityChange = async (hidden) => {
    setHiddenColumns(hidden);
    await db.settings.set('batchHiddenColumns', hidden);
  };

  // Inline editing
  const startEdit = (id, field, currentValue) => {
    const overrideKey = `${field}_override`;
    const item = items.find(i => i.id === id);
    if (CALCULATED_FIELDS.includes(field)) {
      // For calculated fields, show override value or computed
      const val = item[overrideKey] !== undefined && item[overrideKey] !== '' ? item[overrideKey] : getDisplayValue(item, field);
      setEditValue(String(val));
    } else {
      setEditValue(String(currentValue ?? ''));
    }
    setEditingCell({ id, field });
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    try {
      let updates;
      if (CALCULATED_FIELDS.includes(field)) {
        // Save as override
        const overrideKey = `${field}_override`;
        updates = { [overrideKey]: editValue === '' ? undefined : editValue };
      } else {
        updates = { [field]: editValue };
      }
      await db.batches.update(id, updates);
      setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
      setEditingCell(null);
    } catch (err) {
      showError('Failed to save: ' + err.message);
    }
  };

  const cancelEdit = () => setEditingCell(null);

  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter') saveEdit();
    if (e.key === 'Escape') cancelEdit();
  };

  // Add new row
  const handleAddRow = async () => {
    const rowNum = items.length + 1;
    const id = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const item = {
      ...newRow,
      id,
      rowNum,
      createdAt: new Date().toISOString()
    };
    try {
      await db.batches.set(id, item);
      setItems(prev => [...prev, { ...item, id }]);
      setNewRow({
        vendor: vendors[0] || 'Belgium', productId: '', name: '', mgMl: '',
        pricePerBox: '', qtyPurchased: '', comp1: '', comp2: '', comp3: '', srgSale: ''
      });
      setShowAddRow(false);
      success('Row added');
    } catch (err) {
      showError('Failed to add row: ' + err.message);
    }
  };

  // Delete selected rows
  const handleDeleteSelected = async () => {
    try {
      for (const id of selectedRows) {
        await db.batches.delete(id);
      }
      setItems(prev => prev.filter(item => !selectedRows.has(item.id)));
      setSelectedRows(new Set());
      setShowDeleteConfirm(false);
      success(`Deleted ${selectedRows.size} row(s)`);
    } catch (err) {
      showError('Failed to delete: ' + err.message);
    }
  };

  // Vendor management
  const addVendor = async () => {
    if (!newVendor.trim() || vendors.includes(newVendor.trim())) return;
    const updated = [...vendors, newVendor.trim()];
    setVendors(updated);
    await db.settings.set('batchVendors', updated);
    setNewVendor('');
  };

  const removeVendor = async (v) => {
    const updated = vendors.filter(x => x !== v);
    setVendors(updated);
    await db.settings.set('batchVendors', updated);
  };

  // Row selection
  const toggleRow = (id) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === sortedItems.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(sortedItems.map(i => i.id)));
    }
  };

  // Totals row
  const totals = useMemo(() => {
    let totalCost = 0, totalProfit = 0, totalQtyPurchased = 0;
    items.forEach(item => {
      const computed = computeFields(item);
      totalCost += getDisplayValue(item, 'totalQty') || computed.totalQty;
      totalProfit += (getDisplayValue(item, 'profitPerBatch') || computed.profitPerBatch);
      totalQtyPurchased += Number(item.qtyPurchased) || 0;
    });
    const net = totalProfit - totalCost;
    return { totalCost, totalProfit, totalQtyPurchased, net };
  }, [items]);

  const handleExport = useCallback(() => {
    if (items.length === 0) return;
    const headers = DEFAULT_COLUMNS.map(c => c.label);
    const rows = items.map(item => {
      return DEFAULT_COLUMNS.map(col => {
        const val = getDisplayValue(item, col.id);
        if (val === null || val === undefined || val === '') return '';
        return String(val);
      });
    });
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        if (cell.includes(',') || cell.includes('"')) return `"${cell.replace(/"/g, '""')}"`;
        return cell;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `srg-batch-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    success('Batch data exported');
  }, [items, success]);

  const renderCellValue = (item, colId) => {
    const val = getDisplayValue(item, colId);
    switch (colId) {
      case 'pricePerVial':
      case 'pricePerBox':
      case 'comp1':
      case 'comp2':
      case 'comp3':
      case 'srgSale':
      case 'profitPerVial':
      case 'profitPerBatch':
      case 'totalQty':
        return formatCurrency(val);
      case 'profitPerVialPct':
        return formatPercent(val);
      case 'qtyPurchased':
      case 'rowNum':
      case 'mgMl':
        return formatNumber(val);
      default:
        return val || '-';
    }
  };

  const getCellColor = (item, colId) => {
    if (colId === 'profitPerVial' || colId === 'profitPerBatch') {
      const val = Number(getDisplayValue(item, colId));
      if (val > 0) return 'text-green-600 dark:text-green-400';
      if (val < 0) return 'text-red-600 dark:text-red-400';
    }
    if (colId === 'profitPerVialPct') {
      const val = Number(getDisplayValue(item, colId));
      if (val >= 50) return 'text-green-600 dark:text-green-400 font-semibold';
      if (val >= 20) return 'text-green-600 dark:text-green-400';
      if (val > 0) return 'text-yellow-600 dark:text-yellow-400';
      if (val < 0) return 'text-red-600 dark:text-red-400';
    }
    return '';
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">Loading batch data...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Batch Purchases</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {items.length} item{items.length !== 1 ? 's' : ''} | Total cost: {formatCurrency(totals.totalCost)} | Gross: {formatCurrency(totals.totalProfit)}
          </p>
          <p className="text-sm">
            Net: <span className="text-green-600 dark:text-green-400 font-semibold">{formatCurrency(totals.net)}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedRows.size > 0 && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedRows.size})
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={items.length === 0}
            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowVendorManager(true)}
            className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
          >
            <Settings2 className="w-4 h-4" />
            Vendors
          </button>
          <button
            onClick={() => setShowReorderModal(true)}
            className="flex items-center gap-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
          >
            <ArrowUpDown className="w-4 h-4" />
            Columns
          </button>
          <button
            onClick={() => setShowBulkEdit(true)}
            className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
          >
            <Edit3 className="w-4 h-4" />
            Bulk Edit
          </button>
          <button
            onClick={() => setShowAddRow(true)}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
        </div>
      </div>

      {/* Add Row Form */}
      {showAddRow && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-blue-300 dark:border-blue-600">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Add New Batch Item</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Vendor</label>
              <select
                value={newRow.vendor}
                onChange={e => setNewRow(p => ({ ...p, vendor: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {vendors.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">ID</label>
              <input value={newRow.productId} onChange={e => setNewRow(p => ({ ...p, productId: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="e.g. BPC-157" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Name</label>
              <input value={newRow.name} onChange={e => setNewRow(p => ({ ...p, name: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="Peptide name" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">MG/ML</label>
              <input value={newRow.mgMl} onChange={e => setNewRow(p => ({ ...p, mgMl: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="5mg" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">$/Box</label>
              <input type="number" step="0.01" value={newRow.pricePerBox} onChange={e => setNewRow(p => ({ ...p, pricePerBox: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">QTY Purchased</label>
              <input type="number" value={newRow.qtyPurchased} onChange={e => setNewRow(p => ({ ...p, qtyPurchased: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="20" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">COMP1</label>
              <input type="number" step="0.01" value={newRow.comp1} onChange={e => setNewRow(p => ({ ...p, comp1: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">COMP2</label>
              <input type="number" step="0.01" value={newRow.comp2} onChange={e => setNewRow(p => ({ ...p, comp2: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">COMP3</label>
              <input type="number" step="0.01" value={newRow.comp3} onChange={e => setNewRow(p => ({ ...p, comp3: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">SRG Sale</label>
              <input type="number" step="0.01" value={newRow.srgSale} onChange={e => setNewRow(p => ({ ...p, srgSale: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" placeholder="0.00" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowAddRow(false)} className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
            <button onClick={handleAddRow} disabled={!newRow.productId && !newRow.name}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium">Add</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto batch-scroll">
        <table className="min-w-max text-sm text-gray-900 dark:text-white">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <th className="px-2 py-2 text-left w-8">
                <input type="checkbox" checked={selectedRows.size === sortedItems.length && sortedItems.length > 0} onChange={toggleAll}
                  className="rounded border-gray-300 dark:border-gray-600" />
              </th>
              {visibleColumns.map(col => (
                <th
                  key={col.id}
                  onClick={() => handleSort(col.id)}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 whitespace-nowrap select-none"
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {sort.field === col.id && (
                      sort.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="font-medium">No batch items yet</p>
                  <p className="text-sm mt-1">Add rows manually or import a CSV from the Import tab.</p>
                </td>
              </tr>
            ) : sortedItems.map(item => (
              <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${selectedRows.has(item.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                <td className="px-2 py-1.5">
                  <input type="checkbox" checked={selectedRows.has(item.id)} onChange={() => toggleRow(item.id)}
                    className="rounded border-gray-300 dark:border-gray-600" />
                </td>
                {visibleColumns.map(col => {
                  const isEditing = editingCell?.id === item.id && editingCell?.field === col.id;
                  const isCalc = CALCULATED_FIELDS.includes(col.id);
                  const cellColor = getCellColor(item, col.id);
                  const displayVal = renderCellValue(item, col.id);
                  const rawVal = col.id === 'vendor' ? item.vendor : getDisplayValue(item, col.id);

                  if (isEditing) {
                    return (
                      <td key={col.id} className="px-1 py-1">
                        {col.id === 'vendor' ? (
                          <select
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleEditKeyDown}
                            autoFocus
                            className="w-full px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                          >
                            {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                        ) : (
                          <input
                            type={['pricePerBox','qtyPurchased','comp1','comp2','comp3','srgSale','mgMl','pricePerVial','totalQty','profitPerVial','profitPerVialPct','profitPerBatch'].includes(col.id) ? 'number' : 'text'}
                            step="0.01"
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleEditKeyDown}
                            autoFocus
                            onFocus={e => e.target.select()}
                            className="w-full px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={col.id}
                      onClick={() => startEdit(item.id, col.id, rawVal)}
                      className={`px-3 py-1.5 whitespace-nowrap cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${cellColor} ${isCalc ? 'italic' : ''}`}
                      title={isCalc ? 'Calculated (click to override)' : 'Click to edit'}
                    >
                      {displayVal}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          {/* Totals footer */}
          {sortedItems.length > 0 && (
            <tfoot>
              <tr className="bg-gray-100 dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-600 font-semibold text-gray-900 dark:text-white">
                <td className="px-2 py-2" />
                {visibleColumns.map(col => (
                  <td key={col.id} className="px-3 py-2 whitespace-nowrap">
                    {col.id === 'rowNum' && 'Total'}
                    {col.id === 'qtyPurchased' && formatNumber(totals.totalQtyPurchased)}
                    {col.id === 'totalQty' && formatCurrency(totals.totalCost)}
                    {col.id === 'profitPerBatch' && (
                      <span className={totals.totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        {formatCurrency(totals.totalProfit)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Vendor Manager Modal */}
      {showVendorManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Vendors</h3>
              <button onClick={() => setShowVendorManager(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {vendors.map(v => (
                <div key={v} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="text-sm text-gray-900 dark:text-white">{v}</span>
                  <button onClick={() => removeVendor(v)} className="text-red-500 hover:text-red-700 text-xs">Remove</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newVendor}
                onChange={e => setNewVendor(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addVendor()}
                placeholder="New vendor name"
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <button onClick={addVendor} className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete {selectedRows.size} row(s)?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={handleDeleteSelected} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Delete</button>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">Cancel</button>
            </div>
          </div>
        </div>
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

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <BatchBulkEditModal
          isOpen={showBulkEdit}
          onClose={() => setShowBulkEdit(false)}
          items={items}
          vendors={vendors}
          onSave={loadData}
        />
      )}
    </div>
  );
}

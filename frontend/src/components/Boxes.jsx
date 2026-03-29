import { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Trash2, Search, ArrowUpDown, Edit3, Check, X, Box as BoxIcon } from 'lucide-react';
import { db } from '../lib/db';

const DEFAULT_COLUMNS = [
  { id: 'name', label: 'Box Type / Name' },
  { id: 'supplier', label: 'Supplier' },
  { id: 'sku', label: 'SKU / Part #' },
  { id: 'onHand', label: 'On Hand' },
  { id: 'onOrder', label: 'On Order' },
  { id: 'dailyUsage', label: 'Daily Usage' },
  { id: 'daysLeft', label: 'Days Left' },
  { id: 'costPerUnit', label: 'Cost / Unit' },
  { id: 'costPerCase', label: 'Cost / Case' },
  { id: 'unitsPerCase', label: 'Units / Case' },
  { id: 'totalValue', label: 'Total Value' },
  { id: 'reorderPoint', label: 'Reorder Point' },
  { id: 'lastOrdered', label: 'Last Ordered' },
  { id: 'notes', label: 'Notes' },
];

const COMPUTED_FIELDS = ['daysLeft', 'totalValue'];

function computeFields(item) {
  const onHand = Number(item.onHand) || 0;
  const dailyUsage = Number(item.dailyUsage) || 0;
  const costPerUnit = Number(item.costPerUnit) || 0;
  const daysLeft = dailyUsage > 0 ? Math.round((onHand / dailyUsage) * 10) / 10 : null;
  const totalValue = onHand * costPerUnit;
  return { daysLeft, totalValue };
}

function getDisplayValue(item, fieldId) {
  if (item[`${fieldId}_override`] !== undefined && item[`${fieldId}_override`] !== '') {
    return item[`${fieldId}_override`];
  }
  if (COMPUTED_FIELDS.includes(fieldId)) {
    const computed = computeFields(item);
    return computed[fieldId];
  }
  return item[fieldId] ?? '';
}

function formatCell(fieldId, value) {
  if (value === null || value === undefined || value === '') return '-';
  if (fieldId === 'costPerUnit' || fieldId === 'costPerCase' || fieldId === 'totalValue') {
    const num = Number(value);
    return isNaN(num) ? value : `$${num.toFixed(2)}`;
  }
  if (fieldId === 'daysLeft') {
    const num = Number(value);
    return isNaN(num) ? value : num.toFixed(1);
  }
  return value;
}

export default function Boxes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ field: 'name', direction: 'asc' });
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [showAddRow, setShowAddRow] = useState(false);
  const [newItem, setNewItem] = useState({});

  const loadItems = useCallback(async () => {
    try {
      const all = await db.boxes.getAll();
      setItems(all);
    } catch (e) {
      console.error('Failed to load boxes:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filteredItems = useMemo(() => {
    let filtered = items;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(item =>
        (item.name || '').toLowerCase().includes(s) ||
        (item.supplier || '').toLowerCase().includes(s) ||
        (item.sku || '').toLowerCase().includes(s)
      );
    }
    filtered.sort((a, b) => {
      let aVal = getDisplayValue(a, sort.field);
      let bVal = getDisplayValue(b, sort.field);
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) return sort.direction === 'asc' ? aNum - bNum : bNum - aNum;
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
      return sort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return filtered;
  }, [items, search, sort]);

  const handleSort = (field) => {
    setSort(prev => ({ field, direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const startEdit = (itemId, fieldId, currentValue) => {
    setEditingCell({ itemId, fieldId });
    setEditValue(currentValue === null || currentValue === undefined ? '' : String(currentValue));
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    const { itemId, fieldId } = editingCell;
    const updateKey = COMPUTED_FIELDS.includes(fieldId) ? `${fieldId}_override` : fieldId;
    try {
      await db.boxes.update(itemId, { [updateKey]: editValue });
      await loadItems();
    } catch (e) {
      console.error('Failed to save:', e);
    }
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const handleAddRow = async () => {
    if (!newItem.name) return;
    const id = `box-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      await db.boxes.set(id, { ...newItem });
      setNewItem({});
      setShowAddRow(false);
      await loadItems();
    } catch (e) {
      console.error('Failed to add box:', e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await db.boxes.delete(id);
      await loadItems();
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  };

  // Summary stats
  const summary = useMemo(() => {
    let totalOnHand = 0, totalOnOrder = 0, totalValue = 0, totalDailyUsage = 0;
    const suppliers = new Set();
    items.forEach(item => {
      totalOnHand += Number(item.onHand) || 0;
      totalOnOrder += Number(item.onOrder) || 0;
      totalDailyUsage += Number(item.dailyUsage) || 0;
      const computed = computeFields(item);
      totalValue += computed.totalValue || 0;
      if (item.supplier) suppliers.add(item.supplier);
    });
    return { totalOnHand, totalOnOrder, totalValue, totalDailyUsage, suppliers: suppliers.size, types: items.length };
  }, [items]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading boxes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.types}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Box Types</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalOnHand}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">On Hand</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.totalOnOrder}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">On Order</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.totalDailyUsage}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Daily Usage</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">${summary.totalValue.toFixed(2)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Value</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.suppliers}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Suppliers</p>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search boxes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowAddRow(!showAddRow)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Box
        </button>
      </div>

      {/* Add Row */}
      {showAddRow && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-3">Add New Box Type</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['name', 'supplier', 'sku', 'onHand', 'onOrder', 'dailyUsage', 'costPerUnit', 'costPerCase', 'unitsPerCase', 'reorderPoint'].map(field => (
              <div key={field}>
                <label className="text-xs text-gray-600 dark:text-gray-400 block mb-1">
                  {DEFAULT_COLUMNS.find(c => c.id === field)?.label || field}
                </label>
                <input
                  type="text"
                  value={newItem[field] || ''}
                  onChange={(e) => setNewItem(prev => ({ ...prev, [field]: e.target.value }))}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleAddRow} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">Save</button>
            <button onClick={() => { setShowAddRow(false); setNewItem({}); }} className="px-4 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto batch-scroll">
          <table className="min-w-max w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {DEFAULT_COLUMNS.map(col => (
                  <th
                    key={col.id}
                    onClick={() => handleSort(col.id)}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 whitespace-nowrap select-none"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sort.field === col.id && (
                        <span className="text-blue-600 dark:text-blue-400">{sort.direction === 'asc' ? '\u2191' : '\u2193'}</span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase w-12">Del</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={DEFAULT_COLUMNS.length + 1} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <BoxIcon className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p className="font-medium">No boxes found</p>
                    <p className="text-sm mt-1">Add a box type or import box invoices</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const computed = computeFields(item);
                  const daysLeft = getDisplayValue(item, 'daysLeft');
                  const daysLeftNum = Number(daysLeft);
                  const rowRisk = !isNaN(daysLeftNum) && daysLeftNum <= 7 ? 'bg-red-50 dark:bg-red-900/10' :
                    !isNaN(daysLeftNum) && daysLeftNum <= 14 ? 'bg-orange-50 dark:bg-orange-900/10' : '';

                  return (
                    <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${rowRisk}`}>
                      {DEFAULT_COLUMNS.map(col => {
                        const val = getDisplayValue(item, col.id);
                        const isEditing = editingCell?.itemId === item.id && editingCell?.fieldId === col.id;

                        return (
                          <td
                            key={col.id}
                            className="px-3 py-2 whitespace-nowrap cursor-pointer"
                            onClick={() => !isEditing && startEdit(item.id, col.id, val)}
                          >
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit();
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  autoFocus
                                  className="w-full px-1 py-0.5 text-sm border border-blue-400 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
                                />
                                <button onClick={saveEdit} className="text-green-600"><Check className="w-3.5 h-3.5" /></button>
                                <button onClick={cancelEdit} className="text-red-600"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            ) : (
                              <span className={`text-gray-900 dark:text-white ${
                                col.id === 'daysLeft' && !isNaN(daysLeftNum) && daysLeftNum <= 7 ? 'text-red-600 dark:text-red-400 font-bold' :
                                col.id === 'daysLeft' && !isNaN(daysLeftNum) && daysLeftNum <= 14 ? 'text-orange-600 dark:text-orange-400 font-semibold' : ''
                              }`}>
                                {formatCell(col.id, val)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 dark:hover:text-red-300">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { db } from '../lib/db';
import { useToast } from './Toast';

const ALL_COLUMNS = [
  { id: 'rowNum', label: '#', type: 'number', readOnly: true, width: 'w-12' },
  { id: 'vendor', label: 'Vendor', type: 'select', width: 'w-28' },
  { id: 'productId', label: 'ID', type: 'text', width: 'w-28' },
  { id: 'name', label: 'Name', type: 'text', width: 'w-40' },
  { id: 'mgMl', label: 'MG/ML', type: 'text', width: 'w-20' },
  { id: 'pricePerBox', label: '$/Box', type: 'number', width: 'w-24' },
  { id: 'qtyPurchased', label: 'QTY Purchased', type: 'number', width: 'w-20' },
  { id: 'comp1', label: 'COMP1', type: 'number', width: 'w-24' },
  { id: 'comp2', label: 'COMP2', type: 'number', width: 'w-24' },
  { id: 'comp3', label: 'COMP3', type: 'number', width: 'w-24' },
  { id: 'salePrice', label: 'Sale Price', type: 'number', width: 'w-24' },
  { id: 'pricePerVial_override', label: '$/Vial Override', type: 'number', width: 'w-24' },
  { id: 'totalQty_override', label: 'Total/Qty Override', type: 'number', width: 'w-24' },
  { id: 'profitPerVial_override', label: 'Profit/Vial $ Override', type: 'number', width: 'w-24' },
  { id: 'profitPerVialPct_override', label: 'Profit/Vial % Override', type: 'number', width: 'w-24' },
  { id: 'profitPerBatch_override', label: 'Profit/Batch Override', type: 'number', width: 'w-24' },
];

export default function BatchBulkEditModal({ isOpen, onClose, items, vendors, onSave }) {
  const [editData, setEditData] = useState([]);
  const [modified, setModified] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const { success, error: showError } = useToast();

  useEffect(() => {
    if (isOpen && items.length > 0) {
      setEditData(items.map(i => ({ ...i })));
      setModified(new Set());
    }
  }, [isOpen, items]);

  useEffect(() => {
    if (!isOpen) return;
    const loadHidden = async () => {
      const saved = await db.settings.get('batchBulkHiddenColumns');
      if (saved && Array.isArray(saved)) setHiddenColumns(saved);
    };
    loadHidden();
  }, [isOpen]);

  const columns = ALL_COLUMNS.filter(
    col => col.id === 'rowNum' || !hiddenColumns.includes(col.id)
  );

  const handleChange = (index, field, value) => {
    setEditData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setModified(prev => new Set([...prev, `${index}-${field}`]));
  };

  const isModified = (index, field) => modified.has(`${index}-${field}`);

  const handleSaveAll = async () => {
    setSaving(true);
    let savedCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < editData.length; i++) {
        const rowModified = ALL_COLUMNS.some(col => modified.has(`${i}-${col.id}`));
        if (!rowModified) continue;

        const item = editData[i];
        const id = items[i].id;

        try {
          const updates = {};
          ALL_COLUMNS.forEach(col => {
            if (col.readOnly) return;
            if (modified.has(`${i}-${col.id}`)) {
              let value = item[col.id];
              if (col.type === 'number') value = value === '' ? '' : Number(value) || 0;
              updates[col.id] = value;
            }
          });
          await db.batches.update(id, updates);
          savedCount++;
        } catch (err) {
          console.error(`Failed to save batch ${id}:`, err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        success(`Saved ${savedCount} item${savedCount !== 1 ? 's' : ''}`);
        setModified(new Set());
        if (onSave) onSave();
      } else {
        showError(`Saved ${savedCount}, failed ${errorCount}`);
      }
    } catch (err) {
      showError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Batch Bulk Edit</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {editData.length} items | {modified.size} change{modified.size !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveAll}
              disabled={saving || modified.size === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium text-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : `Save (${modified.size})`}
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto p-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900">
                <th className="px-2 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 w-8">#</th>
                {columns.map(col => (
                  <th key={col.id} className="px-2 py-2 text-left text-xs font-medium uppercase text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {editData.map((item, rowIndex) => (
                <tr key={item.id || rowIndex}>
                  <td className="px-2 py-1 text-xs text-gray-400">{rowIndex + 1}</td>
                  {columns.map(col => (
                    <td key={col.id} className="px-1 py-1">
                      {col.readOnly ? (
                        <span className="px-2 py-1 text-sm font-medium whitespace-nowrap text-gray-900 dark:text-white">
                          {item[col.id] ?? '-'}
                        </span>
                      ) : col.type === 'select' && col.id === 'vendor' ? (
                        <select
                          value={item[col.id] ?? ''}
                          onChange={e => handleChange(rowIndex, col.id, e.target.value)}
                          className={`${col.width} px-2 py-1 text-sm border rounded ${
                            isModified(rowIndex, col.id)
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                              : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'
                          } focus:ring-1 focus:ring-blue-500`}
                        >
                          {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        <input
                          type={col.type === 'number' ? 'number' : 'text'}
                          step={col.type === 'number' ? '0.01' : undefined}
                          value={item[col.id] ?? ''}
                          onChange={e => handleChange(rowIndex, col.id, e.target.value)}
                          onFocus={e => e.target.select()}
                          className={`${col.width} px-2 py-1 text-sm border rounded ${
                            isModified(rowIndex, col.id)
                              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                              : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'
                          } focus:ring-1 focus:ring-blue-500`}
                          placeholder={col.label}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

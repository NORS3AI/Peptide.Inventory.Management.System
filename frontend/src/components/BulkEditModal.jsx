import { useState, useEffect, useRef } from 'react';
import { X, Save, AlertCircle, CheckCircle2, Edit3 } from 'lucide-react';
import { db } from '../lib/db';
import { useToast } from './Toast';

export default function BulkEditModal({ isOpen, onClose, peptides, onSave }) {
  const [editData, setEditData] = useState([]);
  const [modified, setModified] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const modalRef = useRef(null);
  const { success, error: showError } = useToast();

  // All editable columns
  const allColumns = [
    { id: 'peptideId', label: 'Product', type: 'text', readOnly: true },
    { id: 'peptideName', label: 'SKU', type: 'text', width: 'w-48' },
    { id: 'nickname', label: 'Nickname', type: 'text', width: 'w-40' },
    { id: 'quantity', label: 'Qty', type: 'number', width: 'w-20' },
    { id: 'labeledCount', label: 'Labeled', type: 'number', width: 'w-20' },
    { id: 'batchNumber', label: 'Batch #', type: 'text', width: 'w-32' },
    { id: 'purity', label: 'Purity', type: 'text', width: 'w-24' },
    { id: 'netWeight', label: 'Net Weight', type: 'text', width: 'w-24' },
    { id: 'velocity', label: 'Velocity', type: 'text', width: 'w-24' },
    { id: 'orderedQty', label: 'Ordered', type: 'number', width: 'w-20' },
    { id: 'notes', label: 'Notes', type: 'text', width: 'w-48' },
  ];

  // Filter out hidden columns (always keep peptideId as the row identifier)
  const columns = allColumns.filter(
    col => col.id === 'peptideId' || !hiddenColumns.includes(col.id)
  );

  // Load hidden columns setting from database
  useEffect(() => {
    if (!isOpen) return;
    const loadHidden = async () => {
      const saved = await db.settings.get('hiddenColumns');
      if (saved && Array.isArray(saved)) {
        setHiddenColumns(saved);
      }
    };
    loadHidden();
  }, [isOpen]);

  // Initialize edit data from peptides
  useEffect(() => {
    if (isOpen && peptides.length > 0) {
      setEditData(peptides.map(p => ({ ...p })));
      setModified(new Set());
      setSaveResult(null);
    }
  }, [isOpen, peptides]);

  // Handle field change
  const handleChange = (index, field, value) => {
    setEditData(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    // Track which rows were modified
    const key = `${index}-${field}`;
    setModified(prev => new Set([...prev, key]));
  };

  // Check if a cell was modified
  const isModified = (index, field) => {
    return modified.has(`${index}-${field}`);
  };

  // Save all changes
  const handleSaveAll = async () => {
    setSaving(true);
    setSaveResult(null);

    let savedCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < editData.length; i++) {
        // Check if this row has any modifications (check all columns, not just visible)
        const rowModified = allColumns.some(col => modified.has(`${i}-${col.id}`));
        if (!rowModified) continue;

        const peptide = editData[i];
        const peptideId = peptides[i].peptideId; // Use original ID as key

        try {
          // Build update object with only changed fields
          const updates = {};
          allColumns.forEach(col => {
            if (col.readOnly) return;
            if (modified.has(`${i}-${col.id}`)) {
              let value = peptide[col.id];
              if (col.type === 'number') {
                value = Number(value) || 0;
              }
              updates[col.id] = value;
            }
          });

          await db.peptides.update(peptideId, updates);
          savedCount++;
        } catch (err) {
          console.error(`Failed to save ${peptide.peptideId}:`, err);
          errorCount++;
        }
      }

      if (errorCount === 0) {
        success(`Saved ${savedCount} peptide${savedCount !== 1 ? 's' : ''}`);
        setModified(new Set());
        if (onSave) onSave();
      } else {
        showError(`Saved ${savedCount}, failed ${errorCount}`);
      }

      setSaveResult({ saved: savedCount, errors: errorCount });
    } catch (err) {
      showError('Failed to save changes');
      console.error('Bulk save error:', err);
    } finally {
      setSaving(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasChanges = modified.size > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999]">
      <div
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[95vw] max-w-7xl h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <Edit3 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Bulk Edit</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Edit all peptides at once. {editData.length} items.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {hasChanges && (
              <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleSaveAll}
              disabled={!hasChanges || saving}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save All'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Save Result Banner */}
        {saveResult && (
          <div className={`px-4 py-2 flex items-center space-x-2 text-sm flex-shrink-0 ${
            saveResult.errors > 0
              ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
              : 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200'
          }`}>
            {saveResult.errors > 0 ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span>
              Saved {saveResult.saved} peptide{saveResult.saved !== 1 ? 's' : ''}
              {saveResult.errors > 0 && `, ${saveResult.errors} error${saveResult.errors !== 1 ? 's' : ''}`}
            </span>
          </div>
        )}

        {/* Scrollable Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-8">#</th>
                {columns.map(col => (
                  <th
                    key={col.id}
                    className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {editData.map((peptide, rowIndex) => (
                <tr
                  key={peptide.peptideId || rowIndex}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750"
                >
                  <td className="px-2 py-1 text-xs text-gray-400 dark:text-gray-500 align-middle">
                    {rowIndex + 1}
                  </td>
                  {columns.map(col => (
                    <td key={col.id} className="px-1 py-1">
                      {col.readOnly ? (
                        <span className="px-2 py-1 text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {peptide[col.id] || '-'}
                        </span>
                      ) : (
                        <input
                          type={col.type}
                          value={peptide[col.id] ?? ''}
                          onChange={(e) => handleChange(rowIndex, col.id, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          className={`${col.width || 'w-full'} px-2 py-1 text-sm border rounded
                            ${isModified(rowIndex, col.id)
                              ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white'
                              : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white'
                            }
                            focus:ring-1 focus:ring-blue-500 focus:border-blue-500
                            placeholder-gray-400 dark:placeholder-gray-500
                          `}
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

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center justify-between flex-shrink-0">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Modified cells are highlighted. Click Save All to persist changes.
          </p>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSaveAll}
              disabled={!hasChanges || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : `Save All${hasChanges ? ` (${new Set([...modified].map(k => k.split('-')[0])).size} rows)` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

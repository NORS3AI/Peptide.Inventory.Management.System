import { useState, useRef, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, Eye, EyeOff } from 'lucide-react';

export default function ColumnReorderModal({ columns, hiddenColumns = [], onReorder, onVisibilityChange, onClose }) {
  const [columnList, setColumnList] = useState([...columns]);
  const [hidden, setHidden] = useState(new Set(hiddenColumns));
  const modalRef = useRef(null);

  // Move column up in the list
  const moveUp = (index) => {
    if (index === 0) return;
    const newList = [...columnList];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setColumnList(newList);
  };

  // Move column down in the list
  const moveDown = (index) => {
    if (index === columnList.length - 1) return;
    const newList = [...columnList];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setColumnList(newList);
  };

  // Toggle column visibility
  const toggleVisibility = (columnId) => {
    const newHidden = new Set(hidden);
    if (newHidden.has(columnId)) {
      newHidden.delete(columnId);
    } else {
      newHidden.add(columnId);
    }
    setHidden(newHidden);
  };

  // Apply changes
  const handleSave = () => {
    onReorder(columnList);
    if (onVisibilityChange) {
      onVisibilityChange(Array.from(hidden));
    }
    onClose();
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-30 z-[999]" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col z-[1000]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Manage Columns</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Reorder and show/hide columns</p>
          </div>
          <button
            onClick={onClose}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900 rounded-full p-1 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Column List */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {columnList.map((column, index) => {
              const isHidden = hidden.has(column.id);
              return (
                <div
                  key={column.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    isHidden
                      ? 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 opacity-60'
                      : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Visibility Checkbox */}
                  <label className="flex items-center cursor-pointer" title={isHidden ? 'Show column' : 'Hide column'}>
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => toggleVisibility(column.id)}
                      className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                    />
                  </label>

                  {/* Order Number */}
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    isHidden
                      ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Column Label */}
                  <div className={`flex-1 font-medium ${
                    isHidden ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'
                  }`}>
                    {column.label}
                  </div>

                  {/* Hidden Icon */}
                  {isHidden && (
                    <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}

                  {/* Up/Down Buttons */}
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className={`p-1.5 rounded transition-colors ${
                        index === 0
                          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900'
                      }`}
                      aria-label="Move up"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === columnList.length - 1}
                      className={`p-1.5 rounded transition-colors ${
                        index === columnList.length - 1
                          ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900'
                      }`}
                      aria-label="Move down"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Apply Order
          </button>
        </div>
      </div>
    </>
  );
}

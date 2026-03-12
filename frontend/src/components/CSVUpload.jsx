import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, X, Trash2, AlertTriangle } from 'lucide-react';
import { parseInventoryCSV, generateSampleCSV, downloadCSV } from '../utils/csvParser';
import { db } from '../lib/db';
import ExclusionManager from './ExclusionManager';

export default function CSVUpload({ onImportComplete }) {
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [importMode, setImportMode] = useState('update'); // 'replace' or 'update' - default to 'update'
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer?.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  }, [importMode]);

  const handleChange = (e) => {
    e.preventDefault();
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFile = async (file) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    // If replace mode, show confirmation dialog first
    if (importMode === 'replace') {
      setPendingFile(file);
      setShowReplaceConfirm(true);
      return;
    }

    // Otherwise proceed with import
    await processFile(file);
  };

  const handleReplaceConfirm = async () => {
    setShowReplaceConfirm(false);
    if (pendingFile) {
      await processFile(pendingFile);
      setPendingFile(null);
    }
  };

  const handleReplaceCancel = () => {
    setShowReplaceConfirm(false);
    setPendingFile(null);
  };

  const processFile = async (file) => {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      // Load exclusions from settings
      const excludedProducts = await db.settings.get('exclusions').catch(() => null) || [
        'OATH-A1-TEST',
        'a1 test',
        'OATH-GH-FRAGMENT-176-191-5MG',
        'OATH-GIFT-CARD',
        'gift card',
        'OATH-NAD+-1000MG',
        'OATH-SS-31-10MG',
        'OATH-TESA-IPA-10-5'
      ];

      // Parse CSV with exclusions
      const parseResult = await parseInventoryCSV(file, { excludedProducts });

      let importedCount = 0;
      let updatedCount = 0;

      if (importMode === 'replace') {
        // Clear all existing data first
        await db.peptides.clear();

        // Import all new data
        await db.peptides.bulkImport(parseResult.peptides);
        importedCount = parseResult.peptides.length;
      } else {
        // Update mode: update quantity AND adjust labeled count proportionally
        for (const peptide of parseResult.peptides) {
          const existing = await db.peptides.get(peptide.peptideId);
          if (existing) {
            // Calculate delta: how much quantity changed
            const oldQuantity = existing.quantity || 0;
            const newQuantity = peptide.quantity || 0;
            const delta = newQuantity - oldQuantity;

            // Apply same delta to labeled count
            const oldLabeled = existing.labeledCount || 0;
            let newLabeled = oldLabeled + delta;

            // Ensure labeled is between 0 and new quantity
            newLabeled = Math.max(0, Math.min(newLabeled, newQuantity));

            // Update quantity AND labeled count
            await db.peptides.update(peptide.peptideId, {
              quantity: newQuantity,
              labeledCount: newLabeled
            });
            updatedCount++;
          } else {
            // Add new peptide with all CSV fields
            await db.peptides.set(peptide.peptideId, peptide);
            importedCount++;
          }
        }
      }

      setResult({
        success: true,
        mode: importMode,
        imported: importedCount,
        updated: updatedCount,
        total: parseResult.peptides.length,
        meta: parseResult.meta
      });

      // Notify parent component
      if (onImportComplete) {
        onImportComplete(parseResult.peptides);
      }

    } catch (err) {
      setError(err.message || 'Failed to import CSV');
      setResult(null);
    } finally {
      setImporting(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await db.peptides.clear();
      setShowClearConfirm(false);
      setResult({
        success: true,
        cleared: true
      });
      if (onImportComplete) {
        onImportComplete([]);
      }
    } catch (err) {
      setError('Failed to clear inventory: ' + err.message);
    } finally {
      setClearing(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleCSV = generateSampleCSV();
    downloadCSV(sampleCSV, 'oath-inventory-sample.csv');
  };

  const clearResult = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Import Mode Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Import Mode</h3>
        <div className="space-y-3">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="radio"
              name="importMode"
              value="replace"
              checked={importMode === 'replace'}
              onChange={(e) => setImportMode(e.target.value)}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Replace All Inventory</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Clear existing data and import fresh. Use this for full inventory updates.
              </div>
            </div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="radio"
              name="importMode"
              value="update"
              checked={importMode === 'update'}
              onChange={(e) => setImportMode(e.target.value)}
              className="mt-1"
            />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Update Existing Inventory</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Update quantities + auto-adjust labeled counts (labeled tracks with quantity changes). Preserves all manually edited fields (purity, batch #, etc.).
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}
          ${importing ? 'opacity-50 pointer-events-none' : 'hover:border-gray-400 dark:hover:border-gray-500'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="csv-upload"
          accept=".csv"
          onChange={handleChange}
          className="hidden"
          disabled={importing}
        />

        <Upload className={`w-16 h-16 mx-auto mb-4 ${dragActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />

        <div className="space-y-2">
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {importing ? 'Importing...' : 'Drop your CSV file here'}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            or{' '}
            <label
              htmlFor="csv-upload"
              className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium"
            >
              browse to upload
            </label>
          </p>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          Mode: <span className="font-semibold">
            {importMode === 'replace' ? 'Replace All' : 'Update Existing'}
          </span>
        </p>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={handleDownloadSample}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span>Download Sample CSV</span>
        </button>
        <ExclusionManager />
        <button
          onClick={() => setShowClearConfirm(true)}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 border border-red-300 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>Clear All Data</span>
        </button>
      </div>

      {/* Replace All Confirmation Dialog */}
      {showReplaceConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-start space-x-4">
              <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Replace All Inventory?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This will delete all existing inventory data and replace it with the data from this CSV file.
                  Any manually edited fields will be lost.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleReplaceConfirm}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
                  >
                    Yes, Replace All
                  </button>
                  <button
                    onClick={handleReplaceCancel}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-start space-x-4">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Clear All Inventory Data?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  This will permanently delete all peptides from your inventory. This action cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleClearAll}
                    disabled={clearing}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-medium"
                  >
                    {clearing ? 'Clearing...' : 'Yes, Clear All'}
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    disabled={clearing}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Result */}
      {result && result.success && !result.cleared && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-900">Import Successful!</h3>
              <div className="mt-2 text-sm text-green-800">
                {result.mode === 'replace' ? (
                  <p>Replaced all inventory with <strong>{result.imported}</strong> peptides.</p>
                ) : (
                  <>
                    <p>
                      <strong>{result.updated}</strong> existing peptide{result.updated !== 1 ? 's' : ''} updated.
                    </p>
                    <p>
                      <strong>{result.imported}</strong> new peptide{result.imported !== 1 ? 's' : ''} added.
                    </p>
                  </>
                )}
                {result.meta.validRows < result.meta.totalRows && (
                  <p className="mt-1">
                    Skipped {result.meta.totalRows - result.meta.validRows} invalid/excluded rows.
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={clearResult}
              className="ml-3 text-green-600 hover:text-green-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Clear Success */}
      {result && result.cleared && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-900">All Data Cleared</h3>
              <div className="mt-2 text-sm text-green-800">
                <p>All inventory data has been removed. Ready for fresh import.</p>
              </div>
            </div>
            <button
              onClick={clearResult}
              className="ml-3 text-green-600 hover:text-green-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Error Result */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-900">Import Failed</h3>
              <div className="mt-2 text-sm text-red-800">
                <p>{error}</p>
              </div>
            </div>
            <button
              onClick={clearResult}
              className="ml-3 text-red-600 hover:text-red-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">CSV Format Requirements</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Required columns: Product, SKU, Quantity</li>
          <li>Optional columns: Size, Batch Number, Purity, Velocity, Status, etc.</li>
          <li>First row must contain headers</li>
          <li>All Product IDs must be unique</li>
          <li>Download the sample CSV to see the correct format</li>
        </ul>
      </div>
    </div>
  );
}

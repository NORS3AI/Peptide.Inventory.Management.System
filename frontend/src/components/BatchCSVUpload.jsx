import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle2, X, Trash2, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import { db } from '../lib/db';

// CSV column mapping: header name -> our field name
const COLUMN_MAP = {
  '#': 'rowNum',
  'vendor': 'vendor',
  'id': 'productId',
  'name': 'name',
  'mg/ml': 'mgMl',
  '$/vial': 'pricePerVial_override',
  '$/box': 'pricePerBox',
  'qty purchased': 'qtyPurchased',
  'total/qty': 'totalQty_override',
  'comp1': 'comp1',
  'comp2': 'comp2',
  'comp3': 'comp3',
  'srg sale': 'srgSale',
  'profit/vial $': 'profitPerVial_override',
  'profit/vial %': 'profitPerVialPct_override',
  'profit/batch': 'profitPerBatch_override',
};

function mapRow(row, index) {
  const item = { rowNum: index + 1 };
  for (const [csvHeader, value] of Object.entries(row)) {
    const normalized = csvHeader.trim().toLowerCase();
    const fieldId = COLUMN_MAP[normalized];
    if (fieldId) {
      // Clean currency symbols and percentage signs
      let cleaned = String(value || '').replace(/[$,%]/g, '').trim();
      item[fieldId] = cleaned;
    }
  }
  return item;
}

export default function BatchCSVUpload({ onImportComplete }) {
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [importMode, setImportMode] = useState('replace');
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = e.dataTransfer?.files;
    if (files && files[0]) handleFile(files[0]);
  }, [importMode]);

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const handleFile = async (file) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }
    if (importMode === 'replace') {
      setPendingFile(file);
      setShowReplaceConfirm(true);
      return;
    }
    await processFile(file);
  };

  const processFile = async (file) => {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        const errMsg = parsed.errors.slice(0, 3).map(e => e.message).join('; ');
        throw new Error(`CSV parse errors: ${errMsg}`);
      }

      const rows = parsed.data.map((row, i) => mapRow(row, i)).filter(r => r.productId || r.name);

      let importedCount = 0;
      let updatedCount = 0;

      if (importMode === 'replace') {
        await db.batches.clear();
        await db.batches.bulkImport(rows);
        importedCount = rows.length;
      } else {
        // Update mode: match by productId
        const existing = await db.batches.getAll();
        const existingMap = new Map(existing.map(e => [e.productId, e]));

        for (const row of rows) {
          const match = existingMap.get(row.productId);
          if (match) {
            await db.batches.update(match.id, row);
            updatedCount++;
          } else {
            await db.batches.set(`batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, row);
            importedCount++;
          }
        }
      }

      setResult({ success: true, mode: importMode, imported: importedCount, updated: updatedCount, total: rows.length });
      if (onImportComplete) onImportComplete();
    } catch (err) {
      setError(err.message || 'Failed to import batch CSV');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadSample = () => {
    const headers = ['#', 'Vendor', 'ID', 'Name', 'MG/ML', '$/Vial', '$/Box', 'QTY Purchased', 'Total/Qty', 'COMP1', 'COMP2', 'COMP3', 'SRG Sale', 'Profit/Vial $', 'Profit/Vial %', 'Profit/Batch'];
    const sample = [
      ['1', 'Belgium', 'BPC-157', 'BPC-157 5mg', '5mg', '$3.50', '$35.00', '20', '$70.00', '$45.00', '$42.00', '$48.00', '$44.99', '$41.49', '1185.4%', '$829.80'],
      ['2', 'Belgium', 'TB-500', 'Thymosin Beta-4 5mg', '5mg', '$4.00', '$40.00', '10', '$40.00', '$55.00', '$50.00', '$52.00', '$49.99', '$45.99', '1149.8%', '$459.90'],
    ];
    const csv = [headers.join(','), ...sample.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'srg-batch-sample.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Import Mode */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Batch Import Mode</h3>
        <div className="space-y-3">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input type="radio" name="batchImportMode" value="replace" checked={importMode === 'replace'} onChange={e => setImportMode(e.target.value)} className="mt-1" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Replace All Batch Data</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Clear existing batch data and import fresh.</div>
            </div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer">
            <input type="radio" name="batchImportMode" value="update" checked={importMode === 'update'} onChange={e => setImportMode(e.target.value)} className="mt-1" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Update Existing</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Match by ID and update; add new items that don't exist.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
        } ${importing ? 'opacity-50 pointer-events-none' : 'hover:border-gray-400 dark:hover:border-gray-500'}`}
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
      >
        <input type="file" id="batch-csv-upload" accept=".csv" onChange={handleChange} className="hidden" disabled={importing} />
        <Upload className={`w-16 h-16 mx-auto mb-4 ${dragActive ? 'text-blue-600' : 'text-gray-400 dark:text-gray-500'}`} />
        <p className="text-lg font-medium text-gray-900 dark:text-white">{importing ? 'Importing...' : 'Drop Batch CSV here'}</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          or <label htmlFor="batch-csv-upload" className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">browse to upload</label>
        </p>
        <p className="text-xs text-gray-500 mt-4">Mode: <span className="font-semibold">{importMode === 'replace' ? 'Replace All' : 'Update Existing'}</span></p>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button onClick={handleDownloadSample}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700">
          <FileText className="w-4 h-4" /><span>Download Sample CSV</span>
        </button>
        <button onClick={async () => { await db.batches.clear(); setResult({ success: true, cleared: true }); if (onImportComplete) onImportComplete(); }}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2 border border-red-300 dark:border-red-700 rounded-lg text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/20">
          <Trash2 className="w-4 h-4" /><span>Clear Batch Data</span>
        </button>
      </div>

      {/* Replace Confirm */}
      {showReplaceConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-start space-x-4">
              <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Replace All Batch Data?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">This will delete all existing batch data and replace with the CSV.</p>
                <div className="flex gap-3">
                  <button onClick={() => { setShowReplaceConfirm(false); if (pendingFile) { processFile(pendingFile); setPendingFile(null); } }}
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium">Yes, Replace</button>
                  <button onClick={() => { setShowReplaceConfirm(false); setPendingFile(null); }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {result?.success && !result.cleared && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-900 dark:text-green-200">Batch Import Successful!</h3>
              <div className="mt-2 text-sm text-green-800 dark:text-green-300">
                {result.mode === 'replace' ? (
                  <p>Replaced all batch data with <strong>{result.imported}</strong> items.</p>
                ) : (
                  <><p><strong>{result.updated}</strong> updated, <strong>{result.imported}</strong> new.</p></>
                )}
              </div>
            </div>
            <button onClick={() => setResult(null)} className="ml-3 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}
      {result?.cleared && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="ml-3"><h3 className="text-sm font-medium text-green-900 dark:text-green-200">Batch data cleared.</h3></div>
            <button onClick={() => setResult(null)} className="ml-auto text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-900 dark:text-red-200">Import Failed</h3>
              <p className="mt-1 text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      {/* Format info */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Batch CSV Format</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>Required columns: #, Vendor, ID, Name, MG/ML, $/Box, QTY Purchased</li>
          <li>Optional: $/Vial, Total/Qty, COMP1-3, SRG Sale, Profit columns</li>
          <li>Calculated fields ($/Vial, Total/Qty, Profit) auto-compute if not provided</li>
          <li>Download the sample CSV to see the correct format</li>
        </ul>
      </div>
    </div>
  );
}

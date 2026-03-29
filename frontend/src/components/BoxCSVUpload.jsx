import { useState, useCallback } from 'react';
import { Upload, AlertCircle, CheckCircle2, X, Trash2, AlertTriangle } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { db } from '../lib/db';

const COLUMN_MAP = {
  'box type': 'name',
  'box name': 'name',
  'name': 'name',
  'description': 'name',
  'item': 'name',
  'product': 'name',
  'supplier': 'supplier',
  'vendor': 'supplier',
  'source': 'supplier',
  'sku': 'sku',
  'part #': 'sku',
  'part number': 'sku',
  'item #': 'sku',
  'item number': 'sku',
  'on hand': 'onHand',
  'qty': 'onHand',
  'quantity': 'onHand',
  'stock': 'onHand',
  'in stock': 'onHand',
  'on order': 'onOrder',
  'ordered': 'onOrder',
  'qty ordered': 'onOrder',
  'daily usage': 'dailyUsage',
  'usage': 'dailyUsage',
  'daily': 'dailyUsage',
  'use/day': 'dailyUsage',
  'cost': 'costPerUnit',
  'cost/unit': 'costPerUnit',
  'unit cost': 'costPerUnit',
  'price': 'costPerUnit',
  'unit price': 'costPerUnit',
  'cost/case': 'costPerCase',
  'case cost': 'costPerCase',
  'case price': 'costPerCase',
  'units/case': 'unitsPerCase',
  'units per case': 'unitsPerCase',
  'pack size': 'unitsPerCase',
  'case qty': 'unitsPerCase',
  'reorder point': 'reorderPoint',
  'reorder': 'reorderPoint',
  'min stock': 'reorderPoint',
  'last ordered': 'lastOrdered',
  'order date': 'lastOrdered',
  'date': 'lastOrdered',
  'notes': 'notes',
  'comments': 'notes',
  'total': 'invoiceTotal',
  'invoice total': 'invoiceTotal',
  'amount': 'invoiceTotal',
};

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

function isAcceptedFile(name) {
  return ACCEPTED_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));
}

function isExcelFile(name) {
  return name.toLowerCase().endsWith('.xlsx') || name.toLowerCase().endsWith('.xls');
}

function mapRow(row, index) {
  const item = {};
  for (const [csvHeader, value] of Object.entries(row)) {
    const normalized = csvHeader.trim().toLowerCase();
    const fieldId = COLUMN_MAP[normalized];
    if (fieldId) {
      let cleaned = String(value || '').replace(/[$,%]/g, '').trim();
      item[fieldId] = cleaned;
    }
  }
  // Try to derive costPerUnit from costPerCase and unitsPerCase if missing
  if (!item.costPerUnit && item.costPerCase && item.unitsPerCase) {
    const caseC = Number(item.costPerCase);
    const units = Number(item.unitsPerCase);
    if (!isNaN(caseC) && units > 0) {
      item.costPerUnit = (caseC / units).toFixed(4);
    }
  }
  return item;
}

async function parseFile(file) {
  if (isExcelFile(file.name)) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  } else {
    const text = await file.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      const errMsg = parsed.errors.slice(0, 3).map(e => e.message).join('; ');
      throw new Error(`CSV parse errors: ${errMsg}`);
    }
    return parsed.data;
  }
}

export default function BoxCSVUpload({ onImportComplete }) {
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [importMode, setImportMode] = useState('update');
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
    const files = e.target.files;
    if (files && files[0]) handleFile(files[0]);
  };

  const handleFile = async (file) => {
    if (!isAcceptedFile(file.name)) {
      setError('Please upload a CSV or Excel file');
      return;
    }
    if (importMode === 'replace') {
      setPendingFile(file);
      setShowReplaceConfirm(true);
      return;
    }
    await processFile(file);
  };

  const handleReplaceConfirm = async () => {
    setShowReplaceConfirm(false);
    if (pendingFile) {
      await processFile(pendingFile);
      setPendingFile(null);
    }
  };

  const processFile = async (file) => {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const rawData = await parseFile(file);
      const rows = rawData.map((row, i) => mapRow(row, i)).filter(r => r.name);

      if (rows.length === 0) {
        throw new Error('No valid box data found. Ensure your file has a "Name" or "Box Type" column.');
      }

      let importedCount = 0;
      let updatedCount = 0;

      if (importMode === 'replace') {
        await db.boxes.clear();
        await db.boxes.bulkImport(rows);
        importedCount = rows.length;
      } else {
        // Update mode: match by name+supplier or name
        const existing = await db.boxes.getAll();
        const existingMap = {};
        existing.forEach(item => {
          const key = `${(item.name || '').toLowerCase()}|${(item.supplier || '').toLowerCase()}`;
          existingMap[key] = item;
        });

        for (const row of rows) {
          const key = `${(row.name || '').toLowerCase()}|${(row.supplier || '').toLowerCase()}`;
          const match = existingMap[key];
          if (match) {
            // Update existing - merge new data over old
            const updates = {};
            for (const [field, val] of Object.entries(row)) {
              if (val !== undefined && val !== '') updates[field] = val;
            }
            await db.boxes.update(match.id, updates);
            updatedCount++;
          } else {
            await db.boxes.bulkImport([row]);
            importedCount++;
          }
        }
      }

      setResult({
        success: true,
        mode: importMode,
        imported: importedCount,
        updated: updatedCount,
        total: rows.length,
      });

      if (onImportComplete) onImportComplete();
    } catch (err) {
      setError(err.message || 'Failed to import file');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Import Mode */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Import Mode</h3>
        <div className="space-y-3">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input type="radio" name="boxImportMode" value="update" checked={importMode === 'update'} onChange={(e) => setImportMode(e.target.value)} className="mt-1" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Update Existing Inventory</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Match by name+supplier. Update existing, add new.</div>
            </div>
          </label>
          <label className="flex items-start space-x-3 cursor-pointer">
            <input type="radio" name="boxImportMode" value="replace" checked={importMode === 'replace'} onChange={(e) => setImportMode(e.target.value)} className="mt-1" />
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Replace All Box Data</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Clear existing box data and import fresh.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${dragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'}
          ${importing ? 'opacity-50 pointer-events-none' : 'hover:border-gray-400 dark:hover:border-gray-500'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input type="file" id="box-upload" accept=".csv,.xlsx,.xls" onChange={handleChange} className="hidden" disabled={importing} />
        <Upload className={`w-16 h-16 mx-auto mb-4 ${dragActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500'}`} />
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          {importing ? 'Importing...' : 'Drop your box invoice file here'}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          or <label htmlFor="box-upload" className="text-blue-600 hover:text-blue-700 cursor-pointer font-medium">browse to upload</label>
        </p>
        <p className="text-xs text-gray-500 mt-4">
          Accepts CSV and Excel (.xlsx, .xls) &middot; Mode: <span className="font-semibold">{importMode === 'replace' ? 'Replace All' : 'Update Existing'}</span>
        </p>
      </div>

      {/* Replace Confirmation */}
      {showReplaceConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-start space-x-4">
              <AlertTriangle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Replace All Box Data?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">This will delete all existing box data and replace it.</p>
                <div className="flex gap-3">
                  <button onClick={handleReplaceConfirm} className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium">Yes, Replace</button>
                  <button onClick={() => { setShowReplaceConfirm(false); setPendingFile(null); }} className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && result.success && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-900 dark:text-green-200">Import Successful!</h3>
              <div className="mt-2 text-sm text-green-800 dark:text-green-300">
                {result.mode === 'replace' ? (
                  <p>Replaced all box data with <strong>{result.imported}</strong> entries.</p>
                ) : (
                  <>
                    <p><strong>{result.updated}</strong> existing box{result.updated !== 1 ? 'es' : ''} updated.</p>
                    <p><strong>{result.imported}</strong> new box{result.imported !== 1 ? 'es' : ''} added.</p>
                  </>
                )}
              </div>
            </div>
            <button onClick={() => setResult(null)} className="ml-3 text-green-600 dark:text-green-400 hover:text-green-800"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-900 dark:text-red-200">Import Failed</h3>
              <p className="mt-2 text-sm text-red-800 dark:text-red-300">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="ml-3 text-red-600 dark:text-red-400 hover:text-red-800"><X className="w-5 h-5" /></button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Box Invoice Format</h3>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
          <li>Required: Name/Box Type column</li>
          <li>Supported: Supplier, SKU, Qty, Cost, Cost/Case, Units/Case, On Order, Daily Usage, Reorder Point, Notes</li>
          <li>Cost per unit auto-calculated from Case Cost / Units per Case if not provided</li>
          <li>Accepts CSV and Excel files (.csv, .xlsx, .xls)</li>
        </ul>
      </div>
    </div>
  );
}

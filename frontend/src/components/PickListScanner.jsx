import { useState, useRef } from 'react';
import { Camera, ScanLine, FileText, Plus, Trash2, Check, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import Tesseract from 'tesseract.js';
import db from '../lib/db';

/**
 * Pick List Scanner - OCR-Powered Inventory Deduction
 *
 * Photograph paper pick lists and let OCR automatically read product names
 * and quantities. The system aggregates totals across all scanned sheets
 * and deducts from labeled inventory in one tap.
 *
 * Two template modes:
 *   Template A: Structured pick list (table/grid format)
 *   Template B: Large text format with product images
 */

export default function PickListScanner({ peptides, onRefresh }) {
  const [template, setTemplate] = useState('structured'); // 'structured' or 'visual'
  const [scannedItems, setScannedItems] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  // Parse OCR text to extract product names and quantities
  const parseOCRText = (text) => {
    const items = [];
    const lines = text.split('\n').filter(line => line.trim());

    // Look for patterns like:
    // "Product Name ... 5" or "Product Name x5" or "5 Product Name"
    // Also handle multi-word product names
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Try to extract quantity and product name
      // Pattern 1: "Product Name ... 5" or "Product Name 5"
      let match = line.match(/^(.+?)\s+[.:x×]?\s*(\d+)\s*$/i);
      if (!match) {
        // Pattern 2: "5 Product Name" or "x5 Product Name"
        match = line.match(/^[x×]?\s*(\d+)\s+(.+)$/i);
        if (match) {
          const quantity = parseInt(match[1]);
          const productText = match[2].trim();
          if (quantity > 0) {
            items.push({ text: productText, quantity });
          }
        }
      } else {
        const productText = match[1].trim();
        const quantity = parseInt(match[2]);
        if (quantity > 0) {
          items.push({ text: productText, quantity });
        }
      }
    }

    return items;
  };

  // Match extracted text against peptide inventory
  const matchProducts = (extractedItems) => {
    const matched = [];

    for (const item of extractedItems) {
      const searchText = item.text.toLowerCase();

      // Try to find matching peptide
      const peptide = peptides.find(p => {
        const nameMatch = p.peptideName?.toLowerCase().includes(searchText) ||
                         searchText.includes(p.peptideName?.toLowerCase());
        const idMatch = p.peptideId?.toLowerCase().includes(searchText) ||
                       searchText.includes(p.peptideId?.toLowerCase());
        const nicknameMatch = p.nickname?.toLowerCase().includes(searchText) ||
                             searchText.includes(p.nickname?.toLowerCase());
        return nameMatch || idMatch || nicknameMatch;
      });

      if (peptide) {
        matched.push({
          productId: peptide.peptideId,
          productName: peptide.nickname || peptide.peptideName || peptide.peptideId,
          quantity: item.quantity,
          extractedText: item.text
        });
      } else {
        // Keep unmatched items for manual review
        matched.push({
          productId: 'UNMATCHED',
          productName: item.text,
          quantity: item.quantity,
          extractedText: item.text,
          unmatched: true
        });
      }
    }

    return matched;
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Create image preview
    const imageUrl = URL.createObjectURL(file);
    setUploadedImage(imageUrl);
    setScanning(true);
    setOcrProgress(0);

    let worker = null;
    try {
      // Create Tesseract worker with proper configuration
      worker = await Tesseract.createWorker('eng', 1, {
        logger: (m) => {
          console.log('Tesseract:', m);
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        },
        // Use CDN for worker files
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
        langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tessdata',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5',
      });

      console.log('Worker created, starting OCR...');

      // Run OCR
      const result = await worker.recognize(file);

      console.log('OCR completed:', result.data.text);

      // Parse OCR text
      const extractedItems = parseOCRText(result.data.text);
      console.log('Extracted items:', extractedItems);

      // Match against inventory
      const matchedItems = matchProducts(extractedItems);
      console.log('Matched items:', matchedItems);

      // Add to scanned items (aggregate duplicates)
      setScannedItems(prev => {
        const updated = [...prev];
        for (const item of matchedItems) {
          const existing = updated.find(i => i.productId === item.productId);
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            updated.push(item);
          }
        }
        return updated;
      });

      if (matchedItems.length === 0) {
        alert('No products found in image. Try a clearer photo or adjust the angle.');
      }

    } catch (error) {
      console.error('OCR failed:', error);

      // Provide specific error messages based on error type
      let errorTitle = 'OCR Scan Failed';
      let errorDetails = '';
      let suggestions = [];

      if (error.message?.includes('network') || error.message?.includes('fetch') || error.message?.includes('CORS')) {
        errorTitle = 'Network Error';
        errorDetails = 'Could not download OCR engine files from the internet.';
        suggestions = [
          'Check your internet connection',
          'Try disabling browser extensions that block requests',
          'Check if your firewall is blocking cdn.jsdelivr.net',
          'Try refreshing the page and scanning again'
        ];
      } else if (error.message?.includes('image') || error.message?.includes('format')) {
        errorTitle = 'Image Format Error';
        errorDetails = 'The image format is not supported or the file is corrupted.';
        suggestions = [
          'Try a different image format (JPG, PNG work best)',
          'Make sure the image file is not corrupted',
          'Try taking a new photo'
        ];
      } else if (error.message?.includes('timeout')) {
        errorTitle = 'Processing Timeout';
        errorDetails = 'OCR took too long to process the image.';
        suggestions = [
          'Try a smaller image (reduce photo resolution)',
          'Crop the image to only show the pick list',
          'Close other browser tabs to free up memory'
        ];
      } else if (error.message?.includes('memory') || error.message?.includes('heap')) {
        errorTitle = 'Memory Error';
        errorDetails = 'Not enough memory to process the image.';
        suggestions = [
          'Try a smaller image file',
          'Close other browser tabs',
          'Restart your browser',
          'Try using a desktop computer if on mobile'
        ];
      } else {
        errorDetails = `Technical error: ${error.message || 'Unknown error'}`;
        suggestions = [
          'Check browser console (F12) for details',
          'Try a clearer, well-lit photo',
          'Ensure text is horizontal and readable',
          'Make sure the image is in focus',
          'Try refreshing the page'
        ];
      }

      const fullMessage = `${errorTitle}\n\n${errorDetails}\n\n💡 Try these solutions:\n${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
      alert(fullMessage);
    } finally {
      // Clean up worker
      if (worker) {
        try {
          await worker.terminate();
        } catch (e) {
          console.error('Failed to terminate worker:', e);
        }
      }
      setScanning(false);
      setOcrProgress(0);
      setUploadedImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveItem = (index) => {
    setScannedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleApplyDeductions = async () => {
    try {
      for (const item of scannedItems) {
        if (item.unmatched) continue; // Skip unmatched items

        const peptide = await db.peptides.get(item.productId);
        if (peptide) {
          const currentLabeled = peptide.labeledCount || 0;
          const newLabeled = Math.max(0, currentLabeled - item.quantity);
          await db.peptides.update(item.productId, { labeledCount: newLabeled });
        }
      }

      // Clear scanned items and refresh
      setScannedItems([]);
      if (onRefresh) await onRefresh();

      alert(`Successfully deducted ${scannedItems.filter(i => !i.unmatched).length} products from labeled inventory!`);
    } catch (error) {
      console.error('Failed to apply deductions:', error);
      alert('Failed to apply deductions. Please try again.');
    }
  };

  const totalItems = scannedItems.reduce((sum, item) => sum + item.quantity, 0);
  const uniqueProducts = new Set(scannedItems.map(i => i.productId)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <ScanLine className="w-7 h-7" />
          <h2 className="text-xl font-bold">Pick List Scanner</h2>
          <span className="px-2 py-0.5 bg-green-500/90 backdrop-blur rounded-full text-xs font-semibold uppercase tracking-wide">
            Live OCR
          </span>
        </div>
        <p className="text-white/80 text-sm max-w-2xl">
          Photograph your paper pick lists and let OCR automatically read product names and quantities.
          The system aggregates totals across all scanned sheets and deducts from your labeled inventory in one tap.
        </p>
      </div>

      {/* Template Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Pick List Template</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setTemplate('structured')}
            className={`relative p-4 rounded-xl border-2 text-left transition-all ${
              template === 'structured'
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 ring-2 ring-indigo-300 dark:ring-indigo-700'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Template A</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Structured Pick List</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Table/grid format with columns for product name, net weight, and quantity.
            </p>
            {template === 'structured' && (
              <div className="absolute top-3 right-3">
                <Check className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            )}
          </button>

          <button
            onClick={() => setTemplate('visual')}
            className={`relative p-4 rounded-xl border-2 text-left transition-all ${
              template === 'visual'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-300 dark:ring-purple-700'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                <Camera className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Template B</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Visual / Large Text</p>
              </div>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Larger text format, sometimes with product images. Less structured layout.
            </p>
            {template === 'visual' && (
              <div className="absolute top-3 right-3">
                <Check className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Template Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Template Preview - {template === 'structured' ? 'Template A (Structured)' : 'Template B (Visual)'}
            </h3>
          </div>
          {showPreview ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {showPreview && (
          <div className="px-6 pb-6">
            {template === 'structured' ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This is an example of Template A - the structured pick list format with table/grid layout.
                </p>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-900 p-8">
                  <div className="text-center">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                      Template image will be added here
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Upload template-a.jpg to frontend/src/assets/templates/
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 italic">
                  OCR will extract product names, net weights, and quantities from this format.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Template B preview will be added once a sample image is provided.
                </p>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center">
                  <Camera className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-400 dark:text-gray-600">
                    Template B example coming soon
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scan Area */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Scan Pick Lists</h3>
        <div
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
          onClick={!scanning ? handleCapture : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          {scanning ? (
            <>
              {uploadedImage && (
                <div className="mb-4 max-w-sm mx-auto">
                  <img src={uploadedImage} alt="Scanning..." className="w-full rounded-lg shadow-md" />
                </div>
              )}
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mb-4"></div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Reading text from image...</p>
              {ocrProgress > 0 && (
                <div className="mt-3 max-w-xs mx-auto">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-indigo-600 dark:bg-indigo-400 h-2 rounded-full transition-all"
                      style={{ width: `${ocrProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ocrProgress}%</p>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Using Template {template === 'structured' ? 'A (Structured)' : 'B (Visual)'}
              </p>
            </>
          ) : (
            <>
              <Camera className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                Tap to photograph a pick list
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Or upload an image from your gallery
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">
                Using Template {template === 'structured' ? 'A (Structured)' : 'B (Visual)'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Running Tally */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Running Tally</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              <span className="font-bold text-gray-900 dark:text-white">{uniqueProducts}</span> products
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              <span className="font-bold text-gray-900 dark:text-white">{totalItems}</span> total units
            </span>
          </div>
        </div>

        {scannedItems.length === 0 ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-600">
            <ScanLine className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">No items scanned yet</p>
            <p className="text-xs mt-1">Scan pick lists above to start building your tally</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {scannedItems.map((item, index) => (
              <div
                key={index}
                className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                  item.unmatched
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                    : 'bg-gray-50 dark:bg-gray-700/50'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${
                      item.unmatched
                        ? 'text-red-900 dark:text-red-200'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {item.productName}
                    </p>
                    {item.unmatched && (
                      <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-xs rounded-full font-medium">
                        No Match
                      </span>
                    )}
                  </div>
                  <p className={`text-xs ${
                    item.unmatched
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {item.unmatched ? `OCR: "${item.extractedText}"` : item.productId}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${
                    item.unmatched
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-indigo-600 dark:text-indigo-400'
                  }`}>
                    x{item.quantity}
                  </span>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply Button */}
      <div className="flex gap-3">
        <button
          onClick={handleApplyDeductions}
          disabled={scannedItems.length === 0}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="w-5 h-5" />
          Apply Deductions to Labeled Counts
        </button>
        {scannedItems.length > 0 && (
          <button
            onClick={() => setScannedItems([])}
            className="px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Clear
          </button>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">How It Works</h4>
            <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
              <li>Select your pick list template (A or B)</li>
              <li>Photograph each pick list sheet — scan as many as needed</li>
              <li>OCR reads product names and quantities from each photo</li>
              <li>The system aggregates totals across all scanned sheets</li>
              <li>Review the running tally, remove unmatched items or correct quantities</li>
              <li>Tap "Apply" to deduct from labeled inventory counts</li>
            </ol>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 italic">
              ✓ OCR is now live using Tesseract.js. Unmatched items are highlighted in red for manual review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

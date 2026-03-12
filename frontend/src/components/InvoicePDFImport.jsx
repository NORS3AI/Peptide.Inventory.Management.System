import { useState, useCallback, useMemo } from 'react';
import { Upload, FileText, Check, X, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { db } from '../lib/db';
import { useToast } from './Toast';

// Set up PDF.js worker - force https for mobile compatibility
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function InvoicePDFImport({ peptides, onImportComplete }) {
  const [file, setFile] = useState(null);
  const [extractedItems, setExtractedItems] = useState([]);
  const [mappings, setMappings] = useState({});
  const [targetColumn, setTargetColumn] = useState('price');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [step, setStep] = useState('upload'); // 'upload', 'mapping', 'preview'
  const [inputMode, setInputMode] = useState('text'); // 'pdf' or 'text' - default to text for mobile
  const [pastedText, setPastedText] = useState('');
  const { success, error: showError } = useToast();

  // Fast substring check before expensive calculation
  const quickMatch = (s1, s2) => {
    const lower1 = s1.toLowerCase();
    const lower2 = s2.toLowerCase();

    // Exact match
    if (lower1 === lower2) return 1.0;

    // Substring match
    if (lower1.includes(lower2) || lower2.includes(lower1)) {
      const shorter = Math.min(lower1.length, lower2.length);
      const longer = Math.max(lower1.length, lower2.length);
      return shorter / longer;
    }

    return null; // No quick match
  };

  // Calculate similarity between two strings (simple Levenshtein-like)
  const similarity = (s1, s2) => {
    // Try quick match first
    const quick = quickMatch(s1, s2);
    if (quick !== null) return quick;

    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    // Skip expensive calculation for very different lengths
    if (longer.length > shorter.length * 2) return 0;

    const editDistance = (s1, s2) => {
      s1 = s1.toLowerCase();
      s2 = s2.toLowerCase();
      const costs = [];
      for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
          if (i === 0) {
            costs[j] = j;
          } else if (j > 0) {
            let newValue = costs[j - 1];
            if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
              newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
            }
            costs[j - 1] = lastValue;
            lastValue = newValue;
          }
        }
        if (i > 0) costs[s2.length] = lastValue;
      }
      return costs[s2.length];
    };

    return (longer.length - editDistance(longer, shorter)) / longer.length;
  };

  // Memoize unique products to avoid recalculating on every match
  const uniqueProducts = useMemo(() => {
    return Array.from(
      new Map(peptides.map(p => [p.peptideId, p])).values()
    );
  }, [peptides]);

  // Find best matching product for an activity name
  const findBestMatch = useCallback((activityName) => {
    let bestMatch = null;
    let bestScore = 0;
    const activityLower = activityName.toLowerCase();

    for (const product of uniqueProducts) {
      // Quick exact match check first (case-insensitive)
      const idLower = product.peptideId?.toLowerCase();
      const nameLower = product.peptideName?.toLowerCase();
      const nickLower = product.nickname?.toLowerCase();

      if (idLower === activityLower || nameLower === activityLower || nickLower === activityLower) {
        return { product, confidence: 1.0 };
      }

      // Try each field and stop early if we find a good match
      let maxScore = 0;

      if (product.peptideId) {
        const score = similarity(activityName, product.peptideId);
        if (score > maxScore) maxScore = score;
        if (score > 0.95) return { product, confidence: score };
      }

      if (product.nickname && maxScore < 0.95) {
        const score = similarity(activityName, product.nickname);
        if (score > maxScore) maxScore = score;
        if (score > 0.95) return { product, confidence: score };
      }

      if (product.peptideName && maxScore < 0.95) {
        const score = similarity(activityName, product.peptideName);
        if (score > maxScore) maxScore = score;
        if (score > 0.95) return { product, confidence: score };
      }

      if (maxScore > bestScore) {
        bestScore = maxScore;
        bestMatch = product;
      }
    }

    return { product: bestMatch, confidence: bestScore };
  }, [uniqueProducts]);

  // Process items in batches to avoid UI blocking
  const processBatch = async (items, batchSize = 25) => {
    console.log(`[PDF] Starting batch processing for ${items.length} items`);
    console.time('[PDF] Total matching time');
    const results = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      // Update progress
      setProcessingStatus(`Matching products... ${Math.min(i + batchSize, items.length)}/${items.length}`);

      // Process batch
      const batchResults = batch.map(item => {
        const { product, confidence } = findBestMatch(item.activity);
        return {
          ...item,
          suggestedProduct: product,
          confidence: confidence,
          selectedProduct: confidence > 0.7 ? product : null
        };
      });

      results.push(...batchResults);

      // Yield to UI thread every 3 batches (75 items)
      if (i % (batchSize * 3) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    console.timeEnd('[PDF] Total matching time');
    return results;
  };

  // Parse PDF and extract Activity + Rate
  const parsePDF = async (file) => {
    console.log('[PDF] Starting PDF processing');
    console.time('[PDF] Total processing time');
    setIsProcessing(true);
    setProcessingStatus('Loading PDF.js worker...');

    try {
      console.time('[PDF] Loading PDF');
      const arrayBuffer = await file.arrayBuffer();

      setProcessingStatus('Reading PDF file...');

      // Add timeout for PDF loading (30 seconds)
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('PDF loading timed out after 30 seconds')), 30000);
      });

      const pdf = await Promise.race([loadingTask.promise, timeoutPromise]);
      console.timeEnd('[PDF] Loading PDF');

      setProcessingStatus(`PDF loaded: ${pdf.numPages} pages, extracting text...`);
      console.time('[PDF] Extracting text');
      let fullText = '';

      // Extract text from all pages
      for (let i = 1; i <= pdf.numPages; i++) {
        setProcessingStatus(`Extracting text from page ${i}/${pdf.numPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';

        // Yield to UI on mobile after each page
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      console.timeEnd('[PDF] Extracting text');
      console.log(`[PDF] Extracted ${fullText.length} characters`);

      setProcessingStatus('Parsing invoice data...');
      console.time('[PDF] Parsing invoice text');
      // Parse the text to find Activity and Rate pairs
      const items = parseInvoiceText(fullText);
      console.timeEnd('[PDF] Parsing invoice text');
      console.log(`[PDF] Extracted ${items.length} items`);

      if (items.length === 0) {
        showError('No pricing data found in PDF. Please check the format.');
        setIsProcessing(false);
        setProcessingStatus('');
        console.timeEnd('[PDF] Total processing time');
        return;
      }

      // Auto-match products in batches
      const itemsWithMatches = await processBatch(items);

      setExtractedItems(itemsWithMatches);

      // Initialize mappings
      const initialMappings = {};
      itemsWithMatches.forEach((item, idx) => {
        if (item.selectedProduct) {
          initialMappings[idx] = item.selectedProduct.peptideId;
        }
      });
      setMappings(initialMappings);

      setStep('mapping');
      setProcessingStatus('');
      console.timeEnd('[PDF] Total processing time');
      success(`Extracted ${items.length} items from PDF`);
    } catch (err) {
      console.error('PDF parsing error:', err);
      const errorMsg = err.message || 'Unknown error';
      if (errorMsg.includes('timeout')) {
        showError('PDF loading timed out. Try using a smaller PDF or check your internet connection.');
      } else if (errorMsg.includes('worker')) {
        showError('PDF.js worker failed to load. Please refresh the page and try again.');
      } else {
        showError(`Failed to parse PDF: ${errorMsg}`);
      }
      console.timeEnd('[PDF] Total processing time');
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Parse invoice text to extract Activity and Rate
  const parseInvoiceText = (text) => {
    const items = [];
    const lines = text.split('\n');

    console.log('[PARSER] Total lines:', lines.length);

    // First pass: extract product names and numbers
    const productNames = [];
    const numberLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (i < 5) {
        console.log(`[PARSER] Line ${i}:`, line);
      }

      // Skip empty lines, headers, footers (but NOT lines with product names)
      if (!line || line.toLowerCase().includes('activity description') ||
          line.toLowerCase().includes('return policy') ||
          line.toLowerCase().includes('disclaimer') ||
          line.match(/^page \d+ of \d+$/i)) {
        continue;
      }

      // Skip lines that are ONLY "3ML Vial" or "Caps" with no product name
      if ((line.toLowerCase() === '3ml vial / matte black' ||
           line.toLowerCase() === 'caps' ||
           line.toLowerCase() === '3ml vial / matte black caps') &&
          !line.match(/\([0-9.]+mg\)/)) {
        continue;
      }

      // Check if line is just numbers: "QTY RATE AMOUNT"
      const numbersOnlyMatch = line.match(/^([\d,]+)\s+([\d.]+)\s+([\d,.]+)\s*$/);
      if (numbersOnlyMatch) {
        const rate = parseFloat(numbersOnlyMatch[2]);
        if (!isNaN(rate) && rate > 0) {
          numberLines.push({ rate });
        }
        continue;
      }

      // Check if line has product name + description + numbers: "Product Name 3ML Vial... QTY RATE AMOUNT"
      // Example: "Tesamorelin (6mg) / Ipamorelin (2mg) Blend (8mg) 3ML Vial / Matte Black 330 11.00 3,630.00"
      const fullLineMatch = line.match(/^(.+?)\s+([\d,]+)\s+([\d.]+)\s+([\d,.]+)\s*$/);
      if (fullLineMatch) {
        const fullText = fullLineMatch[1].trim();
        const rate = parseFloat(fullLineMatch[3]);

        // Extract just the product name (before "3ML Vial" or similar)
        const activityMatch = fullText.match(/^(.+?)\s+3ML Vial/i);
        const activity = activityMatch ? activityMatch[1].trim() : fullText;

        if (activity && !isNaN(rate) && rate > 0) {
          items.push({ activity, rate });
          continue;
        }
      }

      // Extract product names from lines
      // First try to match blend products: "Tesamorelin (6mg) / Ipamorelin (2mg) Blend (8mg)"
      const blendPattern = /([A-Za-z0-9\-]+\s*\([0-9.]+mg\)\s*\/\s*[A-Za-z0-9\-]+\s*\([0-9.]+mg\)\s+Blend\s+\([0-9.]+mg\))/gi;
      const blendMatches = line.match(blendPattern);

      if (blendMatches) {
        blendMatches.forEach(name => {
          productNames.push(name.trim());
        });
        continue; // Don't also match single products on this line
      }

      // Then match single products: "BPC-157 (5mg)", "TB-500 (5mg)", "Melanotan I (10mg)", "Thymosin Alpha-1 (10mg)"
      // Allow multi-word product names with spaces
      const singlePattern = /([A-Za-z0-9\-]+(?:\s+[A-Za-z0-9\-]+)*\s*\([0-9.]+mg\))/gi;
      const singleMatches = line.match(singlePattern);

      if (singleMatches) {
        singleMatches.forEach(name => {
          // Skip if it's part of a blend (already captured)
          if (!name.toLowerCase().includes('blend')) {
            productNames.push(name.trim());
          }
        });
      }
    }

    // If we have product names and number lines separately, pair them up
    console.log('[PARSER] Product names found:', productNames.length);
    console.log('[PARSER] Number lines found:', numberLines.length);
    console.log('[PARSER] Items from fullLineMatch:', items.length);

    if (productNames.length > 0 && numberLines.length > 0) {
      const pairsCount = Math.min(productNames.length, numberLines.length);
      for (let i = 0; i < pairsCount; i++) {
        items.push({
          activity: productNames[i],
          rate: numberLines[i].rate
        });
      }
    }

    console.log('[PARSER] Final items count:', items.length);
    if (items.length > 0) {
      console.log('[PARSER] First item:', items[0]);
      console.log('[PARSER] Last item:', items[items.length - 1]);
    }

    return items;
  };

  // Handle file upload
  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      console.log(`[PDF] File selected: ${selectedFile.name}, ${(selectedFile.size / 1024).toFixed(1)} KB`);
      parsePDF(selectedFile);
    } else {
      showError('Please select a PDF file');
    }
  };

  // Handle pasted text processing
  const handleTextSubmit = async () => {
    if (!pastedText.trim()) {
      showError('Please paste some text first');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('Parsing invoice data...');

    try {
      console.log('[TEXT] Starting text processing');
      console.time('[TEXT] Total processing time');

      // Parse the pasted text
      const items = parseInvoiceText(pastedText);
      console.log(`[TEXT] Extracted ${items.length} items`);

      if (items.length === 0) {
        showError('No pricing data found. Please check the format.');
        setIsProcessing(false);
        setProcessingStatus('');
        return;
      }

      // Auto-match products in batches
      const itemsWithMatches = await processBatch(items);

      setExtractedItems(itemsWithMatches);

      // Initialize mappings
      const initialMappings = {};
      itemsWithMatches.forEach((item, idx) => {
        if (item.selectedProduct) {
          initialMappings[idx] = item.selectedProduct.peptideId;
        }
      });
      setMappings(initialMappings);

      setStep('mapping');
      setProcessingStatus('');
      console.timeEnd('[TEXT] Total processing time');
      success(`Extracted ${items.length} items from pasted text`);
    } catch (err) {
      console.error('Text parsing error:', err);
      showError(`Failed to parse text: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  // Handle product mapping change
  const handleMappingChange = (itemIndex, peptideId) => {
    setMappings(prev => ({
      ...prev,
      [itemIndex]: peptideId
    }));
  };

  // Get formatted products for dropdown
  const productOptions = useMemo(() => {
    return uniqueProducts.map(p => ({
      peptideId: p.peptideId,
      label: p.nickname || p.peptideId,
      sub: p.nickname ? p.peptideId : (p.peptideName || '')
    })).sort((a, b) => a.label.localeCompare(b.label));
  }, [uniqueProducts]);

  // Apply the mappings and update prices
  const handleApply = async () => {
    setIsProcessing(true);
    try {
      // Load current price data
      const currentPrices = await db.settings.get('priceData') || {};

      // Get column key for selected target
      const columnKey = {
        'price': 'Price',
        'axx26': 'Axx26',
        'bxx26': 'Bxx26',
        'cxx26': 'Cxx26'
      }[targetColumn];

      // Apply mappings
      let updatedCount = 0;
      extractedItems.forEach((item, idx) => {
        const peptideId = mappings[idx];
        if (peptideId) {
          if (!currentPrices[peptideId]) {
            currentPrices[peptideId] = {};
          }
          currentPrices[peptideId][columnKey] = item.rate.toString();
          updatedCount++;
        }
      });

      // Save updated prices
      await db.settings.set('priceData', currentPrices);

      success(`Imported ${updatedCount} prices into ${columnKey} column`);

      // Reset and notify parent
      setFile(null);
      setExtractedItems([]);
      setMappings({});
      setStep('upload');

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      console.error('Import error:', err);
      showError('Failed to import prices');
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel and reset
  const handleCancel = () => {
    setFile(null);
    setPastedText('');
    setExtractedItems([]);
    setMappings({});
    setStep('upload');
  };

  // Get confidence badge color
  const getConfidenceBadge = (confidence) => {
    if (confidence >= 0.8) return { color: 'green', label: 'High' };
    if (confidence >= 0.5) return { color: 'yellow', label: 'Medium' };
    return { color: 'red', label: 'Low' };
  };

  const mappedCount = Object.keys(mappings).filter(k => mappings[k]).length;
  const unmappedCount = extractedItems.length - mappedCount;

  return (
    <div className="space-y-6">
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Import Invoice Data
          </h3>

          {/* Mode Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputMode('pdf')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                inputMode === 'pdf'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Upload PDF
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                inputMode === 'text'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Paste Text
            </button>
          </div>

          {/* PDF Upload Mode */}
          {inputMode === 'pdf' && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Upload a PDF invoice containing product names (Activity) and prices (Rate).
              </p>

              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <Upload className="w-12 h-12 mb-4 text-gray-400 dark:text-gray-500" />
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">PDF files only</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf"
                  onChange={handleFileChange}
                  disabled={isProcessing}
                />
              </label>
            </>
          )}

          {/* Text Paste Mode */}
          {inputMode === 'text' && (
            <>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Paste invoice text containing product names and prices. Each line should have a product name followed by a price.
              </p>

              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste invoice text here...&#10;Example:&#10;BPC-157 100.00&#10;TB-500 150.00&#10;GHK-Cu 75.00"
                disabled={isProcessing}
                className="w-full h-64 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
              />

              <button
                onClick={handleTextSubmit}
                disabled={isProcessing || !pastedText.trim()}
                className="mt-4 w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isProcessing ? 'Processing...' : 'Process Text'}
              </button>
            </>
          )}

          {isProcessing && (
            <div className="mt-4 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
              <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                {processingStatus || 'Processing...'}
              </p>
              {file && (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Mapping */}
      {step === 'mapping' && extractedItems.length > 0 && (
        <div className="space-y-4">
          {/* Column Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Import prices into column:
            </label>
            <select
              value={targetColumn}
              onChange={(e) => setTargetColumn(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="price">Price</option>
              <option value="axx26">Axx26</option>
              <option value="bxx26">Bxx26</option>
              <option value="cxx26">Cxx26</option>
            </select>
          </div>

          {/* Status Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {mappedCount} mapped
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {unmappedCount} unmapped
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApply}
                  disabled={mappedCount === 0 || isProcessing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Importing...' : `Import ${mappedCount} Price${mappedCount !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>

          {/* Mapping Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Activity (from PDF)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Match to Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                      Confidence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {extractedItems.map((item, idx) => {
                    const badge = getConfidenceBadge(item.confidence);
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {item.activity}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={mappings[idx] || ''}
                            onChange={(e) => handleMappingChange(idx, e.target.value)}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">-- Select Product --</option>
                            {productOptions.map(product => (
                              <option key={product.peptideId} value={product.peptideId}>
                                {product.label} {product.sub && `(${product.sub})`}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          ${item.rate.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                            ${badge.color === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : ''}
                            ${badge.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' : ''}
                            ${badge.color === 'red' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' : ''}
                          `}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

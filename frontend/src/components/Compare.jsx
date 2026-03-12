import { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, Trash2, ArrowUpDown, TrendingDown, TrendingUp, Plus, Minus, Package, ShoppingCart, Upload, Calendar, BarChart3, Columns3 } from 'lucide-react';
import { db } from '../lib/db';
import { parseInventoryCSV } from '../utils/csvParser';
import ColumnReorderModal from './ColumnReorderModal';
import { useToast } from './Toast';

const MAX_COMPARE_ITEMS = 1000;

const DEFAULT_COLUMNS = [
  { id: 'product', label: 'Product' },
  { id: 'oldQty', label: 'Older Qty' },
  { id: 'newQty', label: 'Newer Qty' },
  { id: 'change', label: 'Change' },
  { id: 'oldManualLabels', label: 'Older Manual Labels' },
  { id: 'newManualLabels', label: 'Newer Manual Labels' },
  { id: 'status', label: 'Status' }
];

export default function Compare({ peptides }) {
  const [snapshots, setSnapshots] = useState([]);
  const [selectedA, setSelectedA] = useState('');
  const [selectedB, setSelectedB] = useState('');
  const [snapshotA, setSnapshotA] = useState(null);
  const [snapshotB, setSnapshotB] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ field: 'change', direction: 'asc' });
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [mode, setMode] = useState('compare'); // 'compare' or 'trend'
  const [trendRange, setTrendRange] = useState('week'); // 'week', '2weeks', 'month', 'all'
  const [trendSort, setTrendSort] = useState({ field: 'totalChange', direction: 'asc' });
  const [importing, setImporting] = useState(false);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMNS);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const fileInputRef = useRef(null);
  const { success, error: showError } = useToast();

  // Load snapshot list and column settings
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const list = await db.snapshots.getAll();
      setSnapshots(list);

      // Auto-select the two most recent if available
      if (list.length >= 2) {
        setSelectedA(list[1].id); // older
        setSelectedB(list[0].id); // newer
      } else if (list.length === 1) {
        setSelectedA(list[0].id);
      }

      // Load column settings
      const savedOrder = await db.settings.get('compareColumnOrder');
      if (savedOrder) {
        const ordered = savedOrder
          .map(id => DEFAULT_COLUMNS.find(col => col.id === id))
          .filter(Boolean);
        const missing = DEFAULT_COLUMNS.filter(col => !savedOrder.includes(col.id));
        setColumnOrder([...ordered, ...missing]);
      }
      const savedHidden = await db.settings.get('compareHiddenColumns');
      if (savedHidden) setHiddenColumns(savedHidden);

      setLoading(false);
    };
    load();
  }, []);

  // Load full snapshot data when selections change
  useEffect(() => {
    const loadSnapshots = async () => {
      if (selectedA) {
        const a = await db.snapshots.get(selectedA);
        setSnapshotA(a);
      } else {
        setSnapshotA(null);
      }
      if (selectedB) {
        const b = await db.snapshots.get(selectedB);
        setSnapshotB(b);
      } else {
        setSnapshotB(null);
      }
    };
    loadSnapshots();
  }, [selectedA, selectedB]);

  // Take a new snapshot
  const handleTakeSnapshot = async () => {
    if (peptides.length === 0) {
      showError('No inventory data to snapshot');
      return;
    }
    const label = snapshotLabel.trim() || undefined;
    await db.snapshots.save(peptides, label);
    setSnapshotLabel('');
    const list = await db.snapshots.getAll();
    setSnapshots(list);
    success(`Snapshot saved (${peptides.length} items)`);
  };

  // Import CSV as snapshot
  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const result = await parseInventoryCSV(file);
      const items = result.peptides.slice(0, MAX_COMPARE_ITEMS);
      const label = file.name.replace(/\.csv$/i, '');
      await db.snapshots.save(items, label);
      const list = await db.snapshots.getAll();
      setSnapshots(list);
      success(`Imported "${label}" (${items.length} items)`);
    } catch (err) {
      showError(`Failed to import CSV: ${err.message}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete a snapshot
  const handleDeleteSnapshot = async (id) => {
    await db.snapshots.delete(id);
    if (selectedA === id) setSelectedA('');
    if (selectedB === id) setSelectedB('');
    const list = await db.snapshots.getAll();
    setSnapshots(list);
    success('Snapshot deleted');
  };

  // Compare the two snapshots
  const comparison = useMemo(() => {
    if (!snapshotA || !snapshotB) return null;

    const older = snapshotA.timestamp <= snapshotB.timestamp ? snapshotA : snapshotB;
    const newer = snapshotA.timestamp <= snapshotB.timestamp ? snapshotB : snapshotA;

    const olderMap = new Map(older.items.map(i => [i.peptideId, i]));
    const newerMap = new Map(newer.items.map(i => [i.peptideId, i]));

    const rows = [];
    let totalDecreased = 0;
    let totalIncreased = 0;
    let newItems = 0;
    let removedItems = 0;
    let unchangedItems = 0;
    let totalSold = 0;
    let totalAdded = 0;

    for (const [id, newItem] of newerMap) {
      const oldItem = olderMap.get(id);
      if (oldItem) {
        const change = newItem.quantity - oldItem.quantity;
        if (change < 0) { totalDecreased++; totalSold += Math.abs(change); }
        else if (change > 0) { totalIncreased++; totalAdded += change; }
        else { unchangedItems++; }
        rows.push({
          peptideId: id,
          name: newItem.nickname || newItem.peptideName || '',
          oldQty: oldItem.quantity,
          newQty: newItem.quantity,
          oldManualLabels: oldItem.manualLabels || 0,
          newManualLabels: newItem.manualLabels || 0,
          change,
          type: change < 0 ? 'decreased' : change > 0 ? 'increased' : 'unchanged'
        });
      } else {
        newItems++;
        totalAdded += newItem.quantity;
        rows.push({
          peptideId: id,
          name: newItem.nickname || newItem.peptideName || '',
          oldQty: null,
          newQty: newItem.quantity,
          oldManualLabels: 0,
          newManualLabels: newItem.manualLabels || 0,
          change: newItem.quantity,
          type: 'new'
        });
      }
    }

    for (const [id, oldItem] of olderMap) {
      if (!newerMap.has(id)) {
        removedItems++;
        totalSold += oldItem.quantity;
        rows.push({
          peptideId: id,
          name: oldItem.nickname || oldItem.peptideName || '',
          oldQty: oldItem.quantity,
          newQty: null,
          oldManualLabels: oldItem.manualLabels || 0,
          newManualLabels: 0,
          change: -oldItem.quantity,
          type: 'removed'
        });
      }
    }

    return {
      older, newer, rows,
      summary: { totalDecreased, totalIncreased, newItems, removedItems, unchangedItems, totalSold, totalAdded }
    };
  }, [snapshotA, snapshotB]);

  // Filter and sort rows (with 1000 item limit)
  const displayRows = useMemo(() => {
    if (!comparison) return [];
    let rows = comparison.rows;

    if (filter !== 'all') {
      rows = rows.filter(r => r.type === filter);
    }

    rows = [...rows].sort((a, b) => {
      let aVal, bVal;
      if (sort.field === 'change') { aVal = a.change; bVal = b.change; }
      else if (sort.field === 'oldQty') { aVal = a.oldQty ?? -1; bVal = b.oldQty ?? -1; }
      else if (sort.field === 'newQty') { aVal = a.newQty ?? -1; bVal = b.newQty ?? -1; }
      else { aVal = (a.name || a.peptideId).toLowerCase(); bVal = (b.name || b.peptideId).toLowerCase(); }
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return rows.slice(0, MAX_COMPARE_ITEMS);
  }, [comparison, filter, sort]);

  // Multi-snapshot trend data
  const trendData = useMemo(() => {
    if (mode !== 'trend' || snapshots.length < 2) return null;

    // Filter snapshots by selected range
    const now = Date.now();
    const rangeMs = {
      week: 7 * 24 * 60 * 60 * 1000,
      '2weeks': 14 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      all: Infinity
    };
    const cutoff = now - rangeMs[trendRange];

    const filtered = snapshots.filter(s => new Date(s.timestamp).getTime() >= cutoff);
    if (filtered.length < 2) return null;

    // Sort oldest to newest
    const sorted = [...filtered].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return { snapshotIds: sorted.map(s => s.id), snapshotLabels: sorted };
  }, [mode, snapshots, trendRange]);

  // Load full trend snapshot data
  const [trendSnapshots, setTrendSnapshots] = useState([]);
  useEffect(() => {
    if (!trendData) { setTrendSnapshots([]); return; }
    const load = async () => {
      const loaded = [];
      for (const id of trendData.snapshotIds) {
        const snap = await db.snapshots.get(id);
        if (snap) loaded.push(snap);
      }
      setTrendSnapshots(loaded);
    };
    load();
  }, [trendData]);

  // Compute trend table rows
  const trendRows = useMemo(() => {
    if (trendSnapshots.length < 2) return [];

    // Collect all product IDs across all snapshots
    const allIds = new Set();
    for (const snap of trendSnapshots) {
      for (const item of snap.items) {
        allIds.add(item.peptideId);
      }
    }

    const rows = [];
    for (const id of allIds) {
      const quantities = trendSnapshots.map(snap => {
        const item = snap.items.find(i => i.peptideId === id);
        return item ? item.quantity : null;
      });

      // Get name from latest snapshot that has this item
      let name = '';
      for (let i = trendSnapshots.length - 1; i >= 0; i--) {
        const item = trendSnapshots[i].items.find(it => it.peptideId === id);
        if (item) {
          name = item.nickname || item.peptideName || '';
          break;
        }
      }

      // Calculate total change (first non-null to last non-null)
      const firstQty = quantities.find(q => q !== null) ?? 0;
      const lastQty = [...quantities].reverse().find(q => q !== null) ?? 0;
      const totalChange = lastQty - firstQty;

      rows.push({ peptideId: id, name, quantities, totalChange, firstQty, lastQty });
    }

    // Sort
    rows.sort((a, b) => {
      let aVal, bVal;
      if (trendSort.field === 'totalChange') { aVal = a.totalChange; bVal = b.totalChange; }
      else if (trendSort.field === 'lastQty') { aVal = a.lastQty; bVal = b.lastQty; }
      else if (typeof trendSort.field === 'number') {
        aVal = a.quantities[trendSort.field] ?? -1;
        bVal = b.quantities[trendSort.field] ?? -1;
      }
      else { aVal = (a.name || a.peptideId).toLowerCase(); bVal = (b.name || b.peptideId).toLowerCase(); }
      if (aVal < bVal) return trendSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return trendSort.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return rows.slice(0, MAX_COMPARE_ITEMS);
  }, [trendSnapshots, trendSort]);

  // Visible columns for Compare Two table
  const visibleColumns = useMemo(() => {
    return columnOrder.filter(col => !hiddenColumns.includes(col.id));
  }, [columnOrder, hiddenColumns]);

  const handleColumnReorder = async (newOrder) => {
    setColumnOrder(newOrder);
    await db.settings.set('compareColumnOrder', newOrder.map(c => c.id));
  };

  const handleColumnVisibility = async (newHidden) => {
    setHiddenColumns(newHidden);
    await db.settings.set('compareHiddenColumns', newHidden);
  };

  const handleSort = (field) => {
    setSort(prev => ({ field, direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const handleTrendSort = (field) => {
    setTrendSort(prev => ({ field, direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Loading snapshots...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Snapshots Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Snapshots</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={snapshotLabel}
            onChange={(e) => setSnapshotLabel(e.target.value)}
            placeholder="Optional label (defaults to today's date)"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleTakeSnapshot}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            Take Snapshot
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors whitespace-nowrap disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
          Snapshots are also taken automatically once per day. You have {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} saved.
          {' '}Max {MAX_COMPARE_ITEMS} items per comparison.
        </p>

        {/* Snapshot List */}
        {snapshots.length > 0 && (
          <div className="mt-4 max-h-48 overflow-y-auto">
            <div className="space-y-1">
              {snapshots.map(s => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm">
                  <div>
                    <span className="font-medium text-gray-900 dark:text-white">{s.label}</span>
                    <span className="text-gray-500 dark:text-gray-400 ml-2">({s.itemCount} items)</span>
                  </div>
                  <button
                    onClick={() => handleDeleteSnapshot(s.id)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mode Toggle */}
      {snapshots.length >= 2 && (
        <div className="flex gap-2">
          <button
            onClick={() => setMode('compare')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              mode === 'compare'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <ArrowUpDown className="w-4 h-4" />
            Compare Two
          </button>
          <button
            onClick={() => setMode('trend')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              mode === 'trend'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Trend Over Time
          </button>
        </div>
      )}

      {/* ===== COMPARE TWO MODE ===== */}
      {mode === 'compare' && (
        <>
          {/* Compare Selection */}
          {snapshots.length >= 2 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Compare Two Snapshots</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Older Snapshot</label>
                  <select
                    value={selectedA}
                    onChange={(e) => setSelectedA(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    {snapshots.map(s => (
                      <option key={s.id} value={s.id}>{s.label} ({s.itemCount} items)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Newer Snapshot</label>
                  <select
                    value={selectedB}
                    onChange={(e) => setSelectedB(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    {snapshots.map(s => (
                      <option key={s.id} value={s.id}>{s.label} ({s.itemCount} items)</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Comparison Results */}
          {comparison && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard icon={<ShoppingCart className="w-6 h-6" />} label="Units Sold / Used" value={comparison.summary.totalSold} color="red" subtitle={`${comparison.summary.totalDecreased} products`} />
                <SummaryCard icon={<TrendingUp className="w-6 h-6" />} label="Units Restocked" value={comparison.summary.totalAdded} color="green" subtitle={`${comparison.summary.totalIncreased + comparison.summary.newItems} products`} />
                <SummaryCard icon={<Plus className="w-6 h-6" />} label="New Products" value={comparison.summary.newItems} color="blue" />
                <SummaryCard icon={<Minus className="w-6 h-6" />} label="Removed" value={comparison.summary.removedItems} color="orange" />
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-2 flex-wrap">
                <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={comparison.rows.length} />
                <FilterBtn active={filter === 'decreased'} onClick={() => setFilter('decreased')} label="Decreased" count={comparison.summary.totalDecreased} color="red" />
                <FilterBtn active={filter === 'increased'} onClick={() => setFilter('increased')} label="Increased" count={comparison.summary.totalIncreased} color="green" />
                <FilterBtn active={filter === 'new'} onClick={() => setFilter('new')} label="New" count={comparison.summary.newItems} color="blue" />
                <FilterBtn active={filter === 'removed'} onClick={() => setFilter('removed')} label="Removed" count={comparison.summary.removedItems} color="orange" />
                <FilterBtn active={filter === 'unchanged'} onClick={() => setFilter('unchanged')} label="Unchanged" count={comparison.summary.unchangedItems} color="gray" />
              </div>

              {/* Comparison Table */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Comparing <span className="font-medium text-gray-900 dark:text-white">{comparison.older.label}</span> → <span className="font-medium text-gray-900 dark:text-white">{comparison.newer.label}</span>
                    {' '}({displayRows.length}{comparison.rows.length > MAX_COMPARE_ITEMS ? ` of ${comparison.rows.length}` : ''} items shown)
                  </p>
                  <button
                    onClick={() => setShowColumnModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Columns3 className="w-4 h-4" />
                    Reorder
                  </button>
                </div>
                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                      <tr>
                        {visibleColumns.map(col => {
                          if (col.id === 'product') return <SortHeader key={col.id} field="peptideId" label="Product" sort={sort} onSort={handleSort} align="left" />;
                          if (col.id === 'oldQty') return <SortHeader key={col.id} field="oldQty" label={comparison.older.label} sort={sort} onSort={handleSort} align="right" />;
                          if (col.id === 'newQty') return <SortHeader key={col.id} field="newQty" label={comparison.newer.label} sort={sort} onSort={handleSort} align="right" />;
                          if (col.id === 'change') return <SortHeader key={col.id} field="change" label="Change" sort={sort} onSort={handleSort} align="right" />;
                          if (col.id === 'status') return <th key={col.id} className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>;
                          return null;
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {displayRows.length === 0 ? (
                        <tr>
                          <td colSpan={visibleColumns.length} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                            No items match this filter
                          </td>
                        </tr>
                      ) : (
                        displayRows.map(row => (
                          <tr key={row.peptideId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            {visibleColumns.map(col => {
                              if (col.id === 'product') return (
                                <td key={col.id} className="px-4 py-2">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">{row.name || row.peptideId}</div>
                                  {row.name && <div className="text-xs text-gray-500 dark:text-gray-400">{row.peptideId}</div>}
                                </td>
                              );
                              if (col.id === 'oldQty') return (
                                <td key={col.id} className="px-4 py-2 text-sm text-right text-gray-500 dark:text-gray-400">
                                  {row.oldQty !== null ? row.oldQty : '-'}
                                </td>
                              );
                              if (col.id === 'newQty') return (
                                <td key={col.id} className="px-4 py-2 text-sm text-right text-gray-500 dark:text-gray-400">
                                  {row.newQty !== null ? row.newQty : '-'}
                                </td>
                              );
                              if (col.id === 'oldManualLabels') return (
                                <td key={col.id} className="px-4 py-2 text-sm text-right text-gray-500 dark:text-gray-400">
                                  {row.oldManualLabels !== null ? row.oldManualLabels : '-'}
                                </td>
                              );
                              if (col.id === 'newManualLabels') return (
                                <td key={col.id} className="px-4 py-2 text-sm text-right text-gray-500 dark:text-gray-400">
                                  {row.newManualLabels !== null ? row.newManualLabels : '-'}
                                </td>
                              );
                              if (col.id === 'change') return (
                                <td key={col.id} className="px-4 py-2 text-sm text-right font-medium">
                                  <span className={
                                    row.change < 0 ? 'text-red-600 dark:text-red-400' :
                                    row.change > 0 ? 'text-green-600 dark:text-green-400' :
                                    'text-gray-500 dark:text-gray-400'
                                  }>
                                    {row.change > 0 ? '+' : ''}{row.change}
                                  </span>
                                </td>
                              );
                              if (col.id === 'status') return (
                                <td key={col.id} className="px-4 py-2 text-right">
                                  <ChangeTag type={row.type} />
                                </td>
                              );
                              return null;
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ===== TREND MODE ===== */}
      {mode === 'trend' && snapshots.length >= 2 && (
        <>
          {/* Range Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Inventory Trend</h3>
            <div className="flex gap-2 flex-wrap">
              {[
                { id: 'week', label: '1 Week' },
                { id: '2weeks', label: '2 Weeks' },
                { id: 'month', label: '1 Month' },
                { id: 'all', label: 'All Time' }
              ].map(r => (
                <button
                  key={r.id}
                  onClick={() => setTrendRange(r.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    trendRange === r.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  {r.label}
                </button>
              ))}
            </div>
            {trendData && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                Showing {trendData.snapshotLabels.length} snapshots across {trendRows.length} products
                {trendRows.length >= MAX_COMPARE_ITEMS && ` (limited to ${MAX_COMPARE_ITEMS})`}
              </p>
            )}
            {!trendData && (
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-3">
                Not enough snapshots in the selected range. Try a wider range or take more snapshots.
              </p>
            )}
          </div>

          {/* Trend Table */}
          {trendSnapshots.length >= 2 && trendRows.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 sticky left-0 bg-gray-50 dark:bg-gray-700 z-10"
                        onClick={() => handleTrendSort('peptideId')}
                      >
                        <div className="flex items-center space-x-2">
                          <span>Product</span>
                          <ArrowUpDown className={`w-4 h-4 ${trendSort.field === 'peptideId' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                        </div>
                      </th>
                      {trendSnapshots.map((snap, idx) => (
                        <th
                          key={snap.id}
                          className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                          onClick={() => handleTrendSort(idx)}
                        >
                          <div className="flex items-center justify-end space-x-1">
                            <span>{snap.label}</span>
                            <ArrowUpDown className={`w-3 h-3 ${trendSort.field === idx ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                          </div>
                        </th>
                      ))}
                      <th
                        className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                        onClick={() => handleTrendSort('totalChange')}
                      >
                        <div className="flex items-center justify-end space-x-2">
                          <span>Net Change</span>
                          <ArrowUpDown className={`w-4 h-4 ${trendSort.field === 'totalChange' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {trendRows.map(row => (
                      <tr key={row.peptideId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-4 py-2 sticky left-0 bg-white dark:bg-gray-800 z-10">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{row.name || row.peptideId}</div>
                          {row.name && <div className="text-xs text-gray-500 dark:text-gray-400">{row.peptideId}</div>}
                        </td>
                        {row.quantities.map((qty, idx) => {
                          // Color code changes between consecutive snapshots
                          const prevQty = idx > 0 ? row.quantities[idx - 1] : null;
                          let cellColor = 'text-gray-500 dark:text-gray-400';
                          if (qty !== null && prevQty !== null) {
                            if (qty < prevQty) cellColor = 'text-red-600 dark:text-red-400';
                            else if (qty > prevQty) cellColor = 'text-green-600 dark:text-green-400';
                          }
                          return (
                            <td key={idx} className={`px-3 py-2 text-sm text-right font-medium ${cellColor}`}>
                              {qty !== null ? qty : '-'}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-sm text-right font-bold">
                          <span className={
                            row.totalChange < 0 ? 'text-red-600 dark:text-red-400' :
                            row.totalChange > 0 ? 'text-green-600 dark:text-green-400' :
                            'text-gray-500 dark:text-gray-400'
                          }>
                            {row.totalChange > 0 ? '+' : ''}{row.totalChange}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {snapshots.length < 2 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {snapshots.length === 0 ? 'No Snapshots Yet' : 'Need One More Snapshot'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {snapshots.length === 0
              ? 'Take your first snapshot or import a CSV to start tracking inventory changes.'
              : 'Take another snapshot or import a CSV to compare changes.'
            }
          </p>
        </div>
      )}

      {/* Column Reorder Modal */}
      {showColumnModal && (
        <ColumnReorderModal
          columns={columnOrder}
          hiddenColumns={hiddenColumns}
          onReorder={handleColumnReorder}
          onVisibilityChange={handleColumnVisibility}
          onClose={() => setShowColumnModal(false)}
        />
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value, color, subtitle }) {
  const colors = {
    red: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30',
    green: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
    orange: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/30'
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, label, count, color = 'gray' }) {
  const colors = {
    gray: active ? 'bg-gray-200 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800',
    red: active ? 'bg-red-200 dark:bg-red-900' : 'bg-red-100 dark:bg-red-900/50',
    green: active ? 'bg-green-200 dark:bg-green-900' : 'bg-green-100 dark:bg-green-900/50',
    blue: active ? 'bg-blue-200 dark:bg-blue-900' : 'bg-blue-100 dark:bg-blue-900/50',
    orange: active ? 'bg-orange-200 dark:bg-orange-900' : 'bg-orange-100 dark:bg-orange-900/50'
  };

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${colors[color]} ${active ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'} hover:opacity-80`}
    >
      {label} <span className="font-bold">({count})</span>
    </button>
  );
}

function SortHeader({ field, label, sort, onSort, align }) {
  const isActive = sort.field === field;
  return (
    <th
      className={`px-4 py-2 text-${align} text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600`}
      onClick={() => onSort(field)}
    >
      <div className={`flex items-center ${align === 'right' ? 'justify-end' : ''} space-x-2`}>
        <span>{label}</span>
        <ArrowUpDown className={`w-4 h-4 ${isActive ? 'text-blue-600 dark:text-blue-400' : ''}`} />
        {isActive && <span className="text-xs text-blue-600 dark:text-blue-400">{sort.direction === 'asc' ? '\u2191' : '\u2193'}</span>}
      </div>
    </th>
  );
}

function ChangeTag({ type }) {
  const config = {
    decreased: { label: 'Sold/Used', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    increased: { label: 'Restocked', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    new: { label: 'New', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    removed: { label: 'Removed', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
    unchanged: { label: 'No Change', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' }
  };
  const c = config[type] || config.unchanged;
  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${c.className}`}>
      {c.label}
    </span>
  );
}

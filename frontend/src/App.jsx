import { useState, useEffect, useMemo } from 'react';
import { Package, Upload, CheckCircle, BarChart3, Moon, Sun, FileText, Tag, Settings, ArrowLeft, ArrowUpDown, GitCompareArrows, ScanLine, DollarSign, ClipboardList, Clock, AlertTriangle, Users, Layers, Box as BoxIcon, ShoppingCart, LogOut, UserCircle } from 'lucide-react';
import Minutes from './components/Minutes';
import { calculateStockStatus } from './utils/stockStatus';
import { useInventory } from './hooks/useInventory';
import { useDarkMode } from './hooks/useDarkMode';
import { useBranding } from './hooks/useBranding';
import { useAuth } from './hooks/useAuth';
import { useWooAutoSync } from './hooks/useWooCommerce';
import { ToastProvider } from './components/Toast';
import { db } from './lib/db';
import Login from './components/Login';
import SetupWizard from './components/SetupWizard';
import Accounts from './components/Accounts';
import ErrorBoundary from './components/ErrorBoundary';
import CSVUpload from './components/CSVUpload';
import PickListScanner from './components/PickListScanner';
import InventoryTable from './components/InventoryTable';
import SalesReady from './components/SalesReady';
import Reports from './components/Reports';
import Labeling from './components/Labeling';
import Compare from './components/Compare';
import Prices from './components/Prices';
import Daily from './components/Daily';
import Batch from './components/Batch';
import BatchCSVUpload from './components/BatchCSVUpload';
import Boxes from './components/Boxes';
import BoxCSVUpload from './components/BoxCSVUpload';
import WooCommerce from './components/WooCommerce';
import SettingsModal from './components/SettingsModal';
import PatchNotesModal from './components/PatchNotesModal';
import packageJson from '../package.json';

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    // Restore active tab from localStorage on page load
    return localStorage.getItem('activeTab') || 'dashboard';
  });
  const { isDark, toggle } = useDarkMode();
  const { branding } = useBranding();
  const auth = useAuth();
  useWooAutoSync();
  const [orders, setOrders] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showPatchNotes, setShowPatchNotes] = useState(false);
  const { peptides, allPeptides, loading, thresholds, stats, refresh, bulkExclude } = useInventory();

  // Load saved font size on mount
  useEffect(() => {
    const savedSize = Number(localStorage.getItem('app-font-size'));
    if (savedSize >= 12 && savedSize <= 24) {
      document.documentElement.style.fontSize = `${savedSize}px`;
    }
  }, []);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // If the user lacks permission for the current tab, fall back to the first accessible tab
  useEffect(() => {
    if (!auth.currentUser || auth.loading) return;
    if (auth.can(activeTab)) return;
    const fallbackOrder = ['dashboard', 'inventory', 'reports', 'woocommerce', 'accounts'];
    const next = fallbackOrder.find(k => auth.can(k));
    if (next) setActiveTab(next);
  }, [auth.currentUser, auth.loading, auth.permissions, activeTab]);

  // Load orders
  useEffect(() => {
    const loadOrders = async () => {
      const allOrders = await db.orders.getAll();
      setOrders(allOrders);
    };
    loadOrders();
  }, [peptides]); // Reload when peptides change

  // Auto-save daily snapshot
  useEffect(() => {
    if (peptides.length > 0) {
      db.snapshots.saveDailyIfNeeded(peptides);
    }
  }, [peptides]);

  const handleImportComplete = () => {
    refresh();
    setActiveTab('inventory');
  };

  const handleBatchImportComplete = () => {
    setActiveTab('batch');
  };

  const handleBoxImportComplete = () => {
    setActiveTab('boxes');
  };

  if (auth.loading) {
    return (
      <ToastProvider>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500">
          Loading…
        </div>
      </ToastProvider>
    );
  }

  // Local mode shows the first-run wizard; WordPress mode never does
  // (accounts live in WordPress — just show the login screen).
  if (auth.authMode !== 'wordpress' && !auth.hasUsers) {
    return (
      <ToastProvider>
        <SetupWizard />
      </ToastProvider>
    );
  }

  if (!auth.currentUser) {
    return (
      <ToastProvider>
        <Login />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <ErrorBoundary label="PIMS">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors overflow-x-hidden">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {branding.appLogo ? (
                <img src={branding.appLogo} alt="" className="w-8 h-8 object-contain" />
              ) : (
                <Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{branding.appTitle}</h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">{branding.appSubtitle}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              {auth.currentRole && (
                <span
                  className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: auth.currentRole.color || '#6b7280' }}
                  title={`Signed in as ${auth.currentUser.username}`}
                >
                  <UserCircle className="w-3.5 h-3.5" />
                  {auth.currentUser.username} · {auth.currentRole.name}
                </span>
              )}
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={toggle}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle dark mode"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-600" />
                )}
              </button>
              <button
                onClick={() => { if (window.confirm('Sign out?')) auth.logout(); }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setShowPatchNotes(true)}
                className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors cursor-pointer font-medium"
              >
                v{packageJson.version}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 transition-colors overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 sm:space-x-8 min-w-max">
            {auth.can('dashboard') && (
              <NavButton icon={<BarChart3 className="w-5 h-5" />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            )}
            {auth.can('batch') && (
              <NavButton icon={<Layers className="w-5 h-5" />} label="Batch" active={activeTab === 'batch'} onClick={() => setActiveTab('batch')} />
            )}
            {auth.can('inventory') && (
              <NavButton icon={<Package className="w-5 h-5" />} label="Inventory" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} badge={stats.total} />
            )}
            {auth.can('boxes') && (
              <NavButton icon={<BoxIcon className="w-5 h-5" />} label="Boxes" active={activeTab === 'boxes'} onClick={() => setActiveTab('boxes')} />
            )}
            {auth.can('labeling') && (
              <NavButton icon={<Tag className="w-5 h-5" />} label="Labeling" active={activeTab === 'labeling'} onClick={() => setActiveTab('labeling')} />
            )}
            {auth.can('sales') && (
              <NavButton icon={<CheckCircle className="w-5 h-5" />} label="Sales Ready" active={activeTab === 'sales'} onClick={() => setActiveTab('sales')} />
            )}
            {auth.can('reports') && (
              <NavButton icon={<FileText className="w-5 h-5" />} label="Reports" active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} />
            )}
            {auth.can('prices') && (
              <NavButton icon={<DollarSign className="w-5 h-5" />} label="Prices" active={activeTab === 'prices'} onClick={() => setActiveTab('prices')} />
            )}
            {auth.can('compare') && (
              <NavButton icon={<GitCompareArrows className="w-5 h-5" />} label="Compare" active={activeTab === 'compare'} onClick={() => setActiveTab('compare')} />
            )}
            {auth.can('daily') && (
              <NavButton icon={<ClipboardList className="w-5 h-5" />} label="Daily" active={activeTab === 'daily'} onClick={() => setActiveTab('daily')} />
            )}
            {auth.can('woocommerce') && (
              <NavButton icon={<ShoppingCart className="w-5 h-5" />} label="WooCommerce" active={activeTab === 'woocommerce'} onClick={() => setActiveTab('woocommerce')} />
            )}
            {auth.can('import') && (
              <NavButton icon={<Upload className="w-5 h-5" />} label="Import CSV" active={activeTab === 'import'} onClick={() => setActiveTab('import')} />
            )}
            {auth.can('accounts') && (
              <NavButton icon={<Users className="w-5 h-5" />} label="Accounts" active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} />
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        ) : (
          <ErrorBoundary key={activeTab} label={`the ${activeTab} tab`}>
            {activeTab === 'dashboard' && <DashboardView stats={stats} peptides={peptides} thresholds={thresholds} onNavigate={setActiveTab} />}
            {activeTab === 'batch' && <BatchView />}
            {activeTab === 'boxes' && <BoxesView />}
            {activeTab === 'import' && <ImportView onImportComplete={handleImportComplete} onBatchImportComplete={handleBatchImportComplete} onBoxImportComplete={handleBoxImportComplete} peptides={peptides} onRefresh={refresh} />}
            {activeTab === 'inventory' && (
              <InventoryView
                peptides={peptides}
                allPeptides={allPeptides}
                thresholds={thresholds}
                onRefresh={refresh}
                bulkExclude={bulkExclude}
              />
            )}
            {activeTab === 'labeling' && <LabelingView peptides={peptides} onRefresh={refresh} />}
            {activeTab === 'sales' && <SalesReadyView peptides={peptides} onRefresh={refresh} />}
            {activeTab === 'reports' && <ReportsView peptides={peptides} orders={orders} thresholds={thresholds} />}
            {activeTab === 'prices' && <PricesView peptides={peptides} />}
            {activeTab === 'compare' && <CompareView peptides={peptides} />}
            {activeTab === 'daily' && <DailyView />}
            {activeTab === 'woocommerce' && <WooCommerce onOpenSettings={() => setShowSettings(true)} />}
            {activeTab === 'accounts' && <Accounts />}
          </ErrorBoundary>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-12 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            © 2026 Peptide Inventory Management System.
          </p>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <PatchNotesModal isOpen={showPatchNotes} onClose={() => setShowPatchNotes(false)} currentVersion={packageJson.version} />
    </div>
      </ErrorBoundary>
    </ToastProvider>
  );
}

function NavButton({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-4 border-b-2 font-medium text-xs sm:text-sm transition-colors relative whitespace-nowrap
        ${active
          ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
        }
      `}
    >
      {icon}
      <span>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
          {badge}
        </span>
      )}
    </button>
  );
}

function DashboardView({ stats, peptides, thresholds, onNavigate }) {
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [detailSort, setDetailSort] = useState({ field: 'peptideId', direction: 'asc' });
  const [activeTasks, setActiveTasks] = useState([]);
  const [recentMeetings, setRecentMeetings] = useState([]);
  const [showMinutesModal, setShowMinutesModal] = useState(false);
  const [focusMeetingId, setFocusMeetingId] = useState(null);
  const [batchStats, setBatchStats] = useState(null);
  const [boxStats, setBoxStats] = useState(null);

  // Load all active tasks for dashboard
  useEffect(() => {
    const loadActiveTasks = async () => {
      try {
        const allTasks = await db.tasks.getAll();
        const active = allTasks.filter(t => !t.completed);
        active.sort((a, b) => {
          if (a.priority === 'critical' && b.priority !== 'critical') return -1;
          if (b.priority === 'critical' && a.priority !== 'critical') return 1;
          const aExp = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
          const bExp = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
          return aExp - bExp;
        });
        setActiveTasks(active);
      } catch (err) {
        console.error('Failed to load tasks for dashboard:', err);
      }
    };
    loadActiveTasks();
    const interval = setInterval(loadActiveTasks, 60000);
    return () => clearInterval(interval);
  }, []);

  // Load recent meetings for dashboard
  useEffect(() => {
    const loadMeetings = async () => {
      try {
        const meetings = await db.minutes.getAll();
        setRecentMeetings(meetings);
      } catch (err) {
        console.error('Failed to load meetings for dashboard:', err);
      }
    };
    loadMeetings();
  }, [showMinutesModal]);

  // Load batch stats for dashboard
  useEffect(() => {
    const loadBatchStats = async () => {
      try {
        const items = await db.batches.getAll();
        if (items.length === 0) { setBatchStats(null); return; }

        let totalCost = 0, totalGross = 0, totalQty = 0;
        const vendors = new Set();
        const topProducts = [];

        items.forEach(item => {
          const pricePerBox = Number(item.pricePerBox) || 0;
          const qtyPurchased = Number(item.qtyPurchased) || 0;
          const salePrice = Number(item.salePrice) || 0;
          const pricePerVial = pricePerBox / 10;
          const cost = pricePerBox * (qtyPurchased / 10);
          const profitBatch = (salePrice - pricePerVial) * qtyPurchased;

          totalCost += cost;
          totalGross += profitBatch;
          totalQty += qtyPurchased;
          if (item.vendor) vendors.add(item.vendor);
          topProducts.push({ name: item.name || item.productId || '?', profit: profitBatch, qty: qtyPurchased, salePrice });
        });

        topProducts.sort((a, b) => b.profit - a.profit);

        setBatchStats({
          products: items.length,
          totalCost,
          gross: totalGross,
          net: totalGross - totalCost,
          totalQty,
          vendors: vendors.size,
          topProducts: topProducts.slice(0, 5),
        });
      } catch (err) {
        console.error('Failed to load batch stats:', err);
      }
    };
    loadBatchStats();
  }, []);

  // Load box stats for dashboard
  useEffect(() => {
    const loadBoxStats = async () => {
      try {
        const items = await db.boxes.getAll();
        if (items.length === 0) { setBoxStats(null); return; }

        let totalOnHand = 0, totalOnOrder = 0, totalValue = 0, totalDailyUsage = 0;
        const suppliers = new Set();
        const critical = [];

        items.forEach(item => {
          const onHand = Number(item.onHand) || 0;
          const onOrder = Number(item.onOrder) || 0;
          const dailyUsage = Number(item.dailyUsage) || 0;
          const costPerUnit = Number(item.costPerUnit) || 0;
          totalOnHand += onHand;
          totalOnOrder += onOrder;
          totalDailyUsage += dailyUsage;
          totalValue += onHand * costPerUnit;
          if (item.supplier) suppliers.add(item.supplier);

          const daysLeft = dailyUsage > 0 ? onHand / dailyUsage : null;
          if (daysLeft !== null && daysLeft <= 14) {
            critical.push({ name: item.name || '?', daysLeft: Math.round(daysLeft * 10) / 10, onHand, supplier: item.supplier || '-' });
          }
        });

        critical.sort((a, b) => a.daysLeft - b.daysLeft);

        setBoxStats({
          types: items.length,
          totalOnHand,
          totalOnOrder,
          totalDailyUsage,
          totalValue,
          suppliers: [...suppliers],
          critical: critical.slice(0, 5),
        });
      } catch (err) {
        console.error('Failed to load box stats:', err);
      }
    };
    loadBoxStats();
  }, []);

  const STATUS_MAP = {
    OUT_OF_STOCK: { color: 'red', label: 'Out of Stock', action: 'Order Immediately' },
    NEARLY_OUT: { color: 'orange', label: 'Nearly Out', action: 'Order Urgently' },
    LOW_STOCK: { color: 'yellow', label: 'Low Stock', action: 'Order Soon' },
    GOOD_STOCK: { color: 'green', label: 'Good Stock', action: 'No Action Needed' },
    ON_ORDER: { color: 'teal', label: 'On Order', action: 'Monitor Delivery' }
  };

  const statusItems = useMemo(() => {
    if (!selectedStatus) return [];
    return peptides.filter(p => {
      const status = calculateStockStatus(p.quantity, thresholds, p.hasActiveOrder);
      return status === selectedStatus;
    });
  }, [peptides, thresholds, selectedStatus]);

  const sortedItems = useMemo(() => {
    const items = [...statusItems];
    items.sort((a, b) => {
      let aVal, bVal;
      if (detailSort.field === 'quantity') {
        aVal = Number(a.quantity) || 0;
        bVal = Number(b.quantity) || 0;
      } else {
        aVal = (a.nickname || a[detailSort.field] || '').toLowerCase();
        bVal = (b.nickname || b[detailSort.field] || '').toLowerCase();
      }
      if (aVal < bVal) return detailSort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return detailSort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [statusItems, detailSort]);

  const handleStatusClick = (statusKey) => {
    if (selectedStatus === statusKey) {
      setSelectedStatus(null);
    } else {
      setSelectedStatus(statusKey);
      setDetailSort({ field: 'peptideId', direction: 'asc' });
    }
  };

  const handleDetailSort = (field) => {
    setDetailSort(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Overview of your peptide inventory</p>
      </div>

      {/* Status Legend */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Stock Status Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <StatusCard
            color="red"
            label="Out of Stock"
            action="Order Immediately"
            count={stats.outOfStock}
            active={selectedStatus === 'OUT_OF_STOCK'}
            onClick={() => handleStatusClick('OUT_OF_STOCK')}
          />
          <StatusCard
            color="orange"
            label="Nearly Out"
            action="Order Urgently"
            count={stats.nearlyOut}
            active={selectedStatus === 'NEARLY_OUT'}
            onClick={() => handleStatusClick('NEARLY_OUT')}
          />
          <StatusCard
            color="yellow"
            label="Low Stock"
            action="Order Soon"
            count={stats.lowStock}
            active={selectedStatus === 'LOW_STOCK'}
            onClick={() => handleStatusClick('LOW_STOCK')}
          />
          <StatusCard
            color="green"
            label="Good Stock"
            action="No Action Needed"
            count={stats.goodStock}
            active={selectedStatus === 'GOOD_STOCK'}
            onClick={() => handleStatusClick('GOOD_STOCK')}
          />
          <StatusCard
            color="teal"
            label="On Order"
            action="Monitor Delivery"
            count={stats.onOrder}
            active={selectedStatus === 'ON_ORDER'}
            onClick={() => handleStatusClick('ON_ORDER')}
          />
        </div>
      </div>

      {/* Status Detail Table */}
      {selectedStatus && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedStatus(null)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {STATUS_MAP[selectedStatus].label} ({sortedItems.length})
              </h3>
            </div>
          </div>
          {sortedItems.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No items in this category</p>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th
                      className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleDetailSort('peptideId')}
                    >
                      <div className="flex items-center space-x-2">
                        <span>Product</span>
                        <ArrowUpDown className={`w-4 h-4 ${detailSort.field === 'peptideId' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                        {detailSort.field === 'peptideId' && <span className="text-xs text-blue-600 dark:text-blue-400">{detailSort.direction === 'asc' ? '\u2191' : '\u2193'}</span>}
                      </div>
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SKU</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Batch</th>
                    <th
                      className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                      onClick={() => handleDetailSort('quantity')}
                    >
                      <div className="flex items-center justify-end space-x-2">
                        <span>Quantity</span>
                        <ArrowUpDown className={`w-4 h-4 ${detailSort.field === 'quantity' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                        {detailSort.field === 'quantity' && <span className="text-xs text-blue-600 dark:text-blue-400">{detailSort.direction === 'asc' ? '\u2191' : '\u2193'}</span>}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                        {item.nickname || item.peptideId}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {item.nickname ? item.peptideId : (item.peptideName || '-')}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                        {item.batchNumber || '-'}
                      </td>
                      <td className="px-4 py-2 text-sm text-right font-medium text-gray-900 dark:text-white">
                        {item.quantity}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          title="Total Peptides"
          value={stats.total.toString()}
          subtitle="In system"
          icon={<Package className="w-8 h-8 text-blue-600 dark:text-blue-400" />}
        />
        <StatCard
          title="Need Ordering"
          value={stats.needsOrdering.toString()}
          subtitle="Requires attention"
          icon={<Package className="w-8 h-8 text-orange-600 dark:text-orange-400" />}
        />
      </div>

      {/* Batch Overview */}
      {batchStats && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Batch Overview
            </h3>
            <button
              onClick={() => onNavigate('batch')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              View Batch
            </button>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{batchStats.products}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Products</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{batchStats.totalQty}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">QTY Ordered</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${batchStats.totalCost.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Cost</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${batchStats.gross.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Gross</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">${batchStats.net.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Net</p>
            </div>
          </div>

          {/* Top Profitable Products */}
          {batchStats.topProducts.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Top Profitable Products</h4>
              <div className="space-y-1.5">
                {batchStats.topProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                      <span className="text-sm text-gray-900 dark:text-white truncate">{p.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">({p.qty} vials)</span>
                    </div>
                    <span className={`text-sm font-semibold whitespace-nowrap ml-2 ${p.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      ${p.profit.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Vendor count */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            {batchStats.vendors} vendor{batchStats.vendors !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Boxes Overview */}
      {boxStats && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BoxIcon className="w-5 h-5" />
              Boxes Overview
            </h3>
            <button
              onClick={() => onNavigate('boxes')}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium"
            >
              View Boxes
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{boxStats.types}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Box Types</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{boxStats.totalOnHand}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">On Hand</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center border border-blue-200 dark:border-blue-800">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{boxStats.totalOnOrder}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">On Order</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{boxStats.totalDailyUsage}/day</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Daily Usage</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">${boxStats.totalValue.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Inventory Value</p>
            </div>
          </div>

          {/* Suppliers */}
          {boxStats.suppliers.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">Suppliers</p>
              <div className="flex flex-wrap gap-2">
                {boxStats.suppliers.map(s => (
                  <span key={s} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Critical - Low Supply */}
          {boxStats.critical.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5">Low Supply Alert</p>
              <div className="space-y-1.5">
                {boxStats.critical.map((b, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                    <span className="text-sm text-gray-900 dark:text-white">{b.name}</span>
                    <span className={`text-sm font-semibold ${b.daysLeft <= 7 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                      {b.daysLeft} days left
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Daily Tasks Activity Log */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            Daily Tasks
          </h3>
          <button
            onClick={() => onNavigate('daily')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Manage Tasks
          </button>
        </div>

        {activeTasks.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <p>No active tasks. Click "Manage Tasks" to create one.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeTasks.map(task => {
              const getTimeUntilExpiration = (expirationDate) => {
                if (!expirationDate) return null;
                const now = new Date();
                const exp = new Date(expirationDate);
                const diffMs = exp - now;
                const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

                if (diffMs < 0) return { text: 'Overdue', color: 'text-red-600 dark:text-red-400' };
                if (diffHours < 1) return { text: 'Due now', color: 'text-red-600 dark:text-red-400' };
                if (diffHours < 24) return { text: `${diffHours}h left`, color: 'text-orange-600 dark:text-orange-400' };
                return { text: `${Math.floor(diffHours / 24)} days left`, color: 'text-yellow-600 dark:text-yellow-400' };
              };

              const timeInfo = getTimeUntilExpiration(task.expirationDate);
              const getPriorityIcon = (priority) => {
                if (priority === 'critical') return <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />;
                return <Clock className="w-4 h-4 text-gray-400" />;
              };

              return (
                <div
                  key={task.id}
                  onClick={() => onNavigate('daily')}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-gray-200 dark:border-gray-600"
                >
                  {getPriorityIcon(task.priority)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                      {task.title}
                    </p>
                    {timeInfo && (
                      <p className={`text-xs ${timeInfo.color}`}>
                        {timeInfo.text}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    task.priority === 'critical'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                      : task.priority === 'high'
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                  }`}>
                    {task.priority}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Team Minutes */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Team Minutes
          </h3>
          <button
            onClick={() => { setFocusMeetingId(null); setShowMinutesModal(true); }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            View All
          </button>
        </div>

        {recentMeetings.length === 0 ? (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <p>No meetings recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentMeetings.map(meeting => (
              <div
                key={meeting.id}
                onClick={() => { setFocusMeetingId(meeting.id); setShowMinutesModal(true); }}
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors border border-gray-200 dark:border-gray-600"
              >
                <Users className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {meeting.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(meeting.meetingDate).toLocaleDateString()} &middot; {meeting.attendees?.length || 0} attendees
                  </p>
                </div>
                {meeting.actionItems && meeting.actionItems.length > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {meeting.actionItems.filter(a => a.completed).length}/{meeting.actionItems.length} done
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Minutes Modal */}
      {showMinutesModal && (
        <Minutes
          key={focusMeetingId || 'all'}
          onClose={() => setShowMinutesModal(false)}
          focusMeetingId={focusMeetingId}
        />
      )}

      {/* Getting Started or Actions */}
      {stats.total === 0 ? (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-2">Getting Started</h3>
          <p className="text-blue-800 dark:text-blue-300 mb-4">
            Welcome to the Peptide Inventory System! To get started:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-blue-800 dark:text-blue-300">
            <li>Import your inventory CSV file using the "Import CSV" tab</li>
            <li>Review your inventory in the "Inventory" tab</li>
            <li>Monitor sales-ready items in the "Sales Ready" tab</li>
            <li>View reports and analytics in the "Reports" tab</li>
          </ol>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Action Items</h3>
          <div className="space-y-3">
            {stats.needsOrdering > 0 && (
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                <span className="text-orange-900 dark:text-orange-200 font-medium">
                  {stats.needsOrdering} peptide{stats.needsOrdering !== 1 ? 's' : ''} need ordering
                </span>
                <button
                  onClick={() => onNavigate('inventory')}
                  className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 font-medium transition-colors"
                >
                  View →
                </button>
              </div>
            )}
            {stats.needsOrdering === 0 && stats.total > 0 && (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg">
                <span className="text-green-900 dark:text-green-200 font-medium">
                  All peptides have adequate stock levels
                </span>
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryView({ peptides, allPeptides, thresholds, onRefresh, bulkExclude }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your peptide stock levels</p>
        </div>
      </div>
      <InventoryTable
        peptides={peptides}
        allPeptides={allPeptides}
        onRefresh={onRefresh}
        thresholds={thresholds}
        bulkExclude={bulkExclude}
      />
    </div>
  );
}

function LabelingView({ peptides, onRefresh }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Labeling Management</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Track labeled inventory and manage labeling tasks</p>
      </div>
      <Labeling peptides={peptides} onRefresh={onRefresh} />
    </div>
  );
}

function SalesReadyView({ peptides, onRefresh }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Ready Validation</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Two-point check: Purity and Net Weight</p>
      </div>
      <SalesReady peptides={peptides} onRefresh={onRefresh} />
    </div>
  );
}

function ImportView({ onImportComplete, onBatchImportComplete, onBoxImportComplete, peptides, onRefresh }) {
  const [subTab, setSubTab] = useState('csv');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Import & Scan</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Import inventory data or scan pick lists</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-0">
        <button
          onClick={() => setSubTab('csv')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            subTab === 'csv'
              ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Upload className="w-4 h-4" />
          Import CSV
        </button>
        <button
          onClick={() => setSubTab('batch')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            subTab === 'batch'
              ? 'border-green-600 text-green-600 dark:border-green-400 dark:text-green-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Import Batch
        </button>
        <button
          onClick={() => setSubTab('boxes')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            subTab === 'boxes'
              ? 'border-amber-600 text-amber-600 dark:border-amber-400 dark:text-amber-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <BoxIcon className="w-4 h-4" />
          Import Boxes
        </button>
        <button
          onClick={() => setSubTab('scanner')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
            subTab === 'scanner'
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <ScanLine className="w-4 h-4" />
          Pick List Scanner
        </button>
      </div>

      {subTab === 'csv' && <CSVUpload onImportComplete={onImportComplete} />}
      {subTab === 'batch' && <BatchCSVUpload onImportComplete={onBatchImportComplete} />}
      {subTab === 'boxes' && <BoxCSVUpload onImportComplete={onBoxImportComplete} />}
      {subTab === 'scanner' && <PickListScanner peptides={peptides} onRefresh={onRefresh} />}
    </div>
  );
}

function ReportsView({ peptides, orders, thresholds }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reports & Analytics</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Comprehensive inventory analysis and exports</p>
      </div>
      <Reports peptides={peptides} orders={orders} thresholds={thresholds} />
    </div>
  );
}

function PricesView({ peptides }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Prices</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Product pricing by tier — click any cell to edit</p>
      </div>
      <Prices peptides={peptides} />
    </div>
  );
}

function CompareView({ peptides }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Compare Inventory</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Track changes between snapshots to see what was ordered</p>
      </div>
      <Compare peptides={peptides} />
    </div>
  );
}

function StatusCard({ color, label, action, count, active, onClick }) {
  const colors = {
    red: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800',
    orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-800'
  };

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border cursor-pointer transition-all hover:scale-105 ${colors[color]} ${active ? 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-lg' : ''}`}
    >
      <div className="text-2xl font-bold">{count}</div>
      <div className="font-semibold mt-1">{label}</div>
      <div className="text-sm mt-1 opacity-80">{action}</div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div>{icon}</div>
      </div>
    </div>
  );
}

function DailyView() {
  return <Daily />;
}

function BatchView() {
  return <Batch />;
}

function BoxesView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Boxes</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Track box inventory, orders, suppliers, and costs</p>
      </div>
      <Boxes />
    </div>
  );
}

export default App;

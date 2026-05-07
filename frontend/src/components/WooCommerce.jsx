import { useEffect, useMemo, useState } from 'react';
import { ShoppingCart, RefreshCw, AlertTriangle, ExternalLink, Settings as SettingsIcon } from 'lucide-react';
import { db } from '../lib/db';
import { useWooCommerce } from '../hooks/useWooCommerce';
import { useToast } from './Toast';

const TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Products' },
  { id: 'customers', label: 'Customers' },
  { id: 'stock', label: 'Stock' },
];

function formatTimestamp(iso) {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString();
}

function StatusPill({ statusEntry, label }) {
  const error = statusEntry?.error;
  return (
    <div className="text-xs text-gray-600 dark:text-gray-400">
      <span className="font-medium">{label}:</span>{' '}
      {error ? (
        <span className="text-red-600 dark:text-red-400">Error — {error}</span>
      ) : (
        <>
          {statusEntry?.count ?? 0} cached · last sync {formatTimestamp(statusEntry?.lastSyncedAt)}
        </>
      )}
    </div>
  );
}

export default function WooCommerce({ onOpenSettings }) {
  const { isConfigured, status, syncing, syncOrders, syncProducts, syncCustomers } = useWooCommerce();
  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);

  const loadAll = async () => {
    setOrders(await db.woocommerce.orders.getAll());
    setProducts(await db.woocommerce.products.getAll());
    setCustomers(await db.woocommerce.customers.getAll());
  };

  useEffect(() => { loadAll(); }, [status]);

  async function runSync(fn, label) {
    try {
      const res = await fn();
      success(`Synced ${res.count} ${label}`);
      await loadAll();
    } catch (err) {
      showError(`${label} sync failed: ${err.message}`);
    }
  }

  if (!isConfigured) {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <ShoppingCart className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">WooCommerce Not Connected</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Configure your WooCommerce site URL and read-only API keys in Settings → WooCommerce, then return here to sync orders, products, and customers.
        </p>
        <button
          onClick={onOpenSettings}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          <SettingsIcon className="w-4 h-4" />
          Open Settings
        </button>
        <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            Your WC site must allow CORS from this origin. Add a header like
            <code className="px-1">Access-Control-Allow-Origin: {window.location.origin}</code>
            on the WP REST API responses.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sync controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">WooCommerce</h2>
          </div>
          <button
            onClick={onOpenSettings}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center gap-1"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            Settings
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SyncCard
            label="Orders"
            statusEntry={status.orders}
            syncing={syncing.orders}
            onSync={() => runSync(syncOrders, 'orders')}
          />
          <SyncCard
            label="Products"
            statusEntry={status.products}
            syncing={syncing.products}
            onSync={() => runSync(syncProducts, 'products')}
          />
          <SyncCard
            label="Customers"
            statusEntry={status.customers}
            syncing={syncing.customers}
            onSync={() => runSync(syncCustomers, 'customers')}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === t.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && <OrdersTable orders={orders} />}
      {activeTab === 'products' && <ProductsTable products={products} />}
      {activeTab === 'customers' && <CustomersTable customers={customers} />}
      {activeTab === 'stock' && <StockTable products={products} />}
    </div>
  );
}

function SyncCard({ label, statusEntry, syncing, onSync }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900 dark:text-white">{label}</span>
        <button
          onClick={onSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      <StatusPill statusEntry={statusEntry} label="Status" />
    </div>
  );
}

function OrdersTable({ orders }) {
  const sorted = useMemo(() => [...orders].sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || '')), [orders]);
  if (!sorted.length) return <EmptyState message="No orders cached yet — click Sync now above." />;
  return (
    <TableShell columns={['#', 'Date', 'Status', 'Customer', 'Items', 'Total']}>
      {sorted.map(o => (
        <tr key={o.id} className="border-t border-gray-100 dark:border-gray-700">
          <td className="px-3 py-2 font-mono text-xs">#{o.number || o.id}</td>
          <td className="px-3 py-2 whitespace-nowrap">{o.dateCreated ? new Date(o.dateCreated).toLocaleDateString() : '—'}</td>
          <td className="px-3 py-2 capitalize">{o.status}</td>
          <td className="px-3 py-2">{o.customerName || o.customerEmail || `#${o.customerId}`}</td>
          <td className="px-3 py-2 text-right">{o.itemCount}</td>
          <td className="px-3 py-2 text-right font-medium">{(o.total || 0).toFixed(2)} {o.currency}</td>
        </tr>
      ))}
    </TableShell>
  );
}

function ProductsTable({ products }) {
  const sorted = useMemo(() => [...products].sort((a, b) => (a.name || '').localeCompare(b.name || '')), [products]);
  if (!sorted.length) return <EmptyState message="No products cached yet — click Sync now above." />;
  return (
    <TableShell columns={['Name', 'SKU', 'Type', 'Status', 'Price', 'Stock']}>
      {sorted.map(p => (
        <tr key={p.id} className="border-t border-gray-100 dark:border-gray-700">
          <td className="px-3 py-2">{p.name}</td>
          <td className="px-3 py-2 font-mono text-xs">{p.sku || '—'}</td>
          <td className="px-3 py-2 capitalize">{p.type}</td>
          <td className="px-3 py-2 capitalize">{p.status}</td>
          <td className="px-3 py-2 text-right">{(p.price || 0).toFixed(2)}</td>
          <td className="px-3 py-2 text-right">{p.manageStock ? (p.stockQuantity ?? 0) : p.stockStatus}</td>
        </tr>
      ))}
    </TableShell>
  );
}

function CustomersTable({ customers }) {
  const sorted = useMemo(() => [...customers].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)), [customers]);
  if (!sorted.length) return <EmptyState message="No customers cached yet — click Sync now above." />;
  return (
    <TableShell columns={['Name', 'Email', 'Orders', 'Total Spent', 'Joined']}>
      {sorted.map(c => (
        <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700">
          <td className="px-3 py-2">{c.fullName}</td>
          <td className="px-3 py-2">{c.email}</td>
          <td className="px-3 py-2 text-right">{c.ordersCount ?? '—'}</td>
          <td className="px-3 py-2 text-right">{(c.totalSpent || 0).toFixed(2)}</td>
          <td className="px-3 py-2 whitespace-nowrap">{c.dateCreated ? new Date(c.dateCreated).toLocaleDateString() : '—'}</td>
        </tr>
      ))}
    </TableShell>
  );
}

function StockTable({ products }) {
  const stocked = useMemo(() =>
    products
      .filter(p => p.manageStock || p.stockStatus)
      .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0)),
    [products]
  );
  if (!stocked.length) return <EmptyState message="No stock data — sync Products first." />;
  return (
    <TableShell columns={['SKU', 'Name', 'Stock Status', 'On Hand', 'Manage Stock']}>
      {stocked.map(p => {
        const onHand = p.stockQuantity ?? null;
        const lowFlag = p.manageStock && typeof onHand === 'number' && onHand <= 5;
        return (
          <tr key={p.id} className={`border-t border-gray-100 dark:border-gray-700 ${lowFlag ? 'bg-red-50 dark:bg-red-900/20' : ''}`}>
            <td className="px-3 py-2 font-mono text-xs">{p.sku || '—'}</td>
            <td className="px-3 py-2">{p.name}</td>
            <td className="px-3 py-2 capitalize">{p.stockStatus || '—'}</td>
            <td className="px-3 py-2 text-right">{p.manageStock ? (onHand ?? 0) : '—'}</td>
            <td className="px-3 py-2">{p.manageStock ? 'Yes' : 'No'}</td>
          </tr>
        );
      })}
    </TableShell>
  );
}

function TableShell({ columns, children }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
      {message}
    </div>
  );
}

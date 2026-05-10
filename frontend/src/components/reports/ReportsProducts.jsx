import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Package, ShoppingBag, Calculator } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../../lib/db';
import {
  DateRangePicker, PRODUCT_RANGE_OPTIONS, useDateRange,
  filterOrdersByRange, bucketDaily,
} from './dateRanges';

function KpiCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

export default function ReportsProducts({ onBack }) {
  const { range, pickerProps } = useDateRange('last30', PRODUCT_RANGE_OPTIONS);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.woocommerce.orders.getAll(),
      db.woocommerce.products.getAll(),
    ]).then(([o, p]) => {
      if (!active) return;
      setOrders(o);
      setProducts(p);
    });
    return () => { active = false; };
  }, []);

  const productsById = useMemo(
    () => Object.fromEntries(products.map(p => [String(p.id), p])),
    [products]
  );

  const filtered = useMemo(() => filterOrdersByRange(orders, range), [orders, range]);

  const stats = useMemo(() => {
    const productAgg = new Map();
    let totalItems = 0;
    const uniqueProductIds = new Set();
    for (const o of filtered) {
      for (const li of (o.lineItems || [])) {
        const id = String(li.productId || li.sku || li.name);
        if (!productAgg.has(id)) {
          productAgg.set(id, { id, name: li.name, sku: li.sku, qty: 0, revenue: 0 });
        }
        const entry = productAgg.get(id);
        entry.qty += Number(li.quantity) || 0;
        entry.revenue += Number(li.total) || 0;
        totalItems += Number(li.quantity) || 0;
        uniqueProductIds.add(id);
      }
    }
    const byQty = Array.from(productAgg.values()).sort((a, b) => b.qty - a.qty);
    const byRevenue = Array.from(productAgg.values()).sort((a, b) => b.revenue - a.revenue);
    const avgPerOrder = filtered.length ? totalItems / filtered.length : 0;
    return { totalItems, uniqueCount: uniqueProductIds.size, avgPerOrder, byQty, byRevenue };
  }, [filtered]);

  const daily = useMemo(() => bucketDaily(filtered, range), [filtered, range]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ArrowLeft className="w-4 h-4" />
            Reports
          </button>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Products</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">{range.label}</span>
        </div>
        <DateRangePicker {...pickerProps} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KpiCard
          icon={<Package className="w-3.5 h-3.5" />}
          label="Total products ordered"
          value={stats.totalItems.toLocaleString()}
          sub={`Across ${filtered.length.toLocaleString()} orders`}
        />
        <KpiCard
          icon={<ShoppingBag className="w-3.5 h-3.5" />}
          label="Unique products ordered"
          value={stats.uniqueCount.toLocaleString()}
        />
        <KpiCard
          icon={<Calculator className="w-3.5 h-3.5" />}
          label="Products per order (avg)"
          value={stats.avgPerOrder.toFixed(2)}
        />
      </div>

      {/* Items sold graph */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Items sold over time</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{range.start.toLocaleDateString()} → {range.end.toLocaleDateString()}</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="items" stroke="#2563eb" strokeWidth={2} dot={false} name="Items sold" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SmallProductTable title="Top 5 Products by Quantity" rows={stats.byQty.slice(0, 5)} valueKey="qty" valueLabel="Qty" />
        <SmallProductTable title="Top 5 Products by Revenue" rows={stats.byRevenue.slice(0, 5)} valueKey="revenue" valueLabel="Revenue" isMoney />
      </div>

      <FullProductTable title="All Products by Quantity" rows={stats.byQty} valueKey="qty" />
      <FullProductTable title="All Products by Revenue" rows={stats.byRevenue} valueKey="revenue" isMoney />
    </div>
  );
}

function SmallProductTable({ title, rows, valueKey, valueLabel, isMoney }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">#</th>
            <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">Product</th>
            <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 uppercase">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={3} className="px-3 py-4 text-center text-xs text-gray-400">No data in range.</td></tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
              <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
              <td className="px-3 py-2">{r.name || r.sku || '—'}</td>
              <td className="px-3 py-2 text-right font-medium">
                {isMoney ? `$${(r[valueKey] || 0).toFixed(2)}` : (r[valueKey] || 0).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FullProductTable({ title, rows, valueKey, isMoney }) {
  const [query, setQuery] = useState('');
  const filtered = rows.filter(r => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (r.name || '').toLowerCase().includes(q) || (r.sku || '').toLowerCase().includes(q);
  });
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{title}</h3>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search…"
          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
      </div>
      <div className="overflow-x-auto max-h-[420px]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">#</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">Product</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">SKU</th>
              <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 uppercase">{isMoney ? 'Revenue' : 'Qty'}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-gray-400">No matches.</td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                <td className="px-3 py-2">{r.name || '—'}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.sku || '—'}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {isMoney ? `$${(r[valueKey] || 0).toFixed(2)}` : (r[valueKey] || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

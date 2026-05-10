import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, DollarSign, UserPlus, Calendar, TrendingUp, Repeat, ShoppingCart } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { db } from '../../lib/db';
import {
  DateRangePicker, SALES_RANGE_OPTIONS, useDateRange,
  filterOrdersByRange, bucketDaily, priorYearRange,
} from './dateRanges';
import UsStatesMap, { STATE_CODE_TO_NAME, ALL_STATE_NAMES } from './UsStatesMap';

function fmtMoney(n) {
  return `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function KpiCard({ icon, label, value, sub, accent }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-xl font-bold ${accent || 'text-gray-900 dark:text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function nameFromStateField(s) {
  if (!s) return null;
  const upper = s.trim().toUpperCase();
  if (STATE_CODE_TO_NAME[upper]) return STATE_CODE_TO_NAME[upper];
  // Already a full name? Match exact (case-insensitive)
  const match = ALL_STATE_NAMES.find(n => n.toLowerCase() === s.trim().toLowerCase());
  return match || null;
}

export default function ReportsSalesCustomers({ onBack, onGoToProducts }) {
  const { range, pickerProps } = useDateRange('last30', SALES_RANGE_OPTIONS);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      db.woocommerce.orders.getAll(),
      db.woocommerce.customers.getAll(),
    ]).then(([o, c]) => {
      if (!active) return;
      setOrders(o);
      setCustomers(c);
    });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => filterOrdersByRange(orders, range), [orders, range]);
  const priorRange = useMemo(() => priorYearRange(range), [range]);
  const priorFiltered = useMemo(() => filterOrdersByRange(orders, priorRange), [orders, priorRange]);

  const totals = useMemo(() => {
    const sales = filtered.reduce((s, o) => s + (Number(o.total) || 0), 0);
    const orderCount = filtered.length;
    const aov = orderCount ? sales / orderCount : 0;
    const priorSales = priorFiltered.reduce((s, o) => s + (Number(o.total) || 0), 0);
    return { sales, orderCount, aov, priorSales };
  }, [filtered, priorFiltered]);

  const customerStats = useMemo(() => {
    // New customers: customer.dateCreated in range
    const startMs = range.start.getTime();
    const endMs = range.end.getTime();
    const newCustomers = customers.filter(c => {
      if (!c.dateCreated) return false;
      const t = new Date(c.dateCreated).getTime();
      return t >= startMs && t <= endMs;
    }).length;

    // Returning: customers who placed >1 order in range
    const counts = new Map();
    for (const o of filtered) {
      if (!o.customerId) continue;
      counts.set(o.customerId, (counts.get(o.customerId) || 0) + 1);
    }
    let returning = 0;
    for (const n of counts.values()) if (n > 1) returning += 1;
    return { newCustomers, returning };
  }, [customers, filtered, range]);

  const daily = useMemo(() => bucketDaily(filtered, range), [filtered, range]);

  // Sales by state
  const byState = useMemo(() => {
    const counts = {};       // state name -> orders count
    const revenues = {};     // state name -> revenue
    let unknown = 0;
    for (const o of filtered) {
      const country = (o.shippingCountry || o.billingCountry || '').toUpperCase();
      if (country && country !== 'US') continue;
      const stateName = nameFromStateField(o.shippingState) || nameFromStateField(o.billingState);
      if (!stateName) { unknown += 1; continue; }
      counts[stateName] = (counts[stateName] || 0) + 1;
      revenues[stateName] = (revenues[stateName] || 0) + (Number(o.total) || 0);
    }
    return { counts, revenues, unknown };
  }, [filtered]);

  // Most valuable customers (lifetime, from WC customers cache)
  const topCustomers = useMemo(
    () => [...customers].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)).slice(0, 25),
    [customers]
  );

  // Top 5 products by revenue (within filtered range)
  const top5ByRevenue = useMemo(() => {
    const agg = new Map();
    for (const o of filtered) {
      for (const li of (o.lineItems || [])) {
        const id = String(li.productId || li.sku || li.name);
        if (!agg.has(id)) agg.set(id, { id, name: li.name, sku: li.sku, revenue: 0, qty: 0 });
        const entry = agg.get(id);
        entry.revenue += Number(li.total) || 0;
        entry.qty += Number(li.quantity) || 0;
      }
    }
    return Array.from(agg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [filtered]);

  const yoyDelta = totals.priorSales > 0
    ? `${(((totals.sales - totals.priorSales) / totals.priorSales) * 100).toFixed(1)}%`
    : 'N/A';
  const yoyAccent = totals.priorSales > 0
    ? (totals.sales >= totals.priorSales ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
    : 'text-gray-400';

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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sales &amp; Customers</h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">{range.label}</span>
        </div>
        <DateRangePicker {...pickerProps} />
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={<DollarSign className="w-3.5 h-3.5" />} label="Sales" value={fmtMoney(totals.sales)} />
        <KpiCard icon={<UserPlus className="w-3.5 h-3.5" />} label="New customers" value={customerStats.newCustomers.toLocaleString()} />
        <KpiCard
          icon={<Calendar className="w-3.5 h-3.5" />}
          label="vs same period last year"
          value={yoyDelta}
          sub={totals.priorSales > 0 ? `Prior: ${fmtMoney(totals.priorSales)}` : 'No prior data'}
          accent={yoyAccent}
        />
        <KpiCard icon={<TrendingUp className="w-3.5 h-3.5" />} label="Avg order value" value={fmtMoney(totals.aov)} />
        <KpiCard icon={<Repeat className="w-3.5 h-3.5" />} label="Returning customers" value={customerStats.returning.toLocaleString()} sub="2+ orders in range" />
        <KpiCard icon={<ShoppingCart className="w-3.5 h-3.5" />} label="Orders" value={totals.orderCount.toLocaleString()} />
      </div>

      {/* Sales Revenue graph */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Sales Revenue</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">{range.start.toLocaleDateString()} → {range.end.toLocaleDateString()}</span>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} name="Revenue ($)" />
              <Line yAxisId="right" type="monotone" dataKey="items" stroke="#2563eb" strokeWidth={2} dot={false} name="Items sold" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Map + Sales by Location */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Shipments by Region (US)</h3>
          <UsStatesMap countsByState={byState.counts} />
          {byState.unknown > 0 && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {byState.unknown} order{byState.unknown === 1 ? '' : 's'} couldn't be mapped to a state. Re-sync WooCommerce orders if state data is missing.
            </div>
          )}
        </div>
        <div className="xl:col-span-2">
          <SalesByLocationTable counts={byState.counts} revenues={byState.revenues} />
        </div>
      </div>

      <MostValuableCustomersTable rows={topCustomers} />

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Top 5 Products by Revenue</h3>
          <button
            onClick={onGoToProducts}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            See all product sales data →
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">#</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">Product</th>
              <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 uppercase">Qty</th>
              <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {top5ByRevenue.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-4 text-center text-xs text-gray-400">No sales data in range.</td></tr>
            )}
            {top5ByRevenue.map((r, i) => (
              <tr key={r.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                <td className="px-3 py-2">{r.name || r.sku || '—'}</td>
                <td className="px-3 py-2 text-right">{(r.qty || 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtMoney(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesByLocationTable({ counts, revenues }) {
  const rows = ALL_STATE_NAMES.map(name => ({
    state: name,
    orders: counts[name] || 0,
    revenue: revenues[name] || 0,
  }));
  const sorted = rows.sort((a, b) => b.revenue - a.revenue || b.orders - a.orders || a.state.localeCompare(b.state));
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Sales by Location</h3>
      </div>
      <div className="overflow-y-auto max-h-[460px]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">State</th>
              <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 uppercase">Orders</th>
              <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(r => (
              <tr key={r.state} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-2">{r.state}</td>
                <td className="px-3 py-2 text-right">{r.orders.toLocaleString()}</td>
                <td className="px-3 py-2 text-right">{fmtMoney(r.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MostValuableCustomersTable({ rows }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Most Valuable Customers (lifetime)</h3>
      </div>
      <div className="overflow-x-auto max-h-[460px]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">#</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">Name</th>
              <th className="px-3 py-2 text-left text-xs text-gray-500 dark:text-gray-400 uppercase">Email</th>
              <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 uppercase">Orders</th>
              <th className="px-3 py-2 text-right text-xs text-gray-500 dark:text-gray-400 uppercase">Total Spent</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-xs text-gray-400">No customer data — sync customers from WooCommerce.</td></tr>
            )}
            {rows.map((c, i) => (
              <tr key={c.id} className="border-t border-gray-100 dark:border-gray-700">
                <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                <td className="px-3 py-2">{c.fullName || `${c.firstName || ''} ${c.lastName || ''}`.trim() || '—'}</td>
                <td className="px-3 py-2">{c.email || '—'}</td>
                <td className="px-3 py-2 text-right">{(c.ordersCount ?? 0).toLocaleString()}</td>
                <td className="px-3 py-2 text-right font-medium">{fmtMoney(c.totalSpent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

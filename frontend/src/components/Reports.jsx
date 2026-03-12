import { useMemo, useState, useEffect } from 'react';
import { Download, TrendingUp, Clock, Package, CheckCircle, AlertTriangle, FileText, PieChart as PieChartIcon, BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon, ArrowUpDown, Tag } from 'lucide-react';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { calculateStockStatus } from '../utils/stockStatus';
import { checkSalesReadiness } from '../utils/salesReadiness';
import { exportToCSV, downloadCSV } from '../utils/csvParser';
import { db } from '../lib/db';

export default function Reports({ peptides, orders = [], thresholds }) {
  const [chartType, setChartType] = useState('pie'); // pie, bar, line, area
  const [velocityChartType, setVelocityChartType] = useState('line'); // line, bar, area
  const [transactions, setTransactions] = useState([]);
  const [timeRange, setTimeRange] = useState(30); // days to show
  const [lowStockSort, setLowStockSort] = useState({ field: 'peptideId', direction: 'asc' });
  const [missingReqSort, setMissingReqSort] = useState({ field: 'peptideId', direction: 'asc' });
  const [labelingSort, setLabelingSort] = useState({ field: 'labeledCount', direction: 'asc' });

  // Custom tooltip style for charts with semi-transparent background and bright text
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: 'rgba(31, 41, 55, 0.85)', // Semi-transparent dark background
      border: 'none',
      borderRadius: '8px',
      backdropFilter: 'blur(4px)', // Add blur for better readability
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.2)'
    },
    labelStyle: {
      color: '#f3f4f6', // Bright light gray for labels
      fontWeight: 'bold'
    },
    itemStyle: {
      color: '#e5e7eb' // Bright light gray for items
    }
  };

  // Fetch transactions
  useEffect(() => {
    const fetchTransactions = async () => {
      const allTransactions = await db.transactions.getAll();
      setTransactions(allTransactions);
    };
    fetchTransactions();
  }, []);

  // Calculate comprehensive statistics
  const stats = useMemo(() => {
    const peptidesWithStatus = peptides.map(p => {
      const quantity = Number(p.quantity) || 0;
      const labeledCount = Number(p.labeledCount) || 0;

      // Calculate off books
      let offBooks;
      if (quantity === 0 && labeledCount > 0) {
        // No official stock but items are labeled - all labeled items are off books
        offBooks = labeledCount;
      } else if (quantity < 0) {
        // Negative quantity (backorder) - subtract absolute value from labeled
        offBooks = Math.max(0, labeledCount - Math.abs(quantity));
      } else {
        // Positive quantity - normal calculation
        offBooks = Math.max(0, labeledCount - quantity);
      }

      return {
        ...p,
        offBooks,
        status: calculateStockStatus(quantity, thresholds, p.hasActiveOrder),
        readiness: checkSalesReadiness(p)
      };
    });

    const statusCounts = {
      outOfStock: 0,
      nearlyOut: 0,
      lowStock: 0,
      goodStock: 0,
      onOrder: 0
    };

    let totalValue = 0;
    let lowStockItems = [];
    let salesReadyCount = 0;
    let needsAttention = [];

    peptidesWithStatus.forEach(p => {
      // Status counts
      if (p.status === 'OUT_OF_STOCK') statusCounts.outOfStock++;
      else if (p.status === 'NEARLY_OUT') statusCounts.nearlyOut++;
      else if (p.status === 'LOW_STOCK') statusCounts.lowStock++;
      else if (p.status === 'GOOD_STOCK') statusCounts.goodStock++;
      else if (p.status === 'ON_ORDER') statusCounts.onOrder++;

      // Total inventory value (quantity as proxy)
      totalValue += Number(p.quantity) || 0;

      // Low stock items
      if (p.status === 'OUT_OF_STOCK' || p.status === 'NEARLY_OUT' || p.status === 'LOW_STOCK') {
        lowStockItems.push(p);
      }

      // Sales ready count
      if (p.readiness.isReady) {
        salesReadyCount++;
      } else if (p.quantity > 0) {
        needsAttention.push(p);
      }
    });

    // Operational metrics from orders
    const completedOrders = orders.filter(o => o.dateResultsReceived);
    let avgOrderToDelivery = 0;
    let avgTestingTurnaround = 0;

    if (completedOrders.length > 0) {
      const orderToDeliveryTimes = completedOrders
        .filter(o => o.dateOrdered && o.dateArrived)
        .map(o => {
          const ordered = new Date(o.dateOrdered);
          const arrived = new Date(o.dateArrived);
          return Math.ceil((arrived - ordered) / (1000 * 60 * 60 * 24)); // days
        });

      const testingTimes = completedOrders
        .filter(o => o.dateSentForTesting && o.dateResultsReceived)
        .map(o => {
          const sent = new Date(o.dateSentForTesting);
          const received = new Date(o.dateResultsReceived);
          return Math.ceil((received - sent) / (1000 * 60 * 60 * 24)); // days
        });

      if (orderToDeliveryTimes.length > 0) {
        avgOrderToDelivery = Math.round(
          orderToDeliveryTimes.reduce((a, b) => a + b, 0) / orderToDeliveryTimes.length
        );
      }

      if (testingTimes.length > 0) {
        avgTestingTurnaround = Math.round(
          testingTimes.reduce((a, b) => a + b, 0) / testingTimes.length
        );
      }
    }

    // Items needing labeling: has stock but not fully labeled, sorted by lowest labeled count
    const needsLabeling = peptidesWithStatus
      .filter(p => {
        const qty = Number(p.quantity) || 0;
        const lbl = Number(p.labeledCount) || 0;
        return qty > 0 && lbl < qty;
      })
      .sort((a, b) => (Number(a.labeledCount) || 0) - (Number(b.labeledCount) || 0))
      .slice(0, 100);

    return {
      total: peptides.length,
      statusCounts,
      totalValue,
      lowStockItems: lowStockItems.slice(0, 10), // Top 10
      salesReadyCount,
      salesReadyPercent: peptides.length > 0 ? Math.round((salesReadyCount / peptides.length) * 100) : 0,
      needsAttention: needsAttention.slice(0, 10), // Top 10
      needsLabeling,
      avgOrderToDelivery,
      avgTestingTurnaround,
      activeOrders: orders.filter(o => !o.dateResultsReceived).length,
      completedOrders: completedOrders.length
    };
  }, [peptides, orders, thresholds]);

  // Chart data
  const chartData = useMemo(() => {
    const COLORS = {
      outOfStock: '#ef4444',
      nearlyOut: '#f97316',
      lowStock: '#eab308',
      goodStock: '#22c55e',
      onOrder: '#14b8a6'
    };

    // Stock Status Data
    const stockData = [
      { name: 'Out of Stock', value: stats.statusCounts.outOfStock, color: COLORS.outOfStock },
      { name: 'Nearly Out', value: stats.statusCounts.nearlyOut, color: COLORS.nearlyOut },
      { name: 'Low Stock', value: stats.statusCounts.lowStock, color: COLORS.lowStock },
      { name: 'Good Stock', value: stats.statusCounts.goodStock, color: COLORS.goodStock },
      { name: 'On Order', value: stats.statusCounts.onOrder, color: COLORS.onOrder }
    ].filter(d => d.value > 0);

    // Sales Readiness Data
    const salesData = [
      { name: 'Sales Ready', value: stats.salesReadyCount, color: '#22c55e' },
      { name: 'Need Attention', value: stats.total - stats.salesReadyCount, color: '#f97316' }
    ].filter(d => d.value > 0);

    return { stockData, salesData, COLORS };
  }, [stats]);

  // Velocity data
  const velocityData = useMemo(() => {
    if (transactions.length === 0) {
      return { timeSeriesData: [], productComparisonData: [], topProducts: [] };
    }

    const salesTransactions = transactions.filter(t => t.type === 'sale');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);

    // Filter transactions within time range
    const recentTransactions = salesTransactions.filter(t =>
      new Date(t.date) >= cutoffDate
    );

    // Group by date for time series
    const dateGroups = {};
    recentTransactions.forEach(t => {
      const date = new Date(t.date).toISOString().split('T')[0];
      if (!dateGroups[date]) {
        dateGroups[date] = 0;
      }
      dateGroups[date] += t.quantity;
    });

    const timeSeriesData = Object.keys(dateGroups)
      .sort()
      .map(date => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales: dateGroups[date]
      }));

    // Group by product for comparison
    const productGroups = {};
    salesTransactions.forEach(t => {
      if (!productGroups[t.peptideId]) {
        productGroups[t.peptideId] = 0;
      }
      productGroups[t.peptideId] += t.quantity;
    });

    const productComparisonData = Object.keys(productGroups)
      .map(peptideId => ({
        name: peptideId,
        sales: productGroups[peptideId]
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 15); // Top 15 products

    const topProducts = productComparisonData.slice(0, 5);

    return { timeSeriesData, productComparisonData, topProducts };
  }, [transactions, timeRange]);

  const handleExportInventory = () => {
    const csvContent = exportToCSV(peptides);
    downloadCSV(csvContent, `oath-inventory-report-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportSummary = () => {
    const summary = `Oath Research Inventory Summary Report
Generated: ${new Date().toLocaleString()}

=== INVENTORY OVERVIEW ===
Total Peptides: ${stats.total}
Total Inventory Units: ${stats.totalValue}
Sales Ready: ${stats.salesReadyCount} (${stats.salesReadyPercent}%)

=== STOCK STATUS ===
Out of Stock: ${stats.statusCounts.outOfStock}
Nearly Out: ${stats.statusCounts.nearlyOut}
Low Stock: ${stats.statusCounts.lowStock}
Good Stock: ${stats.statusCounts.goodStock}
On Order: ${stats.statusCounts.onOrder}

=== OPERATIONAL METRICS ===
Active Orders: ${stats.activeOrders}
Completed Orders: ${stats.completedOrders}
Avg Order-to-Delivery: ${stats.avgOrderToDelivery} days
Avg Testing Turnaround: ${stats.avgTestingTurnaround} days

=== ITEMS NEEDING ATTENTION ===
${stats.needsAttention.map(p =>
  `${p.peptideId} - Missing: ${p.readiness.missing.join(', ')}`
).join('\n')}
`;

    const blob = new Blob([summary], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oath-summary-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Export Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleExportInventory}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export Full Inventory (CSV)</span>
        </button>
        <button
          onClick={handleExportSummary}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span>Export Summary Report (TXT)</span>
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Peptides"
          value={stats.total}
          subtitle="In system"
          icon={<Package className="w-8 h-8 text-blue-600" />}
          color="blue"
        />
        <MetricCard
          title="Sales Ready"
          value={`${stats.salesReadyPercent}%`}
          subtitle={`${stats.salesReadyCount} of ${stats.total}`}
          icon={<CheckCircle className="w-8 h-8 text-green-600" />}
          color="green"
        />
        <MetricCard
          title="Need Attention"
          value={stats.lowStockItems.length}
          subtitle="Low or out of stock"
          icon={<AlertTriangle className="w-8 h-8 text-orange-600" />}
          color="orange"
        />
        <MetricCard
          title="Total Units"
          value={stats.totalValue}
          subtitle="In inventory"
          icon={<TrendingUp className="w-8 h-8 text-purple-600" />}
          color="purple"
        />
      </div>

      {/* Operational Metrics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Operational Metrics</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Active Orders</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.activeOrders}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Completed Orders</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.completedOrders}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Order→Delivery</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.avgOrderToDelivery > 0 ? `${stats.avgOrderToDelivery}d` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Avg Testing Time</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.avgTestingTurnaround > 0 ? `${stats.avgTestingTurnaround}d` : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Stock Status Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Stock Status Breakdown</h3>
        <div className="space-y-3">
          <StatusBar
            label="Out of Stock"
            count={stats.statusCounts.outOfStock}
            total={stats.total}
            color="bg-red-500"
          />
          <StatusBar
            label="Nearly Out"
            count={stats.statusCounts.nearlyOut}
            total={stats.total}
            color="bg-orange-500"
          />
          <StatusBar
            label="Low Stock"
            count={stats.statusCounts.lowStock}
            total={stats.total}
            color="bg-yellow-500"
          />
          <StatusBar
            label="Good Stock"
            count={stats.statusCounts.goodStock}
            total={stats.total}
            color="bg-green-500"
          />
          <StatusBar
            label="On Order"
            count={stats.statusCounts.onOrder}
            total={stats.total}
            color="bg-teal-500"
          />
        </div>
      </div>

      {/* Interactive Charts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-0">
            Data Visualizations
          </h3>

          {/* Chart Type Toggle */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setChartType('pie')}
              className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                chartType === 'pie'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <PieChartIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Pie</span>
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                chartType === 'bar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm font-medium">Bar</span>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                chartType === 'line'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <LineChartIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Line</span>
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                chartType === 'area'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              <AreaChartIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Area</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stock Status Chart */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Stock Status Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              {chartType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={chartData.stockData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.stockData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                </PieChart>
              ) : chartType === 'bar' ? (
                <BarChart data={chartData.stockData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                  <Legend />
                  <Bar dataKey="value" name="Count">
                    {chartData.stockData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={chartData.stockData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} name="Count" />
                </LineChart>
              ) : (
                <AreaChart data={chartData.stockData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Count" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Sales Readiness Chart */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Sales Readiness Status</h4>
            <ResponsiveContainer width="100%" height={300}>
              {chartType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={chartData.salesData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {chartData.salesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                </PieChart>
              ) : chartType === 'bar' ? (
                <BarChart data={chartData.salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                  <Legend />
                  <Bar dataKey="value" name="Count">
                    {chartData.salesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={chartData.salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} name="Count" />
                </LineChart>
              ) : (
                <AreaChart data={chartData.salesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                  <Legend />
                  <Area type="monotone" dataKey="value" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Count" />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Sales Velocity Charts */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Sales Velocity Tracking
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Track product sales performance and trends over time
            </p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setVelocityChartType('line')}
                className={`p-2 rounded ${
                  velocityChartType === 'line'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title="Line Chart"
              >
                <LineChartIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setVelocityChartType('bar')}
                className={`p-2 rounded ${
                  velocityChartType === 'bar'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title="Bar Chart"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setVelocityChartType('area')}
                className={`p-2 rounded ${
                  velocityChartType === 'area'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title="Area Chart"
              >
                <AreaChartIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 mb-2">No transaction data yet</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Start recording sales to see velocity trends
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Time Series Chart */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Sales Over Time
              </h4>
              {velocityData.timeSeriesData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                  No sales in selected time range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  {velocityChartType === 'line' ? (
                    <LineChart data={velocityData.timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                      <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={2} name="Units Sold" />
                    </LineChart>
                  ) : velocityChartType === 'bar' ? (
                    <BarChart data={velocityData.timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                      <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                      <Legend />
                      <Bar dataKey="sales" fill="#3b82f6" name="Units Sold" />
                    </BarChart>
                  ) : (
                    <AreaChart data={velocityData.timeSeriesData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                      <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '12px' }} />
                      <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                      <Legend />
                      <Area type="monotone" dataKey="sales" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="Units Sold" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* Product Comparison Chart */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Top Products by Sales
              </h4>
              {velocityData.productComparisonData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
                  No product sales data
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={velocityData.productComparisonData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                    <XAxis type="number" stroke="#6b7280" style={{ fontSize: '12px' }} />
                    <YAxis type="category" dataKey="name" stroke="#6b7280" style={{ fontSize: '12px' }} width={100} />
                    <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                    <Legend />
                    <Bar dataKey="sales" fill="#10b981" name="Total Units Sold" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}

        {/* Top Performers Summary */}
        {velocityData.topProducts.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Top 5 Best Sellers (All Time)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {velocityData.topProducts.map((product, index) => (
                <div
                  key={product.name}
                  className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      #{index + 1}
                    </span>
                    <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate" title={product.name}>
                    {product.name}
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                    {product.sales}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    units sold
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Low Stock Items */}
      {stats.lowStockItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Items Needing Immediate Attention
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => {
                      setLowStockSort({
                        field: 'peptideId',
                        direction: lowStockSort.field === 'peptideId' && lowStockSort.direction === 'asc' ? 'desc' : 'asc'
                      });
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Product</span>
                      <ArrowUpDown className={`w-4 h-4 ${lowStockSort.field === 'peptideId' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {lowStockSort.field === 'peptideId' && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {lowStockSort.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => {
                      setLowStockSort({
                        field: 'status',
                        direction: lowStockSort.field === 'status' && lowStockSort.direction === 'asc' ? 'desc' : 'asc'
                      });
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Status</span>
                      <ArrowUpDown className={`w-4 h-4 ${lowStockSort.field === 'status' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {lowStockSort.field === 'status' && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {lowStockSort.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => {
                      setLowStockSort({
                        field: 'quantity',
                        direction: lowStockSort.field === 'quantity' && lowStockSort.direction === 'asc' ? 'desc' : 'asc'
                      });
                    }}
                  >
                    <div className="flex items-center justify-end space-x-2">
                      <span>Quantity</span>
                      <ArrowUpDown className={`w-4 h-4 ${lowStockSort.field === 'quantity' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {lowStockSort.field === 'quantity' && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {lowStockSort.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[...stats.lowStockItems].sort((a, b) => {
                  let aVal = a[lowStockSort.field];
                  let bVal = b[lowStockSort.field];

                  if (lowStockSort.field === 'peptideId') {
                    aVal = a.nickname || a.peptideId || '';
                    bVal = b.nickname || b.peptideId || '';
                  }

                  if (lowStockSort.field === 'status') {
                    const statusPriority = { 'OUT_OF_STOCK': 1, 'NEARLY_OUT': 2, 'LOW_STOCK': 3 };
                    aVal = statusPriority[aVal] || 999;
                    bVal = statusPriority[bVal] || 999;
                  }

                  if (lowStockSort.field === 'quantity') {
                    aVal = Number(aVal) || 0;
                    bVal = Number(bVal) || 0;
                  }

                  if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                  if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                  if (aVal < bVal) return lowStockSort.direction === 'asc' ? -1 : 1;
                  if (aVal > bVal) return lowStockSort.direction === 'asc' ? 1 : -1;
                  return 0;
                }).map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                      {item.nickname || item.peptideId}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500 dark:text-gray-400">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Needs Labeling - Top 100 */}
      {stats.needsLabeling.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Needs Labeling ({stats.needsLabeling.length})
            </h3>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Top 100 products needing labels, sorted by lowest labeled count first.
          </p>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-8">#</th>
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => setLabelingSort({ field: 'peptideId', direction: labelingSort.field === 'peptideId' && labelingSort.direction === 'asc' ? 'desc' : 'asc' })}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Product</span>
                      <ArrowUpDown className={`w-4 h-4 ${labelingSort.field === 'peptideId' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {labelingSort.field === 'peptideId' && <span className="text-xs text-blue-600 dark:text-blue-400">{labelingSort.direction === 'asc' ? '\u2191' : '\u2193'}</span>}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => setLabelingSort({ field: 'quantity', direction: labelingSort.field === 'quantity' && labelingSort.direction === 'asc' ? 'desc' : 'asc' })}
                  >
                    <div className="flex items-center justify-end space-x-2">
                      <span>Qty</span>
                      <ArrowUpDown className={`w-4 h-4 ${labelingSort.field === 'quantity' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {labelingSort.field === 'quantity' && <span className="text-xs text-blue-600 dark:text-blue-400">{labelingSort.direction === 'asc' ? '\u2191' : '\u2193'}</span>}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => setLabelingSort({ field: 'labeledCount', direction: labelingSort.field === 'labeledCount' && labelingSort.direction === 'asc' ? 'desc' : 'asc' })}
                  >
                    <div className="flex items-center justify-end space-x-2">
                      <span>Labeled</span>
                      <ArrowUpDown className={`w-4 h-4 ${labelingSort.field === 'labeledCount' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {labelingSort.field === 'labeledCount' && <span className="text-xs text-blue-600 dark:text-blue-400">{labelingSort.direction === 'asc' ? '\u2191' : '\u2193'}</span>}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => setLabelingSort({ field: 'remaining', direction: labelingSort.field === 'remaining' && labelingSort.direction === 'asc' ? 'desc' : 'asc' })}
                  >
                    <div className="flex items-center justify-end space-x-2">
                      <span>Remaining</span>
                      <ArrowUpDown className={`w-4 h-4 ${labelingSort.field === 'remaining' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {labelingSort.field === 'remaining' && <span className="text-xs text-blue-600 dark:text-blue-400">{labelingSort.direction === 'asc' ? '\u2191' : '\u2193'}</span>}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => setLabelingSort({ field: 'progress', direction: labelingSort.field === 'progress' && labelingSort.direction === 'asc' ? 'desc' : 'asc' })}
                  >
                    <div className="flex items-center justify-end space-x-2">
                      <span>Progress</span>
                      <ArrowUpDown className={`w-4 h-4 ${labelingSort.field === 'progress' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {labelingSort.field === 'progress' && <span className="text-xs text-blue-600 dark:text-blue-400">{labelingSort.direction === 'asc' ? '\u2191' : '\u2193'}</span>}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[...stats.needsLabeling].sort((a, b) => {
                  let aVal, bVal;
                  const aQty = Number(a.quantity) || 0;
                  const bQty = Number(b.quantity) || 0;
                  const aLbl = Number(a.labeledCount) || 0;
                  const bLbl = Number(b.labeledCount) || 0;

                  if (labelingSort.field === 'progress') {
                    aVal = aQty > 0 ? (aLbl / aQty) * 100 : 0;
                    bVal = bQty > 0 ? (bLbl / bQty) * 100 : 0;
                  } else if (labelingSort.field === 'remaining') {
                    aVal = aQty - aLbl;
                    bVal = bQty - bLbl;
                  } else if (labelingSort.field === 'labeledCount') {
                    aVal = aLbl;
                    bVal = bLbl;
                  } else if (labelingSort.field === 'quantity') {
                    aVal = aQty;
                    bVal = bQty;
                  } else {
                    aVal = (a.nickname || a.peptideId || '').toLowerCase();
                    bVal = (b.nickname || b.peptideId || '').toLowerCase();
                  }

                  if (aVal < bVal) return labelingSort.direction === 'asc' ? -1 : 1;
                  if (aVal > bVal) return labelingSort.direction === 'asc' ? 1 : -1;
                  return 0;
                }).map((item, index) => {
                  const qty = Number(item.quantity) || 0;
                  const lbl = Number(item.labeledCount) || 0;
                  const remaining = qty - lbl;
                  const pct = qty > 0 ? Math.round((lbl / qty) * 100) : 0;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-2 text-xs text-gray-400 dark:text-gray-500">{index + 1}</td>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                        {item.nickname || item.peptideId}
                      </td>
                      <td className="px-4 py-2 text-sm text-right text-gray-500 dark:text-gray-400">{qty}</td>
                      <td className="px-4 py-2 text-sm text-right text-gray-500 dark:text-gray-400">{lbl}</td>
                      <td className="px-4 py-2 text-sm text-right font-medium text-orange-600 dark:text-orange-400">{remaining}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${pct === 0 ? 'bg-red-500' : pct < 50 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Items Missing Requirements */}
      {stats.needsAttention.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Items Missing Sales Requirements
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => {
                      setMissingReqSort({
                        field: 'peptideId',
                        direction: missingReqSort.field === 'peptideId' && missingReqSort.direction === 'asc' ? 'desc' : 'asc'
                      });
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Product</span>
                      <ArrowUpDown className={`w-4 h-4 ${missingReqSort.field === 'peptideId' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {missingReqSort.field === 'peptideId' && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {missingReqSort.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => {
                      setMissingReqSort({
                        field: 'missing',
                        direction: missingReqSort.field === 'missing' && missingReqSort.direction === 'asc' ? 'desc' : 'asc'
                      });
                    }}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Missing Requirements</span>
                      <ArrowUpDown className={`w-4 h-4 ${missingReqSort.field === 'missing' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {missingReqSort.field === 'missing' && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {missingReqSort.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => {
                      setMissingReqSort({
                        field: 'quantity',
                        direction: missingReqSort.field === 'quantity' && missingReqSort.direction === 'asc' ? 'desc' : 'asc'
                      });
                    }}
                  >
                    <div className="flex items-center justify-end space-x-2">
                      <span>Quantity</span>
                      <ArrowUpDown className={`w-4 h-4 ${missingReqSort.field === 'quantity' ? 'text-blue-600 dark:text-blue-400' : ''}`} />
                      {missingReqSort.field === 'quantity' && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {missingReqSort.direction === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[...stats.needsAttention].sort((a, b) => {
                  let aVal = a[missingReqSort.field];
                  let bVal = b[missingReqSort.field];

                  if (missingReqSort.field === 'missing') {
                    aVal = a.readiness.missing.join(', ').toLowerCase();
                    bVal = b.readiness.missing.join(', ').toLowerCase();
                  }

                  if (missingReqSort.field === 'quantity') {
                    aVal = Number(aVal) || 0;
                    bVal = Number(bVal) || 0;
                  }

                  if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                  if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                  if (aVal < bVal) return missingReqSort.direction === 'asc' ? -1 : 1;
                  if (aVal > bVal) return missingReqSort.direction === 'asc' ? 1 : -1;
                  return 0;
                }).map(item => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-white">
                      {item.nickname || item.peptideId}
                    </td>
                    <td className="px-4 py-2 text-sm text-red-600 dark:text-red-400">
                      {item.readiness.missing.join(', ')}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-500 dark:text-gray-400">
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, subtitle, icon, color }) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
  };

  return (
    <div className={`rounded-lg border p-4 transition-colors ${colors[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>
        <div>{icon}</div>
      </div>
    </div>
  );
}

function StatusBar({ label, count, total, color }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-gray-600 dark:text-gray-400">
          {count} ({percentage}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${color}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    OUT_OF_STOCK: { label: 'Out', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
    NEARLY_OUT: { label: 'Nearly Out', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
    LOW_STOCK: { label: 'Low', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
    GOOD_STOCK: { label: 'Good', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    ON_ORDER: { label: 'On Order', className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' }
  };

  const { label, className } = config[status] || config.GOOD_STOCK;

  return (
    <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
}

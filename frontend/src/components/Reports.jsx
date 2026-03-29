import { useMemo, useState, useEffect } from 'react';
import { Download, TrendingUp, Clock, Package, CheckCircle, AlertTriangle, FileText, PieChart as PieChartIcon, BarChart3, LineChart as LineChartIcon, AreaChart as AreaChartIcon, ArrowUpDown, Tag, Layers, DollarSign, Activity, Timer } from 'lucide-react';
import { PieChart, Pie, BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis } from 'recharts';
import { calculateStockStatus } from '../utils/stockStatus';
import { checkSalesReadiness } from '../utils/salesReadiness';
import { exportToCSV, downloadCSV } from '../utils/csvParser';
import { db } from '../lib/db';

export default function Reports({ peptides, orders = [], thresholds }) {
  const [chartType, setChartType] = useState('pie'); // pie, bar, line, area
  const [lowStockSort, setLowStockSort] = useState({ field: 'peptideId', direction: 'asc' });
  const [missingReqSort, setMissingReqSort] = useState({ field: 'peptideId', direction: 'asc' });
  const [labelingSort, setLabelingSort] = useState({ field: 'labeledCount', direction: 'asc' });
  const [batchItems, setBatchItems] = useState([]);
  const [batchSort, setBatchSort] = useState({ field: 'profitPerBatch', direction: 'desc' });
  const [velocityHistoryData, setVelocityHistoryData] = useState({});
  const [invVelocityChartType, setInvVelocityChartType] = useState('bar');
  const [invVelocitySort, setInvVelocitySort] = useState({ field: 'velocity', direction: 'desc' });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [boxItems, setBoxItems] = useState([]);
  const [earningsPerSec, setEarningsPerSec] = useState(0);
  const [liveEarnings, setLiveEarnings] = useState(0);
  const [earningsStartTime, setEarningsStartTime] = useState(null);

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

  // Fetch batch data
  useEffect(() => {
    const fetchBatch = async () => {
      const items = await db.batches.getAll();
      setBatchItems(items);
    };
    fetchBatch();
  }, []);

  // Fetch box data
  useEffect(() => {
    const fetchBoxes = async () => {
      try {
        const items = await db.boxes.getAll();
        setBoxItems(items);
      } catch (e) { console.error('Failed to load boxes:', e); }
    };
    fetchBoxes();
  }, []);

  // Fetch velocity history
  useEffect(() => {
    const fetchVelocityHistory = async () => {
      try {
        const allHistory = await db.velocityHistory.getAll();
        setVelocityHistoryData(allHistory);
      } catch (e) {
        console.error('Failed to load velocity history:', e);
      }
    };
    fetchVelocityHistory();
  }, []);

  // Batch analytics
  const batchAnalytics = useMemo(() => {
    if (batchItems.length === 0) return null;

    let totalCost = 0, totalGross = 0, totalQty = 0, totalRevenue = 0;
    const vendorBreakdown = {};
    const productData = [];

    batchItems.forEach(item => {
      const pricePerBox = Number(item.pricePerBox) || 0;
      const qtyPurchased = Number(item.qtyPurchased) || 0;
      const srgSale = Number(item.srgSale) || 0;
      const pricePerVial = pricePerBox / 10;
      const cost = pricePerBox * (qtyPurchased / 10);
      const revenue = srgSale * qtyPurchased;
      const profitBatch = (srgSale - pricePerVial) * qtyPurchased;
      const profitPct = pricePerVial > 0 ? ((srgSale - pricePerVial) / pricePerVial) * 100 : 0;

      totalCost += cost;
      totalGross += profitBatch;
      totalQty += qtyPurchased;
      totalRevenue += revenue;

      const vendor = item.vendor || 'Unknown';
      if (!vendorBreakdown[vendor]) vendorBreakdown[vendor] = { cost: 0, profit: 0, qty: 0, products: 0 };
      vendorBreakdown[vendor].cost += cost;
      vendorBreakdown[vendor].profit += profitBatch;
      vendorBreakdown[vendor].qty += qtyPurchased;
      vendorBreakdown[vendor].products += 1;

      productData.push({
        name: item.name || item.productId || '?',
        productId: item.productId || '',
        vendor,
        qtyPurchased,
        pricePerVial,
        srgSale,
        cost,
        revenue,
        profitPerBatch: profitBatch,
        profitPct,
      });
    });

    const avgMargin = totalCost > 0 ? ((totalGross) / totalCost) * 100 : 0;
    const net = totalGross - totalCost;

    return {
      totalCost,
      totalGross,
      net,
      totalQty,
      totalRevenue,
      avgMargin,
      products: batchItems.length,
      vendorBreakdown,
      productData,
    };
  }, [batchItems]);

  const sortedBatchProducts = useMemo(() => {
    if (!batchAnalytics) return [];
    const items = [...batchAnalytics.productData];
    items.sort((a, b) => {
      const aVal = a[batchSort.field] ?? '';
      const bVal = b[batchSort.field] ?? '';
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) return batchSort.direction === 'asc' ? aNum - bNum : bNum - aNum;
      const cmp = String(aVal).localeCompare(String(bVal));
      return batchSort.direction === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [batchAnalytics, batchSort]);

  const handleBatchSort = (field) => {
    setBatchSort(prev => ({ field, direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  // Inventory velocity analytics — uses velocity field from peptide data
  const invVelocityAnalytics = useMemo(() => {
    // Parse velocity values from peptides
    const productsWithVelocity = peptides
      .filter(p => p.velocity && String(p.velocity).trim() !== '')
      .map(p => {
        const name = p.nickname || p.peptideName || p.peptideId;
        const vel = parseFloat(String(p.velocity).replace(/[^0-9.-]/g, ''));
        const qty = Number(p.quantity) || 0;
        const daysLeft = p.daysLeft ? parseFloat(String(p.daysLeft).replace(/[^0-9.-]/g, '')) : (vel > 0 ? qty / vel : null);
        return {
          id: p.peptideId,
          name,
          velocity: isNaN(vel) ? 0 : vel,
          velocityRaw: p.velocity,
          quantity: qty,
          daysLeft: daysLeft !== null && !isNaN(daysLeft) ? Math.round(daysLeft * 10) / 10 : null,
        };
      })
      .filter(p => p.velocity > 0);

    // Sort by velocity descending for rankings
    const ranked = [...productsWithVelocity].sort((a, b) => b.velocity - a.velocity);
    const top15 = ranked.slice(0, 15);

    // Velocity tiers
    const maxVel = ranked.length > 0 ? ranked[0].velocity : 1;
    const tiers = { high: 0, medium: 0, low: 0 };
    productsWithVelocity.forEach(p => {
      if (p.velocity >= maxVel * 0.6) tiers.high++;
      else if (p.velocity >= maxVel * 0.25) tiers.medium++;
      else tiers.low++;
    });

    const tierData = [
      { name: 'High Velocity', value: tiers.high, color: '#ef4444' },
      { name: 'Medium Velocity', value: tiers.medium, color: '#f59e0b' },
      { name: 'Low Velocity', value: tiers.low, color: '#22c55e' },
    ].filter(d => d.value > 0);

    // Days left analysis — products at risk (sorted ascending = lowest days first)
    const daysLeftData = productsWithVelocity
      .filter(p => p.daysLeft !== null && p.daysLeft >= 0)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 20);

    // Velocity vs stock scatter data
    const scatterData = productsWithVelocity.map(p => ({
      name: p.name,
      velocity: p.velocity,
      stock: p.quantity,
      daysLeft: p.daysLeft,
    }));

    // Velocity history trend lines (per product, over time)
    const historyTrends = {};
    Object.entries(velocityHistoryData).forEach(([peptideId, history]) => {
      if (history && history.length > 1) {
        const p = peptides.find(pp => pp.peptideId === peptideId);
        const name = p ? (p.nickname || p.peptideName || p.peptideId) : peptideId;
        historyTrends[peptideId] = {
          name,
          data: history.map(entry => ({
            date: new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            velocity: parseFloat(String(entry.velocity).replace(/[^0-9.-]/g, '')) || 0,
            timestamp: entry.timestamp,
          })),
        };
      }
    });

    const avgVelocity = productsWithVelocity.length > 0
      ? productsWithVelocity.reduce((sum, p) => sum + p.velocity, 0) / productsWithVelocity.length
      : 0;
    const totalVelocity = productsWithVelocity.reduce((sum, p) => sum + p.velocity, 0);

    return {
      productsWithVelocity,
      ranked,
      top15,
      tierData,
      daysLeftData,
      scatterData,
      historyTrends,
      avgVelocity,
      totalVelocity,
      productsTracked: productsWithVelocity.length,
    };
  }, [peptides, velocityHistoryData]);

  // Sorted inventory velocity table
  const sortedInvVelocity = useMemo(() => {
    const items = [...invVelocityAnalytics.productsWithVelocity];
    items.sort((a, b) => {
      const aVal = a[invVelocitySort.field] ?? 0;
      const bVal = b[invVelocitySort.field] ?? 0;
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) return invVelocitySort.direction === 'asc' ? aNum - bNum : bNum - aNum;
      const cmp = String(aVal).localeCompare(String(bVal));
      return invVelocitySort.direction === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [invVelocityAnalytics, invVelocitySort]);

  const handleInvVelocitySort = (field) => {
    setInvVelocitySort(prev => ({ field, direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  // Financial analytics — aggregates all financial data
  const financialData = useMemo(() => {
    // Batch financials
    let batchCost = 0, batchRevenue = 0, batchGross = 0, batchQty = 0;
    const vendorCosts = {};
    const productProfits = [];

    batchItems.forEach(item => {
      const pricePerBox = Number(item.pricePerBox) || 0;
      const qtyPurchased = Number(item.qtyPurchased) || 0;
      const srgSale = Number(item.srgSale) || 0;
      const pricePerVial = pricePerBox / 10;
      const cost = pricePerBox * (qtyPurchased / 10);
      const revenue = srgSale * qtyPurchased;
      const profit = (srgSale - pricePerVial) * qtyPurchased;

      batchCost += cost;
      batchRevenue += revenue;
      batchGross += profit;
      batchQty += qtyPurchased;

      const vendor = item.vendor || 'Unknown';
      if (!vendorCosts[vendor]) vendorCosts[vendor] = { cost: 0, revenue: 0, profit: 0 };
      vendorCosts[vendor].cost += cost;
      vendorCosts[vendor].revenue += revenue;
      vendorCosts[vendor].profit += profit;

      productProfits.push({
        name: item.name || item.productId || '?',
        cost, revenue, profit,
        margin: cost > 0 ? (profit / cost) * 100 : 0,
        srgSale,
      });
    });

    const batchNet = batchGross - batchCost;

    // Box costs
    let boxTotalValue = 0, boxDailyCost = 0;
    boxItems.forEach(item => {
      const onHand = Number(item.onHand) || 0;
      const costPerUnit = Number(item.costPerUnit) || 0;
      const dailyUsage = Number(item.dailyUsage) || 0;
      boxTotalValue += onHand * costPerUnit;
      boxDailyCost += dailyUsage * costPerUnit;
    });

    // Inventory value (quantity = units in stock)
    const inventoryUnits = peptides.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0);

    // Average sale price from batch data
    const avgSalePrice = batchQty > 0 ? batchRevenue / batchQty : 0;

    // Daily revenue estimate from velocity
    let dailyRevenue = 0;
    peptides.forEach(p => {
      const vel = parseFloat(String(p.velocity || '0').replace(/[^0-9.-]/g, '')) || 0;
      dailyRevenue += vel * avgSalePrice;
    });

    const totalVelocity = peptides.reduce((sum, p) => {
      return sum + (parseFloat(String(p.velocity || '0').replace(/[^0-9.-]/g, '')) || 0);
    }, 0);

    // Use total velocity and avg sale price for per-second earnings
    const dailyRevenueEst = totalVelocity * avgSalePrice;
    const revenuePerSecond = dailyRevenueEst / 86400;
    const profitPerSecond = batchCost > 0 ? revenuePerSecond * (batchGross / batchRevenue) : revenuePerSecond * 0.5;

    // Vendor breakdown chart data
    const vendorChartData = Object.entries(vendorCosts).map(([name, d]) => ({
      name, cost: Math.round(d.cost * 100) / 100, revenue: Math.round(d.revenue * 100) / 100, profit: Math.round(d.profit * 100) / 100,
    })).sort((a, b) => b.profit - a.profit);

    // Top profitable products
    productProfits.sort((a, b) => b.profit - a.profit);

    // Profit margin distribution
    const marginBuckets = { 'Loss': 0, '0-25%': 0, '25-50%': 0, '50-100%': 0, '100%+': 0 };
    productProfits.forEach(p => {
      if (p.margin < 0) marginBuckets['Loss']++;
      else if (p.margin < 25) marginBuckets['0-25%']++;
      else if (p.margin < 50) marginBuckets['25-50%']++;
      else if (p.margin < 100) marginBuckets['50-100%']++;
      else marginBuckets['100%+']++;
    });
    const marginData = Object.entries(marginBuckets).filter(([, v]) => v > 0).map(([name, value]) => ({
      name, value,
      color: name === 'Loss' ? '#ef4444' : name === '0-25%' ? '#f97316' : name === '25-50%' ? '#eab308' : name === '50-100%' ? '#22c55e' : '#10b981',
    }));

    return {
      batchCost, batchRevenue, batchGross, batchNet, batchQty,
      boxTotalValue, boxDailyCost,
      inventoryUnits,
      avgSalePrice,
      dailyRevenueEst,
      revenuePerSecond,
      profitPerSecond,
      vendorChartData,
      productProfits: productProfits.slice(0, 20),
      marginData,
      totalVelocity,
      avgMargin: batchCost > 0 ? (batchGross / batchCost) * 100 : 0,
    };
  }, [batchItems, boxItems, peptides]);

  // Live earnings timer
  useEffect(() => {
    if (financialData.profitPerSecond <= 0) return;
    setEarningsPerSec(financialData.profitPerSecond);
    setEarningsStartTime(Date.now());
    setLiveEarnings(0);
    const interval = setInterval(() => {
      setLiveEarnings(prev => prev + financialData.profitPerSecond);
    }, 1000);
    return () => clearInterval(interval);
  }, [financialData.profitPerSecond]);

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

  const handleExportInventory = () => {
    const csvContent = exportToCSV(peptides);
    downloadCSV(csvContent, `srg-inventory-report-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleExportSummary = () => {
    const summary = `SRG Inventory Summary Report
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
    a.download = `srg-summary-${new Date().toISOString().split('T')[0]}.txt`;
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

      {/* Inventory Velocity Analysis */}
      {invVelocityAnalytics.productsTracked > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                Inventory Velocity Analysis
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Product velocity from inventory data — identify fast and slow movers
              </p>
            </div>
            <div className="flex gap-2">
              {['bar', 'line', 'area'].map(type => (
                <button
                  key={type}
                  onClick={() => setInvVelocityChartType(type)}
                  className={`p-2 rounded ${
                    invVelocityChartType === type
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title={`${type.charAt(0).toUpperCase() + type.slice(1)} Chart`}
                >
                  {type === 'bar' ? <BarChart3 className="w-4 h-4" /> : type === 'line' ? <LineChartIcon className="w-4 h-4" /> : <AreaChartIcon className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center border border-purple-200 dark:border-purple-800">
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{invVelocityAnalytics.productsTracked}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Products Tracked</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-white">{invVelocityAnalytics.totalVelocity.toFixed(1)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Velocity</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-white">{invVelocityAnalytics.avgVelocity.toFixed(1)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Avg Velocity</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-white">{invVelocityAnalytics.ranked.length > 0 ? invVelocityAnalytics.ranked[0].name : '-'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Fastest Mover</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top Products by Velocity */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Top Products by Velocity</h4>
              <ResponsiveContainer width="100%" height={350}>
                {invVelocityChartType === 'bar' ? (
                  <BarChart data={invVelocityAnalytics.top15} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                    <XAxis type="number" stroke="#6b7280" style={{ fontSize: '11px' }} />
                    <YAxis type="category" dataKey="name" stroke="#6b7280" style={{ fontSize: '11px' }} width={120} tick={{ fill: '#9ca3af' }} />
                    <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                    <Bar dataKey="velocity" name="Velocity" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                ) : invVelocityChartType === 'line' ? (
                  <LineChart data={invVelocityAnalytics.top15}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                    <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '10px' }} angle={-35} textAnchor="end" height={80} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '11px' }} />
                    <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                    <Line type="monotone" dataKey="velocity" stroke="#8b5cf6" strokeWidth={2} name="Velocity" dot={{ fill: '#8b5cf6', r: 4 }} />
                  </LineChart>
                ) : (
                  <AreaChart data={invVelocityAnalytics.top15}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                    <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '10px' }} angle={-35} textAnchor="end" height={80} />
                    <YAxis stroke="#6b7280" style={{ fontSize: '11px' }} />
                    <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                    <Area type="monotone" dataKey="velocity" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.4} name="Velocity" />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Velocity Distribution */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Velocity Distribution</h4>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={invVelocityAnalytics.tierData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {invVelocityAnalytics.tierData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Days Left / Supply Remaining Chart */}
          {invVelocityAnalytics.daysLeftData.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <Timer className="w-4 h-4 text-orange-500" />
                Days of Supply Remaining (Lowest First)
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={invVelocityAnalytics.daysLeftData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis type="number" stroke="#6b7280" style={{ fontSize: '11px' }} />
                  <YAxis type="category" dataKey="name" stroke="#6b7280" style={{ fontSize: '11px' }} width={120} tick={{ fill: '#9ca3af' }} />
                  <Tooltip
                    contentStyle={tooltipStyle.contentStyle}
                    labelStyle={tooltipStyle.labelStyle}
                    itemStyle={tooltipStyle.itemStyle}
                    formatter={(value) => [`${value} days`, 'Days Left']}
                  />
                  <Bar dataKey="daysLeft" name="Days Left">
                    {invVelocityAnalytics.daysLeftData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.daysLeft <= 7 ? '#ef4444' : entry.daysLeft <= 14 ? '#f97316' : entry.daysLeft <= 30 ? '#eab308' : '#22c55e'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400 justify-center">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> &le;7 days</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block" /> 8-14 days</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> 15-30 days</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> 30+ days</span>
              </div>
            </div>
          )}

          {/* Velocity History Trends (if data exists) */}
          {Object.keys(invVelocityAnalytics.historyTrends).length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                Velocity Trends Over Time
              </h4>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedProduct === null
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  All Products
                </button>
                {Object.entries(invVelocityAnalytics.historyTrends).slice(0, 10).map(([id, trend]) => (
                  <button
                    key={id}
                    onClick={() => setSelectedProduct(selectedProduct === id ? null : id)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      selectedProduct === id
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {trend.name.length > 20 ? trend.name.slice(0, 20) + '...' : trend.name}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '11px' }} allowDuplicatedCategory={false} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '11px' }} />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                  <Legend />
                  {(() => {
                    const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#6366f1', '#84cc16', '#f97316'];
                    const entries = selectedProduct
                      ? [[selectedProduct, invVelocityAnalytics.historyTrends[selectedProduct]]]
                      : Object.entries(invVelocityAnalytics.historyTrends).slice(0, 5);
                    return entries.map(([id, trend], i) => (
                      <Line
                        key={id}
                        data={trend.data}
                        type="monotone"
                        dataKey="velocity"
                        stroke={COLORS[i % COLORS.length]}
                        strokeWidth={2}
                        name={trend.name}
                        dot={{ fill: COLORS[i % COLORS.length], r: 3 }}
                      />
                    ));
                  })()}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Full Product Velocity Table */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">All Products by Velocity</h4>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-8">#</th>
                    {[
                      { id: 'name', label: 'Product' },
                      { id: 'velocity', label: 'Velocity' },
                      { id: 'quantity', label: 'Stock' },
                      { id: 'daysLeft', label: 'Days Left' },
                    ].map(col => (
                      <th
                        key={col.id}
                        onClick={() => handleInvVelocitySort(col.id)}
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 whitespace-nowrap select-none"
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {invVelocitySort.field === col.id && (
                            <span className="text-purple-600 dark:text-purple-400">{invVelocitySort.direction === 'asc' ? '\u2191' : '\u2193'}</span>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sortedInvVelocity.map((p, i) => {
                    const risk = p.daysLeft === null ? 'N/A'
                      : p.daysLeft <= 7 ? 'Critical'
                      : p.daysLeft <= 14 ? 'Warning'
                      : p.daysLeft <= 30 ? 'Monitor'
                      : 'Good';
                    const riskColor = risk === 'Critical' ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20'
                      : risk === 'Warning' ? 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20'
                      : risk === 'Monitor' ? 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                      : risk === 'Good' ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20'
                      : 'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50';
                    return (
                      <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{p.name}</td>
                        <td className="px-3 py-2 text-right font-semibold text-purple-600 dark:text-purple-400">{p.velocity}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{p.quantity}</td>
                        <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{p.daysLeft !== null ? p.daysLeft : '-'}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${riskColor}`}>
                            {risk}
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

      {/* Batch Analysis */}
      {batchAnalytics && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Batch Purchase Analysis
          </h3>

          {/* Batch Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-white">{batchAnalytics.products}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Products</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-white">{batchAnalytics.totalQty}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total QTY</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-white">${batchAnalytics.totalCost.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Cost</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-white">${batchAnalytics.totalRevenue.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-gray-900 dark:text-white">${batchAnalytics.totalGross.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Gross Profit</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
              <p className="text-xl font-bold text-green-600 dark:text-green-400">${batchAnalytics.net.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Net Profit</p>
            </div>
          </div>

          {/* Average Margin */}
          <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Average Margin: <span className="font-bold">{batchAnalytics.avgMargin.toFixed(1)}%</span>
            </p>
          </div>

          {/* Vendor Breakdown */}
          {Object.keys(batchAnalytics.vendorBreakdown).length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Vendor Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(batchAnalytics.vendorBreakdown).map(([vendor, data]) => (
                  <div key={vendor} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{vendor}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Products:</span>
                      <span className="text-gray-900 dark:text-white text-right">{data.products}</span>
                      <span className="text-gray-500 dark:text-gray-400">QTY:</span>
                      <span className="text-gray-900 dark:text-white text-right">{data.qty}</span>
                      <span className="text-gray-500 dark:text-gray-400">Cost:</span>
                      <span className="text-gray-900 dark:text-white text-right">${data.cost.toFixed(2)}</span>
                      <span className="text-gray-500 dark:text-gray-400">Profit:</span>
                      <span className={`text-right font-medium ${data.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>${data.profit.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product-level table */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">All Batch Products</h4>
            <div className="overflow-x-auto batch-scroll">
              <table className="min-w-max w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {[
                      { id: 'name', label: 'Product' },
                      { id: 'vendor', label: 'Vendor' },
                      { id: 'qtyPurchased', label: 'QTY' },
                      { id: 'pricePerVial', label: '$/Vial' },
                      { id: 'srgSale', label: 'SRG Sale' },
                      { id: 'cost', label: 'Cost' },
                      { id: 'revenue', label: 'Revenue' },
                      { id: 'profitPerBatch', label: 'Profit' },
                      { id: 'profitPct', label: 'Margin %' },
                    ].map(col => (
                      <th
                        key={col.id}
                        onClick={() => handleBatchSort(col.id)}
                        className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase cursor-pointer hover:text-gray-900 dark:hover:text-gray-200 whitespace-nowrap select-none"
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {batchSort.field === col.id && (
                            <span className="text-blue-600 dark:text-blue-400">{batchSort.direction === 'asc' ? '\u2191' : '\u2193'}</span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {sortedBatchProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.vendor}</td>
                      <td className="px-3 py-2 text-right">{p.qtyPurchased}</td>
                      <td className="px-3 py-2 text-right">${p.pricePerVial.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">${p.srgSale.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">${p.cost.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">${p.revenue.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${p.profitPerBatch >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        ${p.profitPerBatch.toFixed(2)}
                      </td>
                      <td className={`px-3 py-2 text-right ${p.profitPct >= 50 ? 'text-green-600 dark:text-green-400 font-semibold' : p.profitPct >= 20 ? 'text-green-600 dark:text-green-400' : p.profitPct > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                        {p.profitPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-100 dark:bg-gray-900 border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right">{batchAnalytics.totalQty}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-right">${batchAnalytics.totalCost.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">${batchAnalytics.totalRevenue.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">${batchAnalytics.totalGross.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{batchAnalytics.avgMargin.toFixed(1)}%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Financial Analytics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 transition-colors">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Financial Analytics
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Comprehensive financial overview across all imports and views
          </p>
        </div>

        {/* Live Earnings Counter */}
        {financialData.profitPerSecond > 0 && (
          <div className="mb-6 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl p-6 text-white">
            <div className="text-center">
              <p className="text-sm font-medium opacity-80 mb-1">SRG Estimated Earnings (Live)</p>
              <p className="text-5xl font-bold font-mono tracking-wider">
                ${liveEarnings.toFixed(4)}
              </p>
              <div className="flex justify-center gap-8 mt-3 text-sm opacity-90">
                <div>
                  <p className="font-bold">${financialData.profitPerSecond.toFixed(6)}</p>
                  <p className="text-xs opacity-70">per second</p>
                </div>
                <div>
                  <p className="font-bold">${(financialData.profitPerSecond * 60).toFixed(4)}</p>
                  <p className="text-xs opacity-70">per minute</p>
                </div>
                <div>
                  <p className="font-bold">${(financialData.profitPerSecond * 3600).toFixed(2)}</p>
                  <p className="text-xs opacity-70">per hour</p>
                </div>
                <div>
                  <p className="font-bold">${(financialData.profitPerSecond * 86400).toFixed(2)}</p>
                  <p className="text-xs opacity-70">per day</p>
                </div>
              </div>
              <p className="text-xs mt-3 opacity-60">Based on current velocity ({financialData.totalVelocity.toFixed(1)} units/day) and batch profit margins</p>
            </div>
          </div>
        )}

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white">${financialData.batchRevenue.toFixed(2)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Revenue</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white">${financialData.batchCost.toFixed(2)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Cost (Batches)</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white">${financialData.batchGross.toFixed(2)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gross Profit</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
            <p className="text-xl font-bold text-green-600 dark:text-green-400">${financialData.batchNet.toFixed(2)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Net Profit</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white">${financialData.boxTotalValue.toFixed(2)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Box Inventory Value</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-gray-900 dark:text-white">{financialData.avgMargin.toFixed(1)}%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Avg Profit Margin</p>
          </div>
        </div>

        {/* Revenue breakdown cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">Revenue Estimates</p>
            <div className="space-y-1 text-sm text-blue-800 dark:text-blue-300">
              <div className="flex justify-between"><span>Daily:</span><span className="font-bold">${financialData.dailyRevenueEst.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Weekly:</span><span className="font-bold">${(financialData.dailyRevenueEst * 7).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Monthly:</span><span className="font-bold">${(financialData.dailyRevenueEst * 30).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Yearly:</span><span className="font-bold">${(financialData.dailyRevenueEst * 365).toFixed(2)}</span></div>
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <p className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-1">Cost Breakdown</p>
            <div className="space-y-1 text-sm text-purple-800 dark:text-purple-300">
              <div className="flex justify-between"><span>Batch Purchases:</span><span className="font-bold">${financialData.batchCost.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Box Inventory:</span><span className="font-bold">${financialData.boxTotalValue.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Daily Box Cost:</span><span className="font-bold">${financialData.boxDailyCost.toFixed(2)}</span></div>
              <div className="flex justify-between border-t border-purple-200 dark:border-purple-700 pt-1"><span>Total Assets:</span><span className="font-bold">${(financialData.batchCost + financialData.boxTotalValue).toFixed(2)}</span></div>
            </div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200 mb-1">Key Metrics</p>
            <div className="space-y-1 text-sm text-emerald-800 dark:text-emerald-300">
              <div className="flex justify-between"><span>Avg Sale Price:</span><span className="font-bold">${financialData.avgSalePrice.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Inventory Units:</span><span className="font-bold">{financialData.inventoryUnits}</span></div>
              <div className="flex justify-between"><span>Total Velocity:</span><span className="font-bold">{financialData.totalVelocity.toFixed(1)}/day</span></div>
              <div className="flex justify-between"><span>Batch Products:</span><span className="font-bold">{financialData.batchQty}</span></div>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Vendor P&L Chart */}
          {financialData.vendorChartData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Vendor Profit & Loss</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={financialData.vendorChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                  <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: '11px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '11px' }} />
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} formatter={(value) => `$${value.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="cost" fill="#ef4444" name="Cost" />
                  <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                  <Bar dataKey="profit" fill="#22c55e" name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Profit Margin Distribution */}
          {financialData.marginData.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Profit Margin Distribution</h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={financialData.marginData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {financialData.marginData.map((entry, i) => (
                      <Cell key={`margin-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Products by Profit */}
        {financialData.productProfits.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Top Products by Profit</h4>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={financialData.productProfits.slice(0, 15)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.1} />
                <XAxis type="number" stroke="#6b7280" style={{ fontSize: '11px' }} />
                <YAxis type="category" dataKey="name" stroke="#6b7280" style={{ fontSize: '10px' }} width={130} tick={{ fill: '#9ca3af' }} />
                <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} itemStyle={tooltipStyle.itemStyle} formatter={(value) => `$${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="cost" fill="#ef4444" name="Cost" stackId="a" />
                <Bar dataKey="profit" fill="#22c55e" name="Profit" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Full Product Financial Table */}
        {financialData.productProfits.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Product Financial Breakdown</h4>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto batch-scroll">
              <table className="min-w-max w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-8">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Product</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">SRG Sale</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cost</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Revenue</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Profit</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {financialData.productProfits.map((p, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-2 text-xs text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">{p.name}</td>
                      <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">${p.srgSale.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">${p.cost.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">${p.revenue.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${p.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>${p.profit.toFixed(2)}</td>
                      <td className={`px-3 py-2 text-right ${p.margin >= 50 ? 'text-green-600 dark:text-green-400 font-bold' : p.margin >= 20 ? 'text-green-600 dark:text-green-400' : p.margin > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{p.margin.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {financialData.batchRevenue === 0 && financialData.boxTotalValue === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="font-medium">No financial data available</p>
            <p className="text-sm mt-1">Import batch purchases and box invoices to see financial analytics</p>
          </div>
        )}
      </div>
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

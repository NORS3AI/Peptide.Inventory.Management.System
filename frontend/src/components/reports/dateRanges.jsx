/**
 * Shared date-range helpers and dropdown for Reports sub-pages.
 */
import { useState } from 'react';

const MS_DAY = 24 * 60 * 60 * 1000;

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function rangeForKey(key, customStart, customEnd) {
  const now = new Date();
  const today0 = startOfDay(now);
  switch (key) {
    case 'today':
      return { start: today0, end: endOfDay(now), label: 'Today' };
    case 'yesterday': {
      const y = new Date(today0.getTime() - MS_DAY);
      return { start: y, end: endOfDay(new Date(today0.getTime() - 1)), label: 'Yesterday' };
    }
    case 'thisWeek': {
      const dow = today0.getDay();
      const start = new Date(today0.getTime() - dow * MS_DAY);
      return { start, end: endOfDay(now), label: 'This week' };
    }
    case 'last7':
      return { start: new Date(today0.getTime() - 6 * MS_DAY), end: endOfDay(now), label: 'Last 7 days' };
    case 'last14':
      return { start: new Date(today0.getTime() - 13 * MS_DAY), end: endOfDay(now), label: 'Last 14 days' };
    case 'last30':
      return { start: new Date(today0.getTime() - 29 * MS_DAY), end: endOfDay(now), label: 'Last 30 days' };
    case 'last90':
      return { start: new Date(today0.getTime() - 89 * MS_DAY), end: endOfDay(now), label: 'Last 90 days' };
    case 'thisMonth':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now), label: 'This month' };
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end, label: 'Last month' };
    }
    case 'custom': {
      const start = customStart ? startOfDay(customStart) : startOfDay(new Date(today0.getTime() - 29 * MS_DAY));
      const end = customEnd ? endOfDay(customEnd) : endOfDay(now);
      return { start, end, label: 'Custom' };
    }
    default:
      return { start: new Date(today0.getTime() - 29 * MS_DAY), end: endOfDay(now), label: 'Last 30 days' };
  }
}

export const PRODUCT_RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'last14', label: 'Last 2 weeks' },
  { key: 'last30', label: '1 month' },
  { key: 'last90', label: '3 months' },
  { key: 'custom', label: 'Custom' },
];

export const SALES_RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'last30', label: 'Last 30 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'custom', label: 'Custom' },
];

export function DateRangePicker({ options, value, onChange, customStart, customEnd, onCustomStartChange, onCustomEndChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      >
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
      {value === 'custom' && (
        <div className="flex items-center gap-1 text-sm">
          <input
            type="date"
            value={customStart || ''}
            onChange={e => onCustomStartChange(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <span className="text-gray-500">→</span>
          <input
            type="date"
            value={customEnd || ''}
            onChange={e => onCustomEndChange(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
      )}
    </div>
  );
}

export function useDateRange(defaultKey, options) {
  const [rangeKey, setRangeKey] = useState(defaultKey);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const range = rangeForKey(rangeKey, customStart, customEnd);
  return {
    rangeKey, setRangeKey,
    customStart, setCustomStart,
    customEnd, setCustomEnd,
    range,
    pickerProps: {
      options,
      value: rangeKey,
      onChange: setRangeKey,
      customStart, customEnd,
      onCustomStartChange: setCustomStart,
      onCustomEndChange: setCustomEnd,
    },
  };
}

export function filterOrdersByRange(orders, range) {
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  return orders.filter(o => {
    if (!o.dateCreated) return false;
    const t = new Date(o.dateCreated).getTime();
    return t >= startMs && t <= endMs;
  });
}

/**
 * Same range shifted back exactly one year (for YoY comparisons).
 */
export function priorYearRange(range) {
  const start = new Date(range.start);
  const end = new Date(range.end);
  start.setFullYear(start.getFullYear() - 1);
  end.setFullYear(end.getFullYear() - 1);
  return { start, end, label: `${range.label} (prior year)` };
}

/**
 * Bucket orders into daily totals between range.start and range.end.
 * Returns [{date, revenue, items, orders}]
 */
export function bucketDaily(orders, range) {
  const buckets = new Map();
  const startMs = startOfDay(range.start).getTime();
  const endMs = startOfDay(range.end).getTime();
  for (let t = startMs; t <= endMs; t += MS_DAY) {
    const d = new Date(t).toISOString().slice(0, 10);
    buckets.set(d, { date: d, revenue: 0, items: 0, orders: 0 });
  }
  for (const o of orders) {
    if (!o.dateCreated) continue;
    const t = startOfDay(new Date(o.dateCreated)).getTime();
    const key = new Date(t).toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.revenue += Number(o.total) || 0;
    bucket.items += Number(o.itemCount) || 0;
    bucket.orders += 1;
  }
  return Array.from(buckets.values());
}

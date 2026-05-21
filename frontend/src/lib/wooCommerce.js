/**
 * Minimal WooCommerce REST API client for PIMS.
 *
 * Uses HTTPS Basic auth with consumer_key:consumer_secret. The browser
 * can only reach a WC site if that site sends a permissive CORS header
 * for our origin (configure on the WC server).
 */

function buildAuthHeader(consumerKey, consumerSecret) {
  const token = btoa(`${consumerKey}:${consumerSecret}`);
  return `Basic ${token}`;
}

function normalizeBaseUrl(siteUrl) {
  if (!siteUrl) throw new Error('WooCommerce site URL is required');
  const trimmed = siteUrl.trim().replace(/\/+$/, '');
  return `${trimmed}/wp-json/wc/v3`;
}

async function wcFetch(connection, path, params = {}) {
  if (!connection?.siteUrl) throw new Error('Not connected');
  const base = normalizeBaseUrl(connection.siteUrl);
  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: buildAuthHeader(connection.consumerKey, connection.consumerSecret),
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = `WooCommerce ${res.status} ${res.statusText}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.message) message += ` — ${parsed.message}`;
    } catch {
      if (text) message += ` — ${text.slice(0, 200)}`;
    }
    throw new Error(message);
  }

  const totalPages = Number(res.headers.get('X-WP-TotalPages')) || 1;
  const total = Number(res.headers.get('X-WP-Total')) || 0;
  const data = await res.json();
  return { data, totalPages, total };
}

export async function testConnection(connection) {
  // /system_status is the cheapest authenticated endpoint that proves both
  // reachability and credential validity.
  const { data } = await wcFetch(connection, '/system_status');
  return {
    ok: true,
    environment: data?.environment?.site_url || connection.siteUrl,
    wcVersion: data?.environment?.version,
    storeName: data?.settings?.title,
  };
}

async function fetchAllPaginated(connection, path, baseParams = {}, onPage) {
  const perPage = 100;
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const { data, totalPages: tp } = await wcFetch(connection, path, {
      ...baseParams,
      per_page: perPage,
      page,
    });
    totalPages = tp;
    all.push(...data);
    if (onPage) onPage({ page, totalPages, fetched: all.length });
    page += 1;
  } while (page <= totalPages);
  return all;
}

/**
 * Bulk-update WooCommerce product stock via the batch endpoint.
 * Requires a Read/Write consumer key (a Read-only key returns 401
 * here even though it works for the fetch endpoints).
 *
 *   updates: [{ id, stock_quantity, manage_stock }]
 *
 * Batches are capped at 100 products per request (WC default limit).
 */
async function wcBatchUpdateProducts(connection, updates) {
  if (!connection?.siteUrl) throw new Error('Not connected');
  const base = normalizeBaseUrl(connection.siteUrl);
  const auth = buildAuthHeader(connection.consumerKey, connection.consumerSecret);
  const chunks = [];
  for (let i = 0; i < updates.length; i += 100) {
    chunks.push(updates.slice(i, i + 100));
  }
  let updatedCount = 0;
  const failures = [];
  for (const chunk of chunks) {
    const res = await fetch(`${base}/products/batch`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ update: chunk }),
    });
    const text = await res.text().catch(() => '');
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
    if (!res.ok) {
      const msg = data?.message ? data.message.replace(/<[^>]*>/g, '') : `WooCommerce ${res.status} ${res.statusText}`;
      // Whole chunk failed; record one failure per item so the caller can report.
      for (const item of chunk) failures.push({ id: item.id, error: msg });
      continue;
    }
    if (Array.isArray(data?.update)) {
      for (const r of data.update) {
        if (r?.error) failures.push({ id: r.id, error: r.error.message || 'Update error' });
        else updatedCount += 1;
      }
    } else {
      updatedCount += chunk.length;
    }
  }
  return { updatedCount, failures };
}

export const wc = {
  testConnection,
  fetchOrders: (connection, opts = {}, onPage) =>
    fetchAllPaginated(connection, '/orders', { status: opts.status || 'any', orderby: 'date', order: 'desc' }, onPage),
  fetchProducts: (connection, _opts = {}, onPage) =>
    fetchAllPaginated(connection, '/products', { orderby: 'id', order: 'asc' }, onPage),
  fetchCustomers: (connection, _opts = {}, onPage) =>
    fetchAllPaginated(connection, '/customers', { orderby: 'id', order: 'asc' }, onPage),
  batchUpdateProducts: wcBatchUpdateProducts,
};

export function summarizeOrder(o) {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    total: Number(o.total) || 0,
    currency: o.currency,
    customerId: o.customer_id,
    customerEmail: o.billing?.email || '',
    customerName: `${o.billing?.first_name || ''} ${o.billing?.last_name || ''}`.trim(),
    billingState: o.billing?.state || '',
    billingCountry: o.billing?.country || '',
    shippingState: o.shipping?.state || o.billing?.state || '',
    shippingCountry: o.shipping?.country || o.billing?.country || '',
    dateCreated: o.date_created,
    dateCompleted: o.date_completed,
    itemCount: (o.line_items || []).reduce((s, li) => s + (li.quantity || 0), 0),
    lineItems: (o.line_items || []).map(li => ({
      id: li.id,
      productId: li.product_id,
      sku: li.sku,
      name: li.name,
      quantity: li.quantity,
      total: Number(li.total) || 0,
    })),
  };
}

export function summarizeProduct(p) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: Number(p.price) || 0,
    regularPrice: Number(p.regular_price) || 0,
    salePrice: Number(p.sale_price) || 0,
    stockQuantity: p.stock_quantity,
    stockStatus: p.stock_status,
    manageStock: p.manage_stock,
    type: p.type,
    status: p.status,
    categories: (p.categories || []).map(c => c.name),
    dateModified: p.date_modified,
  };
}

export function summarizeCustomer(c) {
  return {
    id: c.id,
    email: c.email,
    firstName: c.first_name,
    lastName: c.last_name,
    fullName: `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email,
    username: c.username,
    role: c.role,
    dateCreated: c.date_created,
    ordersCount: c.orders_count,
    totalSpent: Number(c.total_spent) || 0,
  };
}

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

export const wc = {
  testConnection,
  fetchOrders: (connection, opts = {}, onPage) =>
    fetchAllPaginated(connection, '/orders', { status: opts.status || 'any', orderby: 'date', order: 'desc' }, onPage),
  fetchProducts: (connection, _opts = {}, onPage) =>
    fetchAllPaginated(connection, '/products', { orderby: 'id', order: 'asc' }, onPage),
  fetchCustomers: (connection, _opts = {}, onPage) =>
    fetchAllPaginated(connection, '/customers', { orderby: 'id', order: 'asc' }, onPage),
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

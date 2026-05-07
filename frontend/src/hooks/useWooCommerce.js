import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';
import { wc, summarizeOrder, summarizeProduct, summarizeCustomer } from '../lib/wooCommerce';

const CONNECTION_KEY = 'woocommerceConnection';
const STATUS_KEY = 'woocommerceSyncStatus';

const DEFAULT_CONNECTION = {
  siteUrl: '',
  consumerKey: '',
  consumerSecret: '',
  enabled: false,
};

const DEFAULT_STATUS = {
  orders: { lastSyncedAt: null, count: 0, error: null },
  products: { lastSyncedAt: null, count: 0, error: null },
  customers: { lastSyncedAt: null, count: 0, error: null },
};

export function useWooCommerce() {
  const [connection, setConnectionState] = useState(DEFAULT_CONNECTION);
  const [status, setStatusState] = useState(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState({ orders: false, products: false, customers: false });

  const load = useCallback(async () => {
    const savedConn = await db.settings.get(CONNECTION_KEY);
    const savedStatus = await db.settings.get(STATUS_KEY);
    setConnectionState({ ...DEFAULT_CONNECTION, ...(savedConn || {}) });
    setStatusState({ ...DEFAULT_STATUS, ...(savedStatus || {}) });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveConnection = useCallback(async (patch) => {
    const next = { ...connection, ...patch };
    setConnectionState(next);
    await db.settings.set(CONNECTION_KEY, next);
    return next;
  }, [connection]);

  const updateStatus = useCallback(async (entity, patch) => {
    const next = { ...status, [entity]: { ...status[entity], ...patch } };
    setStatusState(next);
    await db.settings.set(STATUS_KEY, next);
  }, [status]);

  const testConnection = useCallback(async (override) => {
    const conn = override || connection;
    return await wc.testConnection(conn);
  }, [connection]);

  async function runSync(entity, fetcher, summarize) {
    setSyncing(s => ({ ...s, [entity]: true }));
    try {
      const raw = await fetcher(connection);
      const summarized = raw.map(summarize);
      await db.woocommerce[entity].replaceAll(summarized);
      await updateStatus(entity, {
        lastSyncedAt: new Date().toISOString(),
        count: summarized.length,
        error: null,
      });
      return { count: summarized.length };
    } catch (err) {
      await updateStatus(entity, { error: err.message });
      throw err;
    } finally {
      setSyncing(s => ({ ...s, [entity]: false }));
    }
  }

  const syncOrders = useCallback(() => runSync('orders', wc.fetchOrders, summarizeOrder), [connection, status]);
  const syncProducts = useCallback(() => runSync('products', wc.fetchProducts, summarizeProduct), [connection, status]);
  const syncCustomers = useCallback(() => runSync('customers', wc.fetchCustomers, summarizeCustomer), [connection, status]);

  const isConfigured = Boolean(connection.siteUrl && connection.consumerKey && connection.consumerSecret);

  return {
    connection, isConfigured, loading, status, syncing,
    saveConnection, testConnection,
    syncOrders, syncProducts, syncCustomers,
  };
}

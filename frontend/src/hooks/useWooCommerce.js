import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../lib/db';
import { wc, summarizeOrder, summarizeProduct, summarizeCustomer } from '../lib/wooCommerce';

const CONNECTION_KEY = 'woocommerceConnection';
const STATUS_KEY = 'woocommerceSyncStatus';
const AUTOSYNC_KEY = 'woocommerceAutoSyncMinutes';

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

const ENTITY_FETCHERS = {
  orders: { fetcher: wc.fetchOrders, summarize: summarizeOrder },
  products: { fetcher: wc.fetchProducts, summarize: summarizeProduct },
  customers: { fetcher: wc.fetchCustomers, summarize: summarizeCustomer },
};

export async function getAutoSyncMinutes() {
  const v = await db.settings.get(AUTOSYNC_KEY);
  return Number(v) || 0; // 0 = off
}

export async function setAutoSyncMinutes(minutes) {
  await db.settings.set(AUTOSYNC_KEY, Number(minutes) || 0);
}

/**
 * Standalone full sync (not tied to React state) used by the
 * auto-sync timer. Updates the persisted status object and emits
 * 'woocommerce-synced' so any mounted hooks refresh.
 */
export async function syncAllEntities(connection) {
  if (!connection?.siteUrl || !connection?.consumerKey || !connection?.consumerSecret) {
    return { skipped: true };
  }
  const status = { ...DEFAULT_STATUS, ...((await db.settings.get(STATUS_KEY)) || {}) };
  for (const [entity, { fetcher, summarize }] of Object.entries(ENTITY_FETCHERS)) {
    try {
      const raw = await fetcher(connection);
      const summarized = raw.map(summarize);
      await db.woocommerce[entity].replaceAll(summarized);
      status[entity] = { lastSyncedAt: new Date().toISOString(), count: summarized.length, error: null };
    } catch (err) {
      status[entity] = { ...status[entity], error: err.message };
    }
  }
  await db.settings.set(STATUS_KEY, status);
  window.dispatchEvent(new Event('woocommerce-synced'));
  return { status };
}

/**
 * Wipe all cached WooCommerce data and reset sync status.
 * Connection credentials are kept.
 */
export async function clearWooData() {
  await db.woocommerce.orders.clear();
  await db.woocommerce.products.clear();
  await db.woocommerce.customers.clear();
  await db.settings.set(STATUS_KEY, DEFAULT_STATUS);
  window.dispatchEvent(new Event('woocommerce-synced'));
}

export function useWooCommerce() {
  const [connection, setConnectionState] = useState(DEFAULT_CONNECTION);
  const [status, setStatusState] = useState(DEFAULT_STATUS);
  const [autoSyncMinutes, setAutoSyncMinutesState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState({ orders: false, products: false, customers: false });

  const load = useCallback(async () => {
    const savedConn = await db.settings.get(CONNECTION_KEY);
    const savedStatus = await db.settings.get(STATUS_KEY);
    setConnectionState({ ...DEFAULT_CONNECTION, ...(savedConn || {}) });
    setStatusState({ ...DEFAULT_STATUS, ...(savedStatus || {}) });
    setAutoSyncMinutesState(await getAutoSyncMinutes());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const onSynced = () => load();
    window.addEventListener('woocommerce-synced', onSynced);
    return () => window.removeEventListener('woocommerce-synced', onSynced);
  }, [load]);

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

  const updateAutoSync = useCallback(async (minutes) => {
    await setAutoSyncMinutes(minutes);
    setAutoSyncMinutesState(Number(minutes) || 0);
    window.dispatchEvent(new Event('woocommerce-autosync-changed'));
  }, []);

  const clearData = useCallback(async () => {
    await clearWooData();
    setStatusState(DEFAULT_STATUS);
  }, []);

  const isConfigured = Boolean(connection.siteUrl && connection.consumerKey && connection.consumerSecret);

  return {
    connection, isConfigured, loading, status, syncing, autoSyncMinutes,
    saveConnection, testConnection,
    syncOrders, syncProducts, syncCustomers,
    updateAutoSync, clearData,
  };
}

/**
 * Mount once at the app root. Runs a full WooCommerce sync on the
 * configured interval while PIMS is open. No-op when interval is 0
 * or the connection isn't configured.
 */
export function useWooAutoSync() {
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function arm() {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const minutes = await getAutoSyncMinutes();
      if (!minutes || cancelled) return;
      const conn = await db.settings.get(CONNECTION_KEY);
      if (!conn?.siteUrl) return;
      timerRef.current = setInterval(() => {
        db.settings.get(CONNECTION_KEY).then(c => c && syncAllEntities(c));
      }, minutes * 60 * 1000);
    }

    arm();
    const onChange = () => arm();
    window.addEventListener('woocommerce-autosync-changed', onChange);
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('woocommerce-autosync-changed', onChange);
    };
  }, []);
}

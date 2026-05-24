import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';
import { ssTestConnection } from '../lib/shipstation';

const CONNECTION_KEY = 'shipstationConnection';

const DEFAULT_CONNECTION = {
  apiKey: '',
  apiSecret: '',
};

export function useShipStation() {
  const [connection, setConnectionState] = useState(DEFAULT_CONNECTION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await db.settings.get(CONNECTION_KEY);
      if (!active) return;
      setConnectionState({ ...DEFAULT_CONNECTION, ...(saved || {}) });
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const saveConnection = useCallback(async (patch) => {
    const next = { ...connection, ...patch };
    setConnectionState(next);
    await db.settings.set(CONNECTION_KEY, next);
    return next;
  }, [connection]);

  const testConnection = useCallback(async (override) => {
    return await ssTestConnection(override || connection);
  }, [connection]);

  const isConfigured = Boolean(connection.apiKey && connection.apiSecret);

  return { connection, isConfigured, loading, saveConnection, testConnection };
}

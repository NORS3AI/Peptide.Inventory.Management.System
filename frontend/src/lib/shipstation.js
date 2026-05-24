/**
 * ShipStation API client (skeleton).
 *
 * IMPORTANT: ShipStation does NOT enable CORS, so direct calls from
 * a browser to https://ssapi.shipstation.com/* will fail with a
 * network/CORS error before any response is parsed. Until a small
 * server-side proxy is in place, PIMS stores the credentials but
 * cannot fetch live data.
 *
 * Auth: HTTP Basic with base64("<apiKey>:<apiSecret>").
 */

export const SHIPSTATION_BASE_URL = 'https://ssapi.shipstation.com';

function buildAuthHeader(apiKey, apiSecret) {
  return `Basic ${btoa(`${apiKey}:${apiSecret}`)}`;
}

/**
 * Attempt a low-cost authenticated call. Surfaces a clear CORS
 * message when the browser blocks it (the common case today).
 */
export async function ssTestConnection({ apiKey, apiSecret }) {
  if (!apiKey || !apiSecret) throw new Error('API key and secret are required');
  try {
    const res = await fetch(`${SHIPSTATION_BASE_URL}/carriers`, {
      method: 'GET',
      headers: {
        Authorization: buildAuthHeader(apiKey, apiSecret),
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`ShipStation ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 200)}` : ''}`);
    }
    const carriers = await res.json();
    return { ok: true, carrierCount: Array.isArray(carriers) ? carriers.length : 0 };
  } catch (err) {
    // Browser CORS failures throw TypeError("Failed to fetch")
    if (err?.name === 'TypeError') {
      throw new Error(
        'ShipStation blocks direct browser calls (no CORS). Credentials are valid to save, but live sync needs a server-side proxy. This is a planned PIMS addition.'
      );
    }
    throw err;
  }
}

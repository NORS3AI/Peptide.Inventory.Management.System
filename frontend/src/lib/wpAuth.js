/**
 * WordPress JWT authentication client.
 *
 * Requires the "JWT Authentication for WP REST API" plugin on the
 * WordPress site, with JWT_AUTH_SECRET_KEY and JWT_AUTH_CORS_ENABLE
 * configured in wp-config.php.
 *
 * When PIMS is hosted same-origin with WordPress (e.g.
 * app.superstitionresearch.com), no CORS config is needed and the
 * token check is genuinely server-verified by WordPress.
 */

function normalizeSite(siteUrl) {
  if (!siteUrl) throw new Error('WordPress site URL is required');
  return siteUrl.trim().replace(/\/+$/, '');
}

async function postJson(url, body, token) {
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  if (!res.ok) {
    const msg = data?.message
      ? data.message.replace(/<[^>]*>/g, '')
      : `WordPress ${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Exchange username/password for a JWT.
 * Returns { token, userEmail, userNicename, userDisplayName }.
 */
export async function wpGetToken(siteUrl, username, password) {
  const base = normalizeSite(siteUrl);
  const data = await postJson(`${base}/wp-json/jwt-auth/v1/token`, {
    username,
    password,
  });
  if (!data?.token) throw new Error('No token returned — check the JWT plugin is active');
  return {
    token: data.token,
    userEmail: data.user_email || '',
    userNicename: data.user_nicename || username,
    userDisplayName: data.user_display_name || username,
  };
}

/**
 * Validate an existing token against WordPress.
 * Returns true if the token is still valid.
 */
export async function wpValidateToken(siteUrl, token) {
  if (!token) return false;
  try {
    const base = normalizeSite(siteUrl);
    const data = await postJson(`${base}/wp-json/jwt-auth/v1/token/validate`, null, token);
    // Plugin returns code 'jwt_auth_valid_token' on success
    return data?.data?.status === 200 || data?.code === 'jwt_auth_valid_token';
  } catch {
    return false;
  }
}

/**
 * Fetch the WP user profile (id, roles, name) for the token holder.
 * Used to surface WordPress role names in PIMS.
 */
export async function wpGetMe(siteUrl, token) {
  const base = normalizeSite(siteUrl);
  const res = await fetch(`${base}/wp-json/wp/v2/users/me?context=edit`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    email: data.email || '',
    slug: data.slug,
    roles: data.roles || [],
  };
}

/**
 * List all WordPress users (requires the token holder to have the
 * list_users capability — administrators do). Paginated.
 * Returns [{ id, name, slug, email, roles: [] }].
 */
export async function wpListUsers(siteUrl, token) {
  const base = normalizeSite(siteUrl);
  const perPage = 100;
  let page = 1;
  let totalPages = 1;
  const all = [];
  do {
    const res = await fetch(
      `${base}/wp-json/wp/v2/users?context=edit&per_page=${perPage}&page=${page}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = `WordPress ${res.status} ${res.statusText}`;
      try {
        const p = JSON.parse(text);
        if (p?.message) msg = p.message.replace(/<[^>]*>/g, '');
      } catch { /* ignore */ }
      throw new Error(msg);
    }
    totalPages = Number(res.headers.get('X-WP-TotalPages')) || 1;
    const data = await res.json();
    for (const u of data) {
      all.push({
        id: u.id,
        name: u.name,
        slug: u.slug,
        email: u.email || '',
        roles: u.roles || [],
      });
    }
    page += 1;
  } while (page <= totalPages);
  return all;
}

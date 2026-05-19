import { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '../lib/db';
import { hashPassword, verifyPassword, generateUserId } from '../lib/auth';
import { DEFAULT_ROLES, emptyPermissions } from '../lib/permissions';
import { wpGetToken, wpValidateToken, wpGetMe, wpListUsers } from '../lib/wpAuth';

const SESSION_KEY = 'pims_session';
const WP_TOKEN_KEY = 'pims_wp_token';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

const AUTH_MODE_KEY = 'authMode';            // 'local' | 'wordpress'
const WP_AUTH_CONFIG_KEY = 'wpAuthConfig';   // { siteUrl, defaultRoleId }

export async function getAuthMode() {
  const m = await db.settings.get(AUTH_MODE_KEY);
  return m === 'wordpress' ? 'wordpress' : 'local';
}

export async function getWpAuthConfig() {
  const c = await db.settings.get(WP_AUTH_CONFIG_KEY);
  return { siteUrl: '', defaultRoleId: 'role_guest', ...(c || {}) };
}

export async function setAuthMode(mode) {
  await db.settings.set(AUTH_MODE_KEY, mode === 'wordpress' ? 'wordpress' : 'local');
}

export async function setWpAuthConfig(patch) {
  const current = await getWpAuthConfig();
  const next = { ...current, ...patch };
  await db.settings.set(WP_AUTH_CONFIG_KEY, next);
  return next;
}

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.userId || !parsed?.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSession(userId) {
  const session = { userId, expiresAt: Date.now() + SESSION_DURATION_MS };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(WP_TOKEN_KEY);
}

export function getWpToken() {
  return localStorage.getItem(WP_TOKEN_KEY) || null;
}

async function ensureDefaultRoles() {
  const existing = await db.roles.count();
  if (existing > 0) return;
  for (const role of DEFAULT_ROLES) {
    await db.roles.set(role.id, role);
  }
}

export async function createSuperAdmin({ username, password, email, firstName = '', lastName = '', phone = '' }) {
  await ensureDefaultRoles();
  const passwordHash = await hashPassword(password);
  const id = generateUserId();
  const user = {
    id,
    username: username.trim(),
    email: (email || '').trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone.trim(),
    roleId: 'role_super_admin',
    passwordHash,
    source: 'local',
    createdAt: new Date().toISOString(),
  };
  await db.users.set(id, user);
  return user;
}

/**
 * Find or create the local mirror record for a WordPress user.
 * The first WP user ever to log in becomes Super Admin; subsequent
 * users get the configured default role and can be re-assigned in
 * Accounts by a Super Admin.
 */
async function upsertWpUser({ username, email, displayName, wpRoles }) {
  await ensureDefaultRoles();
  const existing = await db.users.findByUsername(username);
  if (existing) {
    const patched = {
      ...existing,
      email: email || existing.email,
      wpRoles: wpRoles || existing.wpRoles || [],
      lastLoginAt: new Date().toISOString(),
    };
    await db.users.set(existing.id, patched);
    return patched;
  }
  const totalUsers = await db.users.count();
  const cfg = await getWpAuthConfig();
  const roleId = totalUsers === 0 ? 'role_super_admin' : (cfg.defaultRoleId || 'role_guest');
  const id = generateUserId();
  const [firstName, ...rest] = (displayName || username).split(' ');
  const user = {
    id,
    username: username.trim(),
    email: (email || '').trim(),
    firstName: (firstName || '').trim(),
    lastName: rest.join(' ').trim(),
    phone: '',
    roleId,
    source: 'wordpress',
    wpRoles: wpRoles || [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  await db.users.set(id, user);
  return user;
}

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [hasUsers, setHasUsers] = useState(false);
  const [authMode, setAuthModeState] = useState('local');
  const [wpConfig, setWpConfig] = useState({ siteUrl: '', defaultRoleId: 'role_guest' });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await ensureDefaultRoles();
      const mode = await getAuthMode();
      const cfg = await getWpAuthConfig();
      setAuthModeState(mode);
      setWpConfig(cfg);

      const userCount = await db.users.count();
      setHasUsers(userCount > 0);

      if (mode === 'wordpress') {
        const token = getWpToken();
        if (!token || !cfg.siteUrl) {
          setCurrentUser(null);
          setCurrentRole(null);
          return;
        }
        const valid = await wpValidateToken(cfg.siteUrl, token);
        if (!valid) {
          clearSession();
          setCurrentUser(null);
          setCurrentRole(null);
          return;
        }
        const session = readSession();
        const user = session ? await db.users.get(session.userId) : null;
        if (!user) {
          // Token is valid but local link missing — force re-login.
          clearSession();
          setCurrentUser(null);
          setCurrentRole(null);
          return;
        }
        const role = user.roleId ? await db.roles.get(user.roleId) : null;
        setCurrentUser(user);
        setCurrentRole(role);
        return;
      }

      // Local mode
      const session = readSession();
      if (!session) {
        setCurrentUser(null);
        setCurrentRole(null);
        return;
      }
      const user = await db.users.get(session.userId);
      if (!user) {
        clearSession();
        setCurrentUser(null);
        setCurrentRole(null);
        return;
      }
      const role = user.roleId ? await db.roles.get(user.roleId) : null;
      setCurrentUser(user);
      setCurrentRole(role);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('auth-changed', onChange);
    return () => window.removeEventListener('auth-changed', onChange);
  }, [refresh]);

  const login = useCallback(async (username, password) => {
    const mode = await getAuthMode();
    if (mode === 'wordpress') {
      const cfg = await getWpAuthConfig();
      if (!cfg.siteUrl) throw new Error('WordPress site URL is not configured (Settings → Authentication)');
      const { token, userEmail, userDisplayName, userNicename } = await wpGetToken(cfg.siteUrl, username, password);
      localStorage.setItem(WP_TOKEN_KEY, token);
      let wpRoles = [];
      try {
        const me = await wpGetMe(cfg.siteUrl, token);
        if (me?.roles) wpRoles = me.roles;
      } catch { /* profile fetch optional */ }
      const user = await upsertWpUser({
        username: userNicename || username,
        email: userEmail,
        displayName: userDisplayName,
        wpRoles,
      });
      writeSession(user.id);
      window.dispatchEvent(new Event('auth-changed'));
      return user;
    }

    const user = await db.users.findByUsername(username);
    if (!user) throw new Error('Username not found');
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) throw new Error('Incorrect password');
    writeSession(user.id);
    window.dispatchEvent(new Event('auth-changed'));
    return user;
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setCurrentUser(null);
    setCurrentRole(null);
    window.dispatchEvent(new Event('auth-changed'));
  }, []);

  const permissions = useMemo(() => currentRole?.permissions || emptyPermissions(), [currentRole]);
  const can = useCallback((tabKey) => Boolean(permissions[tabKey]), [permissions]);

  const isSuperAdmin = currentRole?.id === 'role_super_admin';
  const canManageUsers = Boolean(currentRole?.canManageUsers);
  const canManageRoles = Boolean(currentRole?.canManageRoles);

  return {
    currentUser, currentRole, hasUsers, loading, permissions,
    authMode, wpConfig,
    login, logout, refresh, can,
    isSuperAdmin, canManageUsers, canManageRoles,
  };
}

/**
 * Pull the WordPress user directory and mirror it into PIMS so a
 * Super Admin can assign PIMS roles before people log in. Existing
 * role assignments are preserved; new users get the configured
 * default role. By default WooCommerce buyers (users whose only WP
 * role is "customer") are skipped to keep Accounts focused on staff.
 */
export async function syncWordPressUsers({ includeCustomers = false } = {}) {
  const mode = await getAuthMode();
  if (mode !== 'wordpress') throw new Error('Switch Authentication to WordPress mode first');
  const cfg = await getWpAuthConfig();
  if (!cfg.siteUrl) throw new Error('WordPress site URL is not configured');
  const token = getWpToken();
  if (!token) throw new Error('Not signed in to WordPress');

  await ensureDefaultRoles();
  const wpUsers = await wpListUsers(cfg.siteUrl, token);
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const wu of wpUsers) {
    const roles = wu.roles || [];
    const onlyCustomer = roles.length > 0 && roles.every(r => r === 'customer');
    if (onlyCustomer && !includeCustomers) { skipped += 1; continue; }

    const username = wu.slug || wu.name;
    const existing = await db.users.findByUsername(username);
    if (existing) {
      await db.users.set(existing.id, {
        ...existing,
        email: wu.email || existing.email,
        wpRoles: roles,
        source: 'wordpress',
      });
      updated += 1;
      continue;
    }
    const totalUsers = await db.users.count();
    const roleId = totalUsers === 0 ? 'role_super_admin' : (cfg.defaultRoleId || 'role_guest');
    const id = generateUserId();
    const [firstName, ...rest] = (wu.name || username).split(' ');
    await db.users.set(id, {
      id,
      username,
      email: wu.email || '',
      firstName: (firstName || '').trim(),
      lastName: rest.join(' ').trim(),
      phone: '',
      roleId,
      source: 'wordpress',
      wpRoles: roles,
      createdAt: new Date().toISOString(),
    });
    imported += 1;
  }
  window.dispatchEvent(new Event('auth-changed'));
  return { imported, updated, skipped, total: wpUsers.length };
}

export async function setUserPassword(userId, newPassword) {
  const user = await db.users.get(userId);
  if (!user) throw new Error('User not found');
  const passwordHash = await hashPassword(newPassword);
  await db.users.set(userId, { ...user, passwordHash });
}

export async function createUser({ username, password, email, firstName = '', lastName = '', phone = '', roleId }) {
  const existing = await db.users.findByUsername(username);
  if (existing) throw new Error('A user with that username already exists');
  if (!roleId) throw new Error('Role is required');
  const passwordHash = await hashPassword(password);
  const id = generateUserId();
  const user = {
    id, username: username.trim(),
    email: (email || '').trim(),
    firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim(),
    roleId, passwordHash, source: 'local', createdAt: new Date().toISOString(),
  };
  await db.users.set(id, user);
  return user;
}

export async function updateUser(userId, patch) {
  const user = await db.users.get(userId);
  if (!user) throw new Error('User not found');
  const next = { ...user };
  for (const k of ['username', 'email', 'firstName', 'lastName', 'phone', 'roleId']) {
    if (patch[k] !== undefined) next[k] = (typeof patch[k] === 'string') ? patch[k].trim() : patch[k];
  }
  if (patch.password) {
    next.passwordHash = await hashPassword(patch.password);
  }
  await db.users.set(userId, next);
  return next;
}

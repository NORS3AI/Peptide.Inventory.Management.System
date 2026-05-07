import { useEffect, useState, useCallback, useMemo } from 'react';
import { db } from '../lib/db';
import { hashPassword, verifyPassword, generateUserId } from '../lib/auth';
import { DEFAULT_ROLES, emptyPermissions } from '../lib/permissions';

const SESSION_KEY = 'pims_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 hours

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
    createdAt: new Date().toISOString(),
  };
  await db.users.set(id, user);
  return user;
}

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentRole, setCurrentRole] = useState(null);
  const [hasUsers, setHasUsers] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await ensureDefaultRoles();
      const userCount = await db.users.count();
      setHasUsers(userCount > 0);
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
    login, logout, refresh, can,
    isSuperAdmin, canManageUsers, canManageRoles,
  };
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
    roleId, passwordHash, createdAt: new Date().toISOString(),
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

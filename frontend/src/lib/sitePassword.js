/**
 * Simple sandbox-level site password gate.
 *
 * One shared password unlocks the whole site; there are no user
 * accounts to manage. A valid session lives in localStorage for a
 * fixed window. Hashed with the same PBKDF2 helpers used elsewhere.
 */
import { hashPassword, verifyPassword, generateUserId } from './auth';
import { db } from './db';
import { DEFAULT_ROLES } from './permissions';

const PASSWORD_HASH_KEY = 'sitePasswordHash';
const SITE_SESSION_KEY = 'pims_site_session';
const AUTH_SESSION_KEY = 'pims_session';
const SITE_SESSION_MS = 12 * 60 * 60 * 1000; // 12h

export async function hasSitePassword() {
  const stored = await db.settings.get(PASSWORD_HASH_KEY);
  return Boolean(stored?.hash);
}

export async function setSitePassword(password) {
  if (!password || password.length < 4) {
    throw new Error('Password must be at least 4 characters');
  }
  const hashed = await hashPassword(password);
  await db.settings.set(PASSWORD_HASH_KEY, hashed);
  return hashed;
}

export async function verifySitePassword(password) {
  const stored = await db.settings.get(PASSWORD_HASH_KEY);
  if (!stored) return false;
  return verifyPassword(password, stored);
}

export async function changeSitePassword(currentPassword, nextPassword) {
  const stored = await db.settings.get(PASSWORD_HASH_KEY);
  if (stored) {
    const ok = await verifyPassword(currentPassword, stored);
    if (!ok) throw new Error('Current password is incorrect');
  }
  return setSitePassword(nextPassword);
}

export async function clearSitePassword(currentPassword) {
  const stored = await db.settings.get(PASSWORD_HASH_KEY);
  if (stored) {
    const ok = await verifyPassword(currentPassword, stored);
    if (!ok) throw new Error('Current password is incorrect');
  }
  await db.settings.set(PASSWORD_HASH_KEY, null);
}

export function hasValidSiteSession() {
  try {
    const raw = localStorage.getItem(SITE_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
      localStorage.removeItem(SITE_SESSION_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function writeSiteSession() {
  localStorage.setItem(
    SITE_SESSION_KEY,
    JSON.stringify({ unlockedAt: Date.now(), expiresAt: Date.now() + SITE_SESSION_MS })
  );
}

export function clearSiteSession() {
  localStorage.removeItem(SITE_SESSION_KEY);
}

/**
 * Make sure the role store is seeded (useAuth also does this on
 * load — safe to run twice because `set` is idempotent on the id).
 */
async function ensureDefaultRoles() {
  const existing = await db.roles.count();
  if (existing > 0) return;
  for (const role of DEFAULT_ROLES) {
    await db.roles.set(role.id, role);
  }
}

/**
 * Ensure a single owner user exists (super admin) and write an
 * auth-session cookie so the existing role-gated UI considers us
 * signed in. If a super-admin user already exists we adopt it
 * instead of creating a second owner.
 */
export async function adoptOwnerSession() {
  await ensureDefaultRoles();
  const all = await db.users.getAll();
  let owner = all.find(u => u.roleId === 'role_super_admin') || all[0];
  if (!owner) {
    const id = generateUserId();
    owner = {
      id,
      username: 'owner',
      email: '',
      firstName: 'Sandbox',
      lastName: 'Owner',
      phone: '',
      roleId: 'role_super_admin',
      source: 'local',
      createdAt: new Date().toISOString(),
    };
    await db.users.set(id, owner);
  }
  const session = {
    userId: owner.id,
    expiresAt: Date.now() + SITE_SESSION_MS,
  };
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
  return owner;
}

/**
 * One-shot unlock after verifying the site password: write both the
 * site session and the (adopted) auth session, then let listeners
 * refresh.
 */
export async function unlockSite() {
  writeSiteSession();
  await adoptOwnerSession();
  window.dispatchEvent(new Event('site-unlocked'));
  window.dispatchEvent(new Event('auth-changed'));
}

export function lockSite() {
  clearSiteSession();
  localStorage.removeItem(AUTH_SESSION_KEY);
  localStorage.removeItem('pims_wp_token');
  window.dispatchEvent(new Event('site-unlocked'));
  window.dispatchEvent(new Event('auth-changed'));
}

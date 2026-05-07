/**
 * Tab keys → label. Used by the permission editor and nav gating.
 * Keep in sync with App.jsx NavButton + view conditionals.
 */
export const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'batch', label: 'Batch' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'boxes', label: 'Boxes' },
  { key: 'labeling', label: 'Labeling' },
  { key: 'sales', label: 'Sales Ready' },
  { key: 'reports', label: 'Reports' },
  { key: 'prices', label: 'Prices' },
  { key: 'compare', label: 'Compare' },
  { key: 'daily', label: 'Daily' },
  { key: 'woocommerce', label: 'WooCommerce' },
  { key: 'import', label: 'Import CSV' },
  { key: 'accounts', label: 'Accounts' },
];

const ALL_TRUE = Object.fromEntries(TABS.map(t => [t.key, true]));

export function emptyPermissions() {
  return Object.fromEntries(TABS.map(t => [t.key, false]));
}

export function fullPermissions() {
  return { ...ALL_TRUE };
}

/**
 * Built-in roles. The super-admin role is the only one that can manage
 * accounts/roles by default; everything is editable by super-admin
 * after first run except `isSystem` deletion.
 */
export const DEFAULT_ROLES = [
  {
    id: 'role_super_admin',
    name: 'Super Admin',
    color: '#dc2626',
    isSystem: true,
    canManageUsers: true,
    canManageRoles: true,
    order: 0,
    permissions: fullPermissions(),
  },
  {
    id: 'role_admin',
    name: 'Admin',
    color: '#ea580c',
    isSystem: true,
    canManageUsers: true,
    canManageRoles: false,
    order: 1,
    permissions: { ...fullPermissions(), accounts: false },
  },
  {
    id: 'role_manager',
    name: 'Manager',
    color: '#2563eb',
    isSystem: true,
    canManageUsers: false,
    canManageRoles: false,
    order: 2,
    permissions: {
      ...emptyPermissions(),
      dashboard: true,
      inventory: true,
      batch: true,
      boxes: true,
      labeling: true,
      sales: true,
      reports: true,
      prices: true,
      compare: true,
      daily: true,
      woocommerce: true,
    },
  },
  {
    id: 'role_customer',
    name: 'Customer',
    color: '#16a34a',
    isSystem: true,
    canManageUsers: false,
    canManageRoles: false,
    order: 3,
    permissions: {
      ...emptyPermissions(),
      dashboard: true,
      woocommerce: true,
    },
  },
  {
    id: 'role_guest',
    name: 'Guest',
    color: '#6b7280',
    isSystem: true,
    canManageUsers: false,
    canManageRoles: false,
    order: 4,
    permissions: { ...emptyPermissions(), dashboard: true },
  },
];

import { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Trash2, Edit, Save, X, Shield, KeyRound, Lock, Unlock } from 'lucide-react';
import { db } from '../lib/db';
import { TABS, emptyPermissions } from '../lib/permissions';
import { useToast } from './Toast';
import { useAuth, createUser, updateUser, syncWordPressUsers } from '../hooks/useAuth';
import { generateRoleId } from '../lib/auth';

const ACCOUNT_TABS = [
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles' },
];

const CREATION_ENABLED_KEY = 'accountCreationEnabled';

export async function isAccountCreationEnabled() {
  const v = await db.settings.get(CREATION_ENABLED_KEY);
  return v === null || v === undefined ? true : Boolean(v);
}

export default function Accounts() {
  const { currentUser, canManageUsers, canManageRoles, refresh, isSuperAdmin, authMode } = useAuth();
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [creationEnabled, setCreationEnabled] = useState(true);

  const reload = async () => {
    setUsers(await db.users.getAll());
    setRoles(await db.roles.getAll());
    setCreationEnabled(await isAccountCreationEnabled());
  };

  useEffect(() => { reload(); }, []);

  const rolesById = useMemo(() => Object.fromEntries(roles.map(r => [r.id, r])), [roles]);

  if (!canManageUsers && !canManageRoles) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 text-sm text-gray-600 dark:text-gray-300">
        You don't have permission to view Accounts.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Accounts</h2>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {ACCOUNT_TABS.map(t => {
          const disabled = (t.id === 'users' && !canManageUsers) || (t.id === 'roles' && !canManageRoles);
          return (
            <button
              key={t.id}
              onClick={() => !disabled && setActiveTab(t.id)}
              disabled={disabled}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                activeTab === t.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : disabled
                  ? 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'users' && canManageUsers && (
        <UsersPanel
          users={users}
          rolesById={rolesById}
          roles={roles}
          reload={async () => { await reload(); await refresh(); }}
          currentUser={currentUser}
          creationEnabled={creationEnabled}
          isSuperAdmin={isSuperAdmin}
          authMode={authMode}
          onToggleCreation={async (next) => {
            await db.settings.set(CREATION_ENABLED_KEY, next);
            setCreationEnabled(next);
          }}
        />
      )}
      {activeTab === 'roles' && canManageRoles && (
        <RolesPanel roles={roles} reload={async () => { await reload(); await refresh(); }} />
      )}
    </div>
  );
}

function RoleBadge({ role }) {
  if (!role) return <span className="text-xs text-gray-400">No role</span>;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: role.color || '#6b7280' }}
    >
      {role.name}
    </span>
  );
}

function UsersPanel({ users, rolesById, roles, reload, currentUser, creationEnabled, isSuperAdmin, onToggleCreation, authMode }) {
  const { success, error: showError } = useToast();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [pwResetFor, setPwResetFor] = useState(null);
  const [wpSyncing, setWpSyncing] = useState(false);
  const [includeCustomers, setIncludeCustomers] = useState(false);
  const isWordPress = authMode === 'wordpress';

  const handleWpSync = async () => {
    setWpSyncing(true);
    try {
      const r = await syncWordPressUsers({ includeCustomers });
      success(`WordPress users synced — ${r.imported} new, ${r.updated} updated${r.skipped ? `, ${r.skipped} customer(s) skipped` : ''}`);
      await reload();
    } catch (err) {
      showError(err.message);
    } finally {
      setWpSyncing(false);
    }
  };

  const blank = {
    username: '', password: '', email: '', firstName: '', lastName: '',
    phone: '', roleId: roles[0]?.id || '',
  };
  const [draft, setDraft] = useState(blank);

  const startCreate = () => { setDraft(blank); setEditing(null); setCreating(true); };
  const startEdit = (u) => {
    setEditing(u.id);
    setCreating(false);
    setDraft({
      username: u.username, password: '', email: u.email || '',
      firstName: u.firstName || '', lastName: u.lastName || '',
      phone: u.phone || '', roleId: u.roleId,
    });
  };
  const cancel = () => { setCreating(false); setEditing(null); setDraft(blank); };

  const submit = async () => {
    try {
      if (creating) {
        if (!(await isAccountCreationEnabled())) throw new Error('Account creation is locked');
        if (!draft.password || draft.password.length < 6) throw new Error('Password must be at least 6 characters');
        await createUser(draft);
        success('Account created');
      } else {
        const patch = { ...draft };
        if (!patch.password) delete patch.password;
        await updateUser(editing, patch);
        success('Account updated');
      }
      cancel();
      await reload();
    } catch (err) {
      showError(err.message);
    }
  };

  const remove = async (u) => {
    if (u.id === currentUser?.id) return showError("You can't delete the account you're signed in as");
    if (!window.confirm(`Delete account "${u.username}"? This cannot be undone.`)) return;
    await db.users.delete(u.id);
    await reload();
    success('Account deleted');
  };

  const resetPassword = async () => {
    try {
      if (!pwResetFor.newPassword || pwResetFor.newPassword.length < 6)
        throw new Error('Password must be at least 6 characters');
      await updateUser(pwResetFor.id, { password: pwResetFor.newPassword });
      success(`Password reset for ${pwResetFor.username}`);
      setPwResetFor(null);
    } catch (err) {
      showError(err.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* WordPress mode: accounts come from WP, not the local creation flow */}
      {isWordPress && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="text-sm">
            <div className="font-medium text-gray-900 dark:text-white">Accounts are managed in WordPress</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">
              Sync the WordPress user directory, then assign PIMS roles here. WooCommerce customers are skipped unless you opt in.
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={includeCustomers} onChange={e => setIncludeCustomers(e.target.checked)} />
              Include customers
            </label>
            <button
              onClick={handleWpSync}
              disabled={wpSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md text-sm font-medium"
            >
              <RotateCcw className={`w-4 h-4 ${wpSyncing ? 'animate-spin' : ''}`} />
              {wpSyncing ? 'Syncing…' : 'Sync WordPress Users'}
            </button>
          </div>
        </div>
      )}

      {/* Local mode: account creation lock */}
      {!isWordPress && (
        <div className={`flex items-center justify-between p-3 rounded-lg border ${
          creationEnabled
            ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
        }`}>
          <div className="flex items-center gap-2 text-sm">
            {creationEnabled ? (
              <Unlock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            ) : (
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {creationEnabled ? 'Account creation is enabled' : 'Account creation is locked'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {creationEnabled
                  ? 'Anyone with the right role can create new accounts.'
                  : "New accounts can't be created until a Super Admin re-enables this."}
              </div>
            </div>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={creationEnabled}
              onChange={e => onToggleCreation(e.target.checked)}
              disabled={!isSuperAdmin}
              className="sr-only peer"
            />
            <div
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isSuperAdmin ? '' : 'opacity-50 cursor-not-allowed'
              } ${creationEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}
              title={isSuperAdmin ? '' : 'Only Super Admin can change this'}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  creationEnabled ? 'translate-x-5' : ''
                }`}
              />
            </div>
          </label>
        </div>
      )}

      {!isWordPress && (
      <div className="flex justify-end">
        <button
          onClick={startCreate}
          disabled={!creationEnabled}
          title={creationEnabled ? '' : 'Account creation is locked'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-md text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New User
        </button>
      </div>
      )}

      {(creating || editing) && (
        <UserForm
          draft={draft}
          setDraft={setDraft}
          roles={roles}
          submitLabel={creating ? 'Create' : 'Save'}
          onSubmit={submit}
          onCancel={cancel}
          isCreate={creating}
        />
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {['Username', 'Name', 'Email', 'Phone', 'Role', 'Source', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{u.username}{u.id === currentUser?.id && <span className="ml-1 text-xs text-gray-400">(you)</span>}</td>
                  <td className="px-3 py-2">{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-3 py-2">{u.email || '—'}</td>
                  <td className="px-3 py-2">{u.phone || '—'}</td>
                  <td className="px-3 py-2"><RoleBadge role={rolesById[u.roleId]} /></td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide ${
                      u.source === 'wordpress'
                        ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                    }`}>
                      {u.source === 'wordpress' ? 'WordPress' : 'Local'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(u)} className="p-1 text-gray-500 hover:text-blue-600" title="Edit"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setPwResetFor({ id: u.id, username: u.username, newPassword: '' })} className="p-1 text-gray-500 hover:text-amber-600" title="Reset password"><KeyRound className="w-4 h-4" /></button>
                      <button onClick={() => remove(u)} disabled={u.id === currentUser?.id} className="p-1 text-gray-500 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Delete"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pwResetFor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Reset password for {pwResetFor.username}</h3>
              <button onClick={() => setPwResetFor(null)}><X className="w-4 h-4" /></button>
            </div>
            <input
              type="password"
              autoFocus
              value={pwResetFor.newPassword}
              onChange={e => setPwResetFor(p => ({ ...p, newPassword: e.target.value }))}
              placeholder="New password (min 6 chars)"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setPwResetFor(null)} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md">Cancel</button>
              <button onClick={resetPassword} className="px-3 py-1.5 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-md font-medium">Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserForm({ draft, setDraft, roles, submitLabel, onSubmit, onCancel, isCreate }) {
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Username *" value={draft.username} onChange={v => set('username', v)} />
        <Field label={isCreate ? 'Password *' : 'New Password (optional)'} type="password" value={draft.password} onChange={v => set('password', v)} />
        <Field label="First Name" value={draft.firstName} onChange={v => set('firstName', v)} />
        <Field label="Surname" value={draft.lastName} onChange={v => set('lastName', v)} />
        <Field label="Email" type="email" value={draft.email} onChange={v => set('email', v)} />
        <Field label="Phone" type="tel" value={draft.phone} onChange={v => set('phone', v)} />
        <label className="block">
          <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Role *</span>
          <select
            value={draft.roleId}
            onChange={e => set('roleId', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">Cancel</button>
        <button onClick={onSubmit} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium">
          <Save className="w-4 h-4" />
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

function RolesPanel({ roles, reload }) {
  const { success, error: showError } = useToast();
  const [editingId, setEditingId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(null);

  const startCreate = () => {
    setEditingId(null);
    setCreating(true);
    setDraft({
      id: generateRoleId(),
      name: 'New Role',
      color: '#6366f1',
      isSystem: false,
      canManageUsers: false,
      canManageRoles: false,
      order: (roles[roles.length - 1]?.order ?? 5) + 1,
      permissions: emptyPermissions(),
    });
  };

  const startEdit = (r) => {
    setCreating(false);
    setEditingId(r.id);
    setDraft({ ...r, permissions: { ...emptyPermissions(), ...r.permissions } });
  };

  const cancel = () => { setEditingId(null); setCreating(false); setDraft(null); };

  const save = async () => {
    try {
      if (!draft.name.trim()) throw new Error('Role name is required');
      await db.roles.set(draft.id, draft);
      success('Role saved');
      cancel();
      await reload();
    } catch (err) { showError(err.message); }
  };

  const remove = async (r) => {
    if (r.isSystem) return showError("Built-in roles can't be deleted (you can edit them).");
    if (!window.confirm(`Delete role "${r.name}"?`)) return;
    await db.roles.delete(r.id);
    await reload();
    success('Role deleted');
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={startCreate} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium">
          <Plus className="w-4 h-4" />
          New Role
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {roles.map(r => (
          <div key={r.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: r.color }} />
                <span className="font-semibold text-gray-900 dark:text-white">{r.name}</span>
                {r.isSystem && <span className="text-[10px] uppercase tracking-wider text-gray-400">Built-in</span>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(r)} className="p-1 text-gray-500 hover:text-blue-600" title="Edit"><Edit className="w-4 h-4" /></button>
                <button onClick={() => remove(r)} disabled={r.isSystem} className="p-1 text-gray-500 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <Shield className="w-3 h-3 inline mr-1" />
              {Object.values(r.permissions || {}).filter(Boolean).length} of {TABS.length} tabs · {r.canManageUsers ? 'users' : ''} {r.canManageRoles ? 'roles' : ''}
            </div>
          </div>
        ))}
      </div>

      {(editingId || creating) && draft && (
        <RoleEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} />
      )}
    </div>
  );
}

function RoleEditor({ draft, setDraft, onSave, onCancel }) {
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const setPerm = (key, v) => setDraft(d => ({ ...d, permissions: { ...d.permissions, [key]: v } }));
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Role Name *" value={draft.name} onChange={v => set('name', v)} />
        <label className="block">
          <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Color</span>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.color} onChange={e => set('color', e.target.value)} className="h-10 w-14 border border-gray-300 dark:border-gray-600 rounded" />
            <input type="text" value={draft.color} onChange={e => set('color', e.target.value)} className="flex-1 px-2 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white" />
          </div>
        </label>
        <Field label="Order (sort)" type="number" value={String(draft.order ?? 99)} onChange={v => set('order', Number(v) || 0)} />
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={!!draft.canManageUsers} onChange={e => set('canManageUsers', e.target.checked)} />
          Can manage users
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="checkbox" checked={!!draft.canManageRoles} onChange={e => set('canManageRoles', e.target.checked)} />
          Can manage roles
        </label>
      </div>

      <div>
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Tabs visible to this role</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TABS.map(t => (
            <label key={t.key} className="flex items-center gap-2 px-2 py-1.5 border border-gray-200 dark:border-gray-700 rounded text-sm">
              <input type="checkbox" checked={!!draft.permissions[t.key]} onChange={e => setPerm(t.key, e.target.checked)} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300">Cancel</button>
        <button onClick={onSave} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium">
          <Save className="w-4 h-4" />
          Save Role
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </label>
  );
}

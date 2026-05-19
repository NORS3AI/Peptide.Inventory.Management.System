import { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, X, Type, Download, Upload, AlertTriangle, Truck, Plus, Trash2, Image as ImageIcon, RotateCcw, ShoppingCart, CheckCircle2, ShieldCheck } from 'lucide-react';
import { db } from '../lib/db';
import { useToast } from './Toast';
import { useBranding, DEFAULT_BRANDING } from '../hooks/useBranding';
import { useWooCommerce } from '../hooks/useWooCommerce';
import { getAuthMode, setAuthMode, getWpAuthConfig, setWpAuthConfig } from '../hooks/useAuth';
import { wpGetToken } from '../lib/wpAuth';

const MAX_IMAGE_BYTES = 1024 * 1024; // 1 MB cap on logo/icon uploads

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 22, 24];

export default function SettingsModal({ isOpen, onClose }) {
  const [fontSize, setFontSize] = useState(() => {
    return Number(localStorage.getItem('app-font-size')) || 16;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [vendors, setVendors] = useState(['Belgium']);
  const [newVendorInput, setNewVendorInput] = useState('');
  const modalRef = useRef(null);
  const fileInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const iconInputRef = useRef(null);
  const { success, error: showError } = useToast();
  const { branding, setBranding, resetBranding } = useBranding();
  const wcApi = useWooCommerce();
  const [wcDraft, setWcDraft] = useState({ siteUrl: '', consumerKey: '', consumerSecret: '' });
  const [wcTestState, setWcTestState] = useState({ status: 'idle', message: '' });

  // Authentication (local vs WordPress JWT)
  const [authModeDraft, setAuthModeDraft] = useState('local');
  const [wpAuthDraft, setWpAuthDraft] = useState({ siteUrl: '', defaultRoleId: 'role_guest' });
  const [roleOptions, setRoleOptions] = useState([]);
  const [wpTestState, setWpTestState] = useState({ status: 'idle', message: '' });
  const [wpTestCreds, setWpTestCreds] = useState({ username: '', password: '' });

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      setAuthModeDraft(await getAuthMode());
      setWpAuthDraft(await getWpAuthConfig());
      setRoleOptions(await db.roles.getAll());
    })();
  }, [isOpen]);

  const saveAuthSettings = async () => {
    await setAuthMode(authModeDraft);
    await setWpAuthConfig(wpAuthDraft);
    success('Authentication settings saved');
  };

  const testWpLogin = async () => {
    setWpTestState({ status: 'running', message: 'Testing…' });
    try {
      if (!wpAuthDraft.siteUrl) throw new Error('Enter the WordPress site URL first');
      const r = await wpGetToken(wpAuthDraft.siteUrl, wpTestCreds.username, wpTestCreds.password);
      setWpTestState({ status: 'ok', message: `Authenticated as ${r.userDisplayName || r.userNicename}` });
    } catch (err) {
      setWpTestState({ status: 'error', message: err.message });
    }
  };

  useEffect(() => {
    setWcDraft({
      siteUrl: wcApi.connection.siteUrl || '',
      consumerKey: wcApi.connection.consumerKey || '',
      consumerSecret: wcApi.connection.consumerSecret || '',
    });
  }, [wcApi.connection.siteUrl, wcApi.connection.consumerKey, wcApi.connection.consumerSecret]);

  const saveWooConnection = async () => {
    await wcApi.saveConnection(wcDraft);
    success('WooCommerce connection saved');
  };

  const testWooConnection = async () => {
    setWcTestState({ status: 'running', message: 'Testing…' });
    try {
      const result = await wcApi.testConnection(wcDraft);
      setWcTestState({ status: 'ok', message: `Connected to ${result.storeName || result.environment} (WC ${result.wcVersion || '?'})` });
    } catch (err) {
      setWcTestState({ status: 'error', message: err.message });
    }
  };

  const disconnectWoo = async () => {
    if (!window.confirm('Clear WooCommerce credentials? Cached orders/products/customers will remain until you sync again.')) return;
    await wcApi.saveConnection({ siteUrl: '', consumerKey: '', consumerSecret: '' });
    setWcDraft({ siteUrl: '', consumerKey: '', consumerSecret: '' });
    setWcTestState({ status: 'idle', message: '' });
    success('WooCommerce disconnected');
  };
  const [titleDraft, setTitleDraft] = useState(branding.appTitle);
  const [subtitleDraft, setSubtitleDraft] = useState(branding.appSubtitle);
  const [browserTitleDraft, setBrowserTitleDraft] = useState(branding.browserTitle);

  useEffect(() => {
    setTitleDraft(branding.appTitle);
    setSubtitleDraft(branding.appSubtitle);
    setBrowserTitleDraft(branding.browserTitle);
  }, [branding.appTitle, branding.appSubtitle, branding.browserTitle]);

  const saveBrandingText = async () => {
    await setBranding({
      appTitle: titleDraft.trim() || DEFAULT_BRANDING.appTitle,
      appSubtitle: subtitleDraft.trim() || DEFAULT_BRANDING.appSubtitle,
      browserTitle: browserTitleDraft.trim() || DEFAULT_BRANDING.browserTitle,
    });
    success('Branding text saved');
  };

  const handleImageUpload = async (event, key) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showError('Please select an image file');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      showError('Image must be 1 MB or smaller');
      return;
    }
    try {
      const dataUrl = await readFileAsDataURL(file);
      await setBranding({ [key]: dataUrl });
      success(key === 'appLogo' ? 'Logo updated' : 'Browser icon updated');
    } catch (err) {
      console.error(err);
      showError('Failed to read image');
    }
  };

  const clearBrandingImage = async (key) => {
    await setBranding({ [key]: '' });
    success(key === 'appLogo' ? 'Logo reset' : 'Browser icon reset');
  };

  // Apply font size to document
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem('app-font-size', fontSize.toString());
  }, [fontSize]);

  // Load saved font size on mount
  useEffect(() => {
    const saved = Number(localStorage.getItem('app-font-size'));
    if (saved && FONT_SIZES.includes(saved)) {
      setFontSize(saved);
      document.documentElement.style.fontSize = `${saved}px`;
    }
  }, []);

  // Load vendors
  useEffect(() => {
    if (!isOpen) return;
    const loadVendors = async () => {
      const saved = await db.settings.get('batchVendors');
      if (saved && Array.isArray(saved) && saved.length > 0) setVendors(saved);
    };
    loadVendors();
  }, [isOpen]);

  const addVendorSetting = async () => {
    if (!newVendorInput.trim() || vendors.includes(newVendorInput.trim())) return;
    const updated = [...vendors, newVendorInput.trim()];
    setVendors(updated);
    await db.settings.set('batchVendors', updated);
    setNewVendorInput('');
    success('Vendor added');
  };

  const removeVendorSetting = async (v) => {
    const updated = vendors.filter(x => x !== v);
    setVendors(updated);
    await db.settings.set('batchVendors', updated);
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Export all data to JSON file
  const handleExportBackup = async () => {
    setIsExporting(true);
    try {
      const exportData = await db.exportData();

      // Create filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `inventory-backup-${timestamp}.json`;

      // Download as JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      success('Backup exported successfully!');
    } catch (err) {
      console.error('Export error:', err);
      showError('Failed to export backup');
    } finally {
      setIsExporting(false);
    }
  };

  // Import data from JSON file
  const handleImportBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // Validate backup format
      if (!importData.data || !importData.version) {
        throw new Error('Invalid backup file format');
      }

      // Confirm before importing
      const confirmed = window.confirm(
        '⚠️ This will REPLACE ALL current data with the backup.\n\n' +
        `Backup date: ${new Date(importData.exportDate).toLocaleString()}\n` +
        `Version: ${importData.version}\n\n` +
        'Are you sure you want to continue?'
      );

      if (!confirmed) {
        setIsImporting(false);
        return;
      }

      // Import the data
      await db.importData(importData);

      success('Backup imported successfully! Reloading page...');

      // Reload page after short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('Import error:', err);
      showError(`Failed to import backup: ${err.message}`);
      setIsImporting(false);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[999] p-4">
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <SettingsIcon className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Settings</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Font Size Control */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Type className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Font Size</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Adjust the base font size for the entire application.
              </p>

              {/* Size Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {FONT_SIZES.map(size => (
                  <button
                    key={size}
                    onClick={() => setFontSize(size)}
                    className={`min-w-[3rem] px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                      fontSize === size
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {size}pt
                  </button>
                ))}
              </div>

              {/* Preview */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Preview</p>
                <p style={{ fontSize: `${fontSize}px` }} className="text-gray-900 dark:text-white">
                  The quick brown fox jumps over the lazy dog.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    style={{ fontSize: `${Math.max(fontSize * 0.875, 11)}px` }}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg whitespace-nowrap"
                  >
                    Sample Button
                  </button>
                  <button
                    style={{ fontSize: `${Math.max(fontSize * 0.875, 11)}px` }}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg whitespace-nowrap"
                  >
                    Save All
                  </button>
                  <button
                    style={{ fontSize: `${Math.max(fontSize * 0.875, 11)}px` }}
                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg whitespace-nowrap"
                  >
                    Bulk Edit
                  </button>
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={() => setFontSize(16)}
                className="mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Reset to default (16pt)
              </button>
            </div>

            {/* Branding */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Branding</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Customize the app title, subtitle, browser tab title, logo, and favicon. Saved per-browser via IndexedDB.
              </p>

              {/* Text fields */}
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">App Title</label>
                  <input
                    type="text"
                    value={titleDraft}
                    onChange={e => setTitleDraft(e.target.value)}
                    placeholder={DEFAULT_BRANDING.appTitle}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">App Subtitle</label>
                  <input
                    type="text"
                    value={subtitleDraft}
                    onChange={e => setSubtitleDraft(e.target.value)}
                    placeholder={DEFAULT_BRANDING.appSubtitle}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Browser Tab Title</label>
                  <input
                    type="text"
                    value={browserTitleDraft}
                    onChange={e => setBrowserTitleDraft(e.target.value)}
                    placeholder={DEFAULT_BRANDING.browserTitle}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <button
                  onClick={saveBrandingText}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  Save Text
                </button>
              </div>

              {/* Logo + Icon */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">App Logo</label>
                  <div className="flex items-center gap-3 mb-2">
                    {branding.appLogo ? (
                      <img src={branding.appLogo} alt="Logo preview" className="w-12 h-12 object-contain rounded border border-gray-200 dark:border-gray-700 bg-white" />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center rounded border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 text-xs">None</div>
                    )}
                    <div className="flex flex-col gap-1">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'appLogo')}
                        className="hidden"
                      />
                      <button onClick={() => logoInputRef.current?.click()} className="px-3 py-1.5 bg-gray-900 dark:bg-blue-600 text-white text-xs rounded-md hover:bg-gray-800 dark:hover:bg-blue-700">
                        Upload
                      </button>
                      {branding.appLogo && (
                        <button onClick={() => clearBrandingImage('appLogo')} className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:underline text-left">
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Browser Icon</label>
                  <div className="flex items-center gap-3 mb-2">
                    {branding.browserIcon ? (
                      <img src={branding.browserIcon} alt="Icon preview" className="w-12 h-12 object-contain rounded border border-gray-200 dark:border-gray-700 bg-white" />
                    ) : (
                      <div className="w-12 h-12 flex items-center justify-center rounded border border-dashed border-gray-300 dark:border-gray-600 text-gray-400 text-xs">None</div>
                    )}
                    <div className="flex flex-col gap-1">
                      <input
                        ref={iconInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, 'browserIcon')}
                        className="hidden"
                      />
                      <button onClick={() => iconInputRef.current?.click()} className="px-3 py-1.5 bg-gray-900 dark:bg-blue-600 text-white text-xs rounded-md hover:bg-gray-800 dark:hover:bg-blue-700">
                        Upload
                      </button>
                      {branding.browserIcon && (
                        <button onClick={() => clearBrandingImage('browserIcon')} className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:underline text-left">
                          Reset
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">PNG, JPG, or SVG up to 1 MB. Square images render best.</p>

              <button
                onClick={async () => { await resetBranding(); success('Branding reset to defaults'); }}
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                <RotateCcw className="w-4 h-4" />
                Reset all branding to defaults
              </button>
            </div>

            {/* Authentication */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Authentication</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Choose how users sign in. WordPress mode verifies credentials against your site — real, server-side auth.
              </p>

              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <label className={`flex-1 border rounded-lg p-3 cursor-pointer ${authModeDraft === 'local' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                    <input type="radio" name="authMode" className="mr-2" checked={authModeDraft === 'local'} onChange={() => setAuthModeDraft('local')} />
                    <span className="font-medium text-sm text-gray-900 dark:text-white">Local accounts</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">PIMS-managed accounts in this browser. UX gate only.</p>
                  </label>
                  <label className={`flex-1 border rounded-lg p-3 cursor-pointer ${authModeDraft === 'wordpress' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}`}>
                    <input type="radio" name="authMode" className="mr-2" checked={authModeDraft === 'wordpress'} onChange={() => setAuthModeDraft('wordpress')} />
                    <span className="font-medium text-sm text-gray-900 dark:text-white">WordPress (JWT)</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Verified by your WordPress site. Requires the JWT plugin.</p>
                  </label>
                </div>

                {authModeDraft === 'wordpress' && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">WordPress Site URL</label>
                      <input
                        type="url"
                        value={wpAuthDraft.siteUrl}
                        onChange={e => setWpAuthDraft(d => ({ ...d, siteUrl: e.target.value }))}
                        placeholder="https://superstitionresearch.com"
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Default role for new WordPress users</label>
                      <select
                        value={wpAuthDraft.defaultRoleId}
                        onChange={e => setWpAuthDraft(d => ({ ...d, defaultRoleId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        {roleOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        The first WordPress user to sign in becomes Super Admin. Everyone after gets this role until a Super Admin changes it in Accounts.
                      </p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg space-y-2">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">Test a WordPress login</div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={wpTestCreds.username}
                          onChange={e => setWpTestCreds(c => ({ ...c, username: e.target.value }))}
                          placeholder="WP username"
                          autoComplete="off"
                          className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                        <input
                          type="password"
                          value={wpTestCreds.password}
                          onChange={e => setWpTestCreds(c => ({ ...c, password: e.target.value }))}
                          placeholder="WP password"
                          autoComplete="off"
                          className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                      <button
                        onClick={testWpLogin}
                        disabled={wpTestState.status === 'running'}
                        className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-md font-medium"
                      >
                        {wpTestState.status === 'running' ? 'Testing…' : 'Test login'}
                      </button>
                      {wpTestState.status === 'ok' && (
                        <div className="flex items-start gap-2 text-xs text-green-700 dark:text-green-300">
                          <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />{wpTestState.message}
                        </div>
                      )}
                      {wpTestState.status === 'error' && (
                        <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{wpTestState.message}
                        </div>
                      )}
                    </div>

                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        Requires the <strong>JWT Authentication for WP REST API</strong> plugin active on your site, plus
                        <code className="px-1">JWT_AUTH_SECRET_KEY</code> in wp-config.php. If PIMS is not same-origin with WordPress you also need <code className="px-1">JWT_AUTH_CORS_ENABLE</code> and a CORS allow rule for <code>{typeof window !== 'undefined' ? window.location.origin : ''}</code>.
                      </div>
                    </div>
                  </>
                )}

                <button
                  onClick={saveAuthSettings}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  Save Authentication Settings
                </button>
              </div>
            </div>

            {/* WooCommerce */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <ShoppingCart className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">WooCommerce</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Connect your WC store to pull orders, products, and customers into PIMS. Use a <strong>Read</strong>-only API key.
              </p>

              <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  Your WooCommerce site must allow CORS from <code>{typeof window !== 'undefined' ? window.location.origin : ''}</code>. Without it the browser will block API calls.
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Site URL</label>
                  <input
                    type="url"
                    value={wcDraft.siteUrl}
                    onChange={e => setWcDraft(d => ({ ...d, siteUrl: e.target.value }))}
                    placeholder="https://yourstore.com"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Consumer Key</label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={wcDraft.consumerKey}
                    onChange={e => setWcDraft(d => ({ ...d, consumerKey: e.target.value }))}
                    placeholder="ck_..."
                    className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Consumer Secret</label>
                  <input
                    type="password"
                    autoComplete="off"
                    value={wcDraft.consumerSecret}
                    onChange={e => setWcDraft(d => ({ ...d, consumerSecret: e.target.value }))}
                    placeholder="cs_..."
                    className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={saveWooConnection}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={testWooConnection}
                    disabled={!wcDraft.siteUrl || !wcDraft.consumerKey || !wcDraft.consumerSecret || wcTestState.status === 'running'}
                    className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-md font-medium"
                  >
                    {wcTestState.status === 'running' ? 'Testing…' : 'Test connection'}
                  </button>
                  {wcApi.isConfigured && (
                    <button
                      onClick={disconnectWoo}
                      className="px-3 py-1.5 text-sm border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md font-medium"
                    >
                      Disconnect
                    </button>
                  )}
                </div>

                {wcTestState.status === 'ok' && (
                  <div className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-xs text-green-800 dark:text-green-200">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>{wcTestState.message}</div>
                  </div>
                )}
                {wcTestState.status === 'error' && (
                  <div className="flex items-start gap-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-800 dark:text-red-200">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>{wcTestState.message}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Vendor Management */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <Truck className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Batch Vendors</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Manage the vendor list used in the Batch view.
              </p>
              <div className="space-y-2 mb-3">
                {vendors.map(v => (
                  <div key={v} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <span className="text-sm text-gray-900 dark:text-white">{v}</span>
                    <button onClick={() => removeVendorSetting(v)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newVendorInput}
                  onChange={e => setNewVendorInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addVendorSetting()}
                  placeholder="New vendor name"
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button onClick={addVendorSetting} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Backup & Restore */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-1">
                <Download className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Backup & Restore</h3>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Export all data (Inventory, Prices, Snapshots, Labels, Settings) to a backup file, or restore from a previous backup.
              </p>

              {/* Warning */}
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Important:</strong> Keep regular backups! IndexedDB can be cleared by browser settings or incognito mode.
                </div>
              </div>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleExportBackup}
                  disabled={isExporting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors font-medium"
                >
                  <Download className="w-5 h-5" />
                  <span>{isExporting ? 'Exporting...' : 'Export Backup'}</span>
                </button>

                <label className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportBackup}
                    className="hidden"
                    disabled={isImporting}
                  />
                  <div className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors font-medium cursor-pointer">
                    <Upload className="w-5 h-5" />
                    <span>{isImporting ? 'Importing...' : 'Import Backup'}</span>
                  </div>
                </label>
              </div>

              {/* Info */}
              <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                <p><strong>Includes:</strong> Inventory, Prices, Labels, Orders, Snapshots, Settings, Transactions, Velocity History</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-900 dark:bg-blue-600 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-blue-700 transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

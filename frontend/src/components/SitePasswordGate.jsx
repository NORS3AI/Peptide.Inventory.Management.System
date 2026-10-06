import { useEffect, useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import {
  hasSitePassword,
  setSitePassword,
  verifySitePassword,
  unlockSite,
} from '../lib/sitePassword';
import { useBranding } from '../hooks/useBranding';

export default function SitePasswordGate() {
  const { branding } = useBranding();
  const [mode, setMode] = useState('loading'); // loading | setup | login
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const exists = await hasSitePassword();
      setMode(exists ? 'login' : 'setup');
    })();
  }, []);

  async function handleSetup(e) {
    e.preventDefault();
    setError('');
    if (!password || password.length < 4) {
      return setError('Password must be at least 4 characters');
    }
    if (password !== confirm) {
      return setError('Passwords do not match');
    }
    setSubmitting(true);
    try {
      await setSitePassword(password);
      await unlockSite();
    } catch (err) {
      setError(err.message || 'Could not set password');
      setSubmitting(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const ok = await verifySitePassword(password);
      if (!ok) throw new Error('Incorrect password');
      await unlockSite();
    } catch (err) {
      setError(err.message || 'Could not unlock site');
      setSubmitting(false);
    }
  }

  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-500">
        Loading…
      </div>
    );
  }

  const isSetup = mode === 'setup';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-sm w-full p-6">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 dark:bg-blue-500 rounded-full mb-3">
            {branding.appLogo ? (
              <img src={branding.appLogo} alt="" className="w-10 h-10 object-contain" />
            ) : isSetup ? (
              <ShieldCheck className="w-7 h-7 text-white" />
            ) : (
              <Lock className="w-7 h-7 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{branding.appTitle}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSetup
              ? 'Set a password to protect this sandbox'
              : 'Enter the site password to continue'}
          </p>
        </div>

        <form onSubmit={isSetup ? handleSetup : handleLogin} className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              {isSetup ? 'New password' : 'Password'}
            </span>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete={isSetup ? 'new-password' : 'current-password'}
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          {isSetup && (
            <label className="block">
              <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm password</span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </label>
          )}

          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium"
          >
            {submitting ? (isSetup ? 'Setting password…' : 'Unlocking…') : (isSetup ? 'Set Password & Enter' : 'Unlock')}
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500 text-center">
          {isSetup
            ? 'This password protects your sandbox PIMS and can be changed later in Settings.'
            : 'Forgot the password? Clear your browser data and set a new one.'}
        </p>
      </div>
    </div>
  );
}

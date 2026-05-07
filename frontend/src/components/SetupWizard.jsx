import { useState } from 'react';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { createSuperAdmin } from '../hooks/useAuth';

export default function SetupWizard({ onComplete }) {
  const [form, setForm] = useState({
    username: 'admin',
    password: '',
    confirm: '',
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.username.trim()) return setError('Username is required');
    if (!form.password) return setError('Password is required');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setSubmitting(true);
    try {
      await createSuperAdmin(form);
      window.dispatchEvent(new Event('auth-changed'));
      onComplete?.();
    } catch (err) {
      setError(err.message || 'Setup failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">First-time setup</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Create the Super Admin account</p>
          </div>
        </div>

        <div className="mt-3 mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex gap-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            This is a UX gate, not a security boundary. All credentials live
            in your browser. Don't reuse a sensitive password.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Username" required value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="First Name" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} />
            <Field label="Surname" value={form.lastName} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
          </div>
          <Field label="Email (used for password reset display)" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />
          <Field label="Phone" type="tel" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          <Field label="Password" type="password" required value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} />
          <Field label="Confirm Password" type="password" required value={form.confirm} onChange={v => setForm(f => ({ ...f, confirm: v }))} />

          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium"
          >
            {submitting ? 'Creating account…' : 'Create Super Admin & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-red-500"> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
    </label>
  );
}

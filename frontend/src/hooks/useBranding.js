import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';

export const DEFAULT_BRANDING = {
  appTitle: 'PIMS',
  appSubtitle: 'Peptide Inventory Management System',
  browserTitle: 'PIMS — Peptide Inventory Management System',
  appLogo: '',
  browserIcon: '',
};

function applyBrowserChrome(branding) {
  if (branding.browserTitle) document.title = branding.browserTitle;

  const href = branding.browserIcon || '/Peptide.Inventory.Management.System/vite.svg';
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (branding.browserIcon) {
    link.removeAttribute('type');
  } else {
    link.type = 'image/svg+xml';
  }
  link.href = href;
}

export function useBranding() {
  const [branding, setBrandingState] = useState(DEFAULT_BRANDING);

  const load = useCallback(async () => {
    const saved = await db.settings.get('branding');
    const merged = { ...DEFAULT_BRANDING, ...(saved || {}) };
    setBrandingState(merged);
    applyBrowserChrome(merged);
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('branding-changed', handler);
    return () => window.removeEventListener('branding-changed', handler);
  }, [load]);

  const setBranding = useCallback(async (patch) => {
    const next = { ...branding, ...patch };
    setBrandingState(next);
    await db.settings.set('branding', next);
    applyBrowserChrome(next);
    window.dispatchEvent(new Event('branding-changed'));
  }, [branding]);

  const resetBranding = useCallback(async () => {
    setBrandingState(DEFAULT_BRANDING);
    await db.settings.set('branding', DEFAULT_BRANDING);
    applyBrowserChrome(DEFAULT_BRANDING);
    window.dispatchEvent(new Event('branding-changed'));
  }, []);

  return { branding, setBranding, resetBranding };
}

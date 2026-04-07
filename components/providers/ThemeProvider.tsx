// ABOUTME: Theme context provider for light/dark/system theme toggle
// ABOUTME: Reads/writes localStorage('floom-theme'), sets data-theme on <html>

'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ThemeChoice = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemeChoice;
  resolved: ResolvedTheme;
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolved: 'dark',
  cycleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(t: ThemeChoice): ResolvedTheme {
  return t === 'system' ? getSystemTheme() : t;
}

function applyTheme(r: ResolvedTheme) {
  document.documentElement.dataset.theme = r;
  if (r === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeChoice>('system');
  const [resolved, setResolved] = useState<ResolvedTheme>('dark');

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('floom-theme') as ThemeChoice | null;
    const initial = stored || 'system';
    setTheme(initial);
    const r = resolve(initial);
    setResolved(r);
    applyTheme(r);
  }, []);

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        const r = getSystemTheme();
        setResolved(r);
        applyTheme(r);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const cycleTheme = useCallback(() => {
    const order: ThemeChoice[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % 3];
    setTheme(next);
    const r = resolve(next);
    setResolved(r);
    applyTheme(r);
    localStorage.setItem('floom-theme', next);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolved, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

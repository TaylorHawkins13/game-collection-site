'use client';

import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('gct_theme') || 'dark';
    setTheme(saved);
    document.body.setAttribute('data-theme', saved);
  }, []);

  function toggle() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('gct_theme', next);
  }

  return (
    <button className="btn-icon" onClick={toggle} title="Toggle theme" type="button">
      {theme === 'light' ? '☀️' : '🌙'}
    </button>
  );
}

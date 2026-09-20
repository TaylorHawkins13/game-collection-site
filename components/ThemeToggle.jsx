'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

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
      {/* Sun/Moon (lucide-react) — the last icon-free control in the
          navbar's own row, now that the rest of it is fully iconified
          (see CHANGELOG.md's icon-rollout entries). Shows the icon for
          the CURRENT theme, same as the text label always has ("Light"
          while in light mode), not the theme a click switches to. */}
      {theme === 'light' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      {theme === 'light' ? 'Light' : 'Dark'}
    </button>
  );
}

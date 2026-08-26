'use client';

import { useEffect, useRef, useState } from 'react';
import { onTrophyEarned } from '@/lib/trophyToast';

const TIER_LABEL = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  platinum: 'Platinum',
};

let nextId = 1;

export default function TrophyToastListener() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  useEffect(() => {
    const unsubscribe = onTrophyEarned((trophy) => {
      const id = nextId++;
      setToasts((t) => [...t, { id, ...trophy }]);
      timers.current[id] = setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
        delete timers.current[id];
      }, 5500);
    });
    const timersAtMount = timers.current;
    return () => {
      unsubscribe();
      Object.values(timersAtMount).forEach(clearTimeout);
    };
  }, []);

  function dismiss(id) {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    // role="status" + aria-live="polite" — same gap as the regular toast
    // stack had (ROADMAP.md "Rest of the Accessibility checklist"):
    // earning a trophy is a real, screen-reader-worthy moment, and this
    // was the one toast stack on the site that never announced itself.
    <div className="trophy-toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`trophy-toast trophy-${t.tier}`} onClick={() => dismiss(t.id)}>
          <div className="trophy-toast-icon" aria-hidden="true" />
          <div>
            <div className="trophy-toast-label">Trophy earned · {TIER_LABEL[t.tier] || t.tier}</div>
            <div className="trophy-toast-name">{t.name}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

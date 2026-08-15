'use client';

import { useEffect, useRef, useState } from 'react';
import { onToast } from '@/lib/toast';

let nextId = 1;

export default function ToastListener() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  useEffect(() => {
    const unsubscribe = onToast(({ message, type }) => {
      const id = nextId++;
      setToasts((t) => [...t, { id, message, type }]);
      timers.current[id] = setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
        delete timers.current[id];
      }, 5000);
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
    // role="status" + aria-live="polite" so a screen reader announces a
    // toast as it appears — previously this was silent unless something
    // happened to already have focus inside the stack, which nothing
    // normally does (toasts show up in response to an action elsewhere
    // on the page, like a failed follow or a rate-limited comment).
    // "polite" rather than "assertive" so a toast doesn't barge in over
    // whatever the screen reader is already announcing.
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`} onClick={() => dismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

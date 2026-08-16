'use client';

import { useId, useState } from 'react';

export default function ChipInput({ id, value, onChange, placeholder, suggestions }) {
  const [input, setInput] = useState('');
  const listId = useId();
  // Don't suggest chips that are already added.
  const options = (suggestions || []).filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  function add(val) {
    val = (val || '').trim();
    if (!val) return;
    if (value.some((v) => v.toLowerCase() === val.toLowerCase())) {
      setInput('');
      return;
    }
    onChange([...value, val]);
    setInput('');
  }

  function remove(i) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    } else if (e.key === 'Backspace' && !input && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="chip-input">
      {value.map((v, i) => (
        <span className="chip" key={v + i}>
          {v}
          <button type="button" onClick={() => remove(i)} aria-label={`Remove ${v}`}>
            ×
          </button>
        </span>
      ))}
      <input
        id={id}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) add(input);
        }}
        placeholder={placeholder}
        list={options.length ? listId : undefined}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((o) => (
            <option value={o} key={o} />
          ))}
        </datalist>
      )}
    </div>
  );
}

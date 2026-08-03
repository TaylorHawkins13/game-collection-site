'use client';

import { useState } from 'react';

export default function ChipInput({ value, onChange, placeholder }) {
  const [input, setInput] = useState('');

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
          <button type="button" onClick={() => remove(i)} aria-label="Remove">
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (input.trim()) add(input);
        }}
        placeholder={placeholder}
      />
    </div>
  );
}

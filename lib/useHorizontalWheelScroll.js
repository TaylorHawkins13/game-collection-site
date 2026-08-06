'use client';

import { useRef, useCallback } from 'react';

// A trackpad sends both deltaX and deltaY, so horizontal-only rows
// (overflow-x: auto, no wrap) already scroll fine for those users. A
// plain mouse wheel only ever sends deltaY — browsers don't translate
// that into horizontal scroll on their own unless the container has
// nothing to scroll vertically AND the OS/browser combo happens to
// redirect it (inconsistent, mostly doesn't happen). Net effect: mouse
// users on PC couldn't scroll these rows at all. This hook attaches a
// wheel listener that forwards vertical wheel movement into
// scrollLeft, only when the scroll is basically vertical (so a
// trackpad's native horizontal swipe isn't double-applied) and only
// when the row actually has horizontal overflow to scroll.
export function useHorizontalWheelScroll() {
  const ref = useRef(null);

  const setRef = useCallback((node) => {
    if (ref.current) {
      ref.current.removeEventListener('wheel', ref.current._hScrollHandler);
    }
    attachHorizontalWheelScroll(node);
    ref.current = node;
  }, []);

  return setRef;
}

// Plain (non-hook) version of the same thing, for use directly as a ref
// callback inside a .map() — e.g. a per-row mosaic list — where the
// number of elements isn't fixed and calling a hook per iteration
// wouldn't be legal.
export function attachHorizontalWheelScroll(node) {
  if (!node) return;
  const handler = (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (node.scrollWidth <= node.clientWidth) return;
    e.preventDefault();
    node.scrollLeft += e.deltaY;
  };
  node.addEventListener('wheel', handler, { passive: false });
  node._hScrollHandler = handler;
}

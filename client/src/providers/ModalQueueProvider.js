// src/providers/ModalQueueProvider.jsx
import React, { createContext, useContext, useMemo, useRef, useState, useEffect } from "react";

const Ctx = createContext(null);

/**
 * Request signature:
 *   { key: string, priority: number, enabled: boolean }
 *
 * Contract:
 *   - Only one active at a time (highest priority wins; FIFO tie-breaker)
 *   - When an item’s `enabled` turns false, it auto-releases
 */
export function ModalQueueProvider({ children }) {
  const [active, setActive] = useState(null); // { key, priority, ts }
  const itemsRef = useRef(new Map());         // key -> { key, priority, enabled, ts }

  const recompute = () => {
    const list = [...itemsRef.current.values()].filter(i => i.enabled);
    if (!list.length) return setActive(null);
    // sort by priority desc, then ts asc
    list.sort((a, b) => (b.priority - a.priority) || (a.ts - b.ts));
    const top = list[0];
    setActive(prev => (prev?.key === top.key ? prev : top));
  };

  const request = ({ key, priority, enabled }) => {
    const existing = itemsRef.current.get(key);
    if (existing) {
      existing.priority = priority;
      existing.enabled = enabled;
    } else {
      itemsRef.current.set(key, { key, priority, enabled, ts: Date.now() });
    }
    recompute();
  };

  const release = (key) => {
    itemsRef.current.delete(key);
    recompute();
  };

  // If an active item becomes disabled elsewhere, drop it.
  useEffect(() => {
    if (!active) return;
    const curr = itemsRef.current.get(active.key);
    if (!curr?.enabled) recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.key]);

  const value = useMemo(() => ({ active, request, release }), [active]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useModalQueue() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useModalQueue must be used inside ModalQueueProvider");
  return ctx;
}

/**
 * Convenience hook for a modal instance
 */
export function useModalQueueItem({ key, priority, enabled }) {
  const { active, request, release } = useModalQueue();

  // (Re)register on changes
  useEffect(() => { request({ key, priority, enabled }); }, [key, priority, enabled]); // eslint-disable-line

  // Auto-release if unmounted
  useEffect(() => () => release(key), [key, release]);

  return {
    isActive: active?.key === key,
    release: () => release(key),
  };
}

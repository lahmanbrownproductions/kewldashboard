"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "kewldashboard.dashboard-title.v1";

export const DEFAULT_DASHBOARD_TITLE = "Kewl Dashboard";

const MAX_LEN = 96;

export function EditableDashboardTitle() {
  const [value, setValue] = useState(DEFAULT_DASHBOARD_TITLE);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const next = stored.trim().slice(0, MAX_LEN) || DEFAULT_DASHBOARD_TITLE;
        setValue(next);
        document.title = next;
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((raw: string) => {
    const next = raw.trim().slice(0, MAX_LEN) || DEFAULT_DASHBOARD_TITLE;
    setValue(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    try {
      document.title = next;
    } catch {
      /* ignore */
    }
  }, []);

  function commit() {
    persist(inputRef.current?.value ?? value);
  }

  return (
    <h1 className="dashboard-title-heading">
      <input
        ref={inputRef}
        type="text"
        className="dashboard-title-input"
        value={value}
        maxLength={MAX_LEN}
        onChange={(event) => setValue(event.target.value.slice(0, MAX_LEN))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            (event.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Dashboard title"
        title="Edit title; stored in this browser"
      />
    </h1>
  );
}

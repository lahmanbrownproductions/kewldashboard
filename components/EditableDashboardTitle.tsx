"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

const STORAGE_KEY = "kewldashboard.dashboard-title.v1";

export const DEFAULT_DASHBOARD_TITLE = "Kewl Dashboard";

const MAX_LEN = 96;

export function EditableDashboardTitle() {
  const id = useId();
  const descId = `${id}-desc`;
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
      <span id={descId} className="sr-only">
        Click or tap the title to rename it. Your custom name is saved only in this browser.
      </span>
      <label htmlFor={id} className="dashboard-title-field" title="Click to edit — saved in this browser">
        <input
          id={id}
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
          aria-describedby={descId}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="dashboard-title-edit-badge" aria-hidden="true">
          <svg
            className="dashboard-title-edit-icon"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="miter"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4L16.5 3.5z" />
          </svg>
        </span>
      </label>
    </h1>
  );
}

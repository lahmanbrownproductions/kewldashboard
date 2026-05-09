"use client";

import { useEffect, useRef } from "react";

import { playButtonBeep } from "@/lib/button-beep";
import { scrollToDashboardTarget } from "@/lib/dashboard-pills";
import type { DashboardSectionId } from "@/lib/dashboard-sections";

/** True when focus is in a field where shortcuts should not steal keys. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  const el = target;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  if (el.isContentEditable) {
    return true;
  }
  return Boolean(el.closest("input, textarea, select, [contenteditable='true']"));
}

/** Let maps, RSS reader, dialogs keep arrow keys for local UX. */
function shouldDeferToNestedSurface(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest(
      ".news-reader-prose-scroll, .news-reader-panel-scroll, .leaflet-container, .leaflet-map-shell, [role='dialog'], .timezone-modal-panel",
    ),
  );
}

function buildStack(sectionOrder: DashboardSectionId[]): string[] {
  return ["overview", ...sectionOrder];
}

type DashboardSectionJumpShortcutsProps = {
  sectionOrder: DashboardSectionId[];
};

/**
 * Global navigation (when not typing / not in a nested scroller):
 * - Alt+0: hero / overview — Alt+1…9: Nth LCARS section in order
 * - Arrow ↑/← previous, Arrow ↓/→ next — cycles overview then sections in stack order
 * - Beeps on each jump (same as panel controls)
 */
export function DashboardSectionJumpShortcuts({ sectionOrder }: DashboardSectionJumpShortcutsProps) {
  const stackIndexRef = useRef(0);
  const sectionOrderRef = useRef(sectionOrder);
  sectionOrderRef.current = sectionOrder;

  useEffect(() => {
    const stack = buildStack(sectionOrder);
    const max = Math.max(0, stack.length - 1);
    stackIndexRef.current = Math.min(Math.max(0, stackIndexRef.current), max);
  }, [sectionOrder]);

  useEffect(() => {
    function stepStack(delta: number) {
      const stack = buildStack(sectionOrderRef.current);
      if (stack.length === 0) {
        return;
      }
      const len = stack.length;
      stackIndexRef.current = (stackIndexRef.current + delta + len) % len;
      scrollToDashboardTarget(stack[stackIndexRef.current]);
      playButtonBeep();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) {
        return;
      }
      if (isTypingTarget(e.target)) {
        return;
      }

      const isArrowNext = e.code === "ArrowDown" || e.code === "ArrowRight";
      const isArrowPrev = e.code === "ArrowUp" || e.code === "ArrowLeft";

      if ((isArrowNext || isArrowPrev) && !e.altKey && !e.ctrlKey && !e.metaKey) {
        if (shouldDeferToNestedSurface(e.target)) {
          return;
        }
        e.preventDefault();
        stepStack(isArrowNext ? 1 : -1);
        return;
      }

      if (!e.altKey || e.ctrlKey || e.metaKey) {
        return;
      }

      if (e.code === "Digit0") {
        e.preventDefault();
        stackIndexRef.current = 0;
        scrollToDashboardTarget("overview");
        playButtonBeep();
        return;
      }

      const m = e.code.match(/^Digit([1-9])$/);
      if (!m) {
        return;
      }
      const digit = Number(m[1]);
      const order = sectionOrderRef.current;
      if (digit < 1 || digit > order.length) {
        return;
      }
      e.preventDefault();
      stackIndexRef.current = digit;
      scrollToDashboardTarget(order[digit - 1]);
      playButtonBeep();
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, []);

  return null;
}

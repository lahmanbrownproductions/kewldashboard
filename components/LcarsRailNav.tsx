"use client";

import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { scrollToDashboardTarget } from "@/lib/dashboard-pills";
import { DASHBOARD_SECTION_DEFS, type DashboardSectionId } from "@/lib/dashboard-sections";

const DRAG_MIME = "application/x-kewldashboard-rail-index";

type LcarsRailNavProps = {
  order: DashboardSectionId[];
  onOrderChange: (nextOrder: DashboardSectionId[]) => void;
};

export function LcarsRailNav({ order, onOrderChange }: LcarsRailNavProps) {
  const [dragEnabled, setDragEnabled] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragFromHandleRef = useRef(false);

  const links = useMemo(() => {
    const byId = new Map(DASHBOARD_SECTION_DEFS.map((section) => [section.id, section]));
    return order
      .map((id) => byId.get(id))
      .filter((section): section is (typeof DASHBOARD_SECTION_DEFS)[number] => Boolean(section));
  }, [order]);

  useEffect(() => {
    function clearDragHandleFlag() {
      dragFromHandleRef.current = false;
    }
    window.addEventListener("pointerup", clearDragHandleFlag);
    window.addEventListener("pointercancel", clearDragHandleFlag);
    return () => {
      window.removeEventListener("pointerup", clearDragHandleFlag);
      window.removeEventListener("pointercancel", clearDragHandleFlag);
    };
  }, []);

  function reorderLinks(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
      return;
    }

    if (fromIndex >= order.length || toIndex >= order.length) {
      return;
    }

    const next = [...order];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onOrderChange(next);
  }

  function parseDraggedIndex(dataTransfer: DataTransfer): number | null {
    const raw = dataTransfer.getData(DRAG_MIME) || dataTransfer.getData("text/plain");
    const index = Number.parseInt(raw, 10);
    return Number.isFinite(index) ? index : null;
  }

  function onRailDragStart(event: DragEvent<HTMLElement>, index: number) {
    if (!dragEnabled || !dragFromHandleRef.current) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_MIME, String(index));
    event.dataTransfer.setData("text/plain", String(index));
  }

  function onRailDragEnd() {
    dragFromHandleRef.current = false;
    setDragOverIndex(null);
  }

  function onRailDragOver(event: DragEvent<HTMLElement>, index: number) {
    if (!dragEnabled) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }

  function onRailDragLeave(event: DragEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDragOverIndex(null);
    }
  }

  function onRailDrop(event: DragEvent<HTMLElement>, dropIndex: number) {
    if (!dragEnabled) {
      return;
    }
    event.preventDefault();
    setDragOverIndex(null);
    const fromIndex = parseDraggedIndex(event.dataTransfer);
    if (fromIndex === null) {
      return;
    }
    reorderLinks(fromIndex, dropIndex);
  }

  return (
    <nav className={`lcars-rail${dragEnabled ? " is-rail-drag-unlocked" : ""}`} aria-label="Dashboard sections">
      <button
        type="button"
        className="rail-top-block rail-lock-toggle"
        aria-pressed={dragEnabled}
        aria-label={dragEnabled ? "Lock sidebar section order" : "Unlock sidebar section drag ordering"}
        title={dragEnabled ? "Lock sidebar order" : "Unlock drag ordering"}
        onClick={() => setDragEnabled((enabled) => !enabled)}
      >
        <span aria-hidden="true" className="rail-drag-glyph" />
      </button>
      {links.map((item, index) => {
        return (
          <div
            key={item.id}
            className={`${item.className}${dragEnabled ? " is-rail-drag-enabled" : ""}${
              dragOverIndex === index ? " is-rail-drop-target" : ""
            }`}
            data-section-id={item.id}
            draggable={dragEnabled}
            onDragStart={(event) => onRailDragStart(event, index)}
            onDragEnd={onRailDragEnd}
            onDragOver={(event) => onRailDragOver(event, index)}
            onDragLeave={onRailDragLeave}
            onDrop={(event) => onRailDrop(event, index)}
          >
            {dragEnabled ? (
              <button
                type="button"
                className="rail-segment-drag-handle"
                aria-label={`Reorder ${item.label}`}
                title={`Drag ${item.label}`}
                onPointerDown={() => {
                  dragFromHandleRef.current = true;
                }}
              >
                <span aria-hidden="true" className="rail-drag-glyph" />
              </button>
            ) : null}
            <button
              type="button"
              className="rail-segment-link"
              aria-label={`Scroll to ${item.label}`}
              onClick={(event) => {
                event.preventDefault();
                scrollToDashboardTarget(item.id);
              }}
            >
              <span>{item.label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

"use client";

import type { DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { RAIL_DRAG_INDEX_MIME, RAIL_DRAG_SECTION_ID_MIME } from "@/lib/dashboard-dnd";
import { scrollToDashboardTarget } from "@/lib/dashboard-pills";
import { DASHBOARD_SECTION_DEFS, type DashboardSectionId } from "@/lib/dashboard-sections";

type LcarsRailNavProps = {
  order: DashboardSectionId[];
  /** Move section from flat-index `from` to flat-index `to` (same semantics as native splice reorder). */
  onRailReorder: (fromIndex: number, toIndex: number) => void;
  dragUnlocked: boolean;
  onDragUnlockedChange: (unlocked: boolean) => void;
  onRailDragEnd?: () => void;
};

export function LcarsRailNav({
  order,
  onRailReorder,
  dragUnlocked,
  onDragUnlockedChange,
  onRailDragEnd,
}: LcarsRailNavProps) {
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

    onRailReorder(fromIndex, toIndex);
  }

  function parseDraggedIndex(dataTransfer: DataTransfer): number | null {
    const raw =
      dataTransfer.getData(RAIL_DRAG_INDEX_MIME) || dataTransfer.getData("text/plain");
    const index = Number.parseInt(raw, 10);
    return Number.isFinite(index) ? index : null;
  }

  function onRailDragStart(event: DragEvent<HTMLElement>, index: number) {
    if (!dragUnlocked || !dragFromHandleRef.current) {
      event.preventDefault();
      return;
    }

    const sectionId = order[index];
    if (!sectionId) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(RAIL_DRAG_INDEX_MIME, String(index));
    event.dataTransfer.setData("text/plain", String(index));
    event.dataTransfer.setData(RAIL_DRAG_SECTION_ID_MIME, sectionId);
  }

  function onRailDragEnded() {
    dragFromHandleRef.current = false;
    setDragOverIndex(null);
    onRailDragEnd?.();
  }

  function onRailDragOver(event: DragEvent<HTMLElement>, index: number) {
    if (!dragUnlocked) {
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
    if (!dragUnlocked) {
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
    <nav className={`lcars-rail${dragUnlocked ? " is-rail-drag-unlocked" : ""}`} aria-label="Dashboard sections">
      <button
        type="button"
        className="rail-top-block rail-lock-toggle"
        aria-pressed={dragUnlocked}
        aria-label={
          dragUnlocked ? "Lock sidebar section order" : "Unlock sidebar section drag ordering"
        }
        title={dragUnlocked ? "Lock sidebar order" : "Unlock drag ordering"}
        onClick={() => onDragUnlockedChange(!dragUnlocked)}
      >
        <span aria-hidden="true" className="rail-drag-glyph" />
      </button>
      {links.map((item, index) => {
        return (
          <div
            key={item.id}
            className={`${item.className}${dragUnlocked ? " is-rail-drag-enabled" : ""}${
              dragOverIndex === index ? " is-rail-drop-target" : ""
            }`}
            data-section-id={item.id}
            draggable={dragUnlocked}
            onDragStart={(event) => onRailDragStart(event, index)}
            onDragEnd={onRailDragEnded}
            onDragOver={(event) => onRailDragOver(event, index)}
            onDragLeave={onRailDragLeave}
            onDrop={(event) => onRailDrop(event, index)}
          >
            {dragUnlocked ? (
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

"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Bookmark = {
  id: string;
  label: string;
  href: string;
};

function bookmarkId(): string {
  return crypto.randomUUID();
}

const DEFAULT_BOOKMARKS: Bookmark[] = [
  { id: "default-github", label: "GitHub", href: "https://github.com" },
  { id: "default-gmail", label: "Gmail", href: "https://mail.google.com" },
  { id: "default-calendar", label: "Calendar", href: "https://calendar.google.com" },
  { id: "default-youtube", label: "YouTube", href: "https://www.youtube.com" },
];

const STORAGE_KEY = "kewldashboard.bookmarks.v1";

function normalizeUrl(raw: string) {
  const value = raw.trim();
  if (!value) {
    return "";
  }
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function hostnameForBookmark(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return href;
  }
}

function parseStoredBookmarks(raw: string): Bookmark[] | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }
        const obj = item as Record<string, unknown>;
        const id = typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : bookmarkId();
        const label = typeof obj.label === "string" ? obj.label.trim() : "";
        const href = typeof obj.href === "string" ? normalizeUrl(obj.href) : "";
        if (!label || !href) {
          return null;
        }
        return { id, label: label.slice(0, 40), href };
      })
      .filter((item): item is Bookmark => item !== null)
      .slice(0, 12);
  } catch {
    return null;
  }
}

type BookmarkRowProps = {
  bookmark: Bookmark;
  isEditing: boolean;
  editLabel: string;
  editHref: string;
  onEditLabel: (value: string) => void;
  onEditHref: (value: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  outerRef?: (node: HTMLElement | null) => void;
  outerStyle?: CSSProperties;
  isDragging?: boolean;
  dragHandleProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  dragDisabled?: boolean;
};

function BookmarkRow({
  bookmark,
  isEditing,
  editLabel,
  editHref,
  onEditLabel,
  onEditHref,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  outerRef,
  outerStyle,
  isDragging = false,
  dragHandleProps,
  dragDisabled = false,
}: BookmarkRowProps) {
  return (
    <article
      ref={outerRef}
      style={outerStyle}
      className={`bookmarks-link${isEditing ? " bookmarks-link--editing" : ""}`}
      role="listitem"
      data-dragging={isDragging ? "true" : undefined}
    >
      <button
        type="button"
        className="watchlist-drag-handle"
        aria-label={`Drag to reorder ${bookmark.label}`}
        disabled={dragDisabled || isEditing}
        {...dragHandleProps}
      >
        <span aria-hidden="true" className="watchlist-drag-glyph" />
      </button>

      <div className="bookmarks-link-body">
        {isEditing ? (
          <>
            <input
              value={editLabel}
              onChange={(event) => onEditLabel(event.target.value)}
              placeholder="Label"
              maxLength={40}
              aria-label="Edit bookmark label"
              className="bookmarks-inline-input"
            />
            <input
              value={editHref}
              onChange={(event) => onEditHref(event.target.value)}
              placeholder="example.com"
              maxLength={120}
              aria-label="Edit bookmark URL"
              className="bookmarks-inline-input"
            />
          </>
        ) : (
          <a href={bookmark.href} target="_blank" rel="noopener noreferrer">
            <strong>{bookmark.label}</strong>
            <small>{hostnameForBookmark(bookmark.href)}</small>
          </a>
        )}
      </div>

      <div className="bookmarks-link-actions">
        {isEditing ? (
          <>
            <button type="button" className="bookmarks-text-action" onClick={onSaveEdit} aria-label={`Save changes to ${bookmark.label}`}>
              save
            </button>
            <span className="bookmarks-text-action-sep" aria-hidden="true">
              |
            </span>
            <button type="button" className="bookmarks-text-action" onClick={onCancelEdit}>
              cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className="bookmarks-text-action" onClick={onStartEdit} aria-label={`Edit ${bookmark.label}`}>
              edit
            </button>
            <span className="bookmarks-text-action-sep" aria-hidden="true">
              |
            </span>
            <button type="button" className="bookmarks-text-action" onClick={onRemove} aria-label={`Remove ${bookmark.label}`}>
              x
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function SortableBookmarkRow(props: Omit<BookmarkRowProps, "outerRef" | "outerStyle" | "isDragging" | "dragHandleProps" | "dragDisabled">) {
  const { bookmark, isEditing } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: bookmark.id,
    disabled: isEditing,
  });

  const outerStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.92 : undefined,
    zIndex: isDragging ? 2 : undefined,
  };

  return (
    <BookmarkRow
      {...props}
      outerRef={setNodeRef}
      outerStyle={outerStyle}
      isDragging={isDragging}
      dragDisabled={false}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

export function BookmarksPanel() {
  const [dragReady, setDragReady] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(DEFAULT_BOOKMARKS);
  const [labelInput, setLabelInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editHref, setEditHref] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return;
    }

    const restored = parseStoredBookmarks(saved);
    if (restored === null) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (restored.length > 0) {
      setBookmarks(restored);
    }
  }, []);

  useEffect(() => {
    setDragReady(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  }, [bookmarks]);

  const canSubmit = useMemo(() => labelInput.trim() && urlInput.trim(), [labelInput, urlInput]);

  function addBookmark(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const label = labelInput.trim().slice(0, 40);
    const href = normalizeUrl(urlInput);

    if (!label || !href) {
      setError("Label and URL are required.");
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(href);
    } catch {
      setError("Enter a valid URL (example.com or https://example.com).");
      return;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      setError("Only http and https links are supported.");
      return;
    }

    if (
      bookmarks.some(
        (bookmark) => bookmark.href === parsed.href || bookmark.label.toLowerCase() === label.toLowerCase(),
      )
    ) {
      setError("Bookmark already exists.");
      return;
    }

    setBookmarks((current) => [{ id: bookmarkId(), label, href: parsed.href }, ...current].slice(0, 12));
    setLabelInput("");
    setUrlInput("");
  }

  function removeBookmark(id: string) {
    setBookmarks((current) => current.filter((bookmark) => bookmark.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    setBookmarks((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) {
        return items;
      }
      return arrayMove(items, oldIndex, newIndex);
    });
  }

  function startEdit(bookmark: Bookmark) {
    setError(null);
    setEditingId(bookmark.id);
    setEditLabel(bookmark.label);
    setEditHref(bookmark.href);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditLabel("");
    setEditHref("");
  }

  function saveEdit() {
    if (!editingId) {
      return;
    }
    setError(null);

    const label = editLabel.trim().slice(0, 40);
    const href = normalizeUrl(editHref);

    if (!label || !href) {
      setError("Label and URL are required.");
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(href);
    } catch {
      setError("Enter a valid URL (example.com or https://example.com).");
      return;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      setError("Only http and https links are supported.");
      return;
    }

    const conflict = bookmarks.some(
      (bookmark) =>
        bookmark.id !== editingId &&
        (bookmark.href === parsed.href || bookmark.label.toLowerCase() === label.toLowerCase()),
    );
    if (conflict) {
      setError("Another bookmark already uses this label or URL.");
      return;
    }

    setBookmarks((current) =>
      current.map((bookmark) =>
        bookmark.id === editingId ? { ...bookmark, label, href: parsed.href } : bookmark,
      ),
    );
    cancelEdit();
  }

  return (
    <section id="bookmarks" className="panel bookmarks-panel scroll-target" aria-label="Website bookmarks">
      <div className="panel-heading watchlist-heading">
        <div>
          <span>Quick Links</span>
          <strong>Website Bookmarks</strong>
        </div>
        <form className="bookmarks-form" onSubmit={addBookmark}>
          <input
            value={labelInput}
            onChange={(event) => setLabelInput(event.target.value)}
            placeholder="Label"
            maxLength={40}
            aria-label="Bookmark label"
          />
          <input
            value={urlInput}
            onChange={(event) => setUrlInput(event.target.value)}
            placeholder="example.com"
            maxLength={120}
            aria-label="Bookmark URL"
          />
          <button type="submit" disabled={!canSubmit}>
            Add
          </button>
        </form>
      </div>

      {error ? <p className="bookmarks-error">{error}</p> : null}

      {dragReady ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={bookmarks.map((bookmark) => bookmark.id)} strategy={rectSortingStrategy}>
            <div className="bookmarks-grid" role="list" aria-label="Saved bookmarks">
              {bookmarks.map((bookmark) => (
                <SortableBookmarkRow
                  key={bookmark.id}
                  bookmark={bookmark}
                  isEditing={editingId === bookmark.id}
                  editLabel={editingId === bookmark.id ? editLabel : ""}
                  editHref={editingId === bookmark.id ? editHref : ""}
                  onEditLabel={setEditLabel}
                  onEditHref={setEditHref}
                  onStartEdit={() => startEdit(bookmark)}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onRemove={() => removeBookmark(bookmark.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="bookmarks-grid" role="list" aria-label="Saved bookmarks">
          {bookmarks.map((bookmark) => (
            <BookmarkRow
              key={bookmark.id}
              bookmark={bookmark}
              isEditing={editingId === bookmark.id}
              editLabel={editingId === bookmark.id ? editLabel : ""}
              editHref={editingId === bookmark.id ? editHref : ""}
              onEditLabel={setEditLabel}
              onEditHref={setEditHref}
              onStartEdit={() => startEdit(bookmark)}
              onSaveEdit={saveEdit}
              onCancelEdit={cancelEdit}
              onRemove={() => removeBookmark(bookmark.id)}
              dragDisabled
            />
          ))}
        </div>
      )}
    </section>
  );
}

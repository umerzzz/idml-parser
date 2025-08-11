import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./SideEditorPanel.module.css";

const defaultFonts = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Courier New",
  "Monaco",
];

const fontSizes = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72,
];

export default function SideEditorPanel({
  isOpen,
  element,
  story,
  onChangeDraft,
  onApply,
  onClose,
}) {
  const [draft, setDraft] = useState({
    content: "",
    fontFamily: "Arial",
    fontSize: 14,
    bold: false,
    italic: false,
    underline: false,
    align: "left",
    color: "#000000",
    lineHeight: 1.3,
  });
  const debounceRef = React.useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!element || !story) return;

    const base = story.styling || {};
    setDraft({
      content: story.text || "",
      fontFamily: base.fontFamily || "Arial",
      fontSize:
        typeof base.fontSize === "number"
          ? base.fontSize
          : parseFloat(base.fontSize) || 14,
      bold: base.fontStyle?.toLowerCase?.().includes("bold") || false,
      italic: base.fontStyle?.toLowerCase?.().includes("italic") || false,
      underline: base.underline || false,
      align: base.alignment || "left",
      color: typeof base.fillColor === "string" ? base.fillColor : "#000000",
      lineHeight:
        typeof base.effectiveLineHeight === "number"
          ? base.effectiveLineHeight
          : 1.3,
    });
  }, [element, story]);

  if (!isOpen || !element || !story) return null;

  const notifyChange = (nextDraft) => {
    if (!onChangeDraft) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChangeDraft(nextDraft), 120);
  };

  const handleInput = (key, value) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      notifyChange(next);
      return next;
    });
  };

  const toggle = (key) =>
    setDraft((d) => {
      const next = { ...d, [key]: !d[key] };
      notifyChange(next);
      return next;
    });

  const apply = () => onApply?.(draft);

  const panel = (
    <aside className={styles.panel} data-editor-panel="true">
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Editor</div>
          <div className={styles.subtitle}>
            {element.type} • {element.id}
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Content</div>
        <textarea
          className={styles.textarea}
          value={draft.content}
          onChange={(e) => handleInput("content", e.target.value)}
          placeholder="Type here..."
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Typography</div>
        <div className={styles.row}>
          <label className={styles.label}>Font</label>
          <select
            className={styles.select}
            value={draft.fontFamily}
            onChange={(e) => handleInput("fontFamily", e.target.value)}
          >
            {defaultFonts.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.rowGroup}>
          <div className={styles.row}>
            <label className={styles.label}>Size</label>
            <select
              className={styles.select}
              value={draft.fontSize}
              onChange={(e) =>
                handleInput("fontSize", parseInt(e.target.value, 10))
              }
            >
              {fontSizes.map((s) => (
                <option key={s} value={s}>
                  {s}px
                </option>
              ))}
            </select>
          </div>
          <div className={styles.row}>
            <label className={styles.label}>Line height</label>
            <input
              type="number"
              className={styles.input}
              step="0.1"
              min="1"
              max="3"
              value={draft.lineHeight}
              onChange={(e) =>
                handleInput("lineHeight", parseFloat(e.target.value))
              }
            />
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.toggleGroup}>
            <button
              className={`${styles.toggleBtn} ${
                draft.bold ? styles.active : ""
              }`}
              onClick={() => toggle("bold")}
              title="Bold"
            >
              B
            </button>
            <button
              className={`${styles.toggleBtn} ${
                draft.italic ? styles.active : ""
              }`}
              onClick={() => toggle("italic")}
              title="Italic"
            >
              I
            </button>
            <button
              className={`${styles.toggleBtn} ${
                draft.underline ? styles.active : ""
              }`}
              onClick={() => toggle("underline")}
              title="Underline"
            >
              U
            </button>
          </div>
        </div>
        <div className={styles.row}>
          <label className={styles.label}>Align</label>
          <div className={styles.toggleGroup}>
            {[
              { key: "left", icon: "⟸" },
              { key: "center", icon: "⟷" },
              { key: "right", icon: "⟹" },
              { key: "justify", icon: "≋" },
            ].map(({ key, icon }) => (
              <button
                key={key}
                className={`${styles.toggleBtn} ${
                  draft.align === key ? styles.active : ""
                }`}
                onClick={() => handleInput("align", key)}
                title={`Align ${key}`}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <label className={styles.label}>Color</label>
          <input
            type="color"
            className={styles.color}
            value={draft.color}
            onChange={(e) => handleInput("color", e.target.value)}
          />
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.applyBtn} onClick={apply}>
          Apply
        </button>
        <button className={styles.cancelBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </aside>
  );

  return mounted ? createPortal(panel, document.body) : null;
}

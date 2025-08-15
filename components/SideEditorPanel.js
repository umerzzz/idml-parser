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

// Map story alignment tokens to UI values
function toUiAlign(alignment) {
  if (!alignment) return "left";
  switch (alignment) {
    case "LeftAlign":
    case "LeftJustified":
      return "left";
    case "CenterAlign":
    case "CenterJustified":
      return "center";
    case "RightAlign":
    case "RightJustified":
      return "right";
    case "JustifyAlign":
    case "FullyJustified":
      return "justify";
    default:
      return alignment; // already a UI value (left|center|right|justify)
  }
}

// Convert rgb()/rgba() to #RRGGBB; pass through #hex; fallback to black
function toHexColor(input) {
  if (typeof input !== "string" || !input) return "#000000";
  const val = input.trim();
  if (val.startsWith("#") && (val.length === 7 || val.length === 4)) return val;
  const rgbMatch = val.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = Math.max(0, Math.min(255, parseInt(rgbMatch[1], 10)));
    const g = Math.max(0, Math.min(255, parseInt(rgbMatch[2], 10)));
    const b = Math.max(0, Math.min(255, parseInt(rgbMatch[3], 10)));
    const toHex = (n) => n.toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  // Unknown swatch or name → fallback
  return "#000000";
}

export default function SideEditorPanel({
  isOpen,
  element,
  story,
  onChangeDraft,
  onApply,
  onClose,
}) {
  const [draft, setDraft] = useState({
    // Text frame fields
    content: "",
    fontFamily: "Arial",
    fontSize: 14,
    bold: false,
    italic: false,
    underline: false,
    align: "left",
    color: "#000000",
    lineHeight: 1.3,
    // Content frame fields
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
  });
  const debounceRef = React.useRef(null);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState("frame"); // 'frame' | 'text'

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!element || !story) return;

    const base = story.styling || {};
    // Prefer first formatted run when available
    const firstRun = Array.isArray(story.formattedContent)
      ? story.formattedContent.find(
          (c) => c?.formatting && !c.formatting.isBreak
        )
      : null;
    const fmt = (firstRun && firstRun.formatting) || base;

    const pos = element.pixelPosition ||
      element.position || {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
      };

    const fontStyleStr = String(fmt.fontStyle || base.fontStyle || "");
    const isBold = /bold/i.test(fontStyleStr);
    const isItalic = /italic/i.test(fontStyleStr);

    const fontSizeNum = (() => {
      const raw = fmt.fontSize || base.fontSize;
      if (typeof raw === "number") return raw;
      const parsed = parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : 14;
    })();

    const effectiveLH =
      typeof base.effectiveLineHeight === "number"
        ? base.effectiveLineHeight
        : 1.3;

    setDraft({
      // Text
      content: story.text || "",
      fontFamily: fmt.fontFamily || base.fontFamily || "Arial",
      fontSize: fontSizeNum,
      bold: Boolean(isBold),
      italic: Boolean(isItalic),
      underline: Boolean(fmt.underline ?? base.underline ?? false),
      align: toUiAlign(fmt.alignment || base.alignment || "left"),
      color: toHexColor(fmt.fillColor || base.fillColor || "#000000"),
      lineHeight: effectiveLH,
      // Frame
      x: Number.isFinite(pos.x) ? Math.round(pos.x) : 0,
      y: Number.isFinite(pos.y) ? Math.round(pos.y) : 0,
      width: Number.isFinite(pos.width) ? Math.round(pos.width) : 0,
      height: Number.isFinite(pos.height) ? Math.round(pos.height) : 0,
      rotation: Number.isFinite(pos.rotation) ? pos.rotation : 0,
    });
  }, [element, story]);

  if (!isOpen || !element || !story) return null;

  const notifyChange = (nextDraft) => {
    if (!onChangeDraft) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChangeDraft(nextDraft), 120);
  };

  // Modular field update helpers
  const setDraftField = (key, value) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      notifyChange({ [key]: value, __all: next });
      return next;
    });
  };

  const setTypography = (partial) => {
    setDraft((prev) => {
      const next = { ...prev, ...partial };
      notifyChange({ ...partial, __all: next });
      return next;
    });
  };

  const setFrame = (partial) => {
    setDraft((prev) => {
      const next = { ...prev, ...partial };
      notifyChange({ ...partial, __all: next });
      return next;
    });
  };

  const toggle = (key) =>
    setDraft((d) => {
      const next = { ...d, [key]: !d[key] };
      notifyChange({ [key]: next[key], __all: next });
      return next;
    });

  const apply = () => onApply?.(draft);

  const panel = (
    <aside
      className={styles.panel}
      data-editor-panel="true"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Editor</div>
          <div className={styles.subtitle}>
            {element.type} • {element.self || element.id}
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${
            activeTab === "frame" ? styles.tabActive : ""
          }`}
          onClick={() => setActiveTab("frame")}
          title="Content Frame"
        >
          Frame
        </button>
        <button
          className={`${styles.tab} ${
            activeTab === "text" ? styles.tabActive : ""
          }`}
          onClick={() => setActiveTab("text")}
          title="Text Frame"
        >
          Text
        </button>
      </div>

      {activeTab === "frame" && (
        <div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Content Frame</div>
            <div className={styles.rowGroup}>
              <div className={styles.row}>
                <label className={styles.smallLabel}>X</label>
                <input
                  type="number"
                  className={styles.inputNarrow}
                  value={draft.x}
                  onChange={(e) =>
                    setFrame({ x: parseInt(e.target.value || "0", 10) })
                  }
                />
              </div>
              <div className={styles.row}>
                <label className={styles.smallLabel}>Y</label>
                <input
                  type="number"
                  className={styles.inputNarrow}
                  value={draft.y}
                  onChange={(e) =>
                    setFrame({ y: parseInt(e.target.value || "0", 10) })
                  }
                />
              </div>
            </div>
            <div className={styles.rowGroup}>
              <div className={styles.row}>
                <label className={styles.smallLabel}>W</label>
                <input
                  type="number"
                  min={1}
                  className={styles.inputNarrow}
                  value={draft.width}
                  onChange={(e) =>
                    setFrame({
                      width: Math.max(1, parseInt(e.target.value || "1", 10)),
                    })
                  }
                />
              </div>
              <div className={styles.row}>
                <label className={styles.smallLabel}>H</label>
                <input
                  type="number"
                  min={1}
                  className={styles.inputNarrow}
                  value={draft.height}
                  onChange={(e) =>
                    setFrame({
                      height: Math.max(1, parseInt(e.target.value || "1", 10)),
                    })
                  }
                />
              </div>
            </div>
            <div className={styles.row}>
              <label className={styles.label}>Rotation</label>
              <input
                type="number"
                className={styles.input}
                step="1"
                value={draft.rotation}
                onChange={(e) =>
                  setFrame({ rotation: parseFloat(e.target.value || "0") })
                }
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "text" && (
        <div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Content</div>
            <textarea
              className={styles.textarea}
              value={draft.content}
              onChange={(e) => setTypography({ content: e.target.value })}
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
                onChange={(e) => setTypography({ fontFamily: e.target.value })}
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
                    setTypography({ fontSize: parseInt(e.target.value, 10) })
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
                    setTypography({ lineHeight: parseFloat(e.target.value) })
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
                    onClick={() => setTypography({ align: key })}
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
                onChange={(e) => setTypography({ color: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}

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

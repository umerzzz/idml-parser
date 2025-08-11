import React from "react";
import styles from "./EditorToolbar.module.css";

const EditorToolbar = ({ onFormat, selectedElement }) => {
  const formatText = (command, value = null) => {
    document.execCommand(command, false, value);
    if (onFormat) {
      onFormat(command, value);
    }
  };

  const fonts = [
    "Arial",
    "Helvetica",
    "Times New Roman",
    "Georgia",
    "Verdana",
    "Tahoma",
    "Trebuchet MS",
    "Impact",
    "Comic Sans MS",
    "Palatino",
    "Garamond",
    "Bookman",
    "Courier New",
    "Monaco",
  ];

  const fontSizes = [
    8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72,
  ];

  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarGroup}>
        {/* Font Family */}
        <select
          className={styles.fontSelect}
          onChange={(e) => formatText("fontName", e.target.value)}
          defaultValue="Arial"
        >
          {fonts.map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </select>

        {/* Font Size */}
        <select
          className={styles.sizeSelect}
          onChange={(e) => formatText("fontSize", e.target.value)}
          defaultValue="14"
        >
          {fontSizes.map((size) => (
            <option key={size} value={size}>
              {size}px
            </option>
          ))}
        </select>
      </div>

      <div className={styles.toolbarGroup}>
        {/* Text Formatting */}
        <button
          className={styles.formatBtn}
          onClick={() => formatText("bold")}
          title="Bold"
        >
          <strong>B</strong>
        </button>

        <button
          className={styles.formatBtn}
          onClick={() => formatText("italic")}
          title="Italic"
        >
          <em>I</em>
        </button>

        <button
          className={styles.formatBtn}
          onClick={() => formatText("underline")}
          title="Underline"
        >
          <u>U</u>
        </button>

        <button
          className={styles.formatBtn}
          onClick={() => formatText("strikeThrough")}
          title="Strikethrough"
        >
          <s>S</s>
        </button>
      </div>

      <div className={styles.toolbarGroup}>
        {/* Text Alignment */}
        <button
          className={styles.formatBtn}
          onClick={() => formatText("justifyLeft")}
          title="Align Left"
        >
          ⬅
        </button>

        <button
          className={styles.formatBtn}
          onClick={() => formatText("justifyCenter")}
          title="Align Center"
        >
          ↔
        </button>

        <button
          className={styles.formatBtn}
          onClick={() => formatText("justifyRight")}
          title="Align Right"
        >
          ➡
        </button>

        <button
          className={styles.formatBtn}
          onClick={() => formatText("justifyFull")}
          title="Justify"
        >
          ⬌
        </button>
      </div>

      <div className={styles.toolbarGroup}>
        {/* Lists */}
        <button
          className={styles.formatBtn}
          onClick={() => formatText("insertUnorderedList")}
          title="Bullet List"
        >
          • List
        </button>

        <button
          className={styles.formatBtn}
          onClick={() => formatText("insertOrderedList")}
          title="Numbered List"
        >
          1. List
        </button>
      </div>

      <div className={styles.toolbarGroup}>
        {/* Text Color */}
        <label className={styles.colorLabel}>
          <input
            type="color"
            className={styles.colorPicker}
            onChange={(e) => formatText("foreColor", e.target.value)}
            title="Text Color"
          />
          <span>A</span>
        </label>

        {/* Background Color */}
        <label className={styles.colorLabel}>
          <input
            type="color"
            className={styles.colorPicker}
            onChange={(e) => formatText("backColor", e.target.value)}
            title="Background Color"
          />
          <span>🎨</span>
        </label>
      </div>

      <div className={styles.toolbarGroup}>
        {/* Other Actions */}
        <button
          className={styles.formatBtn}
          onClick={() => formatText("removeFormat")}
          title="Clear Formatting"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default EditorToolbar;

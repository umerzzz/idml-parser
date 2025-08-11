import React, { useState } from "react";
import styles from "./ElementHighlighter.module.css";

const ElementHighlighter = ({
  element,
  elementPosition,
  onSelect,
  onDoubleClick,
  children,
  isSelected = false,
  isEditable = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(element.id, element);
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (onDoubleClick && isEditable) {
      onDoubleClick(element.id, element);
    }
  };

  const getHighlightStyles = () => {
    const baseStyles = {
      position: "absolute",
      left: elementPosition.x + "px",
      top: elementPosition.y + "px",
      width: elementPosition.width + "px",
      height: elementPosition.height + "px",
      pointerEvents: "all",
      cursor: isEditable ? "text" : "pointer",
      transform: elementPosition.rotation
        ? `rotate(${elementPosition.rotation}deg)`
        : "none",
      transformOrigin: "top left",
      zIndex: isSelected ? 999 : isHovered ? 50 : 10, // Lower z-index to prevent conflicts
    };

    return baseStyles;
  };

  const getFrameStyles = () => {
    const frameStyles = {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      pointerEvents: "none",
      transition: "all 0.2s ease",
    };

    if (isSelected) {
      frameStyles.border = "2px solid #007bff";
      frameStyles.boxShadow =
        "0 0 0 1px rgba(0, 123, 255, 0.5), inset 0 0 0 1px rgba(0, 123, 255, 0.2)";
    } else if (isHovered) {
      frameStyles.border = "1px solid #007bff";
      frameStyles.boxShadow = "0 0 0 1px rgba(0, 123, 255, 0.3)";
    } else {
      frameStyles.border = "1px solid transparent";
      frameStyles.boxShadow = "none";
    }

    return frameStyles;
  };

  const getElementTypeLabel = () => {
    if (!isHovered && !isSelected) return null;

    let label = element.type || "Element";
    if (element.name) {
      label = element.name;
    }

    return <div className={styles.elementLabel}>{label}</div>;
  };

  const getSelectionInfo = () => {
    if (!isSelected) return null;

    return (
      <div className={styles.selectionInfo}>
        <div className={styles.dimensions}>
          {Math.round(elementPosition.width)} ×{" "}
          {Math.round(elementPosition.height)}
        </div>
        <div className={styles.position}>
          x: {Math.round(elementPosition.x)}, y: {Math.round(elementPosition.y)}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`${styles.highlighter} ${isHovered ? styles.hovered : ""} ${
        isSelected ? styles.selected : ""
      }`}
      style={getHighlightStyles()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Element frame/outline */}
      <div className={styles.elementFrame} style={getFrameStyles()}>
        {/* Corner indicators for selection */}
        {isSelected && (
          <div className={styles.cornerIndicators}>
            <div className={styles.corner} data-corner="tl"></div>
            <div className={styles.corner} data-corner="tr"></div>
            <div className={styles.corner} data-corner="bl"></div>
            <div className={styles.corner} data-corner="br"></div>
          </div>
        )}
      </div>

      {/* Element type label */}
      {getElementTypeLabel()}

      {/* Selection information */}
      {getSelectionInfo()}

      {/* Render children (actual element content) */}
      {children}

      {/* Hover effect overlay */}
      {isHovered && !isSelected && <div className={styles.hoverOverlay}></div>}
    </div>
  );
};

export default ElementHighlighter;

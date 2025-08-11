import React, { useState, useRef, useEffect } from "react";
import EditorToolbar from "./EditorToolbar";
import styles from "./EditableTextElement.module.css";

const EditableTextElement = ({
  element,
  elementPosition,
  isSelected,
  isEditing,
  onSelect,
  onEdit,
  onSave,
  onCancel,
  documentData,
  utils,
}) => {
  // Extract text content from the element's story
  const getElementContent = () => {
    if (documentData && documentData.stories) {
      // Find the story associated with this element
      const storyId = element.parentStory;
      if (storyId && documentData.stories[storyId]) {
        return documentData.stories[storyId].text || "";
      }
    }
    return element.content || "";
  };

  const [content, setContent] = useState(getElementContent());
  const [isHovered, setIsHovered] = useState(false);
  const editableRef = useRef(null);

  useEffect(() => {
    if (isEditing && editableRef.current) {
      editableRef.current.focus();
      // Place cursor at end
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(editableRef.current);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, [isEditing]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (!isSelected) {
      onSelect(element.id);
    } else if (isSelected && !isEditing) {
      onEdit(element.id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && e.shiftKey) {
      // Allow line breaks with Shift+Enter
      return;
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  const handleBlur = (e) => {
    // Don't save if clicking on toolbar
    if (e.relatedTarget && e.relatedTarget.closest("[data-toolbar]")) {
      return;
    }
    handleSave();
  };

  const handleSave = () => {
    const newContent = editableRef.current
      ? editableRef.current.innerHTML
      : content;
    setContent(newContent);
    onSave(element.id, newContent);
  };

  const handleCancel = () => {
    if (editableRef.current) {
      editableRef.current.innerHTML = content;
    }
    onCancel(element.id);
  };

  const handleFormatting = (command, value) => {
    // Apply formatting to selected text
    document.execCommand(command, false, value);
  };

  const getElementStyles = () => {
    const baseStyles = {
      position: "absolute",
      left: elementPosition.x + "px",
      top: elementPosition.y + "px",
      width: elementPosition.width + "px",
      height: elementPosition.height + "px",
      background:
        element.fill && element.fill.startsWith("Gradient/")
          ? renderGradientBackground(element.fill, documentData, utils)
          : element.fill && utils?.convertColor
          ? utils.convertColor(element.fill)
          : "transparent",
      border: isSelected
        ? "2px solid #007bff"
        : isHovered
        ? "1px solid #007bff"
        : "1px solid transparent",
      overflow: "visible",
      transform: elementPosition.rotation
        ? `rotate(${elementPosition.rotation}deg)`
        : "none",
      transformOrigin: "top left",
      boxSizing: "border-box",
      zIndex: isSelected || isEditing ? 1000 : 10,
      cursor: isEditing ? "text" : "pointer",
      outline: "none",
    };

    return baseStyles;
  };

  const getTextStyles = () => {
    // Extract proper IDML styling like the original viewer
    if (documentData && documentData.stories && element.parentStory) {
      const story = documentData.stories[element.parentStory];
      if (story) {
        try {
          // Import the same functions used in the original viewer
          const {
            getInDesignAccurateFormatting,
            getStoryStyles,
          } = require("../../lib/viewer/index.js");

          // Get the InDesign-accurate formatting
          const storyFormatting = getInDesignAccurateFormatting(story, utils);

          // Get the complete story styles
          const storyStyles = getStoryStyles(
            story,
            elementPosition.height,
            elementPosition.width,
            utils,
            "white" // Default background for contrast
          );

          return {
            ...storyStyles,
            padding: "4px",
            border: "none",
            outline: "none",
            background: "transparent",
            resize: "none",
            wordWrap: "break-word",
            width: "100%",
            height: "100%",
          };
        } catch (error) {
          console.warn("Failed to extract IDML styling:", error);
        }
      }
    }

    // Fallback to basic styles if IDML extraction fails
    const textStyles = {
      fontFamily: element.fontFamily || "Arial",
      fontSize: element.fontSize || "14px",
      fontWeight: element.fontWeight || "normal",
      fontStyle: element.fontStyle || "normal",
      color: element.textColor || "#000000",
      textAlign: element.textAlign || "left",
      lineHeight: element.lineHeight || "1.2",
      padding: "4px",
      width: "100%",
      height: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      resize: "none",
      wordWrap: "break-word",
    };

    return textStyles;
  };

  const renderGradientBackground = (gradientRef, documentData, utils) => {
    if (
      !gradientRef ||
      !documentData.resources ||
      !documentData.resources.gradients
    ) {
      return null;
    }

    const gradient = documentData.resources.gradients[gradientRef];
    if (
      !gradient ||
      !gradient.gradientStops ||
      gradient.gradientStops.length < 2
    ) {
      return null;
    }

    const stops = gradient.gradientStops
      .map((stop) => {
        const color = utils.convertColor(stop.stopColor);
        const location = stop.location;
        return `${color} ${location}%`;
      })
      .join(", ");

    const gradientType = gradient.type;
    let cssGradient;

    if (gradientType === "Radial") {
      cssGradient = `radial-gradient(circle, ${stops})`;
    } else {
      cssGradient = `linear-gradient(to right, ${stops})`;
    }

    return cssGradient;
  };

  return (
    <div className={styles.editableContainer}>
      {/* Toolbar appears above selected element */}
      {isEditing && (
        <div
          className={styles.toolbar}
          data-toolbar="true"
          style={{
            position: "absolute",
            top: elementPosition.y - 60 + "px",
            left: elementPosition.x + "px",
            zIndex: 1001,
          }}
        >
          <EditorToolbar
            onFormat={handleFormatting}
            selectedElement={element}
          />
        </div>
      )}

      <div
        className={`${styles.editableElement} ${
          isSelected ? styles.selected : ""
        } ${isEditing ? styles.editing : ""}`}
        style={getElementStyles()}
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {isEditing ? (
          <div
            ref={editableRef}
            contentEditable={true}
            suppressContentEditableWarning={true}
            style={getTextStyles()}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        ) : (
          <div
            style={getTextStyles()}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}

        {/* Selection indicators */}
        {isSelected && !isEditing && (
          <div className={styles.selectionHandles}>
            <div className={styles.handle} data-handle="nw"></div>
            <div className={styles.handle} data-handle="ne"></div>
            <div className={styles.handle} data-handle="sw"></div>
            <div className={styles.handle} data-handle="se"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditableTextElement;

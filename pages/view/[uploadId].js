import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useTransition,
} from "react";
import { useRouter } from "next/router";
import React from "react"; // Added missing import for React.Fragment
import { ColorUtils, InDesignTextMetrics } from "../../lib/index.js";
import styles from "../../styles/editor.module.css";
import SideEditorPanel from "../../components/SideEditorPanel";

// Import extracted modules
import {
  // Utils
  safeToPixels,
  getUnitConverter,
  isAlreadyInPixels,
  convertColor as importedConvertColor,
  getDocumentBackgroundColor as importedGetDocumentBackgroundColor,
  getPageBackgroundColor as importedGetPageBackgroundColor,
  getFontWeight,
  getFontStyle,
  extractTextDecorations,
  getTextAlign,

  // Text processing
  measureTextAccurately,
  calculateTextMetrics,
  getOptimalTextStyles,
  renderFormattedText,
  getStoryStyles,
  getInDesignAccurateFormatting,

  // Rendering
  getPagesArray,
  renderPageTabs,
  renderPagePreview,

  // Hooks
  useViewerState,
  useDocumentLoader,
} from "../../lib/viewer/index.js";

// Helper function to render gradient background
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

  // Convert gradient stops to CSS gradient
  const stops = gradient.gradientStops
    .map((stop) => {
      const color = utils.convertColor(stop.stopColor);
      const location = stop.location;
      return `${color} ${location}%`;
    })
    .join(", ");

  // Use actual gradient type from document
  const gradientType = gradient.type;

  // Determine gradient direction based on actual type from document
  let cssGradient;
  if (gradientType === "Radial") {
    cssGradient = `radial-gradient(circle, ${stops})`;
  } else if (gradientType === "Linear") {
    // For linear gradients, use the actual direction from document if available
    // For now, use a default direction since the document doesn't specify angle
    cssGradient = `linear-gradient(to right, ${stops})`;
  } else {
    // Fallback for unknown gradient types
    cssGradient = `linear-gradient(to right, ${stops})`;
  }

  return cssGradient;
};

// Helper function to extract list formatting from document data
const getListFormatting = (element, documentData) => {
  // Check if element has list-related properties
  if (element.name === "Bulleted List" || element.name === "Numbered List") {
    // Look for list formatting in styles
    if (documentData.styles && documentData.styles.paragraph) {
      const defaultStyle =
        documentData.styles.paragraph[
          "ParagraphStyle/$ID/[No paragraph style]"
        ];
      if (
        defaultStyle &&
        defaultStyle.rawStyle &&
        defaultStyle.rawStyle.Properties
      ) {
        const props = defaultStyle.rawStyle.Properties;

        if (element.name === "Bulleted List" && props.BulletChar) {
          return {
            type: "bullet",
            character: props.BulletChar["@_BulletCharacterValue"],
            characterStyle: props.BulletsCharacterStyle,
            // Get bullet spacing and other properties from document
            bulletSpacing: props.BulletChar["@_BulletSpacing"] || 1,
            bulletIndent: props.BulletChar["@_BulletIndent"] || 0,
          };
        } else if (element.name === "Numbered List" && props.NumberingFormat) {
          return {
            type: "numbered",
            format: props.NumberingFormat["#text"],
            characterStyle: props.NumberingCharacterStyle,
            // Get numbering properties from document
            numberingSpacing: props.NumberingFormat["@_NumberingSpacing"] || 1,
            numberingIndent: props.NumberingFormat["@_NumberingIndent"] || 0,
          };
        }
      }
    }
  }
  return null;
};

// Helper function to apply list formatting to text
const applyListFormatting = (text, formatting) => {
  if (!text || !formatting) return text;

  const lines = text.split("\n");

  if (formatting.type === "bullet") {
    const bulletChar = String.fromCharCode(formatting.character);
    const spacing = formatting.bulletSpacing || 1;
    const indent = formatting.bulletIndent || 0;

    // Use actual bullet formatting from document
    return lines
      .map((line) => {
        if (line.trim()) {
          // Use the actual bullet character and spacing from document
          const indentSpace = " ".repeat(indent);
          const bulletSpace = " ".repeat(spacing);
          return `${indentSpace}${bulletChar}${bulletSpace}${line.trim()}`;
        }
        return line;
      })
      .join("\n");
  } else if (formatting.type === "numbered") {
    let counter = 1;
    const formatPattern = formatting.format;
    const spacing = formatting.numberingSpacing || 1;
    const indent = formatting.numberingIndent || 0;

    // Filter out empty lines and only process non-empty content
    const nonEmptyLines = lines.filter((line) => line.trim());

    return nonEmptyLines
      .map((line) => {
        // Parse the actual numbering format from document dynamically
        const indentSpace = " ".repeat(indent);
        const numberSpace = " ".repeat(spacing);

        // Extract the first item from the format pattern to understand the format
        const formatItems = formatPattern
          ? formatPattern.split(",").map((item) => item.trim())
          : [];
        const firstFormat = formatItems[0] || "1";

        let numberText;
        if (firstFormat.match(/^\d+$/)) {
          // Numeric format (1, 2, 3)
          numberText = counter.toString();
        } else if (firstFormat.match(/^[a-z]$/)) {
          // Lowercase letter format (a, b, c)
          numberText = String.fromCharCode(96 + counter);
        } else if (firstFormat.match(/^[A-Z]$/)) {
          // Uppercase letter format (A, B, C)
          numberText = String.fromCharCode(64 + counter);
        } else if (firstFormat.match(/^[ivxlcdm]+$/i)) {
          // Roman numeral format (i, ii, iii or I, II, III)
          const isUpperCase = firstFormat === firstFormat.toUpperCase();
          const romanNumerals = isUpperCase
            ? ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]
            : ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
          numberText = romanNumerals[counter - 1] || counter.toString();
        } else {
          // Use the format pattern as-is
          numberText = firstFormat;
        }

        const formatted = `${indentSpace}${numberText}.${numberSpace}${line.trim()}`;
        counter++;
        return formatted;
      })
      .join("\n");
  }

  return text;
};

export default function Viewer() {
  const router = useRouter();
  const { uploadId } = router.query;

  // Use custom hook for state management
  const {
    documentData,
    setDocumentData,
    loading,
    setLoading,
    showMargins,
    setShowMargins,
    currentPageIndex,
    setCurrentPageIndex,
    pages,
    setPages,
    backgroundConfig,
    setBackgroundConfig,
  } = useViewerState();

  // Use custom hook for document loading
  const loadDocument = useDocumentLoader(uploadId, setDocumentData, setLoading);

  // Simple editor state - use unique key instead of just element ID
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [editingElementId, setEditingElementId] = useState(null);
  const [editorMode, setEditorMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Debounce live updates to avoid flicker during typing
  const debounceRef = useRef(null);

  // Fit-to-viewport zoom (always fit)
  const scrollContainerRef = useRef(null);
  const pageWrapperRef = useRef(null);
  const pageCanvasRef = useRef(null);
  const [fitNonce, setFitNonce] = useState(0);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // Drag/resize state and helpers
  const dragRef = useRef({
    mode: null, // 'move' | 'resize'
    handle: null,
    elementId: null,
    startMouseX: 0,
    startMouseY: 0,
    startPos: { x: 0, y: 0, width: 0, height: 0 },
    pageWidth: 0,
    pageHeight: 0,
    scale: 1,
  });

  const applyPixelPositionUpdate = useCallback(
    (elementKey, partial) => {
      if (!elementKey || !documentData) return;

      // Locate target element robustly
      const elementMap = documentData.elementMap || {};
      let target = elementMap[elementKey] || null;
      if (!target && Array.isArray(documentData.elements)) {
        target = documentData.elements.find(
          (el) =>
            el && ((el.self && el.self === elementKey) || el.id === elementKey)
        );
      }
      if (!target) return;

      const prevPos = target.pixelPosition || {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
      };
      const nextPixelPosition = {
        x: Number.isFinite(partial.x) ? partial.x : prevPos.x,
        y: Number.isFinite(partial.y) ? partial.y : prevPos.y,
        width: Number.isFinite(partial.width)
          ? Math.max(1, partial.width)
          : Math.max(1, prevPos.width),
        height: Number.isFinite(partial.height)
          ? Math.max(1, partial.height)
          : Math.max(1, prevPos.height),
        rotation: Number.isFinite(partial.rotation)
          ? partial.rotation
          : prevPos.rotation || 0,
      };

      const newDoc = {
        ...documentData,
        elements: Array.isArray(documentData.elements)
          ? documentData.elements.map((el) =>
              el &&
              ((el.self && el.self === elementKey) || el.id === elementKey)
                ? {
                    ...el,
                    pixelPosition: {
                      ...(el.pixelPosition || {}),
                      ...nextPixelPosition,
                    },
                  }
                : el
            )
          : documentData.elements,
        elementMap: documentData.elementMap
          ? {
              ...documentData.elementMap,
              [elementKey]: {
                ...(documentData.elementMap[elementKey] || target),
                pixelPosition: {
                  ...((documentData.elementMap[elementKey] || target)
                    ?.pixelPosition || {}),
                  ...nextPixelPosition,
                },
              },
            }
          : documentData.elementMap,
        elementsByPage: documentData.elementsByPage
          ? Object.fromEntries(
              Object.entries(documentData.elementsByPage).map(
                ([pageKey, arr]) => [
                  pageKey,
                  Array.isArray(arr)
                    ? arr.map((el) =>
                        el &&
                        ((el.self && el.self === elementKey) ||
                          el.id === elementKey)
                          ? {
                              ...el,
                              pixelPosition: {
                                ...(el.pixelPosition || {}),
                                ...nextPixelPosition,
                              },
                            }
                          : el
                      )
                    : arr,
                ]
              )
            )
          : documentData.elementsByPage,
      };

      setDocumentData(newDoc);
    },
    [documentData, setDocumentData]
  );

  const startMove = useCallback(
    (e, element, elementPosition, pageWidth, pageHeight, scale) => {
      if (!element || !elementPosition) return;
      e.preventDefault();
      e.stopPropagation();

      dragRef.current.mode = "move";
      dragRef.current.handle = null;
      dragRef.current.elementId = element.id || element.self;
      dragRef.current.startMouseX = e.clientX;
      dragRef.current.startMouseY = e.clientY;
      dragRef.current.startPos = {
        x: elementPosition.x,
        y: elementPosition.y,
        width: elementPosition.width,
        height: elementPosition.height,
      };
      dragRef.current.pageWidth = pageWidth;
      dragRef.current.pageHeight = pageHeight;
      dragRef.current.scale = scale || 1;

      const onMove = (ev) => {
        const dx =
          (ev.clientX - dragRef.current.startMouseX) / dragRef.current.scale;
        const dy =
          (ev.clientY - dragRef.current.startMouseY) / dragRef.current.scale;
        let newX = dragRef.current.startPos.x + dx;
        let newY = dragRef.current.startPos.y + dy;

        newX = Math.max(
          0,
          Math.min(
            newX,
            dragRef.current.pageWidth - dragRef.current.startPos.width
          )
        );
        newY = Math.max(
          0,
          Math.min(
            newY,
            dragRef.current.pageHeight - dragRef.current.startPos.height
          )
        );

        applyPixelPositionUpdate(dragRef.current.elementId, {
          x: newX,
          y: newY,
        });
      };

      const end = () => {
        window.removeEventListener("mousemove", onMove, true);
        window.removeEventListener("mouseup", end, true);
        dragRef.current.mode = null;
      };

      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("mouseup", end, true);
    },
    [applyPixelPositionUpdate]
  );

  const startResize = useCallback(
    (e, element, handle, elementPosition, pageWidth, pageHeight, scale) => {
      if (!element || !elementPosition) return;
      e.preventDefault();
      e.stopPropagation();

      dragRef.current.mode = "resize";
      dragRef.current.handle = handle;
      dragRef.current.elementId = element.id || element.self;
      dragRef.current.startMouseX = e.clientX;
      dragRef.current.startMouseY = e.clientY;
      dragRef.current.startPos = {
        x: elementPosition.x,
        y: elementPosition.y,
        width: elementPosition.width,
        height: elementPosition.height,
      };
      dragRef.current.pageWidth = pageWidth;
      dragRef.current.pageHeight = pageHeight;
      dragRef.current.scale = scale || 1;

      const onMove = (ev) => {
        const dx =
          (ev.clientX - dragRef.current.startMouseX) / dragRef.current.scale;
        const dy =
          (ev.clientY - dragRef.current.startMouseY) / dragRef.current.scale;

        const start = dragRef.current.startPos;
        let { x, y, width, height } = start;
        const pageW = dragRef.current.pageWidth;
        const pageH = dragRef.current.pageHeight;
        const ratio = start.height > 0 ? start.width / start.height : 1;
        const useShift = Boolean(ev.shiftKey);
        const useAlt = Boolean(ev.altKey);

        const centerX = start.x + start.width / 2;
        const centerY = start.y + start.height / 2;

        const handle = dragRef.current.handle;
        if (handle === "br") {
          let newWidth = start.width + dx;
          let newHeight = start.height + dy;
          if (useShift) {
            if (Math.abs(dx) >= Math.abs(dy)) newHeight = newWidth / ratio;
            else newWidth = newHeight * ratio;
          }
          width = Math.max(1, newWidth);
          height = Math.max(1, newHeight);
          if (useAlt) {
            x = centerX - width / 2;
            y = centerY - height / 2;
          } else {
            x = start.x;
            y = start.y;
          }
        } else if (handle === "tr") {
          let newWidth = start.width + dx;
          let newHeight = start.height - dy;
          if (useShift) {
            if (Math.abs(dx) >= Math.abs(dy)) newHeight = newWidth / ratio;
            else newWidth = newHeight * ratio;
          }
          width = Math.max(1, newWidth);
          height = Math.max(1, newHeight);
          if (useAlt) {
            x = centerX - width / 2;
            y = centerY - height / 2;
          } else {
            x = start.x;
            y = start.y + (start.height - height);
          }
        } else if (handle === "bl") {
          let newWidth = start.width - dx;
          let newHeight = start.height + dy;
          if (useShift) {
            if (Math.abs(dx) >= Math.abs(dy)) newHeight = newWidth / ratio;
            else newWidth = newHeight * ratio;
          }
          width = Math.max(1, newWidth);
          height = Math.max(1, newHeight);
          if (useAlt) {
            x = centerX - width / 2;
            y = centerY - height / 2;
          } else {
            x = start.x + (start.width - width);
            y = start.y;
          }
        } else if (handle === "tl") {
          let newWidth = start.width - dx;
          let newHeight = start.height - dy;
          if (useShift) {
            if (Math.abs(dx) >= Math.abs(dy)) newHeight = newWidth / ratio;
            else newWidth = newHeight * ratio;
          }
          width = Math.max(1, newWidth);
          height = Math.max(1, newHeight);
          if (useAlt) {
            x = centerX - width / 2;
            y = centerY - height / 2;
          } else {
            x = start.x + (start.width - width);
            y = start.y + (start.height - height);
          }
        } else if (handle === "r") {
          let newWidth = start.width + dx;
          let newHeight = start.height;
          if (useShift) {
            newHeight = newWidth / ratio;
          }
          width = Math.max(1, newWidth);
          height = Math.max(1, newHeight);
          if (useAlt) {
            x = centerX - width / 2;
            y = centerY - height / 2;
          } else {
            x = start.x;
            y = useShift ? start.y + (start.height - height) / 2 : start.y;
          }
        } else if (handle === "l") {
          let newWidth = start.width - dx;
          let newHeight = start.height;
          if (useShift) {
            newHeight = newWidth / ratio;
          }
          width = Math.max(1, newWidth);
          height = Math.max(1, newHeight);
          if (useAlt) {
            x = centerX - width / 2;
            y = centerY - height / 2;
          } else {
            x = start.x + (start.width - width);
            y = useShift ? start.y + (start.height - height) / 2 : start.y;
          }
        } else if (handle === "b") {
          let newHeight = start.height + dy;
          let newWidth = start.width;
          if (useShift) {
            newWidth = newHeight * ratio;
          }
          width = Math.max(1, newWidth);
          height = Math.max(1, newHeight);
          if (useAlt) {
            x = centerX - width / 2;
            y = centerY - height / 2;
          } else {
            x = useShift ? start.x + (start.width - width) / 2 : start.x;
            y = start.y;
          }
        } else if (handle === "t") {
          let newHeight = start.height - dy;
          let newWidth = start.width;
          if (useShift) {
            newWidth = newHeight * ratio;
          }
          width = Math.max(1, newWidth);
          height = Math.max(1, newHeight);
          if (useAlt) {
            x = centerX - width / 2;
            y = centerY - height / 2;
          } else {
            x = useShift ? start.x + (start.width - width) / 2 : start.x;
            y = start.y + (start.height - height);
          }
        }

        // Constrain within canvas bounds fully
        if (width > pageW) {
          width = pageW;
          if (useAlt) x = centerX - width / 2;
        }
        if (height > pageH) {
          height = pageH;
          if (useAlt) y = centerY - height / 2;
        }

        x = Math.max(0, Math.min(x, pageW - width));
        y = Math.max(0, Math.min(y, pageH - height));

        applyPixelPositionUpdate(dragRef.current.elementId, {
          x,
          y,
          width,
          height,
        });
      };

      const end = () => {
        window.removeEventListener("mousemove", onMove, true);
        window.removeEventListener("mouseup", end, true);
        dragRef.current.mode = null;
      };

      window.addEventListener("mousemove", onMove, true);
      window.addEventListener("mouseup", end, true);
    },
    [applyPixelPositionUpdate]
  );

  const handleGlobalClick = useCallback(
    (e) => {
      // Ignore clicks inside the side editor portal
      const target = e.target;
      if (
        target &&
        target.closest &&
        target.closest('[data-editor-panel="true"]')
      ) {
        return;
      }
      if (
        pageWrapperRef.current &&
        !pageWrapperRef.current.contains(e.target)
      ) {
        // Do not auto-close the editor on outside clicks; keep selection
        // setSelectedElementId(null);
        // setEditingElementId(null);
      }
    },
    [pageWrapperRef]
  );

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const ro = new ResizeObserver(() => setFitNonce((n) => n + 1));
    ro.observe(scrollContainerRef.current);

    const resizer = () => setFitNonce((n) => n + 1);
    window.addEventListener("resize", resizer);
    document.addEventListener("mousedown", handleGlobalClick, true);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", resizer);
      document.removeEventListener("mousedown", handleGlobalClick, true);
    };
  }, [handleGlobalClick]);

  // Responsive: auto-hide thumbnails on smaller screens and render as overlay
  useEffect(() => {
    const update = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (mobile) setShowSidebar(false);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Editor handlers
  const handleSaveEdit = useCallback((newContent) => {
    // Here you would save the content back to the document data
    // For now, just exit edit mode
    console.log("Saving content:", newContent);
    setEditingElementId(null);
    setSelectedElementId(null);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingElementId(null);
  }, []);

  // Helper: inline all <img> sources as data URLs inside a DOM element
  const inlineImagesInElement = useCallback(async (root) => {
    const images = Array.from(root.querySelectorAll("img"));
    await Promise.all(
      images.map(async (img) => {
        try {
          const src = img.getAttribute("src");
          if (!src || src.startsWith("data:")) return;
          const res = await fetch(src);
          if (!res.ok) return;
          const blob = await res.blob();
          const reader = new FileReader();
          const dataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          img.setAttribute("src", dataUrl);
        } catch (e) {
          // Ignore failures; keep original src
        }
      })
    );
  }, []);

  // Helper: prepare a cloned page element for export and return its HTML fragment (not full document)
  const serializePageFragment = useCallback(
    async (pageEl) => {
      const clone = pageEl.cloneNode(true);
      clone.removeAttribute("id");
      clone.style.transform = "";
      clone.style.transformOrigin = "";

      // Remove UI-only elements
      const toRemove = clone.querySelectorAll(
        '[data-export-ignore="true"], [data-editor-panel="true"]'
      );
      toRemove.forEach((el) => el.parentNode && el.parentNode.removeChild(el));

      // Inline images
      await inlineImagesInElement(clone);

      return clone.outerHTML;
    },
    [inlineImagesInElement]
  );

  // Build a full standalone HTML document around a page fragment
  const wrapAsStandaloneHtml = useCallback((fragmentHtml, title) => {
    return `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>${title}</title>\n<style>\n  html, body { margin:0; padding:0; }\n  body { background:#ffffff; display:flex; align-items:flex-start; justify-content:center; padding:20px; }\n</style>\n</head>\n<body>\n${fragmentHtml}\n</body>\n</html>`;
  }, []);

  // Export the currently visible page as a standalone HTML file (white background, inline images)
  const exportCurrentPageAsHTML = useCallback(async () => {
    try {
      const pageEl = document.getElementById(`page-${currentPageIndex + 1}`);
      if (!pageEl) return;
      const fragment = await serializePageFragment(pageEl);
      const html = wrapAsStandaloneHtml(
        fragment,
        `Exported Page ${currentPageIndex + 1}`
      );

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `export-page-${currentPageIndex + 1}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to export HTML:", e);
    }
  }, [currentPageIndex, serializePageFragment, wrapAsStandaloneHtml]);

  // Export all pages as a single HTML (stacked vertically), white background, inline images
  const exportAllPagesAsSingleHtml = useCallback(async () => {
    if (!documentData?.pages) return;
    const originalIndex = currentPageIndex;
    const fragments = [];
    for (let i = 0; i < documentData.pages.length; i++) {
      setCurrentPageIndex(i);
      // Wait a frame for React to render
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 20)));
      const pageEl = document.getElementById(`page-${i + 1}`);
      if (!pageEl) continue;
      // eslint-disable-next-line no-await-in-loop
      const fragment = await serializePageFragment(pageEl);
      fragments.push(fragment);
    }
    // restore index
    setCurrentPageIndex(originalIndex);

    const combined = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>Exported Document</title>\n<style>\n  html, body { margin:0; padding:0; background:#ffffff; }\n  .page-wrap { display:flex; justify-content:center; padding:20px; }\n</style>\n</head>\n<body>\n${fragments
      .map((f) => `<div class="page-wrap">${f}</div>`)
      .join("\n")}\n</body>\n</html>`;

    const blob = new Blob([combined], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `export-document.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [currentPageIndex, documentData, serializePageFragment]);

  // Export all pages as a ZIP of per-page HTML (server-side zipping via adm-zip)
  const exportAllPagesAsZip = useCallback(async () => {
    if (!documentData?.pages) return;
    const originalIndex = currentPageIndex;
    const files = [];
    for (let i = 0; i < documentData.pages.length; i++) {
      setCurrentPageIndex(i);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 20)));
      const pageEl = document.getElementById(`page-${i + 1}`);
      if (!pageEl) continue;
      // eslint-disable-next-line no-await-in-loop
      const fragment = await serializePageFragment(pageEl);
      const html = wrapAsStandaloneHtml(fragment, `Exported Page ${i + 1}`);
      files.push({ name: `page-${i + 1}.html`, content: html });
    }
    setCurrentPageIndex(originalIndex);

    try {
      const res = await fetch("/api/export-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      if (!res.ok) throw new Error("ZIP export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "exported-pages.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("ZIP export error:", e);
    }
  }, [
    currentPageIndex,
    documentData,
    serializePageFragment,
    wrapAsStandaloneHtml,
  ]);

  // Background color override controls
  const backgroundModes = [
    { value: "auto", label: "Auto Detect" },
    { value: "white", label: "Force White" },
    { value: "transparent", label: "Transparent" },
    { value: "custom", label: "Custom Color" },
  ];

  // Create utility object for imported functions
  const utils = {
    convertColor: (colorRef) =>
      importedConvertColor(colorRef, documentData, ColorUtils),
    getFontWeight,
    getFontStyle,
    getTextAlign,
    extractTextDecorations,
    ensureTextContrast: (textColor, backgroundColor) =>
      ColorUtils.ensureTextContrast(textColor, backgroundColor),
  };

  // Centralized function to get elements for a specific page
  const getElementsForPage = useCallback((pageId, documentData) => {
    if (!documentData || !pageId) return [];

    // First try to use existing pageElementIds if available
    if (documentData.pageElementIds && documentData.pageElementIds[pageId]) {
      const elementIds = documentData.pageElementIds[pageId];
      const elements = elementIds
        .map((id) => documentData.elementMap?.[id])
        .filter(Boolean);
      return elements;
    }

    // Fallback to elementsByPage if available (this should now be correct from backend)
    if (documentData.elementsByPage && documentData.elementsByPage[pageId]) {
      const elements = documentData.elementsByPage[pageId];

      // First, ensure elements have proper IDs by matching with main elements
      const elementsWithIds = elements.map((element) => {
        // Find the corresponding element in the main elements array by name
        const mainElement = documentData.elements?.find(
          (el) => el.name === element.name
        );

        if (mainElement) {
          return {
            ...element,
            id: mainElement.id || mainElement.self,
          };
        }

        return element;
      });

      // Then merge linked image data from main elements
      const elementsWithLinkedImages = elementsWithIds.map((element) => {
        // Find the corresponding element in the main elements array
        const mainElement = documentData.elements?.find(
          (el) =>
            el.id === element.id ||
            el.self === element.id ||
            el.name === element.name
        );

        if (mainElement && mainElement.linkedImage) {
          return {
            ...element,
            linkedImage: mainElement.linkedImage,
          };
        }

        return element;
      });

      return elementsWithLinkedImages;
    }

    // NEW: Use comprehensive mapping system for accurate page assignment
    if (documentData.elements && documentData.pages) {
      const allElements = documentData.elements;
      const pageIndex = documentData.pages.findIndex((p) => p.self === pageId);

      if (pageIndex >= 0) {
        // First try to use the comprehensive mapping data if available
        if (documentData.elementToPageMap && documentData.pageToElementsMap) {
          const elementIdsForPage =
            documentData.pageToElementsMap[pageId] || [];
          const pageElements = allElements.filter((element) =>
            elementIdsForPage.includes(element.self || element.id)
          );

          if (pageElements.length > 0) {
            const elementsWithIds = pageElements.map((element) => ({
              ...element,
              id:
                element.id ||
                element.self ||
                `element_${Math.random().toString(36).substr(2, 9)}`,
            }));

            return elementsWithIds;
          }
        }

        // Fallback: Get elements that belong to this specific page based on their pageId
        const pageElements = allElements.filter(
          (element) => element.pageId === pageId
        );

        if (pageElements.length > 0) {
          // Ensure elements have proper IDs
          const elementsWithIds = pageElements.map((element) => ({
            ...element,
            id:
              element.id ||
              element.self ||
              `element_${Math.random().toString(36).substr(2, 9)}`,
          }));

          return elementsWithIds;
        } else {
          // No elements found for page in comprehensive mapping
        }
      }
    }

    return [];
  }, []);

  useEffect(() => {
    if (uploadId) {
      loadDocument();
    }
  }, [uploadId]);

  // Multi-page effect handlers
  useEffect(() => {
    if (documentData) {
      // Set up pages
      const pagesData = documentData.pages || [];
      setPages(pagesData);
    }
  }, [documentData]);

  // NEW: Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        !documentData ||
        !documentData.pages ||
        documentData.pages.length <= 1
      )
        return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        // Next page
        setCurrentPageIndex((prev) =>
          prev < documentData.pages.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        // Previous page
        setCurrentPageIndex((prev) => (prev > 0 ? prev - 1 : prev));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [documentData]);

  if (loading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Loading document...</h1>
      </div>
    );
  }
  if (!documentData) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Error loading document</h1>
        <p>Could not load document data.</p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Main Content Area with Multi-page Support */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* Controls Bar */}
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "8px 12px",
            borderBottom: "1px solid #e5e7eb",
            background: "#f9fafb",
          }}
        >
          <button
            onClick={() => setShowSidebar((s) => !s)}
            title={showSidebar ? "Hide thumbnails" : "Show thumbnails"}
            style={{
              width: 28,
              height: 28,
              border: "1px solid #d1d5db",
              background: "white",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Icon: two rectangles like pages */}
            <span style={{ lineHeight: 1 }}>☰</span>
          </button>
          <button
            onClick={exportCurrentPageAsHTML}
            title="Export current page as HTML"
            style={{
              height: 28,
              padding: "0 10px",
              border: "1px solid #d1d5db",
              background: "white",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Export HTML
          </button>
          <button
            onClick={exportAllPagesAsSingleHtml}
            title="Export all pages as a single HTML"
            style={{
              height: 28,
              padding: "0 10px",
              border: "1px solid #d1d5db",
              background: "white",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Export All → One HTML
          </button>
          <button
            onClick={exportAllPagesAsZip}
            title="Export all pages as a ZIP of HTML files"
            style={{
              height: 28,
              padding: "0 10px",
              border: "1px solid #d1d5db",
              background: "white",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            Export All → ZIP
          </button>
        </div>
        {/* Enhanced Canvas with Single Page Display */}
        <div
          ref={scrollContainerRef}
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "row",
            alignItems: "flex-start",
            padding: "20px 20px 20px 20px",
            gap: 16,
            overflow: "auto",
            backgroundColor: "#e9ecef",
          }}
        >
          {/* Left sidebar: vertical page thumbnails */}
          {showSidebar &&
            (isMobile ? (
              <>
                <div
                  onClick={() => setShowSidebar(false)}
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.3)",
                    zIndex: 1100,
                  }}
                />
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: 220,
                    flex: "0 0 220px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px 10px",
                    background: "#fff",
                    boxShadow: "2px 0 12px rgba(0,0,0,0.2)",
                    overflowY: "auto",
                    zIndex: 1101,
                  }}
                >
                  {getPagesArray(documentData).map((page, idx) => (
                    <div
                      key={`thumb-${page.self}`}
                      onClick={() => {
                        setCurrentPageIndex(idx);
                        setShowSidebar(false);
                      }}
                      style={{
                        width: 180,
                        padding: 8,
                        border:
                          idx === currentPageIndex
                            ? "2px solid #007bff"
                            : "1px solid #ddd",
                        borderRadius: 6,
                        background: "#fff",
                        cursor: "pointer",
                        boxShadow:
                          idx === currentPageIndex
                            ? "0 4px 10px rgba(0,0,0,0.15)"
                            : "none",
                      }}
                    >
                      {renderPagePreview(
                        page,
                        documentData,
                        getElementsForPage,
                        utils,
                        backgroundConfig,
                        importedGetPageBackgroundColor,
                        importedGetDocumentBackgroundColor
                      )}
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          textAlign: "center",
                          color: "#444",
                        }}
                      >
                        Page {idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div
                style={{
                  width: 160,
                  flex: "0 0 160px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  alignItems: "center",
                  position: "sticky",
                  top: 20,
                  maxHeight: "calc(100vh - 40px)",
                  overflowY: "auto",
                }}
              >
                {getPagesArray(documentData).map((page, idx) => (
                  <div
                    key={`thumb-${page.self}`}
                    onClick={() => setCurrentPageIndex(idx)}
                    style={{
                      width: 140,
                      padding: 8,
                      border:
                        idx === currentPageIndex
                          ? "2px solid #007bff"
                          : "1px solid #ddd",
                      borderRadius: 6,
                      background: "#fff",
                      cursor: "pointer",
                      boxShadow:
                        idx === currentPageIndex
                          ? "0 4px 10px rgba(0,0,0,0.15)"
                          : "none",
                    }}
                  >
                    {renderPagePreview(
                      page,
                      documentData,
                      getElementsForPage,
                      utils,
                      backgroundConfig,
                      importedGetPageBackgroundColor,
                      importedGetDocumentBackgroundColor
                    )}
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        textAlign: "center",
                        color: "#444",
                      }}
                    >
                      Page {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {/* Main page container */}
          {(() => {
            const pagesArray = getPagesArray(documentData);
            const currentPage = pagesArray[currentPageIndex];
            const pageElements = getElementsForPage(
              currentPage.self,
              documentData
            );

            // DEBUG: Check for extracted images and image linking

            if (!currentPage) {
              return <div>No page data available</div>;
            }

            // Get elements for the current page using centralized function
            const pageElementsForRendering = getElementsForPage(
              currentPage.self,
              documentData
            );

            // Sort elements by size (largest first, smallest last) so smaller elements render on top
            const sortedElements = [...pageElementsForRendering].sort(
              (a, b) => {
                if (!a.pixelPosition || !b.pixelPosition) return 0;
                const areaA = a.pixelPosition.width * a.pixelPosition.height;
                const areaB = b.pixelPosition.width * b.pixelPosition.height;
                return areaB - areaA; // Larger elements first (will be underneath)
              }
            );

            // Build a stable id->element map for this render
            const pageElementById = Object.fromEntries(
              sortedElements.map((el) => [el.self || el.id, el])
            );

            // DEBUG: Check if page elements have linked images
            if (sortedElements && sortedElements.length > 0) {
              const pageElementsWithLinkedImages = sortedElements.filter(
                (el) => el.linkedImage
              );
              // Page elements with linked images analysis completed
            }

            const pageWidthPx = currentPage.geometricBounds
              ? currentPage.geometricBounds.width
              : documentData.pageInfo?.dimensions?.pixelDimensions?.width ||
                documentData.pageInfo?.dimensions?.width ||
                612;
            const pageHeightPx = currentPage.geometricBounds
              ? currentPage.geometricBounds.height
              : documentData.pageInfo?.dimensions?.pixelDimensions?.height ||
                documentData.pageInfo?.dimensions?.height ||
                792;

            // Compute scale (always fit to viewport)
            let scale = 1;
            const container = scrollContainerRef.current;
            if (container) {
              const availableW = container.clientWidth - 40;
              const availableH = container.clientHeight - 40;
              const sX = availableW / pageWidthPx;
              const sY = availableH / pageHeightPx;
              scale = Math.min(sX, sY);
              if (!Number.isFinite(scale) || scale <= 0) scale = 1;
              // Avoid collapsing too small due to transient layout
              scale = Math.max(scale, 0.2);
            }

            const getTopmostElementKeyAtClientPoint = (clientX, clientY) => {
              const rect = pageCanvasRef.current?.getBoundingClientRect();
              if (!rect) return null;
              const localX = (clientX - rect.left) / scale;
              const localY = (clientY - rect.top) / scale;
              const hits = [];
              const pageArea = pageWidthPx * pageHeightPx;
              for (let i = 0; i < sortedElements.length; i++) {
                const el = sortedElements[i];
                const pos = el && el.pixelPosition;
                if (!pos) continue;
                if (
                  localX >= pos.x &&
                  localX <= pos.x + pos.width &&
                  localY >= pos.y &&
                  localY <= pos.y + pos.height
                ) {
                  const area = Math.max(
                    1,
                    (pos.width || 1) * (pos.height || 1)
                  );
                  hits.push({ index: i, key: el.id || el.self, area });
                }
              }
              if (hits.length === 0) return null;
              // Prefer highest z-order (largest index), but drop near-full-page elements if a smaller hit exists
              const filtered = hits.some((h) => h.area / pageArea < 0.9)
                ? hits.filter((h) => h.area / pageArea < 0.9)
                : hits;
              filtered.sort((a, b) => a.index - b.index);
              return filtered[filtered.length - 1].key;
            };

            return (
              <div
                key={currentPage.self}
                id={`page-${currentPageIndex + 1}`}
                ref={pageWrapperRef}
                style={{
                  position: "relative",
                  width: `${pageWidthPx}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                  boxShadow: "0 0 0 2px #007bff, 0 5px 15px rgba(0,0,0,0.2)",
                }}
              >
                {/* Page Canvas */}
                <div
                  ref={pageCanvasRef}
                  style={{
                    position: "relative",
                    width: "100%",
                    height: `${pageHeightPx}px`,
                    backgroundColor: importedGetPageBackgroundColor(
                      currentPage,
                      documentData,
                      utils.convertColor,
                      (docData) =>
                        importedGetDocumentBackgroundColor(
                          docData,
                          backgroundConfig,
                          utils.convertColor
                        ),
                      backgroundConfig
                    ),
                    border: "1px solid #ccc",
                    overflow: "hidden",
                    borderRadius: "2px",
                    position: "relative",
                    isolation: "isolate",
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setSelectedElementId(null);
                    }
                  }}
                >
                  {/* PRESERVED: Margins Visualization */}
                  {showMargins &&
                    documentData.pageInfo?.margins &&
                    (() => {
                      const visualMarginTop =
                        documentData.pageInfo.margins.pixelMargins?.top ||
                        documentData.pageInfo.margins.top ||
                        0;
                      const visualMarginLeft =
                        documentData.pageInfo.margins.pixelMargins?.left ||
                        documentData.pageInfo.margins.left ||
                        0;
                      const visualMarginRight =
                        documentData.pageInfo.margins.pixelMargins?.right ||
                        documentData.pageInfo.margins.right ||
                        0;
                      const visualMarginBottom =
                        documentData.pageInfo.margins.pixelMargins?.bottom ||
                        documentData.pageInfo.margins.bottom ||
                        0;

                      return (
                        <div
                          style={{
                            position: "absolute",
                            top: visualMarginTop + "px",
                            left: visualMarginLeft + "px",
                            right: visualMarginRight + "px",
                            bottom: visualMarginBottom + "px",
                            border: "3px dashed rgba(255, 0, 0, 0.4)",
                            pointerEvents: "none",
                            zIndex: 100,
                          }}
                        />
                      );
                    })()}

                  {/* PRESERVED: Element Rendering for Current Page */}
                  {sortedElements.map((element, index) => {
                    // DEBUG: Only log elements with linked images to reduce noise
                    if (element.linkedImage && element.linkedImage.url) {
                      // Processing element with image
                    }

                    // DEBUG: Only log missing images to reduce noise
                    if (
                      element.isContentFrame &&
                      element.hasPlacedContent &&
                      !element.linkedImage
                    ) {
                      // Element should have linked image but doesn't
                    }

                    if (!element.pixelPosition) {
                      return null;
                    }

                    // FIXED: Add boundary checking to ensure elements stay within page canvas
                    const pageWidth =
                      currentPage.geometricBounds?.width ||
                      documentData.pageInfo?.dimensions?.pixelDimensions
                        ?.width ||
                      documentData.pageInfo?.dimensions?.width ||
                      612;
                    const pageHeight =
                      currentPage.geometricBounds?.height ||
                      documentData.pageInfo?.dimensions?.pixelDimensions
                        ?.height ||
                      documentData.pageInfo?.dimensions?.height ||
                      792;

                    let elementPosition = element.pixelPosition;

                    // Constrain element position to page boundaries
                    const constrainedPosition = {
                      x: Math.max(
                        0,
                        Math.min(
                          elementPosition.x,
                          pageWidth - elementPosition.width
                        )
                      ),
                      y: Math.max(
                        0,
                        Math.min(
                          elementPosition.y,
                          pageHeight - elementPosition.height
                        )
                      ),
                      width: Math.min(elementPosition.width, pageWidth),
                      height: Math.min(elementPosition.height, pageHeight),
                      rotation: elementPosition.rotation || 0,
                    };

                    // Check if element was constrained
                    const wasConstrained =
                      constrainedPosition.x !== elementPosition.x ||
                      constrainedPosition.y !== elementPosition.y ||
                      constrainedPosition.width !== elementPosition.width ||
                      constrainedPosition.height !== elementPosition.height;

                    if (wasConstrained) {
                      // Element was constrained to page boundaries
                    }

                    elementPosition = constrainedPosition;

                    const isContentFrame =
                      element.isContentFrame || element.hasPlacedContent;
                    const hasPlacedContent = element.placedContent;

                    // Create unique key for this element instance
                    const elementKey = element.self || element.id;
                    const isSelected = selectedElementId === elementKey;
                    const isEditing = editingElementId === elementKey;
                    const isTextElement =
                      element.type === "TextFrame" ||
                      element.name === "Bulleted List" ||
                      element.name === "Numbered List";

                    return (
                      <div
                        key={`render-${elementKey}-${index}`}
                        className={`${styles.idmlElement} ${
                          isSelected ? styles.selected : ""
                        }`}
                        data-element-key={elementKey}
                        data-is-selected={isSelected}
                        style={{
                          position: "absolute",
                          left: elementPosition.x + "px",
                          top: elementPosition.y + "px",
                          width: elementPosition.width + "px",
                          height: elementPosition.height + "px",
                          background:
                            element.fill && element.fill.startsWith("Gradient/")
                              ? renderGradientBackground(
                                  element.fill,
                                  documentData,
                                  utils
                                )
                              : element.fill
                              ? utils.convertColor(element.fill)
                              : "transparent",
                          border: "1px solid transparent",
                          overflow: "hidden",
                          transform: elementPosition.rotation
                            ? `rotate(${elementPosition.rotation}deg)`
                            : "none",
                          transformOrigin: "top left",
                          boxSizing: "border-box",
                          zIndex: isSelected || isEditing ? 10000 : index + 1,
                          maxWidth: "100%",
                          maxHeight: "100%",
                          cursor: isTextElement
                            ? isEditing
                              ? "text"
                              : "text"
                            : "move",
                          transition: "border 0.2s ease, outline 0.2s ease",
                        }}
                        onMouseDown={(e) => {
                          if (isTextElement && isEditing) return; // Don't drag while editing text
                          // Ignore when starting on a resize handle
                          if (
                            e.target &&
                            e.target.getAttribute &&
                            e.target.getAttribute("data-resize-handle")
                          )
                            return;
                          // Select on mousedown to ensure selection even if click is prevented by drag
                          setSelectedElementId(elementKey);
                          startMove(
                            e,
                            element,
                            elementPosition,
                            pageWidthPx,
                            pageHeightPx,
                            scale
                          );
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(elementKey);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(elementKey);
                          if (isTextElement) {
                            setEditingElementId(elementKey);
                          }
                        }}
                      >
                        {/* Element type label for hover */}
                        <div
                          className={styles.elementLabel}
                          data-export-ignore="true"
                        >
                          {element.name || element.type || "Element"}
                        </div>

                        {/* Resize handles (visible when selected) */}
                        {isSelected && (
                          <>
                            <div
                              data-resize-handle="tl"
                              onMouseDown={(e) =>
                                startResize(
                                  e,
                                  element,
                                  "tl",
                                  elementPosition,
                                  pageWidthPx,
                                  pageHeightPx,
                                  scale
                                )
                              }
                              style={{
                                position: "absolute",
                                width: "10px",
                                height: "10px",
                                left: "-5px",
                                top: "-5px",
                                background: "#007bff",
                                border: "2px solid #fff",
                                borderRadius: "2px",
                                cursor: "nwse-resize",
                                zIndex: 10001,
                              }}
                            />
                            <div
                              data-resize-handle="tr"
                              onMouseDown={(e) =>
                                startResize(
                                  e,
                                  element,
                                  "tr",
                                  elementPosition,
                                  pageWidthPx,
                                  pageHeightPx,
                                  scale
                                )
                              }
                              style={{
                                position: "absolute",
                                width: "10px",
                                height: "10px",
                                right: "-5px",
                                top: "-5px",
                                background: "#007bff",
                                border: "2px solid #fff",
                                borderRadius: "2px",
                                cursor: "nesw-resize",
                                zIndex: 10001,
                              }}
                            />
                            <div
                              data-resize-handle="bl"
                              onMouseDown={(e) =>
                                startResize(
                                  e,
                                  element,
                                  "bl",
                                  elementPosition,
                                  pageWidthPx,
                                  pageHeightPx,
                                  scale
                                )
                              }
                              style={{
                                position: "absolute",
                                width: "10px",
                                height: "10px",
                                left: "-5px",
                                bottom: "-5px",
                                background: "#007bff",
                                border: "2px solid #fff",
                                borderRadius: "2px",
                                cursor: "nesw-resize",
                                zIndex: 10001,
                              }}
                            />
                            <div
                              data-resize-handle="br"
                              onMouseDown={(e) =>
                                startResize(
                                  e,
                                  element,
                                  "br",
                                  elementPosition,
                                  pageWidthPx,
                                  pageHeightPx,
                                  scale
                                )
                              }
                              style={{
                                position: "absolute",
                                width: "10px",
                                height: "10px",
                                right: "-5px",
                                bottom: "-5px",
                                background: "#007bff",
                                border: "2px solid #fff",
                                borderRadius: "2px",
                                cursor: "nwse-resize",
                                zIndex: 10001,
                              }}
                            />
                            {/* Side handles */}
                            <div
                              data-resize-handle="t"
                              onMouseDown={(e) =>
                                startResize(
                                  e,
                                  element,
                                  "t",
                                  elementPosition,
                                  pageWidthPx,
                                  pageHeightPx,
                                  scale
                                )
                              }
                              style={{
                                position: "absolute",
                                left: "50%",
                                top: "-5px",
                                transform: "translateX(-50%)",
                                width: "10px",
                                height: "10px",
                                background: "#007bff",
                                border: "2px solid #fff",
                                borderRadius: "2px",
                                cursor: "ns-resize",
                                zIndex: 10001,
                              }}
                            />
                            <div
                              data-resize-handle="b"
                              onMouseDown={(e) =>
                                startResize(
                                  e,
                                  element,
                                  "b",
                                  elementPosition,
                                  pageWidthPx,
                                  pageHeightPx,
                                  scale
                                )
                              }
                              style={{
                                position: "absolute",
                                left: "50%",
                                bottom: "-5px",
                                transform: "translateX(-50%)",
                                width: "10px",
                                height: "10px",
                                background: "#007bff",
                                border: "2px solid #fff",
                                borderRadius: "2px",
                                cursor: "ns-resize",
                                zIndex: 10001,
                              }}
                            />
                            <div
                              data-resize-handle="l"
                              onMouseDown={(e) =>
                                startResize(
                                  e,
                                  element,
                                  "l",
                                  elementPosition,
                                  pageWidthPx,
                                  pageHeightPx,
                                  scale
                                )
                              }
                              style={{
                                position: "absolute",
                                top: "50%",
                                left: "-5px",
                                transform: "translateY(-50%)",
                                width: "10px",
                                height: "10px",
                                background: "#007bff",
                                border: "2px solid #fff",
                                borderRadius: "2px",
                                cursor: "ew-resize",
                                zIndex: 10001,
                              }}
                            />
                            <div
                              data-resize-handle="r"
                              onMouseDown={(e) =>
                                startResize(
                                  e,
                                  element,
                                  "r",
                                  elementPosition,
                                  pageWidthPx,
                                  pageHeightPx,
                                  scale
                                )
                              }
                              style={{
                                position: "absolute",
                                top: "50%",
                                right: "-5px",
                                transform: "translateY(-50%)",
                                width: "10px",
                                height: "10px",
                                background: "#007bff",
                                border: "2px solid #fff",
                                borderRadius: "2px",
                                cursor: "ew-resize",
                                zIndex: 10001,
                              }}
                            />
                          </>
                        )}

                        {/* PRESERVED: Enhanced Image Rendering */}
                        {element.linkedImage &&
                          (element.linkedImage.url ? (
                            <img
                              src={element.linkedImage.url}
                              alt="Frame content"
                              style={{
                                position: "absolute",
                                left: "0px",
                                top: "0px",
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                transformOrigin: "center center",
                              }}
                              onError={(e) => {
                                console.error(
                                  `❌ Main viewer image failed to load: ${element.linkedImage.url}`,
                                  e
                                );
                                e.target.style.display = "none";
                              }}
                            />
                          ) : element.linkedImage.isEmbedded ? (
                            <div
                              style={{
                                position: "absolute",
                                left: "0px",
                                top: "0px",
                                width: "100%",
                                height: "100%",
                                backgroundColor: "#f0f0f0",
                                border: "2px solid #007bff",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "12px",
                                color: "#007bff",
                                flexDirection: "column",
                              }}
                            >
                              Embedded Image
                              <br />
                              No image data
                            </div>
                          ) : null)}

                        {/* PRESERVED: PIXEL-PERFECT Text Rendering */}
                        {element.type === "TextFrame" &&
                          element.parentStory &&
                          documentData.stories[element.parentStory] &&
                          (() => {
                            const story =
                              documentData.stories[element.parentStory];

                            const frameMetrics =
                              InDesignTextMetrics.calculateTextFrameInsets(
                                element,
                                element.textFramePreferences
                              );

                            const storyFormatting =
                              getInDesignAccurateFormatting(story, utils);

                            let cleanText = (story.text || "")
                              .replace(/\n\s*\n/g, "\n")
                              .trim();

                            // Check for list formatting in the document data
                            const listFormatting = getListFormatting(
                              element,
                              documentData
                            );

                            if (listFormatting) {
                              cleanText = applyListFormatting(
                                cleanText,
                                listFormatting
                              );
                            }

                            const textMeasurement =
                              InDesignTextMetrics.measureTextPrecisely(
                                cleanText,
                                storyFormatting,
                                frameMetrics
                              );

                            let finalStyles = getStoryStyles(
                              story,
                              element.position.height,
                              element.position.width,
                              utils,
                              importedGetPageBackgroundColor(
                                currentPage,
                                documentData,
                                utils.convertColor,
                                (docData) =>
                                  importedGetDocumentBackgroundColor(
                                    docData,
                                    backgroundConfig,
                                    utils.convertColor
                                  ),
                                backgroundConfig
                              )
                            );

                            // Compute vertical offset using flex alignment by sizing child container
                            const vJust =
                              element.textFramePreferences
                                ?.verticalJustification || "TopAlign";
                            const columnsMeasuredHeight = Math.min(
                              frameMetrics.contentArea.height,
                              Math.max(0, textMeasurement.textHeight)
                            );
                            const useFullHeight =
                              vJust === "JustifyAlign" ||
                              textMeasurement.willOverflow;
                            const childHeightCss = useFullHeight
                              ? "100%"
                              : `${Math.floor(columnsMeasuredHeight)}px`;

                            let wasAdjusted = false;
                            let adjustmentDetails = null;

                            const containerWidth = elementPosition.width;
                            const containerHeight = elementPosition.height;

                            if (false && textMeasurement.willOverflow) {
                              const adjustment =
                                InDesignTextMetrics.calculateOptimalFontSize(
                                  textMeasurement,
                                  storyFormatting,
                                  0.25
                                );

                              if (adjustment) {
                                finalStyles = {
                                  ...finalStyles,
                                  ...adjustment.adjustedStyles,
                                };
                                wasAdjusted = true;
                                adjustmentDetails = adjustment;
                              }
                            }

                            const adjustedFontSize =
                              wasAdjusted && adjustmentDetails
                                ? adjustmentDetails.newFontSize
                                : null;

                            const createTooltip = () => {
                              const baseInfo = `Story: ${element.parentStory}\nFrame: ${element.position.width}×${element.position.height}px\nContent: ${frameMetrics.contentArea.width}×${frameMetrics.contentArea.height}px`;

                              if (!wasAdjusted) {
                                return `${baseInfo}\nText fits perfectly!`;
                              }

                              return `${baseInfo}\nAdjusted: ${
                                adjustmentDetails.adjustmentType
                              }\nFont: ${
                                adjustmentDetails.originalFontSize
                              }px → ${
                                adjustmentDetails.newFontSize
                              }px\nScale: ${(
                                adjustmentDetails.scaleFactor * 100
                              ).toFixed(1)}%`;
                            };

                            // Map InDesign verticalJustification to CSS justify-content
                            let justifyContent = "flex-start";
                            switch (
                              element.textFramePreferences
                                ?.verticalJustification
                            ) {
                              case "CenterAlign":
                                justifyContent = "center";
                                break;
                              case "BottomAlign":
                                justifyContent = "flex-end";
                                break;
                              case "JustifyAlign":
                                justifyContent = "space-between";
                                break;
                              case "TopAlign":
                              default:
                                justifyContent = "flex-start";
                                break;
                            }

                            // Always define mergedStyles for TextFrame, fallback to finalStyles otherwise
                            let mergedStyles = finalStyles;
                            if (element.type === "TextFrame") {
                              const inDesignCSS =
                                InDesignTextMetrics.generateInDesignCSS(
                                  storyFormatting,
                                  frameMetrics
                                );
                              mergedStyles = {
                                ...finalStyles,
                                ...inDesignCSS,
                              };
                            }

                            return (
                              <div
                                style={{
                                  ...mergedStyles,
                                  position: "absolute",
                                  top: "0px",
                                  left: "0px",
                                  width: `${elementPosition.width}px`,
                                  height: `${elementPosition.height}px`,
                                  display:
                                    element.type === "TextFrame"
                                      ? "flex"
                                      : undefined,
                                  flexDirection:
                                    element.type === "TextFrame"
                                      ? "column"
                                      : undefined,
                                  justifyContent:
                                    element.type === "TextFrame"
                                      ? justifyContent
                                      : undefined,
                                }}
                                title={createTooltip()}
                              >
                                {(() => {
                                  // Check for list formatting in the document data
                                  const listFormatting = getListFormatting(
                                    element,
                                    documentData
                                  );

                                  if (listFormatting) {
                                    // For list elements, render with list formatting
                                    const formattedText = applyListFormatting(
                                      story.text || "",
                                      listFormatting
                                    );
                                    return (
                                      <span
                                        style={{
                                          whiteSpace: "pre-wrap",
                                          display: "inline",
                                          wordBreak: "break-word",
                                          overflowWrap: "break-word",
                                        }}
                                      >
                                        {formattedText}
                                      </span>
                                    );
                                  } else {
                                    // For regular elements, use the normal formatted text rendering
                                    // FIXED: Wrap in span to ensure horizontal flow of text segments
                                    const columnCount =
                                      element.textFramePreferences
                                        ?.textColumnCount || 1;
                                    const columnGap =
                                      element.textFramePreferences
                                        ?.textColumnGutter || 0;

                                    const isMultiColumn =
                                      (columnCount || 1) > 1;
                                    return (
                                      <div
                                        style={{
                                          width: "100%",
                                          height: isMultiColumn
                                            ? "100%"
                                            : "auto",
                                          columnCount: isMultiColumn
                                            ? columnCount
                                            : undefined,
                                          columnGap: isMultiColumn
                                            ? `${columnGap}px`
                                            : undefined,
                                          columnFill: isMultiColumn
                                            ? "auto"
                                            : undefined,
                                          lineHeight: "inherit",
                                          overflow: isMultiColumn
                                            ? "hidden"
                                            : "visible",
                                        }}
                                      >
                                        <div
                                          style={{
                                            width: "100%",
                                            height: "100%",
                                            columnCount: columnCount,
                                            columnGap: `${columnGap}px`,
                                            columnFill: "auto",
                                            lineHeight: "inherit",
                                            overflow: "hidden",
                                          }}
                                        >
                                          {renderFormattedText(
                                            story,
                                            element.position.height,
                                            adjustedFontSize,
                                            utils,
                                            importedGetPageBackgroundColor(
                                              currentPage,
                                              documentData,
                                              utils.convertColor,
                                              (docData) =>
                                                importedGetDocumentBackgroundColor(
                                                  docData,
                                                  backgroundConfig,
                                                  utils.convertColor
                                                ),
                                              backgroundConfig
                                            )
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                })()}
                              </div>
                            );
                          })()}

                        {/* Image Rendering */}
                        {element.linkedImage && element.linkedImage.url && (
                          <>
                            <img
                              src={element.linkedImage.url}
                              alt={element.name || "Frame content"}
                              style={{
                                position: "absolute",
                                left: "0px",
                                top: "0px",
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                transformOrigin: "center center",
                              }}
                              onError={(e) => {
                                console.error(
                                  "Error loading image:",
                                  element.linkedImage.url,
                                  e
                                );
                                e.target.style.display = "none";
                              }}
                            />
                          </>
                        )}

                        {/* Content frame placeholder - only show if no image */}
                        {isContentFrame &&
                          !hasPlacedContent &&
                          !element.linkedImage?.url && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                fontSize: "12px",
                                color: "#666",
                                backgroundColor: "rgba(0, 170, 255, 0.1)",
                                flexDirection: "column",
                              }}
                            >
                              Content Frame
                              <br />
                              {Math.round(elementPosition.width)}×
                              {Math.round(elementPosition.height)}px
                              {element.name && element.name !== "$ID/" && (
                                <>
                                  <br />
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      fontStyle: "italic",
                                    }}
                                  >
                                    {element.name}
                                  </span>
                                </>
                              )}
                            </div>
                          )}

                        {/* PRESERVED: Other elements */}
                        {!hasPlacedContent &&
                          element.type !== "TextFrame" &&
                          !isContentFrame &&
                          element.name !== "Bulleted List" &&
                          element.name !== "Numbered List" && (
                            <div
                              style={{
                                padding: "4px",
                                fontSize: "10px",
                                color: "#999",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                textAlign: "center",
                              }}
                            >
                              {element.type}
                              <br />
                              {Math.round(elementPosition.width)}×
                              {Math.round(elementPosition.height)}px
                            </div>
                          )}
                      </div>
                    );
                  })}

                  {/* Side Panel Editor */}
                  <SideEditorPanel
                    isOpen={Boolean(selectedElementId)}
                    element={(() => {
                      if (!selectedElementId) return null;
                      const target = pageElementById[selectedElementId] || null;
                      return target || null;
                    })()}
                    story={(() => {
                      if (!selectedElementId) return null;
                      const target = pageElementById[selectedElementId] || null;
                      if (!target || !target.parentStory) return null;
                      return documentData.stories?.[target.parentStory] || null;
                    })()}
                    onChangeDraft={(draft) => {
                      const target = selectedElementId
                        ? pageElementById[selectedElementId] || null
                        : null;
                      if (!target) return;

                      // Separate partial delta from full snapshot
                      const all = draft && draft.__all ? draft.__all : draft;
                      const delta =
                        draft && draft.__all
                          ? Object.keys(draft).reduce((acc, key) => {
                              if (key !== "__all") acc[key] = draft[key];
                              return acc;
                            }, {})
                          : draft;

                      const mapAlign = (a) => {
                        switch (a) {
                          case "center":
                            return "CenterAlign";
                          case "right":
                            return "RightAlign";
                          case "justify":
                            return "FullyJustified";
                          case "left":
                            return "LeftAlign";
                          default:
                            return a || "LeftAlign";
                        }
                      };
                      const fontStyle =
                        [all.bold ? "Bold" : null, all.italic ? "Italic" : null]
                          .filter(Boolean)
                          .join(" ") || "Regular";
                      const hexToRgbCss = (hex) => {
                        if (
                          !hex ||
                          typeof hex !== "string" ||
                          !hex.startsWith("#")
                        )
                          return hex;
                        const v = hex.replace("#", "");
                        const n =
                          v.length === 3
                            ? v
                                .split("")
                                .map((c) => c + c)
                                .join("")
                            : v;
                        const r = parseInt(n.slice(0, 2), 16),
                          g = parseInt(n.slice(2, 4), 16),
                          b = parseInt(n.slice(4, 6), 16);
                        return `rgb(${r}, ${g}, ${b})`;
                      };

                      const newDoc = {
                        ...documentData,
                        stories: { ...documentData.stories },
                        elements: [...(documentData.elements || [])],
                        elementsByPage: {
                          ...(documentData.elementsByPage || {}),
                        },
                        elementMap: { ...(documentData.elementMap || {}) },
                      };
                      // Update story only if available AND text fields actually changed
                      if (
                        target.parentStory &&
                        newDoc.stories[target.parentStory]
                      ) {
                        const prevStory =
                          newDoc.stories[target.parentStory] || {};
                        const prevStyling = prevStory.styling || {};

                        // Build a delta of only the style fields present in the partial delta
                        const stylingDelta = {};
                        if (
                          Object.prototype.hasOwnProperty.call(
                            delta,
                            "fontFamily"
                          )
                        ) {
                          stylingDelta.fontFamily = all.fontFamily;
                        }
                        if (
                          Object.prototype.hasOwnProperty.call(
                            delta,
                            "fontSize"
                          )
                        ) {
                          stylingDelta.fontSize = all.fontSize;
                        }
                        if (
                          Object.prototype.hasOwnProperty.call(delta, "bold") ||
                          Object.prototype.hasOwnProperty.call(delta, "italic")
                        ) {
                          stylingDelta.fontStyle = fontStyle;
                        }
                        if (
                          Object.prototype.hasOwnProperty.call(
                            delta,
                            "underline"
                          )
                        ) {
                          stylingDelta.underline = all.underline;
                        }
                        if (
                          Object.prototype.hasOwnProperty.call(delta, "align")
                        ) {
                          stylingDelta.alignment = mapAlign(all.align);
                        }
                        if (
                          Object.prototype.hasOwnProperty.call(delta, "color")
                        ) {
                          stylingDelta.fillColor = hexToRgbCss(all.color);
                        }
                        if (
                          Object.prototype.hasOwnProperty.call(
                            delta,
                            "lineHeight"
                          )
                        ) {
                          stylingDelta.effectiveLineHeight = all.lineHeight;
                        }

                        const didTextContentChange =
                          Object.prototype.hasOwnProperty.call(
                            delta,
                            "content"
                          ) && (all.content ?? "") !== (prevStory.text ?? "");
                        const didStyleChange =
                          Object.keys(stylingDelta).length > 0;

                        if (didTextContentChange || didStyleChange) {
                          // Merge story.styling minimally
                          const nextStyling = {
                            ...prevStyling,
                            ...stylingDelta,
                          };

                          // Build updated formattedContent without resetting unrelated formatting
                          let updatedFormattedContent =
                            prevStory.formattedContent;
                          const baseFmt =
                            (Array.isArray(prevStory.formattedContent) &&
                              prevStory.formattedContent[0]?.formatting) ||
                            prevStyling ||
                            {};

                          const applyFmtDelta = (fmt) => ({
                            ...fmt,
                            ...(Object.prototype.hasOwnProperty.call(
                              stylingDelta,
                              "fontFamily"
                            ) && {
                              fontFamily: stylingDelta.fontFamily,
                            }),
                            ...(Object.prototype.hasOwnProperty.call(
                              stylingDelta,
                              "fontSize"
                            ) && {
                              fontSize: stylingDelta.fontSize,
                            }),
                            ...(Object.prototype.hasOwnProperty.call(
                              stylingDelta,
                              "fontStyle"
                            ) && {
                              fontStyle: stylingDelta.fontStyle,
                            }),
                            ...(Object.prototype.hasOwnProperty.call(
                              stylingDelta,
                              "alignment"
                            ) && {
                              alignment: stylingDelta.alignment,
                            }),
                            ...(Object.prototype.hasOwnProperty.call(
                              stylingDelta,
                              "fillColor"
                            ) && {
                              fillColor: stylingDelta.fillColor,
                            }),
                            ...(Object.prototype.hasOwnProperty.call(
                              stylingDelta,
                              "effectiveLineHeight"
                            ) && {
                              leading: stylingDelta.effectiveLineHeight,
                            }),
                            ...(Object.prototype.hasOwnProperty.call(
                              stylingDelta,
                              "underline"
                            ) && {
                              underline: stylingDelta.underline,
                            }),
                          });

                          if (
                            didTextContentChange ||
                            !Array.isArray(prevStory.formattedContent)
                          ) {
                            updatedFormattedContent = [
                              {
                                text: all.content ?? prevStory.text ?? "",
                                formatting: applyFmtDelta(baseFmt),
                              },
                            ];
                          } else if (didStyleChange) {
                            updatedFormattedContent =
                              prevStory.formattedContent.map((seg, i) => {
                                if (i !== 0 || !seg || typeof seg !== "object")
                                  return seg;
                                return {
                                  ...seg,
                                  formatting: applyFmtDelta(
                                    seg.formatting || {}
                                  ),
                                };
                              });
                          }

                          newDoc.stories[target.parentStory] = {
                            ...prevStory,
                            text: didTextContentChange
                              ? all.content ?? prevStory.text
                              : prevStory.text,
                            styling: nextStyling,
                            formattedContent: updatedFormattedContent,
                          };
                        }
                      }

                      // Apply frame (pixelPosition) changes as user edits
                      const nextPixelPosition = {
                        x: Number.isFinite(all.x)
                          ? all.x
                          : target.pixelPosition?.x ?? 0,
                        y: Number.isFinite(all.y)
                          ? all.y
                          : target.pixelPosition?.y ?? 0,
                        width: Number.isFinite(all.width)
                          ? Math.max(1, all.width)
                          : Math.max(1, target.pixelPosition?.width ?? 1),
                        height: Number.isFinite(all.height)
                          ? Math.max(1, all.height)
                          : Math.max(1, target.pixelPosition?.height ?? 1),
                        rotation: Number.isFinite(all.rotation)
                          ? all.rotation
                          : target.pixelPosition?.rotation ?? 0,
                      };

                      // Update in elements array
                      if (Array.isArray(newDoc.elements)) {
                        newDoc.elements = newDoc.elements.map((el) =>
                          el &&
                          ((el.self && el.self === target.self) ||
                            (!el.self && el.id === target.id))
                            ? {
                                ...el,
                                pixelPosition: {
                                  ...(el.pixelPosition || {}),
                                  ...nextPixelPosition,
                                },
                              }
                            : el
                        );
                      }

                      // Update in elementMap
                      if (newDoc.elementMap) {
                        const key = target.self || target.id;
                        if (key && newDoc.elementMap[key]) {
                          const el = newDoc.elementMap[key];
                          newDoc.elementMap[key] = {
                            ...el,
                            pixelPosition: {
                              ...(el.pixelPosition || {}),
                              ...nextPixelPosition,
                            },
                          };
                        }
                      }

                      // Update in elementsByPage for current page if present
                      if (
                        newDoc.elementsByPage &&
                        currentPage &&
                        newDoc.elementsByPage[currentPage.self]
                      ) {
                        newDoc.elementsByPage[currentPage.self] =
                          newDoc.elementsByPage[currentPage.self].map((el) => {
                            const isMatch =
                              el &&
                              ((el.self && el.self === target.self) ||
                                (!el.self && el.id === target.id));
                            return isMatch
                              ? {
                                  ...el,
                                  pixelPosition: {
                                    ...(el.pixelPosition || {}),
                                    ...nextPixelPosition,
                                  },
                                }
                              : el;
                          });
                      }

                      setDocumentData(newDoc);
                    }}
                    onApply={(draft) => {
                      const target = selectedElementId
                        ? pageElementById[selectedElementId] || null
                        : null;
                      if (target) {
                        // Map UI draft to story.styling (when story exists)
                        const mapAlign = (a) => {
                          switch (a) {
                            case "center":
                              return "CenterAlign";
                            case "right":
                              return "RightAlign";
                            case "justify":
                              return "FullyJustified";
                            case "left":
                              return "LeftAlign";
                            default:
                              return a || "LeftAlign";
                          }
                        };
                        const fontStyle =
                          [
                            draft.bold ? "Bold" : null,
                            draft.italic ? "Italic" : null,
                          ]
                            .filter(Boolean)
                            .join(" ") || "Regular";

                        const hexToRgbCss = (hex) => {
                          if (
                            !hex ||
                            typeof hex !== "string" ||
                            !hex.startsWith("#")
                          )
                            return hex;
                          const v = hex.replace("#", "");
                          const n =
                            v.length === 3
                              ? v
                                  .split("")
                                  .map((c) => c + c)
                                  .join("")
                              : v;
                          const r = parseInt(n.slice(0, 2), 16),
                            g = parseInt(n.slice(2, 4), 16),
                            b = parseInt(n.slice(4, 6), 16);
                          return `rgb(${r}, ${g}, ${b})`;
                        };

                        const newDoc = {
                          ...documentData,
                          stories: { ...documentData.stories },
                          elements: [...(documentData.elements || [])],
                          elementsByPage: {
                            ...(documentData.elementsByPage || {}),
                          },
                          elementMap: { ...(documentData.elementMap || {}) },
                        };
                        if (
                          target.parentStory &&
                          newDoc.stories[target.parentStory]
                        ) {
                          const prevStory =
                            newDoc.stories[target.parentStory] || {};
                          const prevStyling = prevStory.styling || {};

                          const stylingDelta = {};
                          // Compute diffs so we don't overwrite styling unless changed
                          if (
                            draft.fontFamily !== undefined &&
                            draft.fontFamily !== prevStyling.fontFamily
                          ) {
                            stylingDelta.fontFamily = draft.fontFamily;
                          }
                          if (
                            draft.fontSize !== undefined &&
                            draft.fontSize !== prevStyling.fontSize
                          ) {
                            stylingDelta.fontSize = draft.fontSize;
                          }
                          // Bold/Italic are combined into fontStyle
                          if (
                            (draft.bold !== undefined ||
                              draft.italic !== undefined) &&
                            fontStyle !== prevStyling.fontStyle
                          ) {
                            stylingDelta.fontStyle = fontStyle;
                          }
                          if (
                            draft.underline !== undefined &&
                            draft.underline !== prevStyling.underline
                          ) {
                            stylingDelta.underline = draft.underline;
                          }
                          if (draft.align !== undefined) {
                            const mapped = mapAlign(draft.align);
                            if (mapped !== prevStyling.alignment) {
                              stylingDelta.alignment = mapped;
                            }
                          }
                          if (draft.color !== undefined) {
                            const mappedColor = hexToRgbCss(draft.color);
                            if (mappedColor !== prevStyling.fillColor) {
                              stylingDelta.fillColor = mappedColor;
                            }
                          }
                          if (
                            draft.lineHeight !== undefined &&
                            draft.lineHeight !== prevStyling.effectiveLineHeight
                          ) {
                            stylingDelta.effectiveLineHeight = draft.lineHeight;
                          }

                          const didTextContentChange =
                            draft.content !== undefined &&
                            (draft.content ?? "") !== (prevStory.text ?? "");
                          const didStyleChange =
                            Object.keys(stylingDelta).length > 0;

                          if (didTextContentChange || didStyleChange) {
                            const nextStyling = {
                              ...prevStyling,
                              ...stylingDelta,
                            };

                            let updatedFormattedContent =
                              prevStory.formattedContent;
                            const baseFmt =
                              (Array.isArray(prevStory.formattedContent) &&
                                prevStory.formattedContent[0]?.formatting) ||
                              prevStyling ||
                              {};

                            const applyFmtDelta = (fmt) => ({
                              ...fmt,
                              ...(Object.prototype.hasOwnProperty.call(
                                stylingDelta,
                                "fontFamily"
                              ) && {
                                fontFamily: stylingDelta.fontFamily,
                              }),
                              ...(Object.prototype.hasOwnProperty.call(
                                stylingDelta,
                                "fontSize"
                              ) && {
                                fontSize: stylingDelta.fontSize,
                              }),
                              ...(Object.prototype.hasOwnProperty.call(
                                stylingDelta,
                                "fontStyle"
                              ) && {
                                fontStyle: stylingDelta.fontStyle,
                              }),
                              ...(Object.prototype.hasOwnProperty.call(
                                stylingDelta,
                                "alignment"
                              ) && {
                                alignment: stylingDelta.alignment,
                              }),
                              ...(Object.prototype.hasOwnProperty.call(
                                stylingDelta,
                                "fillColor"
                              ) && {
                                fillColor: stylingDelta.fillColor,
                              }),
                              ...(Object.prototype.hasOwnProperty.call(
                                stylingDelta,
                                "effectiveLineHeight"
                              ) && {
                                leading: stylingDelta.effectiveLineHeight,
                              }),
                              ...(Object.prototype.hasOwnProperty.call(
                                stylingDelta,
                                "underline"
                              ) && {
                                underline: stylingDelta.underline,
                              }),
                            });

                            if (
                              didTextContentChange ||
                              !Array.isArray(prevStory.formattedContent)
                            ) {
                              updatedFormattedContent = [
                                {
                                  text: draft.content ?? prevStory.text ?? "",
                                  formatting: applyFmtDelta(baseFmt),
                                },
                              ];
                            } else if (didStyleChange) {
                              updatedFormattedContent =
                                prevStory.formattedContent.map((seg, i) => {
                                  if (
                                    i !== 0 ||
                                    !seg ||
                                    typeof seg !== "object"
                                  )
                                    return seg;
                                  return {
                                    ...seg,
                                    formatting: applyFmtDelta(
                                      seg.formatting || {}
                                    ),
                                  };
                                });
                            }

                            newDoc.stories[target.parentStory] = {
                              ...prevStory,
                              text: didTextContentChange
                                ? draft.content ?? prevStory.text
                                : prevStory.text,
                              styling: nextStyling,
                              formattedContent: updatedFormattedContent,
                            };
                          }
                        }

                        // Apply frame (pixelPosition) changes on Apply as well
                        const nextPixelPosition = {
                          x: Number.isFinite(draft.x)
                            ? draft.x
                            : target.pixelPosition?.x ?? 0,
                          y: Number.isFinite(draft.y)
                            ? draft.y
                            : target.pixelPosition?.y ?? 0,
                          width: Number.isFinite(draft.width)
                            ? Math.max(1, draft.width)
                            : Math.max(1, target.pixelPosition?.width ?? 1),
                          height: Number.isFinite(draft.height)
                            ? Math.max(1, draft.height)
                            : Math.max(1, target.pixelPosition?.height ?? 1),
                          rotation: Number.isFinite(draft.rotation)
                            ? draft.rotation
                            : target.pixelPosition?.rotation ?? 0,
                        };

                        if (Array.isArray(newDoc.elements)) {
                          newDoc.elements = newDoc.elements.map((el) =>
                            el &&
                            ((el.self && el.self === target.self) ||
                              (!el.self && el.id === target.id))
                              ? {
                                  ...el,
                                  pixelPosition: {
                                    ...(el.pixelPosition || {}),
                                    ...nextPixelPosition,
                                  },
                                }
                              : el
                          );
                        }

                        if (newDoc.elementMap) {
                          const key = target.self || target.id;
                          if (key && newDoc.elementMap[key]) {
                            const el = newDoc.elementMap[key];
                            newDoc.elementMap[key] = {
                              ...el,
                              pixelPosition: {
                                ...(el.pixelPosition || {}),
                                ...nextPixelPosition,
                              },
                            };
                          }
                        }

                        if (
                          newDoc.elementsByPage &&
                          currentPage &&
                          newDoc.elementsByPage[currentPage.self]
                        ) {
                          newDoc.elementsByPage[currentPage.self] =
                            newDoc.elementsByPage[currentPage.self].map(
                              (el) => {
                                const isMatch =
                                  el &&
                                  ((el.self && el.self === target.self) ||
                                    (!el.self && el.id === target.id));
                                return isMatch
                                  ? {
                                      ...el,
                                      pixelPosition: {
                                        ...(el.pixelPosition || {}),
                                        ...nextPixelPosition,
                                      },
                                    }
                                  : el;
                              }
                            );
                        }

                        setDocumentData(newDoc);
                      }
                      // Keep editing active and panel open after apply
                      // setEditingElementId(null);
                    }}
                    onClose={() => {
                      setSelectedElementId(null);
                      setEditingElementId(null);
                    }}
                  />
                </div>
              </div>
            );
          })()}

          {/* NEW: Page Tabs - Moved below the document */}
          {/* Removed on-canvas page tabs to avoid duplicate pagination; left sidebar remains as the only pagination UI. */}

          {/* NEW: Jump to current page button */}
          {documentData.pages && documentData.pages.length > 1 && (
            <div
              style={{
                position: "fixed",
                bottom: "20px",
                right: "20px",
                zIndex: 1000,
              }}
            >
              <button
                onClick={() => {
                  document
                    .getElementById(`page-${currentPageIndex + 1}`)
                    ?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                }}
                style={{
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "50%",
                  width: "50px",
                  height: "50px",
                  fontSize: "20px",
                  cursor: "pointer",
                  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title="Jump to current page"
              >
                📄
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

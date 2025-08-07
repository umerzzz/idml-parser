import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import React from "react"; // Added missing import for React.Fragment
import { ColorUtils, InDesignTextMetrics } from "../../lib/index.js";

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
  TEXT_FITTING_STRATEGIES,
  getOptimalTextStyles,
  renderFormattedText,
  getStoryStyles,
  getInDesignAccurateFormatting,

  // Rendering
  getPagesArray,
  renderPageTabs,

  // Debug
  PageDebugPanel,

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
    selectedElement,
    setSelectedElement,
    showMargins,
    setShowMargins,
    showDebugInfo,
    setShowDebugInfo,
    currentPageIndex,
    setCurrentPageIndex,
    pages,
    setPages,
    elementsForCurrentPage,
    setElementsForCurrentPage,
    showPageDebugPanel,
    setShowPageDebugPanel,
    backgroundConfig,
    setBackgroundConfig,
    textFittingStrategy,
    setTextFittingStrategy,
  } = useViewerState();

  // Use custom hook for document loading
  const loadDocument = useDocumentLoader(uploadId, setDocumentData, setLoading);

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

  // NEW: Function to update elements for current page
  const updateElementsForCurrentPage = useCallback(() => {
    if (!documentData) return;

    // Generate missing mappings if they don't exist
    let pageElementIds = documentData.pageElementIds;
    let elementMap = documentData.elementMap;

    if (!pageElementIds || !elementMap) {
      // Create elementMap from elements array
      elementMap = {};
      if (documentData.elements && documentData.elements.length > 0) {
        documentData.elements.forEach((element) => {
          const elementId = element.id || element.self;
          if (elementId) {
            elementMap[elementId] = element;
          }
        });
      }

      // Create pageElementIds from elementsByPage or generate from elements
      pageElementIds = {};
      if (
        documentData.elementsByPage &&
        Object.keys(documentData.elementsByPage).length > 0
      ) {
        // Use existing elementsByPage structure
        Object.entries(documentData.elementsByPage).forEach(
          ([pageId, elements]) => {
            pageElementIds[pageId] = elements
              .map((el) => el.id || el.self)
              .filter(Boolean);
          }
        );
      } else if (documentData.pages && documentData.pages.length > 0) {
        // Generate from pages and elements with better distribution
        const allElementIds =
          documentData.elements
            ?.map((el) => el.id || el.self)
            .filter(Boolean) || [];

        if (allElementIds.length > 0) {
          // Initialize empty arrays for each page
          documentData.pages.forEach((page) => {
            if (page.self) {
              pageElementIds[page.self] = [];
            }
          });

          // Use spatial analysis to assign elements to pages
          allElementIds.forEach((elementId) => {
            const element = documentData.elements.find(
              (el) => (el.id || el.self) === elementId
            );
            if (!element) return;

            // Try to determine which page this element belongs to
            let targetPageId = null;

            // Method 1: Check if element has explicit pageId
            if (element.pageId) {
              targetPageId = element.pageId;
            }
            // Method 2: Use spatial analysis based on Y position
            else if (
              element.pixelPosition &&
              element.pixelPosition.y !== undefined
            ) {
              const elementY = element.pixelPosition.y;
              let bestPage = null;
              let bestDistance = Infinity;

              documentData.pages.forEach((page, pageIndex) => {
                // Estimate page Y position (simplified - assumes pages are stacked vertically)
                const pageHeight =
                  page.geometricBounds?.height ||
                  documentData.pageInfo?.dimensions?.pixelDimensions?.height ||
                  792;
                const estimatedPageY = pageIndex * pageHeight;
                const distance = Math.abs(elementY - estimatedPageY);

                if (distance < bestDistance) {
                  bestDistance = distance;
                  bestPage = page;
                }
              });

              if (bestPage) {
                targetPageId = bestPage.self;
              }
            }

            // Method 3: Fallback to first page if no spatial info
            if (!targetPageId && documentData.pages.length > 0) {
              targetPageId = documentData.pages[0].self;
            }

            // Add element to the target page
            if (targetPageId && pageElementIds[targetPageId]) {
              pageElementIds[targetPageId].push(elementId);
            }
          });

          // Log the distribution
          documentData.pages.forEach((page, pageIndex) => {
            if (page.self) {
              // Page element count logged
            }
          });
        } else {
          // If no elements, create empty arrays for each page
          documentData.pages.forEach((page) => {
            if (page.self) {
              pageElementIds[page.self] = [];
            }
          });
        }
      }
    }

    // Use centralized function to get elements for current page
    if (documentData.pages && documentData.pages.length > 0) {
      const currentPage = documentData.pages[currentPageIndex];
      if (currentPage && currentPage.self) {
        const pageElements = getElementsForPage(currentPage.self, documentData);
        setElementsForCurrentPage(pageElements);
      } else {
        // Fallback to all elements if page not found
        setElementsForCurrentPage(documentData.elements || []);
      }
    } else {
      // Fallback to all elements if no pages data
      setElementsForCurrentPage(documentData.elements || []);
    }
  }, [documentData, currentPageIndex]);

  // NEW: Multi-page effect handlers
  useEffect(() => {
    if (documentData) {
      // Set up pages
      const pagesData = documentData.pages || [];
      setPages(pagesData);

      // Update elements for the current page
      updateElementsForCurrentPage();
    }
  }, [documentData, currentPageIndex, updateElementsForCurrentPage]);

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
      {/* Enhanced Sidebar with Multi-page Support */}
      <div
        style={{
          width: "400px", // PRESERVED: Original sidebar width
          backgroundColor: "#f5f5f5",
          padding: "20px",
          overflowY: "auto",
        }}
      >
        {/* NEW: Document Info Section with Page Support */}
        <div
          style={{
            marginBottom: "20px",
            padding: "10px",
            backgroundColor: "#f5f5f5",
            borderRadius: "4px",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0" }}>Document Info</h3>
          <strong>Name:</strong> {documentData.document?.name || "Untitled"}
          <br />
          <strong>Version:</strong>{" "}
          {documentData.document?.version || "Unknown"}
          <br />
          <strong>Pages:</strong> {documentData.document?.pageCount || 1}
          <br />
          <strong>Size:</strong>{" "}
          {Math.round(
            documentData.pageInfo?.dimensions?.pixelDimensions?.width ||
              documentData.pageInfo?.dimensions?.width ||
              0
          )}{" "}
          ×{" "}
          {Math.round(
            documentData.pageInfo?.dimensions?.pixelDimensions?.height ||
              documentData.pageInfo?.dimensions?.height ||
              0
          )}
          px
          <br />
          <strong>Original Units:</strong>{" "}
          {documentData.pageInfo?.dimensions?.units || "Unknown"}
          {/* NEW: Page information */}
          {documentData.pages && documentData.pages.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <strong>Current Page:</strong> {currentPageIndex + 1} of{" "}
              {documentData.pages.length}
            </div>
          )}
        </div>

        {/* PRESERVED: Text Fitting Strategy Selector */}
        <div
          style={{
            backgroundColor: "#e3f2fd",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "16px",
            border: "1px solid #2196f3",
          }}
        >
          <h4
            style={{ margin: "0 0 8px 0", color: "#1976d2", fontSize: "14px" }}
          >
            🎯 Text Fitting Strategy
          </h4>
          <select
            value={textFittingStrategy}
            onChange={(e) => setTextFittingStrategy(e.target.value)}
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "12px",
            }}
          >
            <option value={TEXT_FITTING_STRATEGIES.PRECISE_FIT}>
              🎯 Precise Fit (InDesign-style)
            </option>
            <option value={TEXT_FITTING_STRATEGIES.AUTO_SCALE}>
              📏 Auto Scale Font
            </option>
            <option value={TEXT_FITTING_STRATEGIES.TRUNCATE}>
              ✂️ Truncate with Ellipsis
            </option>
            <option value={TEXT_FITTING_STRATEGIES.COMPRESS_LINES}>
              📊 Compress Line Height
            </option>
            <option value={TEXT_FITTING_STRATEGIES.ALLOW_OVERFLOW}>
              🌊 Allow Overflow
            </option>
          </select>
          <div style={{ fontSize: "10px", color: "#666", marginTop: "4px" }}>
            {textFittingStrategy === TEXT_FITTING_STRATEGIES.PRECISE_FIT &&
              "Smart font & line height adjustment with truncation fallback"}
            {textFittingStrategy === TEXT_FITTING_STRATEGIES.AUTO_SCALE &&
              "Reduce font size proportionally to fit container"}
            {textFittingStrategy === TEXT_FITTING_STRATEGIES.TRUNCATE &&
              "Cut off text with ellipsis when it overflows"}
            {textFittingStrategy === TEXT_FITTING_STRATEGIES.COMPRESS_LINES &&
              "Reduce line height first, then font size"}
            {textFittingStrategy === TEXT_FITTING_STRATEGIES.ALLOW_OVERFLOW &&
              "Let text overflow naturally (original behavior)"}
          </div>
        </div>

        {/* PRESERVED: Background Color Configuration */}
        <div
          style={{
            backgroundColor: "#fff3e0",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "16px",
            border: "1px solid #ff9800",
          }}
        >
          <h4
            style={{ margin: "0 0 8px 0", color: "#f57700", fontSize: "14px" }}
          >
            🎨 Background Color
          </h4>

          <select
            value={backgroundConfig.mode}
            onChange={(e) =>
              setBackgroundConfig({ ...backgroundConfig, mode: e.target.value })
            }
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              fontSize: "12px",
              marginBottom: "8px",
            }}
          >
            {backgroundModes.map((mode) => (
              <option key={mode.value} value={mode.value}>
                {mode.label}
              </option>
            ))}
          </select>

          {backgroundConfig.mode === "custom" && (
            <div style={{ marginBottom: "8px" }}>
              <label
                style={{
                  fontSize: "11px",
                  color: "#666",
                  display: "block",
                  marginBottom: "4px",
                }}
              >
                Custom Color:
              </label>
              <input
                type="color"
                value={backgroundConfig.customColor}
                onChange={(e) =>
                  setBackgroundConfig({
                    ...backgroundConfig,
                    customColor: e.target.value,
                  })
                }
                style={{
                  width: "100%",
                  height: "30px",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>
          )}

          {backgroundConfig.mode === "auto" && (
            <div style={{ fontSize: "11px", marginTop: "8px" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <input
                  type="checkbox"
                  checked={backgroundConfig.preferPaperColor}
                  onChange={(e) =>
                    setBackgroundConfig({
                      ...backgroundConfig,
                      preferPaperColor: e.target.checked,
                    })
                  }
                  style={{ marginRight: "6px" }}
                />
                Prefer Paper color
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginBottom: "4px",
                }}
              >
                <input
                  type="checkbox"
                  checked={backgroundConfig.allowColorAnalysis}
                  onChange={(e) =>
                    setBackgroundConfig({
                      ...backgroundConfig,
                      allowColorAnalysis: e.target.checked,
                    })
                  }
                  style={{ marginRight: "6px" }}
                />
                Allow color analysis
              </label>
              <label style={{ display: "flex", alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={backgroundConfig.fallbackToWhite}
                  onChange={(e) =>
                    setBackgroundConfig({
                      ...backgroundConfig,
                      fallbackToWhite: e.target.checked,
                    })
                  }
                  style={{ marginRight: "6px" }}
                />
                Fallback to white
              </label>
            </div>
          )}

          <div
            style={{
              marginTop: "8px",
              padding: "6px",
              backgroundColor: "#f5f5f5",
              borderRadius: "3px",
              fontSize: "11px",
            }}
          >
            <strong>Current:</strong>{" "}
            {documentData
              ? importedGetDocumentBackgroundColor(
                  documentData,
                  backgroundConfig,
                  utils.convertColor
                )
              : "Loading..."}
          </div>
        </div>

        {/* ENHANCED: View Controls with Page Debug */}
        <div
          style={{
            backgroundColor: "#f0f8ff",
            padding: "12px",
            borderRadius: "4px",
            marginBottom: "16px",
          }}
        >
          <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#333" }}>
            🔧 View Controls
          </h4>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: "12px",
              }}
            >
              <input
                type="checkbox"
                checked={showMargins}
                onChange={(e) => setShowMargins(e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Show Page Margins (dotted lines)
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: "12px",
              }}
            >
              <input
                type="checkbox"
                checked={showDebugInfo}
                onChange={(e) => setShowDebugInfo(e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Show Debug Information
            </label>

            {/* NEW: Page Debug Panel Toggle */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                fontSize: "12px",
              }}
            >
              <input
                type="checkbox"
                checked={showPageDebugPanel}
                onChange={(e) => setShowPageDebugPanel(e.target.checked)}
                style={{ marginRight: "8px" }}
              />
              Show Page Debug Panel
            </label>
          </div>
        </div>

        {/* PRESERVED: Status Indicators Legend */}
        <div
          style={{
            backgroundColor: "#f9f9f9",
            padding: "8px",
            borderRadius: "4px",
            marginBottom: "16px",
            fontSize: "11px",
          }}
        >
          <div style={{ fontWeight: "bold", marginBottom: "6px" }}>
            📊 Status Indicators:
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <span
                style={{
                  backgroundColor: "#4caf50",
                  color: "white",
                  padding: "1px 3px",
                  borderRadius: "2px",
                }}
              >
                🎯
              </span>
              Precise Fit
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <span
                style={{
                  backgroundColor: "#2196f3",
                  color: "white",
                  padding: "1px 3px",
                  borderRadius: "2px",
                }}
              >
                📏
              </span>
              Font Scaled
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <span
                style={{
                  backgroundColor: "#ff9800",
                  color: "white",
                  padding: "1px 3px",
                  borderRadius: "2px",
                }}
              >
                ✂️
              </span>
              Truncated
            </span>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "4px",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <span
                style={{
                  backgroundColor: "#f44336",
                  color: "white",
                  padding: "1px 2px",
                  borderRadius: "1px",
                  fontSize: "9px",
                }}
              >
                S
              </span>
              Severe overflow
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <span
                style={{
                  backgroundColor: "#ff9800",
                  color: "white",
                  padding: "1px 2px",
                  borderRadius: "1px",
                  fontSize: "9px",
                }}
              >
                M
              </span>
              Moderate
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              <span
                style={{
                  backgroundColor: "#ffeb3b",
                  color: "black",
                  padding: "1px 2px",
                  borderRadius: "1px",
                  fontSize: "9px",
                }}
              >
                L
              </span>
              Light
            </span>
          </div>
        </div>

        {/* PRESERVED: All other sidebar sections (Unit Conversion Info, Positioning Debug Info, Package Info, Elements list, Stories & Formatting) */}
        {/* Unit Conversion Info */}
        {documentData.unitConversion && (
          <div
            style={{
              marginTop: "10px",
              padding: "8px",
              backgroundColor: "#e8f4fd",
              borderRadius: "4px",
              fontSize: "12px",
            }}
          >
            <strong>📐 Unit Conversion:</strong>
            <br />
            Status:{" "}
            {documentData.unitConversion.enabled ? "✅ Enabled" : "❌ Disabled"}
            <br />
            DPI: {documentData.unitConversion.dpi}
            <br />
            Original: {documentData.unitConversion.originalUnits} → Pixels
            {documentData.unitConversion.convertedToPixels && (
              <span style={{ color: "#28a745", fontWeight: "bold" }}> ✅</span>
            )}
          </div>
        )}

        {/* Positioning Debug Info */}
        {documentData.pageInfo?.margins && (
          <div
            style={{
              marginTop: "10px",
              padding: "8px",
              backgroundColor: "#fff3cd",
              borderRadius: "4px",
              fontSize: "11px",
            }}
          >
            <strong>📏 Positioning Debug:</strong>
            <br />
            Page:{" "}
            {Math.round(
              documentData.pageInfo.dimensions?.pixelDimensions?.width ||
                documentData.pageInfo.dimensions?.width ||
                0
            )}{" "}
            ×{" "}
            {Math.round(
              documentData.pageInfo.dimensions?.pixelDimensions?.height ||
                documentData.pageInfo.dimensions?.height ||
                0
            )}
            px
            <br />
            Margins (px): T:
            {documentData.pageInfo.margins.pixelMargins?.top ||
              documentData.pageInfo.margins.top ||
              0}
            R:
            {documentData.pageInfo.margins.pixelMargins?.right ||
              documentData.pageInfo.margins.right ||
              0}
            B:
            {documentData.pageInfo.margins.pixelMargins?.bottom ||
              documentData.pageInfo.margins.bottom ||
              0}
            L:
            {documentData.pageInfo.margins.pixelMargins?.left ||
              documentData.pageInfo.margins.left ||
              0}
            <br />
            Content Area:{" "}
            {Math.round(
              (documentData.pageInfo.dimensions?.pixelDimensions?.width ||
                documentData.pageInfo.dimensions?.width ||
                0) -
                (documentData.pageInfo.margins.pixelMargins?.left ||
                  documentData.pageInfo.margins.left ||
                  0) -
                (documentData.pageInfo.margins.pixelMargins?.right ||
                  documentData.pageInfo.margins.right ||
                  0)
            )}{" "}
            ×{" "}
            {Math.round(
              (documentData.pageInfo.dimensions?.pixelDimensions?.height ||
                documentData.pageInfo.dimensions?.height ||
                0) -
                (documentData.pageInfo.margins.pixelMargins?.top ||
                  documentData.pageInfo.margins.top ||
                  0) -
                (documentData.pageInfo.margins.pixelMargins?.bottom ||
                  documentData.pageInfo.margins.bottom ||
                  0)
            )}
            px
          </div>
        )}
        {/* Package Info */}
        {documentData.packageInfo && (
          <div
            style={{
              marginTop: "10px",
              padding: "8px",
              backgroundColor: "#e9ecef",
              borderRadius: "4px",
            }}
          >
            <strong>Package Info:</strong>
            <br />
            Links: {documentData.packageInfo.linksCount}{" "}
            {documentData.packageInfo.hasLinks ? "✅" : "❌"}
            <br />
            Fonts: {documentData.packageInfo.fontsCount}{" "}
            {documentData.packageInfo.hasFonts ? "✅" : "❌"}
          </div>
        )}

        <h3 style={{ marginTop: "20px" }}>
          Elements ({elementsForCurrentPage.length || 0})
        </h3>
        {elementsForCurrentPage.map((element, index) => (
          <div
            key={`debug-${element.id}-${index}`}
            onClick={() => setSelectedElement(element)}
            style={{
              padding: "8px",
              margin: "4px 0",
              backgroundColor:
                selectedElement?.id === element.id ? "#007bff" : "white",
              color: selectedElement?.id === element.id ? "white" : "black",
              border: "1px solid #ddd",
              cursor: "pointer",
              fontSize: "12px",
            }}
          >
            <strong>{element.type}</strong> ({element.id})
            <br />
            {element.name !== "$ID/"
              ? element.name
              : `${element.type}_${element.id}`}
            <br />
            Pos: ({Math.round(
              (element.pixelPosition || element.position).x
            )}, {Math.round((element.pixelPosition || element.position).y)})px
            <br />
            Size:{" "}
            {Math.round(
              (element.pixelPosition || element.position).width
            )} ×{" "}
            {Math.round((element.pixelPosition || element.position).height)}px
            {element.isContentFrame && (
              <>
                <br />
                <span style={{ color: "#ffc107" }}>🖼️ Content Frame</span>
                {element.placedContent && (
                  <>
                    <br />
                    <span style={{ fontSize: "10px", color: "#6c757d" }}>
                      Type: {element.placedContent.imageTypeName}
                      <br />
                      PPI: {element.placedContent.actualPpi} →{" "}
                      {element.placedContent.effectivePpi}
                      <br />
                      Scale:{" "}
                      {Math.round(
                        (element.placedContent.transform?.a || 1) * 100
                      )}
                      %
                    </span>
                  </>
                )}
              </>
            )}
            {element.parentStory && (
              <>
                <br />
                <span style={{ color: "#17a2b8" }}>
                  📝 Story: {element.parentStory}
                </span>
              </>
            )}
          </div>
        ))}

        <h3 style={{ marginTop: "20px" }}>Stories & Formatting</h3>
        {/* Only show stories for elements on the current page */}
        {(() => {
          const storyIds = new Set(
            elementsForCurrentPage.map((el) => el.parentStory).filter(Boolean)
          );
          return Array.from(storyIds).map((storyId) => {
            const story = documentData.stories[storyId];
            if (!story) return null;
            return (
              <div
                key={storyId}
                style={{
                  padding: "8px",
                  margin: "4px 0",
                  backgroundColor: "white",
                  border: "1px solid #ddd",
                  fontSize: "12px",
                }}
              >
                <strong>{storyId}</strong>
                <br />
                <strong>Text:</strong> "{story.text?.substring(0, 50) || ""}..."
                <br />
                <strong>Words:</strong> {story.wordCount} |{" "}
                <strong>Chars:</strong> {story.characterCount}
                {/* Font Information */}
                {story.styling && (
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "4px",
                      backgroundColor: "#f8f9fa",
                      borderRadius: "2px",
                    }}
                  >
                    <strong>Styling:</strong>
                    <br />
                    Font: {story.styling.fontFamily} {story.styling.fontStyle}
                    <br />
                    Size: {story.styling.fontSize}px
                    <br />
                    Align: {story.styling.alignment}
                    <br />
                    Color:{" "}
                    <span
                      style={{
                        backgroundColor: utils.convertColor(
                          story.styling.fillColor
                        ),
                        padding: "2px 4px",
                        color: "white",
                        fontSize: "10px",
                        borderRadius: "2px",
                      }}
                    >
                      {story.styling.fillColor}
                    </span>
                  </div>
                )}
                {/* Formatted Content Preview */}
                {story.formattedContent &&
                  story.formattedContent.length > 1 && (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "4px",
                        backgroundColor: "#fff3cd",
                        borderRadius: "2px",
                      }}
                    >
                      <strong>Rich Formatting:</strong>{" "}
                      {story.formattedContent.length} segments
                      <br />
                      Line Breaks: {story.lineBreakCount}
                    </div>
                  )}
              </div>
            );
          });
        })()}
      </div>

      {/* NEW: Main Content Area with Multi-page Support */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* Enhanced Canvas with Single Page Display */}
        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            padding: "20px",
            overflow: "auto",
            backgroundColor: "#e9ecef",
          }}
        >
          {/* NEW: Render only the current page */}
          {(() => {
            const pagesArray = getPagesArray(documentData);
            const currentPage = pagesArray[currentPageIndex];
            const pageElements = getElementsForPage(
              currentPage.id,
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

            // DEBUG: Check if page elements have linked images
            if (
              pageElementsForRendering &&
              pageElementsForRendering.length > 0
            ) {
              const pageElementsWithLinkedImages =
                pageElementsForRendering.filter((el) => el.linkedImage);
              // Page elements with linked images analysis completed
            }

            return (
              <div
                key={currentPage.self}
                id={`page-${currentPageIndex + 1}`}
                style={{
                  position: "relative",
                  width: currentPage.geometricBounds
                    ? `${currentPage.geometricBounds.width}px`
                    : (documentData.pageInfo?.dimensions?.pixelDimensions
                        ?.width ||
                        documentData.pageInfo?.dimensions?.width ||
                        612) + "px",
                  boxShadow: "0 0 0 2px #007bff, 0 5px 15px rgba(0,0,0,0.2)",
                }}
              >
                {/* Page number indicator */}
                <div
                  style={{
                    position: "absolute",
                    top: "-25px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "#007bff",
                    color: "white",
                    padding: "2px 10px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    zIndex: 10,
                  }}
                >
                  Page {currentPageIndex + 1} of {pagesArray.length}
                </div>

                {/* Page Canvas */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: currentPage.geometricBounds
                      ? `${currentPage.geometricBounds.height}px`
                      : (documentData.pageInfo?.dimensions?.pixelDimensions
                          ?.height ||
                          documentData.pageInfo?.dimensions?.height ||
                          792) + "px",
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
                  {pageElementsForRendering.map((element, index) => {
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

                    if (showDebugInfo) {
                      // Element positioning debug info
                    }

                    return (
                      <div
                        key={`render-${element.id}-${index}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElement(element);
                        }}
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
                          border:
                            selectedElement?.id === element.id
                              ? "2px solid #007bff"
                              : isContentFrame
                              ? "2px solid #00aaff"
                              : element.name === "Bulleted List"
                              ? "2px solid #d63384"
                              : element.name === "Numbered List"
                              ? "2px solid #0d6efd"
                              : element.type === "TextFrame"
                              ? "1px solid #ff6b6b"
                              : "1px dashed rgba(0,0,0,0.3)",
                          cursor: "pointer",
                          overflow: "hidden",
                          transform: elementPosition.rotation
                            ? `rotate(${elementPosition.rotation}deg)`
                            : "none",
                          transformOrigin: "top left",
                          boxSizing: "border-box",
                          zIndex:
                            element.type === "TextFrame" ||
                            element.name === "Bulleted List" ||
                            element.name === "Numbered List"
                              ? 10
                              : 1,
                          maxWidth: "100%",
                          maxHeight: "100%",
                        }}
                      >
                        {/* PRESERVED: Debug position label */}
                        {showDebugInfo && (
                          <div
                            style={{
                              position: "absolute",
                              top: "-20px",
                              left: "0px",
                              fontSize: "10px",
                              background: wasConstrained
                                ? "rgba(255, 0, 0, 0.8)"
                                : "rgba(255, 255, 0, 0.8)",
                              padding: "2px 4px",
                              borderRadius: "2px",
                              pointerEvents: "none",
                              zIndex: 1000,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {element.id}: ({Math.round(elementPosition.x)},{" "}
                            {Math.round(elementPosition.y)}){" "}
                            {wasConstrained ? "⚠️" : ""}
                          </div>
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
                              🖼️ Embedded Image
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
                                return `${baseInfo}\nText fits perfectly! ✅`;
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
                                justifyContent = "stretch";
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
                                    return (
                                      <span
                                        style={{
                                          display: "inline",
                                          whiteSpace: "pre-wrap",
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
                                      </span>
                                    );
                                  }
                                })()}

                                {/* Enhanced Status Indicators */}
                                {wasAdjusted && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "-2px",
                                      left: "-2px",
                                      backgroundColor:
                                        adjustmentDetails?.stillOverflows
                                          ? "#ff5722"
                                          : "#4caf50",
                                      color: "white",
                                      fontSize: "8px",
                                      padding: "1px 3px",
                                      borderRadius: "2px",
                                      zIndex: 1000,
                                      pointerEvents: "none",
                                      fontFamily: "monospace",
                                    }}
                                  >
                                    {adjustmentDetails?.stillOverflows
                                      ? "⚠️"
                                      : "🎯"}
                                  </div>
                                )}

                                {/* Perfect fit indicator */}
                                {!wasAdjusted &&
                                  !textMeasurement.willOverflow && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: "-2px",
                                        right: "-2px",
                                        backgroundColor: "#2e7d32",
                                        color: "white",
                                        fontSize: "8px",
                                        padding: "1px 3px",
                                        borderRadius: "2px",
                                        zIndex: 1000,
                                        pointerEvents: "none",
                                        fontFamily: "monospace",
                                      }}
                                    >
                                      ✅
                                    </div>
                                  )}
                              </div>
                            );
                          })()}

                        {/* Image Rendering */}
                        {element.linkedImage && element.linkedImage.url && (
                          <>
                            {/* Debug info */}
                            {showDebugInfo && (
                              <div
                                style={{
                                  position: "absolute",
                                  top: "2px",
                                  left: "2px",
                                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                                  color: "white",
                                  fontSize: "8px",
                                  padding: "2px",
                                  zIndex: 1001,
                                  fontFamily: "monospace",
                                }}
                              >
                                🖼️ {element.linkedImage.fileName}
                                <br />
                                {element.linkedImage.url}
                              </div>
                            )}
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
                              🖼️ Content Frame
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
                </div>
              </div>
            );
          })()}

          {/* NEW: Page Tabs - Moved below the document */}
          {renderPageTabs(
            documentData,
            currentPageIndex,
            setCurrentPageIndex,
            setSelectedElement,
            getElementsForPage,
            utils,
            backgroundConfig,
            importedGetPageBackgroundColor,
            importedGetDocumentBackgroundColor
          )}

          {/* PRESERVED: Enhanced Selection Info Panel */}
          {selectedElement && (
            <div
              style={{
                position: "fixed",
                top: "80px",
                right: "20px",
                backgroundColor: "rgba(0, 123, 255, 0.95)",
                color: "white",
                padding: "12px",
                borderRadius: "6px",
                fontSize: "12px",
                maxWidth: "300px",
                lineHeight: "1.4",
                zIndex: 1000,
              }}
            >
              <strong>{selectedElement.type}</strong> ({selectedElement.id})
              <br />
              <strong>Position:</strong> (
              {Math.round(
                (selectedElement.pixelPosition || selectedElement.position).x
              )}
              ,{" "}
              {Math.round(
                (selectedElement.pixelPosition || selectedElement.position).y
              )}
              )px
              <br />
              <strong>Size:</strong>{" "}
              {Math.round(
                (selectedElement.pixelPosition || selectedElement.position)
                  .width
              )}{" "}
              ×{" "}
              {Math.round(
                (selectedElement.pixelPosition || selectedElement.position)
                  .height
              )}
              px
              {selectedElement.isContentFrame && (
                <>
                  <br />
                  <strong>🖼️ Content Frame</strong>
                  {selectedElement.placedContent && (
                    <>
                      <br />
                      <strong>Content:</strong>{" "}
                      {selectedElement.placedContent.imageTypeName}
                      <br />
                      <strong>PPI:</strong>{" "}
                      {selectedElement.placedContent.actualPpi} →{" "}
                      {selectedElement.placedContent.effectivePpi}
                      <br />
                      <strong>Scale:</strong>{" "}
                      {Math.round(
                        (selectedElement.placedContent.transform?.a || 1) * 100
                      )}
                      % ×{" "}
                      {Math.round(
                        (selectedElement.placedContent.transform?.d || 1) * 100
                      )}
                      %
                    </>
                  )}
                </>
              )}
              {selectedElement.parentStory &&
                documentData.stories[selectedElement.parentStory] && (
                  <>
                    <br />
                    <strong>📝 Text Story:</strong>
                    <br />
                    <strong>Font:</strong>{" "}
                    {
                      documentData.stories[selectedElement.parentStory].styling
                        ?.fontFamily
                    }{" "}
                    {
                      documentData.stories[selectedElement.parentStory].styling
                        ?.fontStyle
                    }
                    <br />
                    <strong>Size:</strong>{" "}
                    {
                      documentData.stories[selectedElement.parentStory].styling
                        ?.fontSize
                    }
                    px
                    <br />
                    <strong>Words:</strong>{" "}
                    {
                      documentData.stories[selectedElement.parentStory]
                        .wordCount
                    }
                  </>
                )}
              {selectedElement.linkedImage?.isEmbedded && (
                <>
                  <br />
                  <strong>📎 Embedded Image:</strong>
                  <br />
                  <strong>Type:</strong>{" "}
                  {selectedElement.linkedImage.embeddedType}
                  <br />
                  <strong>Data:</strong>{" "}
                  {selectedElement.linkedImage.embeddedData}
                </>
              )}
              {selectedElement.linkedImage?.isPlaceholder && (
                <>
                  <br />
                  <strong>📋 Image Placeholder</strong>
                </>
              )}
              {/* Close button */}
              <button
                onClick={() => setSelectedElement(null)}
                style={{
                  position: "absolute",
                  top: "5px",
                  right: "5px",
                  background: "none",
                  border: "none",
                  color: "white",
                  fontSize: "14px",
                  cursor: "pointer",
                  padding: "2px 6px",
                }}
              >
                ✕
              </button>
            </div>
          )}

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

      {/* NEW: Debug Panel */}
      <PageDebugPanel
        showPageDebugPanel={showPageDebugPanel}
        documentData={documentData}
        uploadId={uploadId}
        currentPageIndex={currentPageIndex}
        elementsForCurrentPage={elementsForCurrentPage}
        setShowPageDebugPanel={setShowPageDebugPanel}
      />

      {/* NEW: Element Organization Debug Panel */}
      {showDebugInfo && documentData && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "20px",
            backgroundColor: "rgba(0, 0, 0, 0.9)",
            color: "white",
            padding: "15px",
            borderRadius: "8px",
            fontSize: "12px",
            maxWidth: "400px",
            maxHeight: "300px",
            overflow: "auto",
            zIndex: 1000,
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", color: "#00ff00" }}>
            🔍 Element Organization Debug
          </h4>
          <div>
            <strong>Total Elements:</strong>{" "}
            {documentData.elements?.length ||
              Object.keys(documentData.elementMap || {}).length}
            <br />
            <strong>Pages:</strong> {documentData.pages?.length || 0}
            <br />
            <strong>Elements by Page:</strong>
            {(() => {
              // Generate mappings if they don't exist
              let pageElementIds = documentData.pageElementIds;
              let elementMap = documentData.elementMap;

              if (!pageElementIds || !elementMap) {
                // Create elementMap from elements array
                elementMap = {};
                if (documentData.elements && documentData.elements.length > 0) {
                  documentData.elements.forEach((element) => {
                    const elementId = element.id || element.self;
                    if (elementId) {
                      elementMap[elementId] = element;
                    }
                  });
                }

                // Create pageElementIds from elementsByPage or generate from elements
                pageElementIds = {};
                if (
                  documentData.elementsByPage &&
                  Object.keys(documentData.elementsByPage).length > 0
                ) {
                  Object.entries(documentData.elementsByPage).forEach(
                    ([pageId, elements]) => {
                      pageElementIds[pageId] = elements
                        .map((el) => el.id || el.self)
                        .filter(Boolean);
                    }
                  );
                } else if (
                  documentData.pages &&
                  documentData.pages.length > 0
                ) {
                  // Generate from pages and elements with better distribution
                  const allElementIds =
                    documentData.elements
                      ?.map((el) => el.id || el.self)
                      .filter(Boolean) || [];

                  if (allElementIds.length > 0) {
                    // Initialize empty arrays for each page
                    documentData.pages.forEach((page) => {
                      if (page.self) {
                        pageElementIds[page.self] = [];
                      }
                    });

                    // Use spatial analysis to assign elements to pages
                    allElementIds.forEach((elementId) => {
                      const element = documentData.elements.find(
                        (el) => (el.id || el.self) === elementId
                      );
                      if (!element) return;

                      // Try to determine which page this element belongs to
                      let targetPageId = null;

                      // Method 1: Check if element has explicit pageId
                      if (element.pageId) {
                        targetPageId = element.pageId;
                      }
                      // Method 2: Use spatial analysis based on Y position
                      else if (
                        element.pixelPosition &&
                        element.pixelPosition.y !== undefined
                      ) {
                        const elementY = element.pixelPosition.y;
                        let bestPage = null;
                        let bestDistance = Infinity;

                        documentData.pages.forEach((page, pageIndex) => {
                          // Estimate page Y position (simplified - assumes pages are stacked vertically)
                          const pageHeight =
                            page.geometricBounds?.height ||
                            documentData.pageInfo?.dimensions?.pixelDimensions
                              ?.height ||
                            792;
                          const estimatedPageY = pageIndex * pageHeight;
                          const distance = Math.abs(elementY - estimatedPageY);

                          if (distance < bestDistance) {
                            bestDistance = distance;
                            bestPage = page;
                          }
                        });

                        if (bestPage) {
                          targetPageId = bestPage.self;
                        }
                      }

                      // Method 3: Fallback to first page if no spatial info
                      if (!targetPageId && documentData.pages.length > 0) {
                        targetPageId = documentData.pages[0].self;
                      }

                      // Add element to the target page
                      if (targetPageId && pageElementIds[targetPageId]) {
                        pageElementIds[targetPageId].push(elementId);
                      }
                    });
                  } else {
                    // If no elements, create empty arrays for each page
                    documentData.pages.forEach((page) => {
                      if (page.self) {
                        pageElementIds[page.self] = [];
                      }
                    });
                  }
                }
              }

              return (
                pageElementIds &&
                Object.entries(pageElementIds).map(([pageId, elementIds]) => (
                  <div
                    key={pageId}
                    style={{ marginLeft: "10px", marginTop: "5px" }}
                  >
                    📄 {pageId}: {elementIds.length} elements
                    {elementIds.slice(0, 3).map((elId) => {
                      const el = elementMap[elId];
                      return (
                        <div
                          key={elId}
                          style={{
                            marginLeft: "15px",
                            fontSize: "10px",
                            color: "#ccc",
                          }}
                        >
                          • {el?.type || "?"} ({elId}) - pageId:{" "}
                          {el?.pageId || "none"}
                        </div>
                      );
                    })}
                    {elementIds.length > 3 && (
                      <div
                        style={{
                          marginLeft: "15px",
                          fontSize: "10px",
                          color: "#ccc",
                        }}
                      >
                        ... and {elementIds.length - 3} more
                      </div>
                    )}
                  </div>
                ))
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

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
  getOptimalTextStyles,
  renderFormattedText,
  getStoryStyles,
  getInDesignAccurateFormatting,

  // Rendering
  getPagesArray,
  renderPageTabs,

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

                    return (
                      <div
                        key={`render-${element.id}-${index}`}
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
                          border: "none",
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
                </div>
              </div>
            );
          })()}

          {/* NEW: Page Tabs - Moved below the document */}
          {renderPageTabs(
            documentData,
            currentPageIndex,
            setCurrentPageIndex,
            getElementsForPage,
            utils,
            backgroundConfig,
            importedGetPageBackgroundColor,
            importedGetDocumentBackgroundColor
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
    </div>
  );
}

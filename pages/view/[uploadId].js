import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import React from "react"; // Added missing import for React.Fragment
import { ColorUtils, InDesignTextMetrics } from "../../lib/index.js";

export default function Viewer() {
  const router = useRouter();
  const { uploadId } = router.query;
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showMargins, setShowMargins] = useState(true);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  // NEW: Multi-page state management
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pages, setPages] = useState([]);
  const [elementsForCurrentPage, setElementsForCurrentPage] = useState([]);
  const [showPageDebugPanel, setShowPageDebugPanel] = useState(false);

  // Add debug log to verify ColorUtils is imported correctly - NEW
  console.log("ColorUtils imported:", !!ColorUtils, typeof ColorUtils);
  console.log(
    "ColorUtils methods:",
    ColorUtils
      ? Object.getOwnPropertyNames(ColorUtils).filter(
          (name) => typeof ColorUtils[name] === "function"
        )
      : "Not available"
  );

  // CONFIGURATION OPTIONS - Make background detection flexible
  const [backgroundConfig, setBackgroundConfig] = useState({
    mode: "auto", // 'auto', 'white', 'custom', 'transparent'
    customColor: "#ffffff",
    allowColorAnalysis: true,
    preferPaperColor: true,
    fallbackToWhite: true,
  });

  // Background color override controls
  const backgroundModes = [
    { value: "auto", label: "Auto Detect" },
    { value: "white", label: "Force White" },
    { value: "transparent", label: "Transparent" },
    { value: "custom", label: "Custom Color" },
  ];

  const mmToPx = (mm) => {
    if (typeof mm !== "number") return 0;
    return (mm * 96) / 25.4;
  };

  // Centralized function to get elements for a specific page
  const getElementsForPage = useCallback((pageId, documentData) => {
    if (!documentData || !pageId) return [];

    // First try to use existing pageElementIds if available
    if (documentData.pageElementIds && documentData.pageElementIds[pageId]) {
      const elementIds = documentData.pageElementIds[pageId];
      return elementIds
        .map((id) => documentData.elementMap?.[id])
        .filter(Boolean);
    }

    // Fallback to elementsByPage if available (this should now be correct from backend)
    if (documentData.elementsByPage && documentData.elementsByPage[pageId]) {
      return documentData.elementsByPage[pageId];
    }

    // If neither exists, use intelligent distribution
    if (documentData.elements && documentData.pages) {
      const allElements = documentData.elements;
      const pageIndex = documentData.pages.findIndex((p) => p.self === pageId);

      if (pageIndex >= 0) {
        console.log(
          `🔍 Using intelligent distribution for page ${pageId} (index ${pageIndex})`
        );

        // Get all elements without pageId
        const unassignedElements = allElements.filter(
          (element) => !element.pageId
        );

        if (unassignedElements.length > 0) {
          // Distribute elements evenly across pages
          const elementsPerPage = Math.ceil(
            unassignedElements.length / documentData.pages.length
          );
          const startIndex = pageIndex * elementsPerPage;
          const endIndex = Math.min(
            startIndex + elementsPerPage,
            unassignedElements.length
          );

          const pageElements = unassignedElements.slice(startIndex, endIndex);

          console.log(
            `📊 Distributed ${pageElements.length} elements to page ${pageId} (${startIndex}-${endIndex} of ${unassignedElements.length})`
          );

          return pageElements;
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

    console.log("🔍 updateElementsForCurrentPage called with:", {
      hasPages: !!documentData.pages,
      pagesLength: documentData.pages?.length,
      hasPageElementIds: !!documentData.pageElementIds,
      hasElementMap: !!documentData.elementMap,
      hasElementsByPage: !!documentData.elementsByPage,
      currentPageIndex,
      currentPage: documentData.pages?.[currentPageIndex],
    });

    // Generate missing mappings if they don't exist
    let pageElementIds = documentData.pageElementIds;
    let elementMap = documentData.elementMap;

    if (!pageElementIds || !elementMap) {
      console.log(
        "🔧 Generating missing pageElementIds and elementMap mappings..."
      );

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
              console.log(
                `📄 Page ${pageIndex + 1} (${page.self}): ${
                  pageElementIds[page.self].length
                } elements`
              );
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

      console.log("🔧 Generated mappings:", {
        elementMapKeys: Object.keys(elementMap),
        pageElementIdsKeys: Object.keys(pageElementIds),
      });
    }

    // Use centralized function to get elements for current page
    if (documentData.pages && documentData.pages.length > 0) {
      const currentPage = documentData.pages[currentPageIndex];
      if (currentPage && currentPage.self) {
        const pageElements = getElementsForPage(currentPage.self, documentData);
        console.log(
          `Loading ${pageElements.length} elements for page ${
            currentPageIndex + 1
          } (ID: ${currentPage.self})`
        );
        console.log(
          "Page elements found:",
          pageElements.map((el) => ({ id: el.id, type: el.type }))
        );
        setElementsForCurrentPage(pageElements);
      } else {
        // Fallback to all elements if page not found
        console.log("Page not found, using all elements as fallback");
        setElementsForCurrentPage(documentData.elements || []);
      }
    } else {
      // Fallback to all elements if no pages data
      console.log("Missing pages data, using all elements as fallback");
      console.log("Available keys:", Object.keys(documentData || {}));
      setElementsForCurrentPage(documentData.elements || []);
    }
  }, [documentData, currentPageIndex]);

  // NEW: Multi-page effect handlers
  useEffect(() => {
    if (documentData) {
      // Set up pages
      const pagesData = documentData.pages || [];
      console.log("Pages data:", pagesData);
      console.log("Document page count:", documentData.document?.pageCount);
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

  const loadDocument = async () => {
    try {
      const response = await fetch(`/api/document/${uploadId}`);
      const data = await response.json();
      console.log("📄 Document data:", data);

      // DEBUG: Check element positioning data in detail
      console.log("🔍 DEBUG DATA STRUCTURE:");
      console.log("DATA EXISTS:", !!data);
      console.log("DATA.ELEMENTS EXISTS:", !!data?.elements);
      console.log("DATA.ELEMENTS LENGTH:", data?.elements?.length);
      console.log("DATA KEYS:", data ? Object.keys(data) : "no data");
      console.log("FULL DATA OBJECT:", data);

      if (data && data.elements && data.elements.length > 0) {
        console.log("🔍 ELEMENT POSITIONING ANALYSIS:");
        console.log("RAW ELEMENTS ARRAY:", data.elements);

        data.elements.forEach((element, index) => {
          console.log(`\n=== ELEMENT ${index} ===`);
          console.log("ELEMENT ID:", element.id);
          console.log("ELEMENT NAME:", element.name);
          console.log("ELEMENT TYPE:", element.type);
          console.log("ORIGINAL POSITION:", element.position);
          console.log("PIXEL POSITION:", element.pixelPosition);

          // Check for Y=0 issues
          if (element.position?.y === 0) {
            console.log("🚨 ORIGINAL POSITION Y IS ZERO!");
          }
          if (element.pixelPosition?.y === 0) {
            console.log("🚨 PIXEL POSITION Y IS ZERO!");
          }

          // Show what coordinates we're actually using for positioning
          const finalPosition = element.pixelPosition || element.position;
          console.log("FINAL POSITION FOR RENDERING:", finalPosition);

          // Show each coordinate explicitly
          console.log("FINAL X:", finalPosition?.x);
          console.log("FINAL Y:", finalPosition?.y);
          console.log("FINAL WIDTH:", finalPosition?.width);
          console.log("FINAL HEIGHT:", finalPosition?.height);
        });
      } else {
        console.log("🚨 NO ELEMENTS FOUND! This is the problem.");
      }
      setDocumentData(data);
      setLoading(false);
    } catch (error) {
      console.error("Error loading document:", error);
      setLoading(false);
    }
  };

  // Use ColorUtils for color conversion - ENHANCED with safety checks
  const convertColor = (colorRef) => {
    console.log("Converting color:", colorRef);

    // First, check if we have color definitions in the document data
    if (
      documentData?.colorDefinitions &&
      documentData.colorDefinitions[colorRef]
    ) {
      const colorDef = documentData.colorDefinitions[colorRef];
      console.log("Found color definition:", colorDef);

      // If we have RGB values, use them
      if (
        colorDef.hasDirectRGB &&
        colorDef.red !== undefined &&
        colorDef.green !== undefined &&
        colorDef.blue !== undefined
      ) {
        return `rgb(${colorDef.red}, ${colorDef.green}, ${colorDef.blue})`;
      }

      // If we have CMYK values, convert them to RGB
      if (
        colorDef.hasDirectCMYK &&
        colorDef.cyan !== undefined &&
        colorDef.magenta !== undefined &&
        colorDef.yellow !== undefined &&
        colorDef.black !== undefined
      ) {
        if (ColorUtils && ColorUtils.cmykToRgbString) {
          return ColorUtils.cmykToRgbString(
            colorDef.cyan,
            colorDef.magenta,
            colorDef.yellow,
            colorDef.black
          );
        }
      }
    }

    // Safety check - if ColorUtils is not available
    if (!ColorUtils || typeof ColorUtils.convertIdmlColorToRgb !== "function") {
      console.error(
        "ColorUtils not available or missing convertIdmlColorToRgb method"
      );
      // Fallback conversion
      if (colorRef === "Color/None") return "transparent";
      if (colorRef === "Color/Black") return "rgb(0, 0, 0)";
      if (colorRef === "Color/White" || colorRef === "Color/Paper")
        return "rgb(255, 255, 255)";
      return "rgb(200, 200, 200)"; // Default gray
    }

    try {
      // If colorRef is a string and matches a color in resources, use the color object
      if (
        typeof colorRef === "string" &&
        documentData?.resources?.colors &&
        documentData.resources.colors[colorRef]
      ) {
        return ColorUtils.convertIdmlColorToRgb(
          documentData.resources.colors[colorRef]
        );
      }
      // Otherwise, pass through (handles objects or fallback)
      return ColorUtils.convertIdmlColorToRgb(colorRef);
    } catch (error) {
      console.error("Error converting color:", error);
      // Fallback conversion
      if (colorRef === "Color/None") return "transparent";
      if (colorRef === "Color/Black") return "rgb(0, 0, 0)";
      if (colorRef === "Color/White" || colorRef === "Color/Paper")
        return "rgb(255, 255, 255)";
      return "rgb(200, 200, 200)"; // Default gray
    }
  };

  const getDocumentBackgroundColor = (documentData) => {
    console.log("🔍 Starting improved background color detection...", {
      config: backgroundConfig,
    });

    // Handle different background modes - ENHANCED
    if (backgroundConfig.mode === "white") {
      return "white";
    } else if (backgroundConfig.mode === "transparent") {
      return "transparent";
    } else if (backgroundConfig.mode === "custom") {
      return backgroundConfig.customColor;
    }

    // Auto detection mode - PRESERVED all original logic
    // 1. Look for a full-page rectangle with a fill (prefer this over swatch analysis)
    if (documentData.elements) {
      const pageWidth =
        documentData.pageInfo?.dimensions?.pixelDimensions?.width || 612;
      const pageHeight =
        documentData.pageInfo?.dimensions?.pixelDimensions?.height || 792;

      // Find the largest rectangle with a non-None fill
      const fullPageRects = documentData.elements.filter(
        (el) =>
          el.type === "Rectangle" &&
          el.pixelPosition &&
          el.pixelPosition.x <= 5 &&
          el.pixelPosition.y <= 5 &&
          el.pixelPosition.width >= pageWidth * 0.95 &&
          el.pixelPosition.height >= pageHeight * 0.95 &&
          el.fill &&
          el.fill !== "Color/None"
      );
      if (fullPageRects.length > 0) {
        // Use the largest by area
        const bgRect = fullPageRects.reduce((a, b) =>
          a.pixelPosition.width * a.pixelPosition.height >
          b.pixelPosition.width * b.pixelPosition.height
            ? a
            : b
        );
        console.log("🎨 Using full-page rectangle as background:", bgRect.fill);
        return convertColor(bgRect.fill);
      }
    }

    // Strategy 1: Look for Paper color in resources (InDesign's default) - ENHANCED
    if (backgroundConfig.preferPaperColor && documentData.colorDefinitions) {
      const paperColor = Object.entries(documentData.colorDefinitions).find(
        ([key, color]) => color.name === "Paper" || key === "Color/Paper"
      );

      if (paperColor) {
        console.log(
          "📄 Found Paper color in colorDefinitions - using as background"
        );
        return convertColor(paperColor[0]);
      }
    }

    // PRESERVED: All original background detection strategies
    // Strategy 2: Look for page background color in pageInfo
    if (
      documentData.pageInfo?.backgroundColor &&
      documentData.pageInfo.backgroundColor !== "Color/None"
    ) {
      console.log(
        "📄 Found page background in pageInfo:",
        documentData.pageInfo.backgroundColor
      );
      return convertColor(documentData.pageInfo.backgroundColor);
    }

    // Strategy 3: Look for document background in document properties
    if (
      documentData.document?.backgroundColor &&
      documentData.document.backgroundColor !== "Color/None"
    ) {
      console.log(
        "📄 Found document background in document:",
        documentData.document.backgroundColor
      );
      return convertColor(documentData.document.backgroundColor);
    }

    // Strategy 4: Look for spreads background color
    if (documentData.spreads) {
      for (const [spreadId, spread] of Object.entries(documentData.spreads)) {
        if (spread.backgroundColor && spread.backgroundColor !== "Color/None") {
          console.log(
            "📄 Found spread background color:",
            spread.backgroundColor
          );
          return convertColor(spread.backgroundColor);
        }
      }
    }

    // PRESERVED: All original advanced background detection logic
    // (keeping the rest of the original complex background detection logic)

    // Fallback: Use configured fallback
    if (backgroundConfig.fallbackToWhite) {
      console.log("📄 ✅ No background color detected - using white fallback");
      return "white";
    } else {
      console.log(
        "📄 ✅ No background color detected - using transparent fallback"
      );
      return "transparent";
    }
  };

  // NEW: Add a function to get background color for a specific page
  const getPageBackgroundColor = (page, documentData) => {
    console.log(`🎨 BACKGROUND COLOR FUNCTION CALLED!`);
    console.log(
      `🔍 Getting background color for page ${page.self} (${page.name})`
    );
    console.log(`🔍 Page data:`, page);
    console.log(`🔍 Document data keys:`, Object.keys(documentData));

    // First check if the page itself has a background color
    if (page.backgroundColor && page.backgroundColor !== "Color/None") {
      console.log(
        `📄 Page has explicit background color: ${page.backgroundColor}`
      );
      return convertColor(page.backgroundColor);
    }

    // Then look for a full-page rectangle on this specific page
    if (documentData.elementsByPage && page.self) {
      const pageElements = documentData.elementsByPage[page.self] || [];
      console.log(
        `🔍 Found ${pageElements.length} elements for page ${page.self}`
      );
      console.log(`🔍 Page elements:`, pageElements);

      const pageWidth =
        page.geometricBounds?.width ||
        documentData.pageInfo?.dimensions?.pixelDimensions?.width ||
        612;
      const pageHeight =
        page.geometricBounds?.height ||
        documentData.pageInfo?.dimensions?.pixelDimensions?.height ||
        792;

      console.log(`📐 Page dimensions: ${pageWidth}x${pageHeight}`);

      // Find background rectangles for this page - ENHANCED DETECTION
      const backgroundRects = pageElements.filter((element) => {
        // Check if it's a rectangle with a background-like name
        const isBackgroundElement =
          element.type === "Rectangle" &&
          element.name &&
          (element.name.includes("Background") ||
            element.name.includes("BG") ||
            element.name.includes("bg"));

        // Check if it has a fill color
        const hasFillColor = element.fill && element.fill !== "Color/None";

        // Check if it's positioned at the top-left (background position)
        const position =
          element.geometricBounds || element.pixelPosition || element.position;
        const isBackgroundPosition =
          position && position.left <= 5 && position.top <= 5;

        // Check if it's large enough to be a background
        const isLargeEnough =
          position &&
          position.width >= pageWidth * 0.9 &&
          position.height >= pageHeight * 0.9;

        console.log(`🔍 Element ${element.self} (${element.name}):`, {
          isBackgroundElement,
          hasFillColor,
          isBackgroundPosition,
          isLargeEnough,
          fill: element.fill,
          position: position,
        });

        return (
          isBackgroundElement &&
          hasFillColor &&
          isBackgroundPosition &&
          isLargeEnough
        );
      });

      console.log(
        `🎨 Found ${backgroundRects.length} background rectangles for page ${page.self}`
      );

      if (backgroundRects.length > 0) {
        // Get the largest one
        const bgRect = backgroundRects.reduce((largest, current) => {
          const largestPosition =
            largest.geometricBounds ||
            largest.pixelPosition ||
            largest.position;
          const currentPosition =
            current.geometricBounds ||
            current.pixelPosition ||
            current.position;

          const largestArea = largestPosition.width * largestPosition.height;
          const currentArea = currentPosition.width * currentPosition.height;

          return currentArea > largestArea ? current : largest;
        });

        console.log(
          `🎨 Using background rectangle: ${bgRect.name} with fill: ${bgRect.fill}`
        );
        return convertColor(bgRect.fill);
      }
    }

    // Fall back to document background color
    console.log(
      `📄 No page-specific background found, using document background`
    );
    return getDocumentBackgroundColor(documentData);
  };

  // PRESERVED: All original text processing functions
  const getFontWeight = (fontStyle) => {
    if (!fontStyle) return "400";

    const style = fontStyle.toLowerCase();

    // Handle complex styles like "Bold Italic", "Semibold Condensed", etc.
    if (style.includes("thin")) return "100";
    if (style.includes("extralight") || style.includes("ultra light"))
      return "200";
    if (style.includes("light")) return "300";
    if (style.includes("medium")) return "500";
    if (style.includes("demibold") || style.includes("semibold")) return "600";
    if (style.includes("bold")) return "700";
    if (style.includes("extrabold") || style.includes("ultra bold"))
      return "800";
    if (style.includes("black") || style.includes("heavy")) return "900";

    return "400"; // Regular/Normal
  };

  const getFontStyle = (fontStyle) => {
    if (
      !fontStyle ||
      fontStyle === "" ||
      fontStyle === "Regular" ||
      fontStyle === "normal"
    ) {
      return "normal";
    }

    const style = fontStyle.toLowerCase().trim();

    // FIXED: More precise italic detection - only exact matches or explicit italic styles
    const willBeItalic =
      style === "italic" ||
      style === "oblique" ||
      style.endsWith(" italic") ||
      style.startsWith("italic ") ||
      style === "it" ||
      style.includes(" italic ") ||
      style.endsWith("-italic") ||
      style.startsWith("italic-");

    // DEBUG: Log when italic is being applied
    if (willBeItalic) {
      console.log("🎨 Font style applying ITALIC:", {
        input: fontStyle,
        inputType: typeof fontStyle,
        normalizedInput: style,
        reason: "Matched italic pattern",
      });
    }

    if (willBeItalic) {
      return "italic";
    }

    // Default to normal for everything else (including Regular, Medium, Bold, etc.)
    return "normal";
  };

  const extractTextDecorations = (formatting) => {
    const decorations = [];

    // Check for underline
    if (
      formatting.underline ||
      (formatting.characterStyle &&
        formatting.characterStyle.toLowerCase().includes("underline"))
    ) {
      decorations.push("underline");
    }

    // Check for strikethrough
    if (
      formatting.strikethrough ||
      formatting.strikeThrough ||
      (formatting.characterStyle &&
        formatting.characterStyle.toLowerCase().includes("strikethrough"))
    ) {
      decorations.push("line-through");
    }

    // Check for overline
    if (
      formatting.overline ||
      (formatting.characterStyle &&
        formatting.characterStyle.toLowerCase().includes("overline"))
    ) {
      decorations.push("overline");
    }

    return decorations.length > 0 ? decorations.join(" ") : "none";
  };

  const getTextAlign = (alignment) => {
    const alignments = {
      LeftAlign: "left",
      RightAlign: "right",
      CenterAlign: "center",
      LeftJustified: "justify",
      RightJustified: "justify",
      CenterJustified: "center",
      FullyJustified: "justify",
    };
    return alignments[alignment] || "left";
  };

  // PRESERVED: All original text measurement and fitting functions
  const measureTextAccurately = (
    text,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle
  ) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const width = metrics.width;
    const height = fontSize * 1.2;

    return {
      width,
      height,
      actualBounds:
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
    };
  };

  const calculateTextMetrics = (
    text,
    fontSize,
    lineHeight,
    containerWidth,
    containerHeight,
    fontFamily = "Arial",
    fontWeight = "normal",
    fontStyle = "normal"
  ) => {
    if (!text)
      return { willOverflow: false, estimatedLines: 0, estimatedTextHeight: 0 };

    const canvasMetrics = measureTextAccurately(
      text,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle
    );

    let lineHeightPx;
    if (typeof lineHeight === "string" && lineHeight.includes("px")) {
      lineHeightPx = parseFloat(lineHeight);
    } else if (typeof lineHeight === "number") {
      lineHeightPx = lineHeight * fontSize;
    } else {
      const numericLineHeight = parseFloat(lineHeight) || 1.2;
      lineHeightPx = numericLineHeight * fontSize;
    }

    const effectiveWidth = containerWidth - 4;
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const lines = [];
    let currentLine = "";
    let currentLineWidth = 0;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWidth = ctx.measureText(word).width;
      const spaceWidth = ctx.measureText(" ").width;
      const wordWithSpaceWidth = currentLine
        ? wordWidth + spaceWidth
        : wordWidth;

      if (
        currentLine &&
        currentLineWidth + wordWithSpaceWidth > effectiveWidth
      ) {
        lines.push(currentLine);
        currentLine = word;
        currentLineWidth = wordWidth;
      } else {
        if (currentLine) {
          currentLine += " " + word;
          currentLineWidth += wordWithSpaceWidth;
        } else {
          currentLine = word;
          currentLineWidth = wordWidth;
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    const estimatedLines = Math.max(1, lines.length);
    const estimatedTextHeight = estimatedLines * lineHeightPx;
    const availableHeight = containerHeight - 4;

    return {
      estimatedLines,
      estimatedTextHeight,
      lineHeightPx,
      availableHeight,
      actualLines: lines,
      willOverflow: estimatedTextHeight > availableHeight,
      overfillRatio: estimatedTextHeight / availableHeight,
      overflowSeverity:
        estimatedTextHeight > availableHeight * 1.5
          ? "severe"
          : estimatedTextHeight > availableHeight * 1.2
          ? "moderate"
          : "minor",
    };
  };

  // PRESERVED: All text fitting strategies
  const TEXT_FITTING_STRATEGIES = {
    AUTO_SCALE: "auto_scale",
    TRUNCATE: "truncate",
    ALLOW_OVERFLOW: "allow_overflow",
    PRECISE_FIT: "precise_fit",
    COMPRESS_LINES: "compress_lines",
  };

  const [textFittingStrategy, setTextFittingStrategy] = useState(
    TEXT_FITTING_STRATEGIES.PRECISE_FIT
  );

  const getOptimalTextStyles = (
    baseStyles,
    textMetrics,
    containerWidth,
    containerHeight,
    strategy = textFittingStrategy
  ) => {
    if (!textMetrics.willOverflow) {
      return {
        styles: baseStyles,
        wasAdjusted: false,
        adjustmentDetails: null,
      };
    }

    const fontSize = parseFloat(baseStyles.fontSize);
    const lineHeight = parseFloat(baseStyles.lineHeight);

    switch (strategy) {
      case TEXT_FITTING_STRATEGIES.AUTO_SCALE: {
        const maxReduction =
          textMetrics.overflowSeverity === "severe"
            ? 0.7
            : textMetrics.overflowSeverity === "moderate"
            ? 0.8
            : 0.9;
        const scaleFactor = Math.max(
          maxReduction,
          1 / textMetrics.overfillRatio
        );

        return {
          styles: {
            ...baseStyles,
            fontSize: `${Math.max(8, fontSize * scaleFactor)}px`,
            lineHeight: Math.max(0.9, lineHeight * scaleFactor),
            overflow: "hidden",
          },
          wasAdjusted: true,
          adjustmentDetails: {
            type: "font_scaled",
            scaleFactor: scaleFactor,
            originalSize: fontSize,
            newSize: fontSize * scaleFactor,
          },
        };
      }

      case TEXT_FITTING_STRATEGIES.TRUNCATE: {
        const availableLines = Math.floor(
          textMetrics.availableHeight / textMetrics.lineHeightPx
        );
        const truncateAtLine = Math.max(1, availableLines);

        return {
          styles: {
            ...baseStyles,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: truncateAtLine,
            WebkitBoxOrient: "vertical",
            lineHeight: baseStyles.lineHeight,
          },
          wasAdjusted: true,
          adjustmentDetails: {
            type: "text_truncated",
            visibleLines: truncateAtLine,
            totalLines: textMetrics.estimatedLines,
          },
        };
      }

      case TEXT_FITTING_STRATEGIES.COMPRESS_LINES: {
        const targetHeight = textMetrics.availableHeight;
        const currentHeight = textMetrics.estimatedTextHeight;
        const compressionRatio = targetHeight / currentHeight;

        if (compressionRatio > 0.8) {
          return {
            styles: {
              ...baseStyles,
              lineHeight: Math.max(0.8, lineHeight * compressionRatio),
              overflow: "hidden",
            },
            wasAdjusted: true,
            adjustmentDetails: {
              type: "line_height_compressed",
              originalLineHeight: lineHeight,
              newLineHeight: lineHeight * compressionRatio,
            },
          };
        } else {
          const fontReduction = Math.max(0.8, compressionRatio);
          return {
            styles: {
              ...baseStyles,
              fontSize: `${fontSize * fontReduction}px`,
              lineHeight: Math.max(0.8, lineHeight * compressionRatio),
              overflow: "hidden",
            },
            wasAdjusted: true,
            adjustmentDetails: {
              type: "full_compression",
              fontReduction: fontReduction,
              lineHeightReduction: compressionRatio,
            },
          };
        }
      }

      case TEXT_FITTING_STRATEGIES.PRECISE_FIT: {
        const compressionNeeded =
          textMetrics.availableHeight / textMetrics.estimatedTextHeight;

        if (compressionNeeded >= 0.95) {
          return {
            styles: {
              ...baseStyles,
              overflow: "hidden",
            },
            wasAdjusted: false,
            adjustmentDetails: { type: "no_adjustment_needed" },
          };
        } else if (compressionNeeded > 0.85) {
          const lineHeightReduction = Math.max(0.9, compressionNeeded * 1.05);

          return {
            styles: {
              ...baseStyles,
              lineHeight: Math.max(
                0.9,
                parseFloat(baseStyles.lineHeight) * lineHeightReduction
              ),
              overflow: "hidden",
            },
            wasAdjusted: true,
            adjustmentDetails: {
              type: "minor_line_height_adjustment",
              lineHeightReduction,
              originalLineHeight: baseStyles.lineHeight,
            },
          };
        } else if (compressionNeeded > 0.7) {
          const fontScale = Math.max(0.9, Math.sqrt(compressionNeeded));
          const lineScale = Math.max(0.85, compressionNeeded / fontScale);

          return {
            styles: {
              ...baseStyles,
              fontSize: `${fontSize * fontScale}px`,
              lineHeight: Math.max(
                0.85,
                parseFloat(baseStyles.lineHeight) * lineScale
              ),
              overflow: "hidden",
            },
            wasAdjusted: true,
            adjustmentDetails: {
              type: "moderate_dual_adjustment",
              fontScale,
              lineScale,
              compressionNeeded,
            },
          };
        } else {
          const maxFontScale = 0.85;
          const maxLineScale = 0.8;

          return {
            styles: {
              ...baseStyles,
              fontSize: `${fontSize * maxFontScale}px`,
              lineHeight: Math.max(
                0.8,
                parseFloat(baseStyles.lineHeight) * maxLineScale
              ),
              overflow: "hidden",
              maxHeight: `${textMetrics.availableHeight}px`,
            },
            wasAdjusted: true,
            adjustmentDetails: {
              type: "major_adjustment_with_overflow",
              fontScale: maxFontScale,
              lineScale: maxLineScale,
              allowedOverflow: true,
            },
          };
        }
      }

      case TEXT_FITTING_STRATEGIES.ALLOW_OVERFLOW:
      default: {
        return {
          styles: {
            ...baseStyles,
            overflow: "visible",
          },
          wasAdjusted: false,
          adjustmentDetails: { type: "overflow_allowed" },
        };
      }
    }
  };

  const renderFormattedText = (
    story,
    containerHeight = null,
    adjustedFontSize = null
  ) => {
    if (!story.formattedContent || !Array.isArray(story.formattedContent)) {
      console.log("Text value:", story.text);
      if (typeof story.text === "string") {
        return (
          <span
            style={{
              whiteSpace: "pre-line",
              display: "block",
            }}
          >
            {story.text}
          </span>
        );
      }
      return <span>{story.text}</span>;
    }

    const lineBreakCount = story.formattedContent.filter(
      (item) => item.formatting?.isBreak
    ).length;
    const consecutiveBreaks = [];
    let currentBreakGroup = [];

    story.formattedContent.forEach((item, index) => {
      if (item.formatting?.isBreak) {
        currentBreakGroup.push({
          index,
          source: item.formatting.source,
          breakType: item.formatting.breakType,
        });
      } else if (currentBreakGroup.length > 0) {
        if (currentBreakGroup.length > 1) {
          consecutiveBreaks.push(currentBreakGroup);
        }
        currentBreakGroup = [];
      }
    });

    if (currentBreakGroup.length > 1) {
      consecutiveBreaks.push(currentBreakGroup);
    }

    console.log(
      `🎨 Rendering formatted text with ${lineBreakCount} total line breaks`
    );
    if (consecutiveBreaks.length > 0) {
      console.log(
        `🎨 Found ${consecutiveBreaks.length} groups of consecutive line breaks:`,
        consecutiveBreaks
      );
    }

    return story.formattedContent
      .map((content, index) => {
        if (content.formatting?.isBreak) {
          console.log(
            `🎨 Rendering line break ${index}: source=${content.formatting.source}, type=${content.formatting.breakType}`
          );
          return <br key={index} />;
        }

        const formatting = content.formatting || {};
        const originalFontSize =
          formatting.fontSize || story.styling?.fontSize || 12;
        const fontSize = adjustedFontSize || originalFontSize;

        const hasFormatting =
          formatting.fontStyle ||
          formatting.characterStyle ||
          formatting.paragraphStyle;
        const finalFontStyle = getFontStyle(formatting.fontStyle);
        const finalFontWeight = getFontWeight(formatting.fontStyle);

        if (
          hasFormatting ||
          finalFontStyle === "italic" ||
          finalFontWeight !== "400"
        ) {
          console.log(
            "🎨 Style resolution for text:",
            JSON.stringify(content.text?.substring(0, 20) + "..."),
            {
              rawFormatting: formatting,
              fontStyle: formatting.fontStyle,
              storyDefaultStyle: story.styling?.fontStyle,
              finalFontStyle: finalFontStyle,
              finalFontWeight: finalFontWeight,
              characterStyle: formatting.characterStyle,
              paragraphStyle: formatting.paragraphStyle,
            }
          );
        }
        if (
          finalFontStyle === "italic" &&
          (!formatting.fontStyle || formatting.fontStyle === "Regular")
        ) {
          console.warn(
            "⚠️  UNEXPECTED ITALIC: Text is being styled as italic but fontStyle is:",
            formatting.fontStyle
          );
        }

        let lineHeight = "inherit";

        if (formatting.effectiveLineHeight) {
          lineHeight = formatting.effectiveLineHeight;
        } else if (formatting.leading !== undefined) {
          if (formatting.leading === "auto") {
            lineHeight = "inherit";
          } else if (typeof formatting.leading === "number") {
            const ratio = formatting.leading / fontSize;
            lineHeight = Math.max(1.1, Math.min(2.5, ratio));
          }
        }

        const completeStyles = formatting.completeStyles || {};

        const style = {
          fontSize: `${fontSize}px`,
          fontFamily:
            formatting.fontFamily ||
            story.styling?.fontFamily ||
            "Arial, sans-serif",

          fontWeight:
            completeStyles.fontWeight ||
            getFontWeight(formatting.fontStyle) ||
            "400",
          fontStyle:
            completeStyles.fontStyle ||
            getFontStyle(formatting.fontStyle) ||
            "normal",

          color: convertColor(formatting.fillColor) || "black",
          textAlign: getTextAlign(formatting.alignment),
          lineHeight: lineHeight,
          letterSpacing: formatting.tracking
            ? `${formatting.tracking / 1000}em`
            : "normal",

          textDecoration:
            completeStyles.textDecoration || extractTextDecorations(formatting),

          textTransform: completeStyles.textTransform || "none",
          textShadow: completeStyles.textShadow || "none",

          margin: 0,
          padding: 0,

          ...(formatting.leftIndent && {
            marginLeft: `${formatting.leftIndent}px`,
          }),
          ...(formatting.rightIndent && {
            marginRight: `${formatting.rightIndent}px`,
          }),
          ...(formatting.firstLineIndent && {
            textIndent: `${formatting.firstLineIndent}px`,
          }),
          ...(formatting.spaceBefore && {
            marginTop: `${formatting.spaceBefore}px`,
          }),
          ...(formatting.spaceAfter && {
            marginBottom: `${formatting.spaceAfter}px`,
          }),

          ...(completeStyles.baselineShift && {
            verticalAlign: `${completeStyles.baselineShift}px`,
          }),
          ...(completeStyles.horizontalScale &&
            completeStyles.horizontalScale !== 100 && {
              transform: `scaleX(${completeStyles.horizontalScale / 100})`,
            }),
        };

        const currentText = content.text || "";
        const nextContent = story.formattedContent[index + 1];
        const needsSpaceAfter =
          nextContent &&
          !nextContent.formatting?.isBreak &&
          !currentText.endsWith(" ") &&
          !currentText.endsWith("\n") &&
          nextContent.text &&
          !nextContent.text.startsWith(" ") &&
          !nextContent.text.startsWith("\n");

        if (
          (currentText.includes("pa") &&
            nextContent?.text?.includes("voluptusda")) ||
          (currentText.includes("voluptusda") && index > 0)
        ) {
          console.log(`🔧 Space insertion check [${index}]:`, {
            currentText: JSON.stringify(currentText),
            nextText: nextContent ? JSON.stringify(nextContent.text) : "none",
            needsSpaceAfter,
            currentEndsWithSpace: currentText.endsWith(" "),
            nextStartsWithSpace: nextContent?.text?.startsWith(" "),
          });
        }

        return (
          <React.Fragment key={index}>
            <span style={style}>{content.text}</span>
            {needsSpaceAfter && " "}
          </React.Fragment>
        );
      })
      .filter(Boolean);
  };
  const getStoryStyles = (
    story,
    containerHeight = null,
    containerWidth = null
  ) => {
    const styling = story.styling || {};
    const fontSize = styling.fontSize || 12;
    let lineHeight = "1.3";

    if (styling.effectiveLineHeight) {
      lineHeight = styling.effectiveLineHeight;
    } else if (styling.leading !== undefined) {
      if (styling.leading === "auto") {
        lineHeight = "1.3";
      } else if (typeof styling.leading === "number") {
        const ratio = styling.leading / fontSize;
        lineHeight = Math.max(1.1, Math.min(2.5, ratio)).toString();
      }
    }

    return {
      fontSize: `${fontSize}px`,
      fontFamily: styling.fontFamily || "Arial, sans-serif",
      fontWeight: getFontWeight(styling.fontStyle),
      fontStyle: getFontStyle(styling.fontStyle),
      color: convertColor(styling.fillColor) || "black",
      textAlign: getTextAlign(styling.alignment),
      lineHeight: lineHeight,
      letterSpacing: styling.tracking
        ? `${styling.tracking / 1000}em`
        : "normal",

      padding: "1px 2px",
      margin: 0,

      height: "100%",
      width: "100%",
      minHeight: `${fontSize * 1.4}px`,

      wordWrap: "break-word",
      overflow: "visible",
      boxSizing: "border-box",

      display: "block",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "break-word",

      textOverflow: "visible",
      lineClamp: "none",
    };
  };
  const getInDesignAccurateFormatting = (story) => {
    const styling = story.styling || {};
    const firstFormatted = story.formattedContent?.find(
      (item) => item.formatting && !item.formatting.isBreak
    );
    const formatting = firstFormatted?.formatting || styling;
    return {
      fontSize: formatting.fontSize || styling.fontSize || 12,
      fontFamily:
        formatting.fontFamily || styling.fontFamily || "Arial, sans-serif",
      fontWeight: getFontWeight(formatting.fontStyle || styling.fontStyle),
      fontStyle: getFontStyle(formatting.fontStyle || styling.fontStyle),
      color: convertColor(formatting.fillColor || styling.fillColor) || "black",
      textAlign: getTextAlign(formatting.alignment || styling.alignment),

      leading: formatting.leading || styling.leading || "auto",
      leadingType: formatting.leadingType || styling.leadingType || "auto",
      tracking: formatting.tracking || styling.tracking || 0,
      baselineShift: formatting.baselineShift || 0,

      firstBaselineOffset: formatting.firstBaselineOffset || "AscentOffset",
      verticalJustification: formatting.verticalJustification || "TopAlign",
    };
  };
  // NEW: Add page tabs rendering
  const renderPageTabs = () => {
    if (
      !documentData ||
      !documentData.pages ||
      documentData.pages.length <= 1
    ) {
      console.log("Not rendering page tabs:", {
        hasDocumentData: !!documentData,
        pagesArray: documentData?.pages,
        pageCount: documentData?.pages?.length,
      });
      return null;
    }
    console.log("Rendering page tabs for", documentData.pages.length, "pages");

    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "20px",
          overflowX: "auto",
          padding: "10px 0",
        }}
      >
        {documentData.pages.map((page, index) => (
          <div
            key={page.self}
            onClick={() => {
              setCurrentPageIndex(index);
              setSelectedElement(null);
            }}
            style={{
              padding: "8px 16px",
              margin: "0 4px",
              backgroundColor:
                currentPageIndex === index ? "#007bff" : "#f0f0f0",
              color: currentPageIndex === index ? "white" : "black",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: currentPageIndex === index ? "bold" : "normal",
              minWidth: "60px",
              textAlign: "center",
              boxShadow:
                currentPageIndex === index
                  ? "0 2px 4px rgba(0,0,0,0.2)"
                  : "none",
            }}
          >
            Page {index + 1}
            {page.name && page.name !== "$ID/" && (
              <span
                style={{ display: "block", fontSize: "10px", marginTop: "3px" }}
              >
                {page.name}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };
  // NEW: Add a debug panel component
  const PageDebugPanel = () => {
    if (!showPageDebugPanel || !documentData) return null;
    return (
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          width: "400px",
          maxHeight: "80vh",
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          color: "#00ff00",
          padding: "15px",
          borderRadius: "8px",
          zIndex: 9999,
          fontFamily: "monospace",
          fontSize: "12px",
          overflow: "auto",
          boxShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          <h3 style={{ margin: 0, color: "#00ff00" }}>📄 Page Debug Panel</h3>
          <button
            onClick={() => setShowPageDebugPanel(false)}
            style={{
              background: "none",
              border: "none",
              color: "#ff0000",
              fontSize: "16px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <div
            style={{
              fontWeight: "bold",
              borderBottom: "1px solid #333",
              paddingBottom: "5px",
              marginBottom: "5px",
            }}
          >
            Document Info
          </div>
          <div>Upload ID: {uploadId}</div>
          <div>Page Count: {documentData.document?.pageCount || 0}</div>
          <div>Current Page: {currentPageIndex + 1}</div>
        </div>

        <div style={{ marginBottom: "15px" }}>
          <div
            style={{
              fontWeight: "bold",
              borderBottom: "1px solid #333",
              paddingBottom: "5px",
              marginBottom: "5px",
            }}
          >
            Pages ({documentData.pages?.length || 0})
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "3px",
                    borderBottom: "1px solid #333",
                  }}
                >
                  #
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "3px",
                    borderBottom: "1px solid #333",
                  }}
                >
                  ID
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "3px",
                    borderBottom: "1px solid #333",
                  }}
                >
                  Name
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "3px",
                    borderBottom: "1px solid #333",
                  }}
                >
                  Elements
                </th>
              </tr>
            </thead>
            <tbody>
              {documentData.pages?.map((page, index) => (
                <tr
                  key={page.self}
                  style={{
                    backgroundColor:
                      currentPageIndex === index
                        ? "rgba(0, 123, 255, 0.2)"
                        : "transparent",
                  }}
                >
                  <td style={{ padding: "3px" }}>{index + 1}</td>
                  <td style={{ padding: "3px" }}>
                    {page.self.substring(0, 8)}...
                  </td>
                  <td style={{ padding: "3px" }}>{page.name || "Unnamed"}</td>
                  <td style={{ padding: "3px" }}>
                    {documentData.elementsByPage?.[page.self]?.length || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <div
            style={{
              fontWeight: "bold",
              borderBottom: "1px solid #333",
              paddingBottom: "5px",
              marginBottom: "5px",
            }}
          >
            Element Distribution
          </div>
          <div>Total Elements: {documentData.elements?.length || 0}</div>
          <div>Elements on Current Page: {elementsForCurrentPage.length}</div>
          <div>
            Elements with Missing Page ID:{" "}
            {(documentData.elements || []).filter((el) => !el.pageId).length}
          </div>
        </div>

        <div style={{ marginTop: "15px" }}>
          <button
            onClick={() => {
              console.log("Document Data:", documentData);
              console.log("Pages:", documentData.pages);
              console.log("Elements by Page:", documentData.elementsByPage);
              console.log("Current Page Elements:", elementsForCurrentPage);
            }}
            style={{
              backgroundColor: "#444",
              color: "white",
              border: "none",
              padding: "5px 10px",
              borderRadius: "4px",
              cursor: "pointer",
              marginRight: "10px",
            }}
          >
            Log Data to Console
          </button>
        </div>
      </div>
    );
  };
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
              ? getDocumentBackgroundColor(documentData)
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
            key={element.id}
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
                        backgroundColor: convertColor(story.styling.fillColor),
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
        {/* NEW: Page Tabs */}
        {renderPageTabs()}

        {/* Enhanced Canvas with Multi-page Support */}
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
          {/* NEW: Render all pages with proper spacing between them */}
          {(() => {
            const pagesArray = getPagesArray(documentData);
            console.log(`🎨 PAGES ARRAY DEBUG:`, {
              pagesArray,
              length: pagesArray.length,
              documentDataPages: documentData.pages,
              documentDataKeys: Object.keys(documentData),
            });
            return pagesArray.length > 0 ? (
              pagesArray.map((page, pageIndex) => {
                console.log(
                  `🎨 RENDERING PAGE ${pageIndex + 1}: ${page.self} (${
                    page.name
                  })`
                );

                // Get elements for this specific page using centralized function
                const pageElements = getElementsForPage(
                  page.self,
                  documentData
                );
                console.log(
                  `🎨 RENDERING PAGE ${pageIndex + 1} (${page.self}) with ${
                    pageElements.length
                  } elements:`,
                  pageElements.map((el) => ({
                    id: el.id,
                    type: el.type,
                    pageId: el.pageId,
                    position: el.pixelPosition
                      ? {
                          x: Math.round(el.pixelPosition.x),
                          y: Math.round(el.pixelPosition.y),
                          width: Math.round(el.pixelPosition.width),
                          height: Math.round(el.pixelPosition.height),
                        }
                      : "No position",
                  }))
                );

                // Determine if this is the currently selected page
                const isCurrentPage = pageIndex === currentPageIndex;

                return (
                  <div
                    key={page.self}
                    id={`page-${pageIndex + 1}`}
                    style={{
                      position: "relative",
                      marginBottom: "40px",
                      width: page.geometricBounds
                        ? `${page.geometricBounds.width}px`
                        : (documentData.pageInfo?.dimensions?.pixelDimensions
                            ?.width ||
                            documentData.pageInfo?.dimensions?.width ||
                            612) + "px",
                      // Add a highlight effect for the current page
                      boxShadow: isCurrentPage
                        ? "0 0 0 2px #007bff, 0 5px 15px rgba(0,0,0,0.2)"
                        : "0 5px 15px rgba(0,0,0,0.1)",
                    }}
                  >
                    {/* Page number indicator */}
                    <div
                      style={{
                        position: "absolute",
                        top: "-25px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: isCurrentPage ? "#007bff" : "#6c757d",
                        color: "white",
                        padding: "2px 10px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        fontWeight: "bold",
                        zIndex: 10,
                      }}
                    >
                      Page {pageIndex + 1}
                    </div>

                    {/* Page Canvas */}
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: page.geometricBounds
                          ? `${page.geometricBounds.height}px`
                          : (documentData.pageInfo?.dimensions?.pixelDimensions
                              ?.height ||
                              documentData.pageInfo?.dimensions?.height ||
                              792) + "px",
                        backgroundColor: getPageBackgroundColor(
                          page,
                          documentData
                        ),
                        border: "1px solid #ccc",
                        overflow: "hidden",
                        borderRadius: "2px",
                      }}
                      onClick={() => {
                        if (pageIndex !== currentPageIndex) {
                          setCurrentPageIndex(pageIndex);
                          setSelectedElement(null);
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
                            documentData.pageInfo.margins.pixelMargins
                              ?.bottom ||
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

                      {/* PRESERVED: Element Rendering with Multi-page Support */}
                      {pageElements.map((element, index) => {
                        if (!element.pixelPosition) {
                          console.warn(
                            `⚠️ Skipping element ${element.id} because pixelPosition is missing!`
                          );
                          return null;
                        }
                        const elementPosition = element.pixelPosition;
                        const isContentFrame =
                          element.isContentFrame || element.hasPlacedContent;
                        const hasPlacedContent = element.placedContent;

                        if (showDebugInfo) {
                          console.log(
                            "🧱 Element positioning:",
                            element.id,
                            "Type:",
                            element.type,
                            "Position source:",
                            element.pixelPosition
                              ? "pixelPosition"
                              : "position",
                            "Final coords:",
                            {
                              x: elementPosition.x,
                              y: elementPosition.y,
                              width: elementPosition.width,
                              height: elementPosition.height,
                            },
                            "Conversion info:",
                            element.position?._conversionInfo
                          );
                        }

                        return (
                          <div
                            key={element.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedElement(element);
                              setCurrentPageIndex(pageIndex);
                            }}
                            style={{
                              position: "absolute",
                              left: elementPosition.x + "px",
                              top: elementPosition.y + "px",
                              width: elementPosition.width + "px",
                              height: elementPosition.height + "px",
                              backgroundColor: element.fill
                                ? convertColor(element.fill)
                                : "transparent",
                              border:
                                selectedElement?.id === element.id
                                  ? "2px solid #007bff"
                                  : isContentFrame
                                  ? "2px solid #00aaff"
                                  : element.type === "TextFrame"
                                  ? "1px solid #ff6b6b"
                                  : "1px dashed rgba(0,0,0,0.3)",
                              cursor: "pointer",
                              overflow: "visible",
                              transform: elementPosition.rotation
                                ? `rotate(${elementPosition.rotation}deg)`
                                : "none",
                              transformOrigin: "top left",
                              boxSizing: "border-box",
                              zIndex: element.type === "TextFrame" ? 10 : 1,
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
                                  background: "rgba(255, 255, 0, 0.8)",
                                  padding: "2px 4px",
                                  borderRadius: "2px",
                                  pointerEvents: "none",
                                  zIndex: 1000,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {element.id}: ({Math.round(elementPosition.x)},{" "}
                                {Math.round(elementPosition.y)})
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
                                    console.error("Error loading image:", e);
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
                                  getInDesignAccurateFormatting(story);

                                const cleanText = (story.text || "")
                                  .replace(/\n\s*\n/g, "\n")
                                  .trim();

                                const textMeasurement =
                                  InDesignTextMetrics.measureTextPrecisely(
                                    cleanText,
                                    storyFormatting,
                                    frameMetrics
                                  );

                                let finalStyles = getStoryStyles(
                                  story,
                                  element.position.height,
                                  element.position.width
                                );
                                let wasAdjusted = false;
                                let adjustmentDetails = null;

                                const containerWidth = elementPosition.width;
                                const containerHeight = elementPosition.height;

                                if (false && textMeasurement.willOverflow) {
                                  console.log(
                                    `📏 Text overflow detected in story ${element.parentStory}:`,
                                    {
                                      textHeight: textMeasurement.textHeight,
                                      availableHeight:
                                        textMeasurement.availableHeight,
                                      overflowAmount:
                                        textMeasurement.overflowAmount,
                                      lineCount: textMeasurement.lineCount,
                                    }
                                  );

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

                                return (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "0px",
                                      left: "0px",
                                      width: `${elementPosition.width}px`,
                                      height: `${elementPosition.height}px`,

                                      padding: `${frameMetrics.insets.top}px ${frameMetrics.insets.right}px ${frameMetrics.insets.bottom}px ${frameMetrics.insets.left}px`,

                                      fontSize: `${finalStyles.fontSize}`,
                                      fontFamily: finalStyles.fontFamily,
                                      fontWeight: finalStyles.fontWeight,
                                      fontStyle: finalStyles.fontStyle,
                                      color: finalStyles.color,
                                      textAlign: finalStyles.textAlign,
                                      lineHeight: finalStyles.lineHeight,
                                      letterSpacing: finalStyles.letterSpacing,

                                      margin: 0,

                                      display: "block",
                                      whiteSpace: "pre-wrap",
                                      wordBreak: "break-word",
                                      overflowWrap: "break-word",
                                      overflow: "visible",
                                      boxSizing: "border-box",
                                    }}
                                    title={createTooltip()}
                                  >
                                    {renderFormattedText(
                                      story,
                                      element.position.height,
                                      adjustedFontSize
                                    )}

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

                            {/* PRESERVED: Content frame placeholder */}
                            {isContentFrame &&
                              !hasPlacedContent &&
                              !element.linkedImage?.isEmbedded && (
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
                              !isContentFrame && (
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
              })
            ) : (
              <div>No pages found in document</div>
            );
          })()}

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
      <PageDebugPanel />

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

// Add a helper function at the top of the Viewer component
function getPagesArray(documentData) {
  if (!documentData || !documentData.pages) return [];
  if (Array.isArray(documentData.pages)) return documentData.pages;
  if (typeof documentData.pages === "object")
    return Object.values(documentData.pages);
  return [];
}

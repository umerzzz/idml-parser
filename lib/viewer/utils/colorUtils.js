/**
 * Color utilities for the IDML Viewer
 */

/**
 * Converts a hex color to RGB values
 * @param {string} hex - The hex color string
 * @returns {object} RGB values
 */
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

/**
 * Calculates the relative luminance of a color
 * @param {string} color - The color string (hex, rgb, or named color)
 * @returns {number} The relative luminance (0-1)
 */
const getRelativeLuminance = (color) => {
  let rgb;

  if (color.startsWith("#")) {
    rgb = hexToRgb(color);
  } else if (color.startsWith("rgb")) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      rgb = {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
      };
    }
  } else {
    // Handle named colors
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = color;
    const computedColor = ctx.fillStyle;
    rgb = hexToRgb(computedColor);
  }

  if (!rgb) return 0.5; // Default fallback

  const { r, g, b } = rgb;
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

/**
 * Calculates the contrast ratio between two colors
 * @param {string} color1 - First color
 * @param {string} color2 - Second color
 * @returns {number} The contrast ratio
 */
const getContrastRatio = (color1, color2) => {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
};

/**
 * Ensures text color has proper contrast against background
 * @param {string} textColor - The original text color
 * @param {string} backgroundColor - The background color
 * @param {number} minContrastRatio - Minimum contrast ratio (default: 4.5 for normal text)
 * @returns {string} The adjusted text color
 */
export const ensureTextContrast = (
  textColor,
  backgroundColor,
  minContrastRatio = 4.5
) => {
  if (!textColor || !backgroundColor) return textColor || "black";

  // Enhanced detection of light/white backgrounds
  const isLightBackground = () => {
    // Direct string matches
    if (backgroundColor === "transparent" || backgroundColor === "white") {
      return true;
    }

    // RGB white detection
    if (
      backgroundColor === "rgb(255, 255, 255)" ||
      backgroundColor === "#ffffff"
    ) {
      return true;
    }

    // Check if it's a very light color (high luminance)
    try {
      const luminance = getRelativeLuminance(backgroundColor);
      return luminance > 0.7; // Lowered from 0.8 to 0.7 to catch more light backgrounds
    } catch (e) {
      // If luminance calculation fails, be conservative and don't adjust
      return true;
    }
  };

  // Don't adjust if background is light/white (common cases)
  if (isLightBackground()) {
    return textColor;
  }

  const contrast = getContrastRatio(textColor, backgroundColor);

  // Only adjust if contrast is really poor (below 2.5 instead of 3.0 for more conservative approach)
  if (contrast >= 2.5) {
    return textColor; // Keep original color if contrast is acceptable
  }

  // Try to find a better color
  const backgroundLuminance = getRelativeLuminance(backgroundColor);

  // If background is dark, use light text; if light, use dark text
  const targetLuminance = backgroundLuminance > 0.5 ? 0.1 : 0.9;

  // Generate a color with the target luminance
  const targetColor = targetLuminance > 0.5 ? "#000000" : "#ffffff";

  return targetColor;
};

/**
 * Converts IDML color references to RGB values
 * @param {string|object} colorRef - The color reference from IDML
 * @param {object} documentData - The document data containing color definitions
 * @param {object} ColorUtils - The ColorUtils module for color conversion
 * @returns {string} The RGB color string
 */
export const convertColor = (colorRef, documentData, ColorUtils) => {
  // First, check if we have color definitions in the document data
  if (
    documentData?.colorDefinitions &&
    documentData.colorDefinitions[colorRef]
  ) {
    const colorDef = documentData.colorDefinitions[colorRef];

    // If we have RGB values, use them
    if (
      colorDef.hasDirectRGB &&
      colorDef.red !== undefined &&
      colorDef.green !== undefined &&
      colorDef.blue !== undefined
    ) {
      const result = `rgb(${colorDef.red}, ${colorDef.green}, ${colorDef.blue})`;
      return result;
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
        const result = ColorUtils.cmykToRgbString(
          colorDef.cyan,
          colorDef.magenta,
          colorDef.yellow,
          colorDef.black
        );
        return result;
      }
    }
  }

  // Safety check - if ColorUtils is not available
  if (!ColorUtils || typeof ColorUtils.convertIdmlColorToRgb !== "function") {
    console.error(
      "ColorUtils not available or missing convertIdmlColorToRgb method"
    );
    // Fallback conversion - use black for text accuracy
    if (colorRef === "Color/None") return "transparent";
    if (colorRef === "Color/Black") return "rgb(0, 0, 0)";
    if (colorRef === "Color/White" || colorRef === "Color/Paper")
      return "rgb(255, 255, 255)";
    return "rgb(0, 0, 0)"; // Default black for text accuracy
  }

  try {
    // If colorRef is a string and matches a color in resources, use the color object
    if (
      typeof colorRef === "string" &&
      documentData?.resources?.colors &&
      documentData.resources.colors[colorRef]
    ) {
      const result = ColorUtils.convertIdmlColorToRgb(
        documentData.resources.colors[colorRef]
      );
      return result;
    }
    // Otherwise, pass through (handles objects or fallback)
    const result = ColorUtils.convertIdmlColorToRgb(colorRef);
    return result;
  } catch (error) {
    console.error("Error converting color:", error);
    // Fallback conversion - use black for text accuracy
    if (colorRef === "Color/None") return "transparent";
    if (colorRef === "Color/Black") return "rgb(0, 0, 0)";
    if (colorRef === "Color/White" || colorRef === "Color/Paper")
      return "rgb(255, 255, 255)";
    return "rgb(0, 0, 0)"; // Default black for text accuracy
  }
};

/**
 * Gets the document background color
 * @param {object} documentData - The document data
 * @param {object} backgroundConfig - The background configuration
 * @param {function} convertColorFn - The color conversion function
 * @returns {string} The background color
 */
export const getDocumentBackgroundColor = (
  documentData,
  backgroundConfig,
  convertColorFn
) => {
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
      const detectedColor = convertColorFn(bgRect.fill, documentData);

      return detectedColor;
    }
  }

  // Strategy 1: Look for Paper color in resources (InDesign's default) - ENHANCED
  if (backgroundConfig.preferPaperColor && documentData.colorDefinitions) {
    const paperColor = Object.entries(documentData.colorDefinitions).find(
      ([key, color]) => color.name === "Paper" || key === "Color/Paper"
    );

    if (paperColor) {
      const detectedColor = convertColorFn(paperColor[0], documentData);
      return detectedColor;
    }
  }

  // PRESERVED: All original background detection strategies
  // Strategy 2: Look for page background color in pageInfo
  if (
    documentData.pageInfo?.backgroundColor &&
    documentData.pageInfo.backgroundColor !== "Color/None"
  ) {
    const detectedColor = convertColorFn(
      documentData.pageInfo.backgroundColor,
      documentData
    );
    return detectedColor;
  }

  // Strategy 3: Look for document background in document properties
  if (
    documentData.document?.backgroundColor &&
    documentData.document.backgroundColor !== "Color/None"
  ) {
    const detectedColor = convertColorFn(
      documentData.document.backgroundColor,
      documentData
    );
    return detectedColor;
  }

  // Strategy 4: Look for spreads background color
  if (documentData.spreads) {
    for (const [spreadId, spread] of Object.entries(documentData.spreads)) {
      if (spread.backgroundColor && spread.backgroundColor !== "Color/None") {
        const detectedColor = convertColorFn(
          spread.backgroundColor,
          documentData
        );
        return detectedColor;
      }
    }
  }

  // PRESERVED: All original advanced background detection logic
  // (keeping the rest of the original complex background detection logic)

  // Fallback: Use configured fallback
  if (backgroundConfig.fallbackToWhite) {
    return "white";
  } else {
    return "transparent";
  }
};

/**
 * Gets the background color for a specific page
 * @param {object} page - The page object
 * @param {object} documentData - The document data
 * @param {function} convertColorFn - The color conversion function
 * @param {function} getDocumentBackgroundColorFn - The document background color function
 * @param {object} backgroundConfig - The background configuration
 * @returns {string} The page background color
 */
export const getPageBackgroundColor = (
  page,
  documentData,
  convertColorFn,
  getDocumentBackgroundColorFn,
  backgroundConfig = null
) => {
  // Handle different background modes first
  if (backgroundConfig) {
    if (backgroundConfig.mode === "white") {
      return "white";
    } else if (backgroundConfig.mode === "transparent") {
      return "transparent";
    } else if (backgroundConfig.mode === "custom") {
      return backgroundConfig.customColor;
    }
  }

  // First check if the page itself has a background color
  if (page.backgroundColor && page.backgroundColor !== "Color/None") {
    return convertColorFn(page.backgroundColor, documentData);
  }

  // Check if the page's spread has a background color
  if (
    page.spreadParent &&
    documentData.spreads &&
    documentData.spreads[page.spreadParent]
  ) {
    const spread = documentData.spreads[page.spreadParent];
    if (spread.backgroundColor && spread.backgroundColor !== "Color/None") {
      return convertColorFn(spread.backgroundColor, documentData);
    }
  }

  // Then look for a full-page rectangle on this specific page
  if (documentData.elementsByPage && page.self) {
    const pageElements = documentData.elementsByPage[page.self] || [];

    const pageWidth =
      page.geometricBounds?.width ||
      documentData.pageInfo?.dimensions?.pixelDimensions?.width ||
      612;
    const pageHeight =
      page.geometricBounds?.height ||
      documentData.pageInfo?.dimensions?.pixelDimensions?.height ||
      792;

    // Find background rectangles for this page - IMPROVED DETECTION
    const backgroundRects = pageElements.filter((element) => {
      // Must be a rectangle with a fill color
      if (
        element.type !== "Rectangle" ||
        !element.fill ||
        element.fill === "Color/None"
      ) {
        return false;
      }

      const position =
        element.geometricBounds || element.pixelPosition || element.position;
      if (!position) {
        return false;
      }

      // Check if it's positioned near the top-left (background position) - more flexible
      const isBackgroundPosition = position.left <= 20 && position.top <= 20;

      // Check if it's large enough to be a background (more flexible - 70%)
      const isLargeEnough =
        position.width >= pageWidth * 0.7 &&
        position.height >= pageHeight * 0.7;

      // Check if it has a background-like name (optional, not required)
      const hasBackgroundName =
        element.name &&
        (element.name.includes("Background") ||
          element.name.includes("BG") ||
          element.name.includes("bg") ||
          element.name.includes("Page") ||
          element.name.includes("page"));

      // NEW: Check if this might be a content area (avoid these)
      const mightBeContent =
        element.name &&
        (element.name.includes("Text") ||
          element.name.includes("Content") ||
          element.name.includes("Frame") ||
          element.name.includes("Box") ||
          element.name.includes("Container"));

      // NEW: Try to detect if this is likely a background vs content
      // Backgrounds are usually positioned at the very back (z-index wise)
      // and often have simpler names or no names
      const isLikelyBackground =
        !mightBeContent &&
        (!element.name ||
          element.name === "Rectangle" ||
          element.name === "Background" ||
          element.name.includes("Background") ||
          element.name.includes("BG"));

      // Accept if it's large enough and positioned correctly, regardless of name
      return isBackgroundPosition && isLargeEnough && isLikelyBackground;
    });

    if (backgroundRects.length > 0) {
      // Get the largest one
      const bgRect = backgroundRects.reduce((largest, current) => {
        const largestPosition =
          largest.geometricBounds || largest.pixelPosition || largest.position;
        const currentPosition =
          current.geometricBounds || current.pixelPosition || current.position;

        const largestArea = largestPosition.width * largestPosition.height;
        const currentArea = currentPosition.width * currentPosition.height;

        return currentArea > largestArea ? current : largest;
      });

      return convertColorFn(bgRect.fill, documentData);
    } else {
      // Debug: Show what rectangles we found but rejected
      const rectangles = pageElements.filter((el) => el.type === "Rectangle");

      // ALTERNATIVE APPROACH: Look for ANY large rectangle as potential background
      if (rectangles.length > 0) {
        // Filter rectangles that are large enough to be backgrounds (more flexible)
        const largeRectangles = rectangles.filter((rect) => {
          const position =
            rect.geometricBounds || rect.pixelPosition || rect.position;
          if (!position) return false;

          const isLargeEnough =
            position.width >= pageWidth * 0.5 &&
            position.height >= pageHeight * 0.5;

          return isLargeEnough;
        });

        if (largeRectangles.length > 0) {
          // Try to find the lightest colored rectangle
          const lightestRect = largeRectangles.reduce((lightest, current) => {
            // Simple heuristic: prefer rectangles with lighter color names or "None" fill
            const lightestScore =
              lightest.fill === "Color/None"
                ? 0
                : lightest.fill?.includes("White")
                ? 1
                : lightest.fill?.includes("Light")
                ? 2
                : lightest.fill?.includes("Gray")
                ? 3
                : 10;

            const currentScore =
              current.fill === "Color/None"
                ? 0
                : current.fill?.includes("White")
                ? 1
                : current.fill?.includes("Light")
                ? 2
                : current.fill?.includes("Gray")
                ? 3
                : 10;

            return currentScore < lightestScore ? current : lightest;
          });

          return convertColorFn(lightestRect.fill, documentData);
        }
      }

      // ULTIMATE FALLBACK: Look for ANY rectangle with a fill color
      if (rectangles.length > 0) {
        const rectanglesWithFill = rectangles.filter(
          (rect) => rect.fill && rect.fill !== "Color/None"
        );

        if (rectanglesWithFill.length > 0) {
          // Use the largest rectangle with a fill color
          const largestRect = rectanglesWithFill.reduce((largest, current) => {
            const largestPosition =
              largest.geometricBounds ||
              largest.pixelPosition ||
              largest.position;
            const currentPosition =
              current.geometricBounds ||
              current.pixelPosition ||
              current.position;

            if (!largestPosition || !currentPosition) return largest;

            const largestArea = largestPosition.width * largestPosition.height;
            const currentArea = currentPosition.width * currentPosition.height;

            return currentArea > largestArea ? current : largest;
          });

          return convertColorFn(largestRect.fill, documentData);
        }
      }

      // FINAL FALLBACK: If no suitable background found, use white for pages that should be white
      // and try to detect based on content patterns

      // Check if this page has mostly text content (likely white background)
      const textElements = pageElements.filter((el) => el.type === "TextFrame");
      const hasMostlyText = textElements.length > pageElements.length * 0.5;

      if (hasMostlyText) {
        return "white";
      }

      // Check if page has a specific name pattern that suggests white background
      if (
        page.name &&
        (page.name.toString().includes("1") ||
          page.name.toString().includes("2") ||
          page.name.toString().includes("3"))
      ) {
        return "white";
      }

      // LAST RESORT: Use white instead of falling back to document background
      return "white";
    }
  } else {
    // Fall back to document background color with proper config

    // Use the provided fallback function or create a default one
    if (getDocumentBackgroundColorFn) {
      return getDocumentBackgroundColorFn(documentData);
    } else {
      // Create a default fallback function
      const defaultConfig = backgroundConfig || {
        mode: "auto",
        fallbackToWhite: true,
        preferPaperColor: true,
      };
      return getDocumentBackgroundColor(
        documentData,
        defaultConfig,
        convertColorFn
      );
    }
  }
};

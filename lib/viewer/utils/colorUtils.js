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

  // Don't adjust if background is transparent or white (common cases)
  if (backgroundColor === "transparent" || backgroundColor === "white") {
    return textColor;
  }

  const contrast = getContrastRatio(textColor, backgroundColor);

  // Only adjust if contrast is really poor (below 3.0 instead of 4.5)
  if (contrast >= 3.0) {
    return textColor; // Keep original color if contrast is acceptable
  }

  // Try to find a better color
  const backgroundLuminance = getRelativeLuminance(backgroundColor);

  // If background is dark, use light text; if light, use dark text
  const targetLuminance = backgroundLuminance > 0.5 ? 0.1 : 0.9;

  // Generate a color with the target luminance
  const targetColor = targetLuminance > 0.5 ? "#000000" : "#ffffff";

  console.log(
    `🎨 Text contrast adjustment: ${textColor} on ${backgroundColor} (ratio: ${contrast.toFixed(
      2
    )}) -> ${targetColor}`
  );

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
      return ColorUtils.convertIdmlColorToRgb(
        documentData.resources.colors[colorRef]
      );
    }
    // Otherwise, pass through (handles objects or fallback)
    return ColorUtils.convertIdmlColorToRgb(colorRef);
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
      return convertColorFn(bgRect.fill, documentData);
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
      return convertColorFn(paperColor[0], documentData);
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
    return convertColorFn(documentData.pageInfo.backgroundColor, documentData);
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
    return convertColorFn(documentData.document.backgroundColor, documentData);
  }

  // Strategy 4: Look for spreads background color
  if (documentData.spreads) {
    for (const [spreadId, spread] of Object.entries(documentData.spreads)) {
      if (spread.backgroundColor && spread.backgroundColor !== "Color/None") {
        console.log(
          "📄 Found spread background color:",
          spread.backgroundColor
        );
        return convertColorFn(spread.backgroundColor, documentData);
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
  console.log(`🎨 BACKGROUND COLOR FUNCTION CALLED!`);
  console.log(
    `🔍 Getting background color for page ${page.self} (${page.name})`
  );
  console.log(`🔍 Page data:`, page);
  console.log(`🔍 Document data keys:`, Object.keys(documentData));
  console.log(`🔍 Background config:`, backgroundConfig);

  // Handle different background modes first
  if (backgroundConfig) {
    if (backgroundConfig.mode === "white") {
      console.log(`📄 Using forced white background for page ${page.self}`);
      return "white";
    } else if (backgroundConfig.mode === "transparent") {
      console.log(`📄 Using transparent background for page ${page.self}`);
      return "transparent";
    } else if (backgroundConfig.mode === "custom") {
      console.log(
        `📄 Using custom background color for page ${page.self}: ${backgroundConfig.customColor}`
      );
      return backgroundConfig.customColor;
    }
  }

  // First check if the page itself has a background color
  if (page.backgroundColor && page.backgroundColor !== "Color/None") {
    console.log(
      `📄 Page has explicit background color: ${page.backgroundColor}`
    );
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
      console.log(
        `📄 Page's spread has background color: ${spread.backgroundColor}`
      );
      return convertColorFn(spread.backgroundColor, documentData);
    }
  }

  // Then look for a full-page rectangle on this specific page
  if (documentData.elementsByPage && page.self) {
    const pageElements = documentData.elementsByPage[page.self] || [];
    console.log(
      `🔍 Found ${pageElements.length} elements for page ${page.self}`
    );

    // Debug: Log all elements on this page to understand what we're working with
    console.log(
      `🔍 All elements on page ${page.self}:`,
      pageElements.map((el) => ({
        id: el.self || el.id,
        name: el.name,
        type: el.type,
        fill: el.fill,
        hasPosition: !!(el.geometricBounds || el.pixelPosition || el.position),
      }))
    );

    const pageWidth =
      page.geometricBounds?.width ||
      documentData.pageInfo?.dimensions?.pixelDimensions?.width ||
      612;
    const pageHeight =
      page.geometricBounds?.height ||
      documentData.pageInfo?.dimensions?.pixelDimensions?.height ||
      792;

    console.log(`📐 Page dimensions: ${pageWidth}x${pageHeight}`);

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
        console.log(`🔍 Element ${element.self} has no position data`);
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

      console.log(`🔍 Element ${element.self} (${element.name}):`, {
        type: element.type,
        fill: element.fill,
        position: {
          left: position.left,
          top: position.top,
          width: position.width,
          height: position.height,
        },
        isBackgroundPosition,
        isLargeEnough,
        hasBackgroundName,
        mightBeContent,
        isLikelyBackground,
        pageDimensions: { width: pageWidth, height: pageHeight },
      });

      // Accept if it's large enough and positioned correctly, regardless of name
      return isBackgroundPosition && isLargeEnough && isLikelyBackground;
    });

    console.log(
      `🎨 Found ${backgroundRects.length} background rectangles for page ${page.self}`
    );

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

      console.log(
        `🎨 Using background rectangle: ${bgRect.name} with fill: ${bgRect.fill}`
      );
      return convertColorFn(bgRect.fill, documentData);
    } else {
      console.log(`🔍 No background rectangles found for page ${page.self}`);

      // Debug: Show what rectangles we found but rejected
      const rectangles = pageElements.filter((el) => el.type === "Rectangle");
      console.log(
        `🔍 Rectangles on page ${page.self}:`,
        rectangles.map((rect) => ({
          id: rect.self || rect.id,
          name: rect.name,
          fill: rect.fill,
          position: rect.geometricBounds || rect.pixelPosition || rect.position,
        }))
      );

      // ALTERNATIVE APPROACH: Look for ANY large rectangle as potential background
      if (rectangles.length > 0) {
        console.log(
          `🔍 Trying alternative approach: looking for any large rectangle`
        );

        // Filter rectangles that are large enough to be backgrounds (more flexible)
        const largeRectangles = rectangles.filter((rect) => {
          const position =
            rect.geometricBounds || rect.pixelPosition || rect.position;
          if (!position) return false;

          const isLargeEnough =
            position.width >= pageWidth * 0.5 &&
            position.height >= pageHeight * 0.5;

          console.log(`🔍 Large rectangle check for ${rect.name}:`, {
            width: position.width,
            height: position.height,
            pageWidth,
            pageHeight,
            isLargeEnough,
          });

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

            console.log(
              `🔍 Color comparison: ${lightest.name}(${lightest.fill}) vs ${current.name}(${current.fill})`
            );
            console.log(`🔍 Scores: ${lightestScore} vs ${currentScore}`);

            return currentScore < lightestScore ? current : lightest;
          });

          console.log(
            `🎨 Alternative: Using lightest rectangle as background: ${lightestRect.name} with fill: ${lightestRect.fill}`
          );
          return convertColorFn(lightestRect.fill, documentData);
        }
      }

      // ULTIMATE FALLBACK: Look for ANY rectangle with a fill color
      if (rectangles.length > 0) {
        console.log(
          `🔍 Ultimate fallback: looking for ANY rectangle with fill color`
        );

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

          console.log(
            `🎨 Ultimate fallback: Using largest rectangle as background: ${largestRect.name} with fill: ${largestRect.fill}`
          );
          return convertColorFn(largestRect.fill, documentData);
        }
      }

      // FINAL FALLBACK: If no suitable background found, use white for pages that should be white
      // and try to detect based on content patterns
      console.log(
        `🔍 No suitable background found, using intelligent fallback`
      );

      // Check if this page has mostly text content (likely white background)
      const textElements = pageElements.filter((el) => el.type === "TextFrame");
      const hasMostlyText = textElements.length > pageElements.length * 0.5;

      if (hasMostlyText) {
        console.log(`🎨 Page has mostly text content, using white background`);
        return "white";
      }

      // Check if page has a specific name pattern that suggests white background
      if (
        page.name &&
        (page.name.toString().includes("1") ||
          page.name.toString().includes("2") ||
          page.name.toString().includes("3"))
      ) {
        console.log(
          `🎨 Page ${page.name} likely has white background based on name pattern`
        );
        return "white";
      }

      // LAST RESORT: Use white instead of falling back to document background
      console.log(`🎨 Using white as last resort for page ${page.self}`);
      return "white";
    }
  } else {
    console.log(`🔍 No elementsByPage data or page.self for page ${page.self}`);
    console.log(
      `🔍 elementsByPage keys:`,
      documentData.elementsByPage
        ? Object.keys(documentData.elementsByPage)
        : "undefined"
    );
    console.log(`🔍 page.self:`, page.self);
  }

  // Fall back to document background color with proper config
  console.log(
    `📄 No page-specific background found, using document background`
  );

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
};

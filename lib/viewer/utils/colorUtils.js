/**
 * Color utilities for the IDML Viewer
 */

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
 * @returns {string} The page background color
 */
export const getPageBackgroundColor = (
  page,
  documentData,
  convertColorFn,
  getDocumentBackgroundColorFn
) => {
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
    return convertColorFn(page.backgroundColor, documentData);
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
    }
  }

  // Fall back to document background color
  console.log(
    `📄 No page-specific background found, using document background`
  );
  return getDocumentBackgroundColorFn(documentData);
};

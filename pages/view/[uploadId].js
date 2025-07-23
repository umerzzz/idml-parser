import { useState, useEffect } from "react";
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

  useEffect(() => {
    if (uploadId) {
      loadDocument();
    }
  }, [uploadId]);

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

  // Use ColorUtils for color conversion
  const convertColor = (colorRef) => {
    // If colorRef is a string and matches a color in resources, use the color object
    if (
      typeof colorRef === "string" &&
      documentData.resources &&
      documentData.resources.colors &&
      documentData.resources.colors[colorRef]
    ) {
      return ColorUtils.convertIdmlColorToRgb(
        documentData.resources.colors[colorRef]
      );
    }
    // Otherwise, pass through (handles objects or fallback)
    return ColorUtils.convertIdmlColorToRgb(colorRef);
  };

  const getDocumentBackgroundColor = (documentData) => {
    console.log("🔍 Starting improved background color detection...", {
      config: backgroundConfig,
    });

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

    // Handle configured background modes
    if (backgroundConfig.mode === "white") {
      console.log("📄 ✅ Force white mode - returning white");
      return "white";
    }

    if (backgroundConfig.mode === "transparent") {
      console.log("📄 ✅ Transparent mode - returning transparent");
      return "transparent";
    }

    if (backgroundConfig.mode === "custom") {
      console.log(
        "📄 ✅ Custom color mode - returning:",
        backgroundConfig.customColor
      );
      return backgroundConfig.customColor;
    }

    // Auto mode - continue with detection logic

    // Strategy 1: Look for page background color in pageInfo
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

    // Strategy 2: Look for document background in document properties
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

    // Strategy 3: Look for spreads background color
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

    // STRATEGY 3.5: Analyze document colors for suitable background colors using ColorUtils
    if (documentData.resources?.colors) {
      console.log("📄 Analyzing document colors for background candidates...");

      // Use ColorUtils to analyze and filter background colors
      const colorKeys = Object.keys(documentData.resources.colors);
      const backgroundCandidates = [];

      for (const colorKey of colorKeys) {
        const analysis = ColorUtils.analyzeIdmlColorForBackground(colorKey);
        if (analysis && analysis.isLightBackground) {
          console.log(
            `   ✅ Background candidate: ${colorKey} - ${analysis.reasoning} (${analysis.category})`
          );
          backgroundCandidates.push(colorKey);
        } else if (analysis) {
          console.log(
            `   ❌ Not suitable: ${colorKey} - ${analysis.reasoning}`
          );
        }
      }

      if (backgroundCandidates.length > 0) {
        // Sort candidates using ColorUtils sorting function
        const sortedCandidates =
          ColorUtils.sortColorsByLightness(backgroundCandidates);
        const bestCandidate = sortedCandidates[0];

        console.log(
          `📄 Found ${backgroundCandidates.length} background color candidates:`,
          sortedCandidates
        );
        console.log("📄 Using best background color candidate:", bestCandidate);
        return convertColor(bestCandidate);
      }
    }

    // Strategy 4: Look for a large background rectangle element with actual fill
    if (documentData.elements) {
      const pageWidth =
        documentData.pageInfo?.dimensions?.pixelDimensions?.width || 612;
      const pageHeight =
        documentData.pageInfo?.dimensions?.pixelDimensions?.height || 792;

      console.log(
        "📄 Searching for background in",
        documentData.elements.length,
        "elements"
      );
      console.log("📄 Page dimensions:", pageWidth, "x", pageHeight);

      // Log all rectangles with their positions and fills for debugging
      const rectangles = documentData.elements.filter(
        (element) => element.type === "Rectangle"
      );
      console.log("📄 Found", rectangles.length, "rectangles:");

      let hasAnyActualFill = false;
      rectangles.forEach((rect) => {
        console.log(
          `   - ${rect.id}: pos(${rect.position.x}, ${rect.position.y}) size(${rect.position.width} x ${rect.position.height}) fill: ${rect.fill}`
        );
        if (rect.fill && rect.fill !== "Color/None") {
          hasAnyActualFill = true;
        }
      });

      // CRITICAL FIX: If ALL rectangles have Color/None, check if we already found a background color above
      if (!hasAnyActualFill) {
        console.log(
          "📄 ✅ ALL rectangles have Color/None - but checking for document-level background first"
        );
        // Don't immediately default to white - continue checking other strategies
      }

      // Strategy 4a: Look for rectangles that cover the entire page area with actual color
      const fullPageElements = documentData.elements.filter((element) => {
        return (
          element.type === "Rectangle" &&
          element.position.x <= 50 && // More tolerance for left edge
          element.position.y <= 50 && // More tolerance for top edge
          element.position.width >= pageWidth * 0.8 && // Covers most width
          element.position.height >= pageHeight * 0.8 && // Covers most height
          element.fill &&
          element.fill !== "Color/None"
        );
      });

      if (fullPageElements.length > 0) {
        // Get the largest background element (likely the page background)
        const backgroundElement = fullPageElements.reduce(
          (largest, current) => {
            const largestArea =
              largest.position.width * largest.position.height;
            const currentArea =
              current.position.width * current.position.height;
            return currentArea > largestArea ? current : largest;
          }
        );

        console.log(
          "📄 Found full-page background element:",
          backgroundElement.id,
          "with color:",
          backgroundElement.fill
        );
        return convertColor(backgroundElement.fill);
      }

      // Strategy 4b: Look for any large rectangle with actual color (even if not full page)
      const largeColoredElements = documentData.elements.filter((element) => {
        const area = element.position.width * element.position.height;
        const pageArea = pageWidth * pageHeight;
        return (
          element.type === "Rectangle" &&
          area >= pageArea * 0.3 && // At least 30% of page area
          element.fill &&
          element.fill !== "Color/None"
        );
      });

      if (largeColoredElements.length > 0) {
        // Sort by area, largest first
        largeColoredElements.sort((a, b) => {
          const areaA = a.position.width * a.position.height;
          const areaB = b.position.width * b.position.height;
          return areaB - areaA;
        });

        const backgroundElement = largeColoredElements[0];
        console.log(
          "📄 Found large colored background element:",
          backgroundElement.id,
          "with color:",
          backgroundElement.fill
        );
        return convertColor(backgroundElement.fill);
      }
    }

    // Strategy 5: Look for Paper color specifically (InDesign's default) - if enabled
    if (backgroundConfig.preferPaperColor && documentData.resources?.colors) {
      const paperColor = Object.entries(documentData.resources.colors).find(
        ([key, color]) => color.name === "Paper" || key === "Color/Paper"
      );

      if (paperColor) {
        console.log("📄 Found Paper color in resources - using as background");
        return convertColor(paperColor[0]);
      }
    }

    // Strategy 6: Check for explicitly named background colors
    if (documentData.resources?.colors) {
      // Look for specific background color names
      const backgroundColorNames = [
        "Page",
        "Background",
        "Document",
        "Page Color",
        "Background Color",
      ];

      for (const colorName of backgroundColorNames) {
        const foundColor = Object.entries(documentData.resources.colors).find(
          ([key, color]) =>
            color.name &&
            backgroundColorNames.some((name) =>
              color.name.toLowerCase().includes(name.toLowerCase())
            )
        );

        if (foundColor) {
          console.log("📄 Found named background color:", foundColor[1].name);
          return convertColor(foundColor[0]);
        }
      }
    }

    // Strategy 7: Check spreads data for background colors
    if (documentData.spreads) {
      console.log("📄 Checking spreads for background colors...");
      for (const [spreadId, spread] of Object.entries(documentData.spreads)) {
        console.log(`   - Spread ${spreadId} keys:`, Object.keys(spread));

        // Check for page background in spread
        if (spread.pages) {
          for (const [index, page] of spread.pages.entries()) {
            console.log(`     - Page ${index} keys:`, Object.keys(page));
            if (page.backgroundColor && page.backgroundColor !== "Color/None") {
              console.log(
                "📄 Found page background in spread page:",
                page.backgroundColor
              );
              return convertColor(page.backgroundColor);
            }
          }
        }
      }
    }

    // Strategy 8: Check master spreads for background
    if (documentData.masterSpreads) {
      console.log("📄 Checking master spreads for background colors...");
      for (const [masterId, master] of Object.entries(
        documentData.masterSpreads
      )) {
        console.log(`   - Master ${masterId} keys:`, Object.keys(master));
        if (master.backgroundColor && master.backgroundColor !== "Color/None") {
          console.log(
            "📄 Found master spread background:",
            master.backgroundColor
          );
          return convertColor(master.backgroundColor);
        }
      }
    }

    // Strategy 9: IMPROVED color analysis - only as last resort and only for colors actually used as fills - if enabled
    if (
      backgroundConfig.allowColorAnalysis &&
      documentData.resources?.colors &&
      documentData.elements
    ) {
      console.log("📄 Performing last-resort color analysis...");

      // First, get all colors actually used as fills in the document
      const usedFillColors = new Set();
      documentData.elements.forEach((element) => {
        if (element.fill && element.fill !== "Color/None") {
          usedFillColors.add(element.fill);
        }
      });

      console.log(
        "📄 Colors actually used as fills:",
        Array.from(usedFillColors)
      );

      if (usedFillColors.size === 0) {
        console.log(
          "📄 ✅ No colors used as fills - confirming white background"
        );
        return "white";
      }

      // Analyze only colors that are actually used as fills
      const fillColorAnalysis = Array.from(usedFillColors)
        .map((colorKey) => {
          const color = documentData.resources.colors[colorKey];
          if (!color) return null;

          // Extract CMYK values from the key if available
          const cmykMatch = colorKey.match(
            /Color\/C=([\d.]+)\s*M=([\d.]+)\s*Y=([\d.]+)\s*K=([\d.]+)/
          );
          if (!cmykMatch) return null;

          const [, c, m, y, k] = cmykMatch.map((val) => parseFloat(val));
          console.log(
            `   → Analyzing used fill color ${colorKey}: C=${c} M=${m} Y=${y} K=${k}`
          );

          // Calculate how "background-like" this color is
          const colorfulness = c + m + y;
          const darkness = k;
          const lightness = 100 - darkness; // Higher is lighter

          // Background colors should typically be:
          // - Low colorfulness (neutral)
          // - High lightness (bright)
          // - Large coverage area

          let backgroundScore = 0;

          // Prefer lighter colors (white/paper-like)
          backgroundScore += lightness * 2;

          // Slightly penalize very colorful colors (unless they cover large areas)
          if (colorfulness > 50) {
            backgroundScore -= colorfulness * 0.5;
          }

          // Calculate total area covered by this color
          let totalArea = 0;
          documentData.elements.forEach((element) => {
            if (element.fill === colorKey) {
              totalArea +=
                (element.position.width || 0) * (element.position.height || 0);
            }
          });

          const pageArea =
            (documentData.pageInfo?.dimensions?.width || 612) *
            (documentData.pageInfo?.dimensions?.height || 792);
          const coverageRatio = totalArea / pageArea;

          // Heavily boost colors that cover large areas
          backgroundScore += coverageRatio * 1000;

          console.log(
            `   📊 Background score for ${colorKey}: ${backgroundScore} (lightness: ${lightness}, colorfulness: ${colorfulness}, coverage: ${coverageRatio.toFixed(
              3
            )})`
          );

          return {
            key: colorKey,
            color,
            cmyk: { c, m, y, k },
            backgroundScore,
            lightness,
            colorfulness,
            coverageRatio,
          };
        })
        .filter(Boolean);

      if (fillColorAnalysis.length > 0) {
        // Sort by background score (highest first)
        fillColorAnalysis.sort((a, b) => b.backgroundScore - a.backgroundScore);
        const bestBackgroundColor = fillColorAnalysis[0];

        console.log(
          `🎨 Selected background color from fills: ${bestBackgroundColor.key} (score: ${bestBackgroundColor.backgroundScore})`
        );
        console.log(
          `   Color details: C=${bestBackgroundColor.cmyk.c} M=${bestBackgroundColor.cmyk.m} Y=${bestBackgroundColor.cmyk.y} K=${bestBackgroundColor.cmyk.k}`
        );
        return convertColor(bestBackgroundColor.key);
      }
    }

    // Final Fallback: Use configured fallback
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

  // ENHANCED: Pixel-perfect text measurement using canvas for accuracy
  const measureTextAccurately = (
    text,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle
  ) => {
    // Create a canvas for precise text measurement
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Set font properties to match the text
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    const metrics = ctx.measureText(text);
    const width = metrics.width;
    const height = fontSize * 1.2; // Approximate height based on font size

    return {
      width,
      height,
      actualBounds:
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
    };
  };

  // IMPROVED: Calculate text metrics with more generous spacing
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

    // Method 1: Canvas-based measurement (most accurate)
    const canvasMetrics = measureTextAccurately(
      text,
      fontSize,
      fontFamily,
      fontWeight,
      fontStyle
    );

    // IMPROVED: More generous line height calculation
    let lineHeightPx;
    if (typeof lineHeight === "string" && lineHeight.includes("px")) {
      lineHeightPx = parseFloat(lineHeight);
    } else if (typeof lineHeight === "number") {
      lineHeightPx = lineHeight * fontSize;
    } else {
      // Parse CSS line-height values like "1.2", "1.5", etc.
      const numericLineHeight = parseFloat(lineHeight) || 1.2;
      lineHeightPx = numericLineHeight * fontSize;
    }

    // FIXED: More accurate word-based wrapping like InDesign
    const effectiveWidth = containerWidth - 4; // Account for padding

    // Split text into words and measure actual width
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const lines = [];
    let currentLine = "";
    let currentLineWidth = 0;

    // Create canvas context for accurate word measurement
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordWidth = ctx.measureText(word).width;
      const spaceWidth = ctx.measureText(" ").width;

      // Check if adding this word would exceed the line width
      const wordWithSpaceWidth = currentLine
        ? wordWidth + spaceWidth
        : wordWidth;

      if (
        currentLine &&
        currentLineWidth + wordWithSpaceWidth > effectiveWidth
      ) {
        // Start a new line
        lines.push(currentLine);
        currentLine = word;
        currentLineWidth = wordWidth;
      } else {
        // Add word to current line
        if (currentLine) {
          currentLine += " " + word;
          currentLineWidth += wordWithSpaceWidth;
        } else {
          currentLine = word;
          currentLineWidth = wordWidth;
        }
      }
    }

    // Add the last line if it has content
    if (currentLine) {
      lines.push(currentLine);
    }

    const estimatedLines = Math.max(1, lines.length);
    const estimatedTextHeight = estimatedLines * lineHeightPx;

    // Account for padding in available height
    const availableHeight = containerHeight - 4;

    return {
      estimatedLines,
      estimatedTextHeight,
      lineHeightPx,
      availableHeight,
      actualLines: lines, // Include actual line breakdown for debugging
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

  // ENHANCED: Multiple text fitting strategies for pixel-perfect display
  const TEXT_FITTING_STRATEGIES = {
    AUTO_SCALE: "auto_scale", // Reduce font size to fit
    TRUNCATE: "truncate", // Cut off with ellipsis
    ALLOW_OVERFLOW: "allow_overflow", // Let text overflow naturally
    PRECISE_FIT: "precise_fit", // InDesign-style precise fitting
    COMPRESS_LINES: "compress_lines", // Reduce line height first
  };

  // Configuration - you can change this based on your preference
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
        // Progressive font size reduction
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
        // Calculate how many lines can fit
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
        // First try reducing line height, then font size if needed
        const targetHeight = textMetrics.availableHeight;
        const currentHeight = textMetrics.estimatedTextHeight;
        const compressionRatio = targetHeight / currentHeight;

        if (compressionRatio > 0.8) {
          // Just compress line height
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
          // Compress both line height and font size
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
        // ENHANCED: More nuanced fitting approach
        const compressionNeeded =
          textMetrics.availableHeight / textMetrics.estimatedTextHeight;

        if (compressionNeeded >= 0.95) {
          // Text fits well, just ensure no overflow
          return {
            styles: {
              ...baseStyles,
              overflow: "hidden",
            },
            wasAdjusted: false,
            adjustmentDetails: { type: "no_adjustment_needed" },
          };
        } else if (compressionNeeded > 0.85) {
          // Minor adjustment - just reduce line height slightly
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
          // Moderate adjustment - compress both font and line height proportionally
          const fontScale = Math.max(0.9, Math.sqrt(compressionNeeded)); // Less aggressive font scaling
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
          // Major adjustment - apply reasonable compression then allow slight overflow
          const maxFontScale = 0.85; // Less aggressive than before
          const maxLineScale = 0.8; // Less aggressive than before

          return {
            styles: {
              ...baseStyles,
              fontSize: `${fontSize * maxFontScale}px`,
              lineHeight: Math.max(
                0.8,
                parseFloat(baseStyles.lineHeight) * maxLineScale
              ),
              overflow: "hidden",
              // Allow some overflow rather than harsh truncation
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
            overflow: "visible", // Let text overflow naturally
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
      console.log("Text value:", story.text); // Debug: check actual value before rendering
      // Use CSS to preserve all whitespace and newlines
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

    // DEBUG: Count line breaks in formatted content
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
        // FIXED: Render ALL line breaks to preserve user's intended spacing
        if (content.formatting?.isBreak) {
          // Render any type of line break - don't filter based on source
          console.log(
            `🎨 Rendering line break ${index}: source=${content.formatting.source}, type=${content.formatting.breakType}`
          );
          return <br key={index} />;
        }

        const formatting = content.formatting || {};
        // CRITICAL FIX: Use adjusted font size if overflow prevention was applied
        const originalFontSize =
          formatting.fontSize || story.styling?.fontSize || 12;
        const fontSize = adjustedFontSize || originalFontSize;

        // DEBUG: Log style resolution for any text with formatting applied (generic check)
        const hasFormatting =
          formatting.fontStyle ||
          formatting.characterStyle ||
          formatting.paragraphStyle;
        const finalFontStyle = getFontStyle(formatting.fontStyle);

        if (hasFormatting || finalFontStyle === "italic") {
          console.log(
            "🎨 Style resolution for text:",
            JSON.stringify(content.text?.substring(0, 20) + "..."),
            {
              rawFormatting: formatting,
              resolvedFontStyle: formatting.fontStyle,
              storyDefaultStyle: story.styling?.fontStyle,
              finalFontStyle: finalFontStyle,
              characterStyle: formatting.characterStyle,
              paragraphStyle: formatting.paragraphStyle,
            }
          );

          // WARN: Alert if italic is being applied when it shouldn't be
          if (
            finalFontStyle === "italic" &&
            (!formatting.fontStyle || formatting.fontStyle === "Regular")
          ) {
            console.warn(
              "⚠️  UNEXPECTED ITALIC: Text is being styled as italic but fontStyle is:",
              formatting.fontStyle
            );
          }
        }

        // IMPROVED: More generous line height calculation for individual spans
        let lineHeight = "inherit"; // Inherit from parent container

        if (formatting.effectiveLineHeight) {
          lineHeight = formatting.effectiveLineHeight;
        } else if (formatting.leading !== undefined) {
          if (formatting.leading === "auto") {
            lineHeight = "inherit";
          } else if (typeof formatting.leading === "number") {
            // IMPROVED: More generous line height range to prevent text chopping
            const ratio = formatting.leading / fontSize;
            lineHeight = Math.max(1.1, Math.min(2.5, ratio)); // More generous range
          }
        }

        // ENHANCED: Use complete character styles if available
        const completeStyles = formatting.completeStyles || {};

        const style = {
          fontSize: `${fontSize}px`,
          fontFamily:
            formatting.fontFamily ||
            story.styling?.fontFamily ||
            "Arial, sans-serif",

          // ENHANCED: Use complete style analysis for proper font weight/style
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

          // ENHANCED: Complete text decoration support
          textDecoration:
            completeStyles.textDecoration || extractTextDecorations(formatting),

          // ENHANCED: Text effects
          textTransform: completeStyles.textTransform || "none",
          textShadow: completeStyles.textShadow || "none",

          // FIXED: Remove margins that could cause spacing issues
          margin: 0,
          padding: 0,

          // Only apply indentation if explicitly specified
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

          // ENHANCED: Advanced InDesign properties
          ...(completeStyles.baselineShift && {
            verticalAlign: `${completeStyles.baselineShift}px`,
          }),
          ...(completeStyles.horizontalScale &&
            completeStyles.horizontalScale !== 100 && {
              transform: `scaleX(${completeStyles.horizontalScale / 100})`,
            }),
        };

        // CRITICAL FIX: Add space after span if needed to prevent word joining
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

        // DEBUG: Log space insertion for problematic text
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
      .filter(Boolean); // Remove null entries from skipped line breaks
  };

  const getStoryStyles = (
    story,
    containerHeight = null,
    containerWidth = null
  ) => {
    const styling = story.styling || {};
    const fontSize = styling.fontSize || 12;

    // IMPROVED: More generous line height calculation to prevent text chopping
    let lineHeight = "1.3"; // More generous default CSS line-height

    if (styling.effectiveLineHeight) {
      lineHeight = styling.effectiveLineHeight;
    } else if (styling.leading !== undefined) {
      if (styling.leading === "auto") {
        lineHeight = "1.3"; // More generous auto line height
      } else if (typeof styling.leading === "number") {
        // Convert InDesign points to CSS line-height ratio, more generous range
        const ratio = styling.leading / fontSize;
        lineHeight = Math.max(1.1, Math.min(2.5, ratio)).toString(); // More generous range
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

      // IMPROVED: Minimal padding to prevent container size conflicts
      padding: "1px 2px",
      margin: 0,

      // FIXED: Use full container size, let CSS handle overflow properly
      height: "100%", // Use full container height
      width: "100%", // Use full container width
      minHeight: `${fontSize * 1.4}px`, // More generous minimum height

      wordWrap: "break-word",
      overflow: "visible", // CHANGED: Allow text to be visible instead of hidden
      boxSizing: "border-box",

      // IMPROVED: Better text layout handling
      display: "block",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      overflowWrap: "break-word",

      // IMPROVED: Allow text to flow naturally
      textOverflow: "visible", // Don't clip text
      lineClamp: "none", // Allow long words to break if needed

      // Remove flexbox alignment that might cause issues
      // justifyContent: styling.alignment === "CenterAlign" ? "center" : "flex-start",
    };
  };

  // ENHANCED: Extract InDesign-accurate formatting for precise text measurement
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

      // InDesign-specific properties for precise measurement
      leading: formatting.leading || styling.leading || "auto",
      leadingType: formatting.leadingType || styling.leadingType || "auto",
      tracking: formatting.tracking || styling.tracking || 0,
      baselineShift: formatting.baselineShift || 0,

      // Text frame properties
      firstBaselineOffset: formatting.firstBaselineOffset || "AscentOffset",
      verticalJustification: formatting.verticalJustification || "TopAlign",
    };
  };

  if (loading) {
    return <div style={{ padding: "20px" }}>Loading document...</div>;
  }

  if (!documentData) {
    return <div style={{ padding: "20px" }}>Error loading document</div>;
  }

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Enhanced Sidebar */}
      <div
        style={{
          width: "400px",
          backgroundColor: "#f5f5f5",
          padding: "20px",
          overflowY: "auto",
        }}
      >
        {/* Text Fitting Strategy Selector */}
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

        {/* Background Color Configuration */}
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

          {/* Background Mode Selector */}
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

          {/* Custom Color Picker - shown when custom mode selected */}
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

          {/* Advanced Options - shown when auto mode selected */}
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

          {/* Current Background Display */}
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

        {/* View Controls */}
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
          </div>
        </div>

        {/* Status Indicators Legend */}
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

        <h3>Document Info</h3>
        <p>Version: {documentData.document?.version}</p>
        <p>Pages: {documentData.document?.pageCount}</p>
        <p>
          Size:{" "}
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
          {documentData.pageInfo?.dimensions?.pixelDimensions && (
            <span style={{ fontSize: "12px", color: "#666", display: "block" }}>
              (Original: {Math.round(documentData.pageInfo.dimensions.width)} ×{" "}
              {Math.round(documentData.pageInfo.dimensions.height)}{" "}
              {documentData.pageInfo.dimensions.units})
            </span>
          )}
        </p>

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
          Elements ({documentData.elements?.length || 0})
        </h3>
        {(documentData.elements || []).map((element, index) => (
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
        {Object.keys(documentData.stories || {}).map((storyId) => {
          const story = documentData.stories[storyId];
          return (
            <div
              key={storyId}
              style={{
                padding: "8px",
                margin: "4px 0",
                backgroundColor: "red",
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
              {story.formattedContent && story.formattedContent.length > 1 && (
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
        })}
      </div>

      {/* Enhanced Canvas */}
      <div
        style={{
          display: "flex",
          flex: 1,
          justifyContent: "center", // keep this to center it
          alignItems: "flex-start", // align to top, not center vertically
          padding: "20px",
          overflow: "auto", // Changed to auto to allow scrolling if needed
          backgroundColor: "#e9ecef", // FIXED: Keep outer container neutral gray background
        }}
      >
        {/* FIXED: Document Canvas Container - only this gets the document background */}
        <div
          style={{
            position: "relative",
            width:
              (documentData.pageInfo?.dimensions?.pixelDimensions?.width ||
                documentData.pageInfo?.dimensions?.width ||
                612) + "px",
            height:
              (documentData.pageInfo?.dimensions?.pixelDimensions?.height ||
                documentData.pageInfo?.dimensions?.height ||
                792) + "px",
            backgroundColor: (() => {
              const bgColor = getDocumentBackgroundColor(documentData);
              console.log(
                "🎨 Final background color being applied to DOCUMENT CANVAS only:",
                bgColor
              );
              return bgColor;
            })(),
            margin: "0 auto",
            border: "1px solid #ccc",
            boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
            overflow: "hidden", // Clip content to page boundaries
            // FIXED: Ensure this container is clearly distinct from the outer background
            borderRadius: "2px",
          }}
        >
          {(() => {
            // DEBUG: Log page dimensions and margins
            const pageWidth =
              documentData.pageInfo?.dimensions?.pixelDimensions?.width ||
              documentData.pageInfo?.dimensions?.width ||
              612;
            const pageHeight =
              documentData.pageInfo?.dimensions?.pixelDimensions?.height ||
              documentData.pageInfo?.dimensions?.height ||
              792;
            const marginLeft =
              documentData.pageInfo?.margins?.pixelMargins?.left ||
              documentData.pageInfo?.margins?.left ||
              0;
            const marginTop =
              documentData.pageInfo?.margins?.pixelMargins?.top ||
              documentData.pageInfo?.margins?.top ||
              0;
            const marginRight =
              documentData.pageInfo?.margins?.pixelMargins?.right ||
              documentData.pageInfo?.margins?.right ||
              0;
            const marginBottom =
              documentData.pageInfo?.margins?.pixelMargins?.bottom ||
              documentData.pageInfo?.margins?.bottom ||
              0;

            if (showDebugInfo) {
              console.log("📐 PAGE DIMENSIONS DEBUG:");
              console.log(`   📏 Page size: ${pageWidth} × ${pageHeight}px`);
              console.log(
                `   📏 Margins: top=${marginTop}, right=${marginRight}, bottom=${marginBottom}, left=${marginLeft}`
              );
              console.log(
                `   📏 Content area: ${
                  pageWidth - marginLeft - marginRight
                } × ${pageHeight - marginTop - marginBottom}px`
              );
              console.log(
                `   📏 Dotted border position: top=${marginTop}, left=${marginLeft}, right=${marginRight}, bottom=${marginBottom}`
              );
            }

            return null; // This is just for debugging, return nothing
          })()}
          {/* Margins Visualization - only show when enabled */}
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

              if (showDebugInfo) {
                console.log("📐 MARGIN VISUALIZATION:", {
                  top: visualMarginTop,
                  left: visualMarginLeft,
                  right: visualMarginRight,
                  bottom: visualMarginBottom,
                });
              }

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
          {(documentData.elements || []).map((element, index) => {
            // ENFORCED: Only use pixelPosition (in pixels) for rendering
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

            // FIXED: Remove margin application - margins are for visual guidelines only
            // Element positions should be exactly as calculated from IDML coordinates
            // Margins in the UI are just dotted lines showing the content area

            if (showDebugInfo) {
              console.log(
                "🧱 Element positioning:",
                element.id,
                "Type:",
                element.type,
                "Position source:",
                element.pixelPosition ? "pixelPosition" : "position",
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
                onClick={() => setSelectedElement(element)}
                style={{
                  position: "absolute",
                  // FIXED: Use element position directly without any margin offsets
                  // This ensures pixel-perfect positioning matching InDesign layout
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
                  overflow: "visible", // CRITICAL: Allow text containers to overflow frame if needed
                  transform: elementPosition.rotation
                    ? `rotate(${elementPosition.rotation}deg)`
                    : undefined,
                  transformOrigin: "center center",
                  zIndex: index,
                  boxSizing: "border-box",
                  boxShadow: isContentFrame
                    ? "0 0 0 1px rgba(0, 170, 255, 0.3)"
                    : "none",
                }}
                title={`${element.type} (${element.id})${
                  isContentFrame ? " - Content Frame" : ""
                }$[PIXEL ONLY]`}
              >
                {/* Debug position label */}
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

                {/* Enhanced Image Rendering for both embedded and external images */}
                {((hasPlacedContent &&
                  element.placedContent?.type === "Image") ||
                  element.linkedImage) && (
                  <div
                    style={{
                      position: "absolute",
                      width: "100%",
                      height: "100%",
                      overflow: "hidden",
                    }}
                  >
                    {element.linkedImage?.isEmbedded &&
                    element.linkedImage?.isExtracted ? (
                      // Handle extracted embedded images
                      <img
                        src={element.linkedImage.url}
                        alt="Extracted embedded content"
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
                          console.error("Error loading extracted image:", e);
                          e.target.style.display = "none";
                          e.target.nextSibling.style.display = "flex";
                        }}
                      />
                    ) : element.linkedImage?.isEmbedded ? (
                      // Handle embedded placeholder when no extracted image
                      <div
                        style={{
                          position: "absolute",
                          left:
                            element.placedContent?.transform?.tx + "px" ||
                            "0px",
                          top:
                            element.placedContent?.transform?.ty + "px" ||
                            "0px",
                          transform: `scale(${
                            element.placedContent?.transform?.a || 1
                          }, ${element.placedContent?.transform?.d || 1})`,
                          transformOrigin: "top left",
                          width: "200px",
                          height: "200px",
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
                        <span style={{ fontSize: "10px" }}>
                          {element.linkedImage?.embeddedType}
                        </span>
                        <br />
                        <span style={{ fontSize: "10px" }}>
                          PPI: {element.placedContent?.actualPpi}
                        </span>
                      </div>
                    ) : element.linkedImage?.url ? (
                      // Handle external images
                      <img
                        src={element.linkedImage.url}
                        alt="External linked content"
                        style={{
                          position: "absolute",
                          left:
                            element.placedContent?.transform?.tx + "px" ||
                            "0px",
                          top:
                            element.placedContent?.transform?.ty + "px" ||
                            "0px",
                          transform: `scale(${
                            element.placedContent?.transform?.a || 1
                          }, ${element.placedContent?.transform?.d || 1})`,
                          transformOrigin: "top left",
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      // Fallback placeholder
                      <div
                        style={{
                          position: "absolute",
                          left: element.placedContent?.transform?.tx + "px",
                          top: element.placedContent?.transform?.ty + "px",
                          transform: `scale(${
                            element.placedContent?.transform?.a || 1
                          }, ${element.placedContent?.transform?.d || 1})`,
                          transformOrigin: "top left",
                          width: "200px",
                          height: "200px",
                          backgroundColor: "#f0f0f0",
                          border: "1px solid #ccc",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          color: "#666",
                        }}
                      >
                        📷 {element.placedContent?.imageTypeName}
                        <br />
                        {element.placedContent?.actualPpi}
                      </div>
                    )}

                    {/* Error fallback div */}
                    <div
                      style={{
                        position: "absolute",
                        left:
                          element.placedContent?.transform?.tx + "px" || "0px",
                        top:
                          element.placedContent?.transform?.ty + "px" || "0px",
                        transform: `scale(${
                          element.placedContent?.transform?.a || 1
                        }, ${element.placedContent?.transform?.d || 1})`,
                        transformOrigin: "top left",
                        width: "200px",
                        height: "200px",
                        backgroundColor: "#ffeeee",
                        border: "2px solid #ff6b6b",
                        display: "none",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        color: "#ff6b6b",
                        flexDirection: "column",
                      }}
                    >
                      ❌ Image Load Error
                    </div>
                  </div>
                )}

                {/* PIXEL-PERFECT Text Rendering with Advanced Fitting Strategies */}
                {element.type === "TextFrame" &&
                  element.parentStory &&
                  documentData.stories[element.parentStory] &&
                  (() => {
                    const story = documentData.stories[element.parentStory];

                    // ENHANCED: Calculate precise text frame metrics using InDesign-compatible system
                    const frameMetrics =
                      InDesignTextMetrics.calculateTextFrameInsets(
                        element,
                        element.textFramePreferences
                      );

                    // Get story formatting with InDesign-accurate properties
                    const storyFormatting =
                      getInDesignAccurateFormatting(story);

                    // Clean text to remove excessive line breaks that could cause overflow
                    const cleanText = (story.text || "")
                      .replace(/\n\s*\n/g, "\n")
                      .trim();

                    // ENHANCED: Use InDesign-accurate text measurement
                    const textMeasurement =
                      InDesignTextMetrics.measureTextPrecisely(
                        cleanText,
                        storyFormatting,
                        frameMetrics
                      );

                    // IMPROVED: Generate CSS styles with full container dimensions
                    let finalStyles = getStoryStyles(
                      story,
                      element.position.height,
                      element.position.width
                    );
                    let wasAdjusted = false;
                    let adjustmentDetails = null;

                    // IMPROVED: Use full container dimensions for overflow detection (in pixels)
                    const containerWidth = elementPosition.width; // Use full width in pixels
                    const containerHeight = elementPosition.height; // Use full height in pixels // Use full height

                    // TEMPORARILY DISABLED: Apply overflow prevention if needed (may be causing text chopping)
                    if (false && textMeasurement.willOverflow) {
                      console.log(
                        `📏 Text overflow detected in story ${element.parentStory}:`,
                        {
                          textHeight: textMeasurement.textHeight,
                          availableHeight: textMeasurement.availableHeight,
                          overflowAmount: textMeasurement.overflowAmount,
                          lineCount: textMeasurement.lineCount,
                        }
                      );

                      const adjustment =
                        InDesignTextMetrics.calculateOptimalFontSize(
                          textMeasurement,
                          storyFormatting,
                          0.25 // Maximum 25% font size reduction for better overflow prevention
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

                    // Extract adjusted font size for text spans
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
                      }\nFont: ${adjustmentDetails.originalFontSize}px → ${
                        adjustmentDetails.newFontSize
                      }px\nScale: ${(
                        adjustmentDetails.scaleFactor * 100
                      ).toFixed(1)}%`;
                    };

                    return (
                      <div
                        style={{
                          // HYBRID APPROACH: Use full frame size but apply insets as padding
                          position: "absolute",
                          top: "0px", // Use full frame positioning
                          left: "0px", // Use full frame positioning
                          width: `${elementPosition.width}px`, // Use full frame width in pixels
                          height: `${elementPosition.height}px`, // Use full frame height in pixels

                          // HYBRID: Apply insets as padding to create visual spacing without reducing text area too much
                          padding: `${frameMetrics.insets.top}px ${frameMetrics.insets.right}px ${frameMetrics.insets.bottom}px ${frameMetrics.insets.left}px`,

                          // Text styling from story
                          fontSize: `${finalStyles.fontSize}`,
                          fontFamily: finalStyles.fontFamily,
                          fontWeight: finalStyles.fontWeight,
                          fontStyle: finalStyles.fontStyle,
                          color: finalStyles.color,
                          textAlign: finalStyles.textAlign,
                          lineHeight: finalStyles.lineHeight,
                          letterSpacing: finalStyles.letterSpacing,

                          margin: 0,

                          // Text layout - allow overflow to prevent chopping
                          display: "block",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          overflowWrap: "break-word",
                          overflow: "visible", // CRITICAL: Allow text to overflow to prevent chopping
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
                              backgroundColor: adjustmentDetails?.stillOverflows
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
                            {adjustmentDetails?.stillOverflows ? "⚠️" : "🎯"}
                          </div>
                        )}

                        {/* Perfect fit indicator */}
                        {!wasAdjusted && !textMeasurement.willOverflow && (
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

                {/* Content frame placeholder when no content */}
                {/* Content frame placeholder when no content */}
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
                            style={{ fontSize: "10px", fontStyle: "italic" }}
                          >
                            {element.name}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                {/* Other elements */}
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
          {/* Enhanced Selection Info Panel */}
          {selectedElement && (
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                backgroundColor: "rgba(0, 123, 255, 0.95)",
                color: "white",
                padding: "12px",
                borderRadius: "6px",
                fontSize: "12px",
                maxWidth: "300px",
                lineHeight: "1.4",
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

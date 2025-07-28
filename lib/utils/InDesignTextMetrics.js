/**
 * InDesignTextMetrics.js - Precise text measurement utility for 1:1 InDesign compatibility
 * Handles font metrics, leading calculations, and text frame insets exactly like InDesign
 */

class InDesignTextMetrics {
  /**
   * Calculate precise text frame dimensions including InDesign-specific insets
   * @param {object} textFrame - The text frame element
   * @param {object} textFramePrefs - Text frame preferences from InDesign
   * @returns {object} Adjusted frame dimensions
   */
  static calculateTextFrameInsets(textFrame, textFramePrefs) {
    // InDesign default text frame insets (in points)
    const DEFAULT_INSETS = {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    };

    // Extract insets from preferences if available
    const insets = {
      top:
        textFramePrefs?.insetSpacing?.top ||
        textFramePrefs?.textInsets?.top ||
        DEFAULT_INSETS.top,
      bottom:
        textFramePrefs?.insetSpacing?.bottom ||
        textFramePrefs?.textInsets?.bottom ||
        DEFAULT_INSETS.bottom,
      left:
        textFramePrefs?.insetSpacing?.left ||
        textFramePrefs?.textInsets?.left ||
        DEFAULT_INSETS.left,
      right:
        textFramePrefs?.insetSpacing?.right ||
        textFramePrefs?.textInsets?.right ||
        DEFAULT_INSETS.right,
    };

    // Calculate content area (available for text)
    const contentArea = {
      width: Math.max(0, textFrame.position.width - insets.left - insets.right),
      height: Math.max(
        0,
        textFrame.position.height - insets.top - insets.bottom
      ),
      offsetX: insets.left,
      offsetY: insets.top,
    };

    return {
      originalFrame: textFrame.position,
      insets,
      contentArea,
      hasInsets:
        insets.top > 0 ||
        insets.bottom > 0 ||
        insets.left > 0 ||
        insets.right > 0,
    };
  }

  /**
   * Convert InDesign leading to precise CSS line-height
   * @param {number|string} leading - InDesign leading value
   * @param {number} fontSize - Font size in points
   * @param {string} leadingType - Type of leading (auto, absolute, percentage)
   * @returns {object} CSS-compatible line height info
   */
  static convertLeadingToCSS(leading, fontSize, leadingType = "auto") {
    let cssLineHeight;
    let lineHeightPx;

    switch (leadingType) {
      case "auto":
        // InDesign auto leading is typically 120% of font size
        cssLineHeight = 1.2;
        lineHeightPx = fontSize * 1.2;
        break;

      case "absolute":
        // Leading is in points, convert to line-height ratio
        if (typeof leading === "number" && leading > 0) {
          cssLineHeight = Math.max(0.8, leading / fontSize);
          lineHeightPx = leading;
        } else {
          cssLineHeight = 1.2;
          lineHeightPx = fontSize * 1.2;
        }
        break;

      case "percentage":
        // Leading is percentage-based
        const percentage = parseFloat(leading) / 100;
        cssLineHeight = Math.max(0.8, percentage);
        lineHeightPx = fontSize * percentage;
        break;

      default:
        cssLineHeight = 1.2;
        lineHeightPx = fontSize * 1.2;
    }

    return {
      cssLineHeight: Math.round(cssLineHeight * 1000) / 1000, // Round to 3 decimal places
      lineHeightPx: Math.round(lineHeightPx * 100) / 100, // Round to 2 decimal places
      leadingType,
      originalLeading: leading,
    };
  }

  /**
   * Calculate first baseline offset according to InDesign rules
   * @param {string} firstBaselineOffset - InDesign first baseline offset setting
   * @param {number} fontSize - Font size in points
   * @param {number} lineHeight - Line height in points
   * @returns {number} First baseline offset in points
   */
  static calculateFirstBaselineOffset(
    firstBaselineOffset,
    fontSize,
    lineHeight
  ) {
    switch (firstBaselineOffset) {
      case "AscentOffset":
        // Text sits at natural ascent line (default)
        return fontSize * 0.8; // Approximate ascent for most fonts

      case "CapHeightOffset":
        // Text sits at cap height
        return fontSize * 0.7; // Approximate cap height for most fonts

      case "FixedHeight":
        // Custom fixed height - use line height
        return lineHeight;

      case "XHeightOffset":
        // Text sits at x-height
        return fontSize * 0.5; // Approximate x-height for most fonts

      default:
        return fontSize * 0.8; // Default to ascent offset
    }
  }

  /**
   * Measure text accurately using canvas with InDesign-specific adjustments
   * @param {string} text - Text to measure
   * @param {object} textStyles - Complete text styling object
   * @param {object} frameMetrics - Text frame metrics
   * @returns {object} Precise text measurement data
   */
  static measureTextPrecisely(text, textStyles, frameMetrics) {
    if (!text || text.trim() === "") {
      return {
        textWidth: 0,
        textHeight: 0,
        lineCount: 0,
        lines: [],
        willOverflow: false,
        fits: true,
      };
    }

    // Create canvas for measurement
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Set font with proper fallbacks
    const fontSize = parseFloat(textStyles.fontSize) || 12;
    const fontFamily = textStyles.fontFamily || "Arial, sans-serif";
    const fontWeight = textStyles.fontWeight || "normal";
    const fontStyle = textStyles.fontStyle || "normal";

    ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

    // Calculate effective content width accounting for tracking
    const tracking = textStyles.tracking || 0;
    const trackingAdjustment = (tracking * fontSize) / 1000; // Convert em to px
    const effectiveWidth = Math.max(
      10,
      frameMetrics.contentArea.width - Math.abs(trackingAdjustment) - 2
    ); // Leave 2px margin

    // Split text into words for accurate wrapping, preserving line breaks
    const words = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split(/(\s+|\n)/)
      .filter((word) => word.length > 0);
    const lines = [];
    let currentLine = "";
    let currentLineWidth = 0;

    // Measure space width once
    const spaceWidth = ctx.measureText(" ").width + trackingAdjustment;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Handle explicit line breaks
      if (word === "\n") {
        if (currentLine) {
          lines.push({
            text: currentLine,
            width: currentLineWidth,
          });
          currentLine = "";
          currentLineWidth = 0;
        }
        continue;
      }

      // Skip pure whitespace (except spaces)
      if (/^\s+$/.test(word) && word !== " ") {
        continue;
      }

      const wordWidth =
        ctx.measureText(word).width +
        Math.max(0, word.length - 1) * trackingAdjustment;

      // Check if word fits on current line
      const wordWithSpaceWidth =
        currentLine && word !== " " ? wordWidth + spaceWidth : wordWidth;

      if (
        currentLine &&
        word !== " " &&
        currentLineWidth + wordWithSpaceWidth > effectiveWidth
      ) {
        // Word doesn't fit, start new line
        lines.push({
          text: currentLine,
          width: currentLineWidth,
        });
        currentLine = word;
        currentLineWidth = wordWidth;
      } else {
        // Word fits, add to current line
        if (currentLine && word !== " ") {
          currentLine += " " + word;
          currentLineWidth += wordWithSpaceWidth;
        } else if (word !== " ") {
          currentLine = word;
          currentLineWidth = wordWidth;
        }
      }
    }

    // Add the last line
    if (currentLine) {
      lines.push({
        text: currentLine,
        width: currentLineWidth,
      });
    }

    // Calculate text height using InDesign-accurate leading
    const lineHeightInfo = this.convertLeadingToCSS(
      textStyles.leading,
      fontSize,
      textStyles.leadingType
    );

    const lineCount = Math.max(1, lines.length);
    const firstBaselineOffset = this.calculateFirstBaselineOffset(
      textStyles.firstBaselineOffset || "AscentOffset",
      fontSize,
      lineHeightInfo.lineHeightPx
    );

    // Calculate total text height including first baseline offset
    const textHeight =
      firstBaselineOffset + (lineCount - 1) * lineHeightInfo.lineHeightPx;

    // Check if text overflows the available height
    const willOverflow = textHeight > frameMetrics.contentArea.height;

    return {
      textWidth: Math.max(...lines.map((line) => line.width)),
      textHeight: Math.round(textHeight * 100) / 100,
      lineCount,
      lines,
      lineHeightPx: lineHeightInfo.lineHeightPx,
      firstBaselineOffset,
      willOverflow,
      fits: !willOverflow,
      availableHeight: frameMetrics.contentArea.height,
      overflowAmount: willOverflow
        ? textHeight - frameMetrics.contentArea.height
        : 0,
      // Detailed metrics for debugging
      metrics: {
        fontSize,
        leading: textStyles.leading,
        leadingType: textStyles.leadingType,
        effectiveWidth,
        tracking: trackingAdjustment,
        spaceWidth,
      },
    };
  }

  /**
   * Calculate optimal font size to prevent overflow while maintaining design integrity
   * @param {object} textMeasurement - Result from measureTextPrecisely
   * @param {object} originalStyles - Original text styles
   * @param {number} maxReduction - Maximum font size reduction allowed (0.0-1.0)
   * @returns {object} Adjusted text styles or null if no adjustment needed
   */
  static calculateOptimalFontSize(
    textMeasurement,
    originalStyles,
    maxReduction = 0.25
  ) {
    if (!textMeasurement.willOverflow) {
      return null; // No adjustment needed
    }

    const originalFontSize = parseFloat(originalStyles.fontSize) || 12;
    const overflowRatio =
      textMeasurement.textHeight / textMeasurement.availableHeight;

    console.log("🔧 calculateOptimalFontSize:", {
      originalFontSize,
      textHeight: textMeasurement.textHeight,
      availableHeight: textMeasurement.availableHeight,
      overflowRatio,
      overflowAmount: textMeasurement.overflowAmount,
    });

    // Calculate required scale factor to fit exactly
    let scaleFactor = 1 / overflowRatio;

    // Apply maximum reduction limit to preserve design integrity
    const minAllowedScale = 1 - maxReduction;
    const finalScaleFactor = Math.max(minAllowedScale, scaleFactor);

    const newFontSize = originalFontSize * finalScaleFactor;

    console.log("🔧 Scale calculation:", {
      requiredScale: scaleFactor,
      maxReduction,
      minAllowedScale,
      finalScaleFactor,
      newFontSize,
    });

    // Calculate if text will still overflow after adjustment
    const willStillOverflow = finalScaleFactor > scaleFactor;

    return {
      adjustedStyles: {
        ...originalStyles,
        fontSize: `${Math.round(newFontSize * 100) / 100}px`,
        // Also adjust line-height proportionally if needed
        lineHeight:
          overflowRatio > 1.3
            ? Math.max(
                0.9,
                parseFloat(originalStyles.lineHeight || "1.2") *
                  finalScaleFactor
              )
            : originalStyles.lineHeight,
      },
      adjustmentType: willStillOverflow
        ? "partial_font_reduction"
        : "font_size_optimized",
      scaleFactor: finalScaleFactor,
      originalFontSize,
      newFontSize: Math.round(newFontSize * 100) / 100,
      stillOverflows: willStillOverflow,
      reductionApplied: ((1 - finalScaleFactor) * 100).toFixed(1) + "%",
    };
  }

  /**
   * Generate CSS styles with InDesign-accurate typography
   * @param {object} inDesignFormatting - Formatting object from InDesign
   * @param {object} frameMetrics - Text frame metrics
   * @returns {object} CSS styles optimized for InDesign compatibility
   */
  static generateInDesignCSS(inDesignFormatting, frameMetrics) {
    const fontSize = inDesignFormatting.fontSize || 12;

    // Convert leading to CSS
    const lineHeightInfo = this.convertLeadingToCSS(
      inDesignFormatting.leading,
      fontSize,
      inDesignFormatting.leadingType
    );

    // Calculate first baseline offset for positioning
    const firstBaselineOffset = this.calculateFirstBaselineOffset(
      inDesignFormatting.firstBaselineOffset || "AscentOffset",
      fontSize,
      lineHeightInfo.lineHeightPx
    );

    return {
      // Typography
      fontSize: `${fontSize}px`,
      lineHeight: lineHeightInfo.cssLineHeight,
      fontFamily: inDesignFormatting.fontFamily || "Arial, sans-serif",
      fontWeight: inDesignFormatting.fontWeight || "normal",
      fontStyle: inDesignFormatting.fontStyle || "normal",

      // Advanced typography
      letterSpacing: inDesignFormatting.tracking
        ? `${inDesignFormatting.tracking / 1000}em`
        : "normal",
      textAlign: inDesignFormatting.textAlign || "left",
      color: inDesignFormatting.color || "black",

      // Layout and positioning - minimal padding to avoid excessive top spacing
      padding: `${Math.min(2, firstBaselineOffset * 0.3)}px ${
        frameMetrics.insets.right
      }px ${frameMetrics.insets.bottom}px ${frameMetrics.insets.left}px`,
      margin: 0,

      // Overflow control
      width: `${frameMetrics.contentArea.width}px`,
      height: `${frameMetrics.contentArea.height}px`,
      overflow: "hidden",
      boxSizing: "border-box",

      // Text layout optimization
      whiteSpace: "normal",
      wordWrap: "break-word",
      overflowWrap: "break-word",
      wordBreak: "normal",

      // InDesign-specific adjustments
      position: "relative",
      top: frameMetrics.hasInsets ? `${frameMetrics.offsetY}px` : "0",
      left: frameMetrics.hasInsets ? `${frameMetrics.offsetX}px` : "0",

      // Debug info (can be removed in production)
      "--indesign-leading": inDesignFormatting.leading,
      "--indesign-leading-type": inDesignFormatting.leadingType,
      "--css-line-height": lineHeightInfo.cssLineHeight,
      "--first-baseline-offset": `${firstBaselineOffset}px`,
    };
  }
}

// ES6 exports
export default InDesignTextMetrics;

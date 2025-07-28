/**
 * ColorUtils.js - Comprehensive color conversion and manipulation utilities
 * Handles CMYK, RGB, HEX, and other color format conversions for IDML processing
 */

class ColorUtils {
  /**
   * Convert CMYK color values to RGB
   * @param {number} c - Cyan (0-100)
   * @param {number} m - Magenta (0-100)
   * @param {number} y - Yellow (0-100)
   * @param {number} k - Black/Key (0-100)
   * @returns {object} RGB object with r, g, b values (0-255)
   */
  static cmykToRgb(c, m, y, k) {
    // Normalize CMYK values to 0-1 range
    const cNorm = c / 100;
    const mNorm = m / 100;
    const yNorm = y / 100;
    const kNorm = k / 100;

    // Convert to RGB using standard formula
    const r = Math.round(255 * (1 - cNorm) * (1 - kNorm));
    const g = Math.round(255 * (1 - mNorm) * (1 - kNorm));
    const b = Math.round(255 * (1 - yNorm) * (1 - kNorm));

    return { r, g, b };
  }

  /**
   * Convert CMYK to RGB CSS string
   * @param {number} c - Cyan (0-100)
   * @param {number} m - Magenta (0-100)
   * @param {number} y - Yellow (0-100)
   * @param {number} k - Black/Key (0-100)
   * @returns {string} CSS rgb() string
   */
  static cmykToRgbString(c, m, y, k) {
    const { r, g, b } = this.cmykToRgb(c, m, y, k);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Convert RGB to HEX
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {string} HEX color string
   */
  static rgbToHex(r, g, b) {
    const toHex = (component) => {
      const hex = component.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Convert CMYK to HEX
   * @param {number} c - Cyan (0-100)
   * @param {number} m - Magenta (0-100)
   * @param {number} y - Yellow (0-100)
   * @param {number} k - Black/Key (0-100)
   * @returns {string} HEX color string
   */
  static cmykToHex(c, m, y, k) {
    const { r, g, b } = this.cmykToRgb(c, m, y, k);
    return this.rgbToHex(r, g, b);
  }

  /**
   * Parse CMYK values from IDML color reference string
   * @param {string} colorRef - IDML color reference (e.g., "Color/C=1 M=18 Y=16 K=0")
   * @returns {object|null} Object with c, m, y, k values or null if not parseable
   */
  static parseCmykFromColorRef(colorRef) {
    if (!colorRef || typeof colorRef !== "string") {
      return null;
    }

    // Match CMYK pattern in IDML color references
    const cmykMatch = colorRef.match(
      /Color\/C=([\d.]+)\s*M=([\d.]+)\s*Y=([\d.]+)\s*K=([\d.]+)/
    );

    if (cmykMatch) {
      const [, c, m, y, k] = cmykMatch.map((val) => parseFloat(val));
      return { c, m, y, k };
    }

    return null;
  }

  /**
   * Convert IDML color reference to RGB CSS string
   * @param {string} colorRef - IDML color reference
   * @returns {string} CSS color string (rgb, hex, or named color)
   */
  static convertIdmlColorToRgb(colorRefOrObj) {
    // ENHANCED: Add enhanced logging for debugging (from second file)
    console.log(
      "ColorUtils.convertIdmlColorToRgb called with:",
      typeof colorRefOrObj === "object"
        ? JSON.stringify(colorRefOrObj, null, 2).substring(0, 200) + "..."
        : colorRefOrObj
    );

    if (!colorRefOrObj || colorRefOrObj === "Color/None") {
      return "transparent";
    }

    // ENHANCED: Handle color objects with intelligent RGB/CMYK prioritization
    if (typeof colorRefOrObj === "object") {
      console.log(`🎨 Converting color object:`, {
        self: colorRefOrObj.self,
        source: colorRefOrObj.colorSource,
        hasRGB: colorRefOrObj.hasDirectRGB,
        hasCMYK: colorRefOrObj.hasDirectCMYK,
        space: colorRefOrObj.space,
      });

      // PRIORITY 1: Use direct RGB values (ONLY if they're meaningful, not all zeros)
      if (
        colorRefOrObj.hasDirectRGB &&
        ((colorRefOrObj.red !== undefined && colorRefOrObj.red > 0) ||
          (colorRefOrObj.green !== undefined && colorRefOrObj.green > 0) ||
          (colorRefOrObj.blue !== undefined && colorRefOrObj.blue > 0))
      ) {
        const rgbString = `rgb(${colorRefOrObj.red || 0}, ${
          colorRefOrObj.green || 0
        }, ${colorRefOrObj.blue || 0})`;
        console.log(
          `   ✅ Using direct RGB values: ${rgbString} (source: ${colorRefOrObj.colorSource})`
        );
        return rgbString;
      }

      // PRIORITY 2: Convert CMYK values to RGB (when RGB not available or RGB is all zeros)
      if (
        colorRefOrObj.hasDirectCMYK &&
        (colorRefOrObj.cyan !== undefined ||
          colorRefOrObj.magenta !== undefined ||
          colorRefOrObj.yellow !== undefined ||
          colorRefOrObj.black !== undefined)
      ) {
        const { r, g, b } = this.cmykToRgb(
          colorRefOrObj.cyan || 0,
          colorRefOrObj.magenta || 0,
          colorRefOrObj.yellow || 0,
          colorRefOrObj.black || 0
        );
        const rgbString = `rgb(${r}, ${g}, ${b})`;
        console.log(
          `   🔄 Converted CMYK to RGB: C:${colorRefOrObj.cyan} M:${colorRefOrObj.magenta} Y:${colorRefOrObj.yellow} K:${colorRefOrObj.black} → ${rgbString} (source: ${colorRefOrObj.colorSource})`
        );
        return rgbString;
      }

      // PRIORITY 3: Handle special case where RGB values are all zero but it's marked as RGB source
      // This should NOT use "0 0 0" for standard colors
      if (
        colorRefOrObj.hasDirectRGB &&
        colorRefOrObj.red === 0 &&
        colorRefOrObj.green === 0 &&
        colorRefOrObj.blue === 0 &&
        colorRefOrObj.isCustomColor === true
      ) {
        // Only use RGB "0 0 0" for custom colors that explicitly want black
        const rgbString = `rgb(0, 0, 0)`;
        console.log(
          `   ✅ Using RGB black for custom color: ${rgbString} (source: ${colorRefOrObj.colorSource})`
        );
        return rgbString;
      }

      // FALLBACK: Legacy object handling (backward compatibility)
      // Check for legacy red/green/blue properties (but avoid all-zero unless it's a custom color)
      if (
        colorRefOrObj.red !== undefined &&
        colorRefOrObj.green !== undefined &&
        colorRefOrObj.blue !== undefined
      ) {
        // Only use RGB if it has actual color values OR it's explicitly a custom color
        if (
          colorRefOrObj.red > 0 ||
          colorRefOrObj.green > 0 ||
          colorRefOrObj.blue > 0 ||
          colorRefOrObj.isCustomColor === true
        ) {
          const rgbString = `rgb(${colorRefOrObj.red}, ${colorRefOrObj.green}, ${colorRefOrObj.blue})`;
          console.log(`   ✅ Using legacy RGB properties: ${rgbString}`);
          return rgbString;
        } else {
          console.log(
            `   ⚠️  Skipping legacy RGB "0 0 0" for non-custom color`
          );
        }
      }

      // Check for legacy cyan/magenta/yellow/black properties
      if (
        colorRefOrObj.cyan !== undefined &&
        colorRefOrObj.magenta !== undefined &&
        colorRefOrObj.yellow !== undefined &&
        colorRefOrObj.black !== undefined
      ) {
        // Only convert CMYK if it has meaningful values OR it's from a CMYK source that should be processed
        const hasValidCMYK =
          colorRefOrObj.cyan > 0 ||
          colorRefOrObj.magenta > 0 ||
          colorRefOrObj.yellow > 0 ||
          colorRefOrObj.black > 0;
        const isCMYKSource =
          colorRefOrObj.colorSource &&
          colorRefOrObj.colorSource.includes("cmyk");

        if (
          hasValidCMYK ||
          isCMYKSource ||
          colorRefOrObj.isCustomColor === true
        ) {
          const { r, g, b } = this.cmykToRgb(
            colorRefOrObj.cyan,
            colorRefOrObj.magenta,
            colorRefOrObj.yellow,
            colorRefOrObj.black
          );
          const rgbString = `rgb(${r}, ${g}, ${b})`;
          console.log(`   🔄 Converted legacy CMYK to RGB: ${rgbString}`);
          return rgbString;
        } else {
          console.log(
            `   ⚠️  Skipping legacy CMYK "0 0 0 0" for non-CMYK source`
          );
        }
      }
    }

    // Handle string-based color references (color names like "Color/Main", "Color/Black", etc.)
    if (typeof colorRefOrObj === "string") {
      console.log(`🎨 Processing string color reference: "${colorRefOrObj}"`);

      // Try to parse CMYK pattern from string
      const cmyk = this.parseCmykFromColorRef(colorRefOrObj);
      if (cmyk) {
        const rgbString = this.cmykToRgbString(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
        console.log(
          `   🔄 Parsed and converted CMYK string: ${colorRefOrObj} → ${rgbString}`
        );
        return rgbString;
      }

      // Check predefined named colors
      const namedColors = {
        "Color/Black": "rgb(0, 0, 0)",
        "Color/White": "rgb(255, 255, 255)",
        "Color/Red": "rgb(255, 0, 0)",
        "Color/Green": "rgb(0, 255, 0)",
        "Color/Blue": "rgb(0, 0, 255)",
        "Color/Cyan": "rgb(0, 255, 255)",
        "Color/Magenta": "rgb(255, 0, 255)",
        "Color/Yellow": "rgb(255, 255, 0)",
        "Color/Paper": "rgb(255, 255, 255)",
      };

      if (namedColors[colorRefOrObj]) {
        console.log(
          `   ✅ Using predefined named color: ${colorRefOrObj} → ${namedColors[colorRefOrObj]}`
        );
        return namedColors[colorRefOrObj];
      }
    }

    // Ultimate fallback
    console.log(
      `   ⚠️  No valid color data found, using default gray: ${JSON.stringify(
        colorRefOrObj
      )}`
    );
    return "rgb(200, 200, 200)";
  }

  /**
   * Determine if a CMYK color is suitable for use as a background
   * @param {number} c - Cyan (0-100)
   * @param {number} m - Magenta (0-100)
   * @param {number} y - Yellow (0-100)
   * @param {number} k - Black/Key (0-100)
   * @returns {object} Analysis result with isLightBackground boolean and reasoning
   */
  static analyzeCmykForBackground(c, m, y, k) {
    const maxCMY = Math.max(c, m, y);
    const avgCMY = (c + m + y) / 3;

    const analysis = {
      c,
      m,
      y,
      k,
      maxCMY,
      avgCMY,
      isLightBackground: false,
      category: "unknown",
      reasoning: "",
    };

    // Very light colors: low K and low CMY values
    if (k <= 20 && maxCMY <= 30 && avgCMY <= 20) {
      analysis.isLightBackground = true;
      analysis.category = "very_light";
      analysis.reasoning = "Very light color suitable for background";
      return analysis;
    }

    // Light tinted colors: very low K, slightly higher CMY (like light pink, light blue, etc.)
    if (k <= 10 && maxCMY <= 50 && avgCMY <= 25) {
      analysis.isLightBackground = true;
      analysis.category = "light_tinted";
      analysis.reasoning = "Light tinted color suitable for background";
      return analysis;
    }

    // Light gray: balanced CMY, moderate K
    if (
      k >= 5 &&
      k <= 60 &&
      maxCMY <= 15 &&
      Math.abs(c - m) <= 5 &&
      Math.abs(m - y) <= 5
    ) {
      analysis.isLightBackground = true;
      analysis.category = "light_gray";
      analysis.reasoning = "Light gray color suitable for background";
      return analysis;
    }

    // Not suitable for background
    analysis.reasoning = "Too dark or saturated for background use";
    return analysis;
  }

  /**
   * Analyze IDML color reference for background suitability
   * @param {string} colorRef - IDML color reference
   * @returns {object|null} Analysis result or null if not CMYK
   */
  static analyzeIdmlColorForBackground(colorRef) {
    // Handle Paper color specially
    if (colorRef === "Color/Paper" || colorRef.includes("Paper")) {
      return {
        isLightBackground: true,
        category: "paper",
        reasoning: "InDesign Paper color - ideal for background",
        colorRef,
      };
    }

    const cmyk = this.parseCmykFromColorRef(colorRef);
    if (!cmyk) {
      return null;
    }

    const analysis = this.analyzeCmykForBackground(
      cmyk.c,
      cmyk.m,
      cmyk.y,
      cmyk.k
    );
    analysis.colorRef = colorRef;
    return analysis;
  }

  /**
   * Get RGB brightness value (0-255, higher = brighter)
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {number} Brightness value
   */
  static getRgbBrightness(r, g, b) {
    // Use relative luminance formula
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /**
   * Get brightness from CMYK values
   * @param {number} c - Cyan (0-100)
   * @param {number} m - Magenta (0-100)
   * @param {number} y - Yellow (0-100)
   * @param {number} k - Black/Key (0-100)
   * @returns {number} Brightness value (0-255)
   */
  static getCmykBrightness(c, m, y, k) {
    const { r, g, b } = this.cmykToRgb(c, m, y, k);
    return this.getRgbBrightness(r, g, b);
  }

  /**
   * Sort colors by lightness (lightest first)
   * @param {Array} colorRefs - Array of IDML color references
   * @returns {Array} Sorted array with lightest colors first
   */
  static sortColorsByLightness(colorRefs) {
    return colorRefs.sort((a, b) => {
      // Analyze both colors for background suitability
      const analysisA = this.analyzeIdmlColorForBackground(a);
      const analysisB = this.analyzeIdmlColorForBackground(b);

      // Prioritize actual CMYK colors over Paper color for visual interest
      const aIsPaper = a.includes("Paper");
      const bIsPaper = b.includes("Paper");
      const aIsCmyk = !aIsPaper && analysisA && analysisA.c !== undefined;
      const bIsCmyk = !bIsPaper && analysisB && analysisB.c !== undefined;

      // If one is CMYK and other is Paper, prefer CMYK for visual interest
      if (aIsCmyk && bIsPaper) return -1;
      if (bIsCmyk && aIsPaper) return 1;

      // If both are CMYK, sort by lightness (lower K value = lighter)
      if (aIsCmyk && bIsCmyk) {
        const cmykA = this.parseCmykFromColorRef(a);
        const cmykB = this.parseCmykFromColorRef(b);

        if (cmykA && cmykB) {
          // First compare by category priority (very_light > light_gray, etc.)
          const categoryPriority = {
            very_light: 1,
            light_gray: 2,
            paper: 3,
            unknown: 4,
          };

          const priorityA = categoryPriority[analysisA.category] || 4;
          const priorityB = categoryPriority[analysisB.category] || 4;

          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          // If same category, sort by K value (lower K = lighter)
          return cmykA.k - cmykB.k;
        }
      }

      // If both are Paper or both are unknown, maintain original order
      return 0;
    });
  }
}

// ES6 exports
export default ColorUtils;
export const {
  cmykToRgb,
  cmykToRgbString,
  cmykToHex,
  rgbToHex,
  parseCmykFromColorRef,
  convertIdmlColorToRgb,
  analyzeCmykForBackground,
  analyzeIdmlColorForBackground,
  getRgbBrightness,
  getCmykBrightness,
  sortColorsByLightness,
} = ColorUtils;

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
      return hex.length === 1 ? '0' + hex : hex;
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
    if (!colorRef || typeof colorRef !== 'string') {
      return null;
    }

    // Match CMYK pattern in IDML color references
    const cmykMatch = colorRef.match(/Color\/C=([\d.]+)\s*M=([\d.]+)\s*Y=([\d.]+)\s*K=([\d.]+)/);
    
    if (cmykMatch) {
      const [, c, m, y, k] = cmykMatch.map(val => parseFloat(val));
      return { c, m, y, k };
    }

    return null;
  }

  /**
   * Convert IDML color reference to RGB CSS string
   * @param {string} colorRef - IDML color reference
   * @returns {string} CSS color string (rgb, hex, or named color)
   */
  static convertIdmlColorToRgb(colorRef) {
    if (!colorRef || colorRef === "Color/None") {
      return "transparent";
    }

    // Try to parse CMYK first
    const cmyk = this.parseCmykFromColorRef(colorRef);
    if (cmyk) {
      console.log(`🎨 Converting CMYK color: C=${cmyk.c} M=${cmyk.m} Y=${cmyk.y} K=${cmyk.k}`);
      const rgbString = this.cmykToRgbString(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
      console.log(`🎨 CMYK to RGB result: ${rgbString}`);
      return rgbString;
    }

    // Fallback to predefined named colors
    const namedColors = {
      "Color/Black": "rgb(0, 0, 0)",
      "Color/White": "rgb(255, 255, 255)",
      "Color/Red": "rgb(255, 0, 0)",
      "Color/Green": "rgb(0, 255, 0)",
      "Color/Blue": "rgb(0, 0, 255)",
      "Color/Cyan": "rgb(0, 255, 255)",
      "Color/Magenta": "rgb(255, 0, 255)",
      "Color/Yellow": "rgb(255, 255, 0)",
      "Color/Paper": "rgb(255, 255, 255)", // InDesign's paper color
    };

    return namedColors[colorRef] || "rgb(200, 200, 200)";
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
      c, m, y, k,
      maxCMY,
      avgCMY,
      isLightBackground: false,
      category: 'unknown',
      reasoning: ''
    };

    // Very light colors: low K and low CMY values
    if (k <= 20 && maxCMY <= 30 && avgCMY <= 20) {
      analysis.isLightBackground = true;
      analysis.category = 'very_light';
      analysis.reasoning = 'Very light color suitable for background';
      return analysis;
    }
    
    // Light tinted colors: very low K, slightly higher CMY (like light pink, light blue, etc.)
    if (k <= 10 && maxCMY <= 50 && avgCMY <= 25) {
      analysis.isLightBackground = true;
      analysis.category = 'light_tinted';
      analysis.reasoning = 'Light tinted color suitable for background';
      return analysis;
    }
    
    // Light gray: balanced CMY, moderate K
    if (k >= 5 && k <= 60 && maxCMY <= 15 && Math.abs(c - m) <= 5 && Math.abs(m - y) <= 5) {
      analysis.isLightBackground = true;
      analysis.category = 'light_gray';
      analysis.reasoning = 'Light gray color suitable for background';
      return analysis;
    }
    
    // Not suitable for background
    analysis.reasoning = 'Too dark or saturated for background use';
    return analysis;
  }

  /**
   * Analyze IDML color reference for background suitability
   * @param {string} colorRef - IDML color reference
   * @returns {object|null} Analysis result or null if not CMYK
   */
  static analyzeIdmlColorForBackground(colorRef) {
    // Handle Paper color specially
    if (colorRef === 'Color/Paper' || colorRef.includes('Paper')) {
      return {
        isLightBackground: true,
        category: 'paper',
        reasoning: 'InDesign Paper color - ideal for background',
        colorRef
      };
    }

    const cmyk = this.parseCmykFromColorRef(colorRef);
    if (!cmyk) {
      return null;
    }

    const analysis = this.analyzeCmykForBackground(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
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
    return (0.299 * r + 0.587 * g + 0.114 * b);
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
      const aIsPaper = a.includes('Paper');
      const bIsPaper = b.includes('Paper');
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
            'very_light': 1,
            'light_gray': 2,
            'paper': 3,
            'unknown': 4
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

// Restore CommonJS exports
module.exports = ColorUtils;
module.exports.cmykToRgb = ColorUtils.cmykToRgb;
module.exports.cmykToRgbString = ColorUtils.cmykToRgbString;
module.exports.cmykToHex = ColorUtils.cmykToHex;
module.exports.rgbToHex = ColorUtils.rgbToHex;
module.exports.parseCmykFromColorRef = ColorUtils.parseCmykFromColorRef;
module.exports.convertIdmlColorToRgb = ColorUtils.convertIdmlColorToRgb;
module.exports.analyzeCmykForBackground = ColorUtils.analyzeCmykForBackground;
module.exports.analyzeIdmlColorForBackground = ColorUtils.analyzeIdmlColorForBackground;
module.exports.getRgbBrightness = ColorUtils.getRgbBrightness;
module.exports.getCmykBrightness = ColorUtils.getCmykBrightness;
module.exports.sortColorsByLightness = ColorUtils.sortColorsByLightness; 

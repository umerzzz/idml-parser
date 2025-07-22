/**
 * UnitConverter - Converts various design units to pixels
 * All conversions go through inches, then: pixels = inches × DPI
 *
 * Supported units: Pixels, Points, Picas, Millimeters, Centimeters, Inches, Cicero, Agate
 */

class UnitConverter {
  constructor(dpi = 96) {
    this.dpi = dpi; // Default web DPI

    // Conversion factors to inches
    this.CONVERSIONS_TO_INCHES = {
      // Already in pixels - no conversion needed
      Pixels: null,
      pixels: null,
      px: null,

      // Standard units to inches
      Points: 1 / 72, // 1 point = 1/72 inch
      points: 1 / 72,
      pt: 1 / 72,

      Picas: 1 / 6, // 1 pica = 1/6 inch = 12 points
      picas: 1 / 6,
      pc: 1 / 6,

      Millimeters: 0.0393701, // 1 mm = 0.0393701 inches
      millimeters: 0.0393701,
      mm: 0.0393701,

      Centimeters: 0.393701, // 1 cm = 0.393701 inches
      centimeters: 0.393701,
      cm: 0.393701,

      Inches: 1, // 1 inch = 1 inch
      inches: 1,
      in: 1,

      Cicero: 0.178, // 1 cicero = 12 Didot points ≈ 0.178 inches
      cicero: 0.178,

      Agate: 5.5 / 72, // 1 agate = 5.5 points = 5.5/72 inches
      agate: 5.5 / 72,
      ag: 5.5 / 72,
    };
  }

  /**
   * Set the DPI for conversions
   * @param {number} dpi - Dots per inch (96 for web, 300/600 for print)
   */
  setDPI(dpi) {
    this.dpi = dpi;
  }

  /**
   * Get the DPI currently being used
   * @returns {number} Current DPI setting
   */
  getDPI() {
    return this.dpi;
  }

  /**
   * Check if a unit is supported for conversion
   * @param {string} unit - Unit name to check
   * @returns {boolean} True if unit is supported
   */
  isSupportedUnit(unit) {
    return unit in this.CONVERSIONS_TO_INCHES;
  }

  /**
   * Convert any supported unit to pixels
   * @param {number} value - Numeric value to convert
   * @param {string} fromUnit - Source unit (e.g., 'Points', 'Millimeters')
   * @returns {number} Value converted to pixels
   */
  toPixels(value, fromUnit) {
    if (typeof value !== "number" || isNaN(value)) {
      console.warn(`UnitConverter: Invalid value "${value}" for conversion`);
      return 0;
    }

    if (!fromUnit) {
      console.warn("UnitConverter: No unit specified, assuming pixels");
      return value;
    }

    // Check if already in pixels
    if (this.CONVERSIONS_TO_INCHES[fromUnit] === null) {
      return value; // Already in pixels, no conversion needed
    }

    // Get conversion factor to inches
    const toInches = this.CONVERSIONS_TO_INCHES[fromUnit];

    if (toInches === undefined) {
      console.warn(
        `UnitConverter: Unsupported unit "${fromUnit}", treating as pixels`
      );
      return value;
    }

    // Convert: value → inches → pixels
    const inches = value * toInches;
    const pixels = inches * this.dpi;

    console.log(
      `📐 Converting: ${value} ${fromUnit} → ${inches.toFixed(
        4
      )} in → ${pixels.toFixed(2)} px (DPI: ${this.dpi})`
    );

    return Math.round(pixels * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Convert multiple values to pixels (for geometric bounds, etc.)
   * @param {object} values - Object with numeric values to convert
   * @param {string} fromUnit - Source unit
   * @returns {object} Object with values converted to pixels
   */
  convertObjectToPixels(values, fromUnit) {
    if (!values || typeof values !== "object") {
      return values;
    }

    const converted = {};
    for (const [key, value] of Object.entries(values)) {
      if (typeof value === "number") {
        converted[key] = this.toPixels(value, fromUnit);
      } else {
        converted[key] = value; // Keep non-numeric values as-is
      }
    }

    return converted;
  }

  /**
   * Convert dimensions object to pixels while preserving original
   * @param {object} dimensions - Dimensions object with width, height, units
   * @returns {object} Object with both original and pixel dimensions
   */
  convertDimensions(dimensions) {
    if (!dimensions || typeof dimensions !== "object") {
      return dimensions;
    }

    const { width, height, units, ...rest } = dimensions;

    // If already in pixels, return as-is but add pixel dimensions for consistency
    if (this.CONVERSIONS_TO_INCHES[units] === null) {
      return {
        ...dimensions,
        pixelDimensions: {
          width: width,
          height: height,
          units: "Pixels",
        },
      };
    }

    // Convert to pixels
    const pixelWidth = this.toPixels(width, units);
    const pixelHeight = this.toPixels(height, units);

    return {
      ...dimensions, // Keep original dimensions
      pixelDimensions: {
        width: pixelWidth,
        height: pixelHeight,
        units: "Pixels",
      },
    };
  }

  /**
   * Get a list of all supported units
   * @returns {string[]} Array of supported unit names
   */
  getSupportedUnits() {
    return Object.keys(this.CONVERSIONS_TO_INCHES);
  }

  /**
   * Create a unit converter with specific DPI
   * @param {number} dpi - DPI setting
   * @returns {UnitConverter} New UnitConverter instance
   */
  static withDPI(dpi) {
    return new UnitConverter(dpi);
  }
}

module.exports = UnitConverter;

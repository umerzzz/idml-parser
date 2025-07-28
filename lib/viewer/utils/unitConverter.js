/**
 * Unit conversion utilities for the IDML Viewer
 * This module provides a unified approach to unit conversion that prevents double-conversion
 */

import UnitConverter from "../../utils/UnitConverter.js";

// Create a singleton instance to prevent multiple conversions
let unitConverterInstance = null;

/**
 * Get the unit converter instance
 * @param {number} dpi - DPI setting (default: 96)
 * @returns {UnitConverter} The unit converter instance
 */
export const getUnitConverter = (dpi = 96) => {
  if (!unitConverterInstance) {
    unitConverterInstance = new UnitConverter(dpi);
  }
  return unitConverterInstance;
};

/**
 * Safe conversion to pixels that prevents double-conversion
 * @param {number} value - The value to convert
 * @param {string} fromUnit - The source unit
 * @param {boolean} alreadyConverted - Whether the value is already in pixels
 * @returns {number} The value in pixels
 */
export const safeToPixels = (value, fromUnit, alreadyConverted = false) => {
  if (typeof value !== "number" || isNaN(value)) {
    return 0;
  }

  // If already converted or no unit specified, return as-is
  if (alreadyConverted || !fromUnit) {
    return value;
  }

  const converter = getUnitConverter();
  return converter.toPixels(value, fromUnit);
};

/**
 * Check if a value is already in pixels
 * @param {number} value - The value to check
 * @param {string} unit - The unit of the value
 * @returns {boolean} True if the value is already in pixels
 */
export const isAlreadyInPixels = (value, unit) => {
  if (!unit) return true;

  const converter = getUnitConverter();
  return converter.CONVERSIONS_TO_INCHES[unit] === null;
};

// Legacy function for backward compatibility - now uses safe conversion
export const mmToPx = (mm) => {
  return safeToPixels(mm, "Millimeters");
};

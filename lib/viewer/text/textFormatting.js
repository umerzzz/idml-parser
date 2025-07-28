/**
 * Text formatting utilities for the IDML Viewer
 */

/**
 * Gets InDesign-accurate formatting for text elements
 * @param {object} story - The story object
 * @param {object} utils - Utility functions (convertColor, getFontWeight, getFontStyle, getTextAlign)
 * @returns {object} The InDesign-accurate formatting object
 */
export const getInDesignAccurateFormatting = (story, utils) => {
  const { convertColor, getFontWeight, getFontStyle, getTextAlign } = utils;

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

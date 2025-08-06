/**
 * Text rendering utilities for the IDML Viewer
 */

import React from "react";

// Text fitting strategies
export const TEXT_FITTING_STRATEGIES = {
  AUTO_SCALE: "auto_scale",
  TRUNCATE: "truncate",
  ALLOW_OVERFLOW: "allow_overflow",
  PRECISE_FIT: "precise_fit",
  COMPRESS_LINES: "compress_lines",
};

/**
 * Determines if a space should be added between two text segments
 * @param {string} currentText - The current text segment
 * @param {object} currentFormatting - The formatting of current text
 * @param {string} nextText - The next text segment
 * @param {object} nextFormatting - The formatting of next text
 * @returns {boolean} Whether a space should be added
 */
const shouldAddSpaceBetween = (
  currentText,
  currentFormatting,
  nextText,
  nextFormatting
) => {
  if (!nextText || nextText.length === 0) return false;

  // Don't add space if either text is empty
  if (!currentText || currentText.length === 0) return false;

  // Don't add space if next segment is a line break
  if (nextFormatting?.isBreak) return false;

  // Don't add space if current text ends with whitespace
  if (/\s$/.test(currentText)) return false;

  // Don't add space if next text starts with whitespace
  if (/^\s/.test(nextText)) return false;

  // Don't add space if current text ends with punctuation that should connect to next word
  if (/[.,;:!?)]$/.test(currentText.trim())) return false;

  // Don't add space if next text starts with punctuation that should connect to previous word
  if (/^[.,;:!?(]/.test(nextText.trim())) return false;

  // Don't add space between two formatted segments with the same formatting
  if (
    currentFormatting?.fontStyle &&
    nextFormatting?.fontStyle &&
    currentFormatting.fontStyle === nextFormatting.fontStyle
  ) {
    return false;
  }

  // IMPROVED: Better single word detection for words split across formatting
  const combinedText = currentText.trim() + nextText.trim();

  // Check if it's a single word (letters only)
  if (/^[a-zA-Z]+$/.test(combinedText)) return false;

  // IMPROVED: Check if it's a word with common word patterns
  // This handles cases like "PORTFO" + "LIO" = "PORTFOLIO"
  const commonWordPatterns = [
    /^[a-zA-Z]+$/, // Pure letters
    /^[a-zA-Z]+[0-9]+$/, // Letters followed by numbers
    /^[0-9]+[a-zA-Z]+$/, // Numbers followed by letters
    /^[a-zA-Z]+['-][a-zA-Z]+$/, // Words with apostrophes or hyphens
  ];

  for (const pattern of commonWordPatterns) {
    if (pattern.test(combinedText)) return false;
  }

  // IMPROVED: Check if adjacent segments form a common word when combined
  const commonWords = [
    "portfolio",
    "portfolio",
    "portfolio",
    "portfolio",
    "portfolio",
    "portfolio",
    "portfolio",
    "portfolio",
    "portfolio",
    "portfolio",
    // Add more common words that might be split
  ];

  const normalizedCombined = combinedText.toLowerCase();
  if (commonWords.includes(normalizedCombined)) return false;

  // IMPROVED: Check if segments are part of the same word by analyzing context
  // If both segments are part of the same paragraph style and have similar formatting,
  // they're likely part of the same word
  if (
    currentFormatting.paragraphStyle &&
    nextFormatting.paragraphStyle &&
    currentFormatting.paragraphStyle === nextFormatting.paragraphStyle &&
    currentFormatting.fontSize === nextFormatting.fontSize &&
    currentFormatting.fontFamily === nextFormatting.fontFamily
  ) {
    // Additional check: if the combined text looks like a word, don't add space
    if (/^[a-zA-Z]+$/.test(combinedText) || combinedText.length <= 12) {
      return false;
    }
  }

  return true;
};

/**
 * Gets optimal text styles based on container dimensions
 * @param {object} story - The story object
 * @param {number} containerHeight - The container height
 * @param {number} containerWidth - The container width
 * @param {object} utils - Utility functions
 * @returns {object} The optimal text styles
 */
export const getOptimalTextStyles = (
  story,
  containerHeight,
  containerWidth,
  utils
) => {
  const { convertColor, getFontWeight, getFontStyle, getTextAlign } = utils;

  const styling = story.styling || {};
  const fontSize = styling.fontSize || 12;

  // Calculate optimal font size based on container
  let optimalFontSize = fontSize;
  if (containerHeight && containerWidth) {
    const containerArea = containerHeight * containerWidth;
    const textLength = story.text?.length || 0;

    if (textLength > 0) {
      // Simple heuristic for font size adjustment
      const areaPerChar = containerArea / textLength;
      const baseFontSize = Math.sqrt(areaPerChar) * 0.1;
      optimalFontSize = Math.max(8, Math.min(72, baseFontSize));
    }
  }

  return {
    fontSize: `${optimalFontSize}px`,
    fontFamily: styling.fontFamily || "Arial, sans-serif",
    fontWeight: getFontWeight(styling.fontStyle),
    fontStyle: getFontStyle(styling.fontStyle),
    color: convertColor(styling.fillColor) || "black",
    textAlign: getTextAlign(styling.alignment),
    lineHeight: "1.3",
    letterSpacing: styling.tracking ? `${styling.tracking / 1000}em` : "normal",
  };
};

/**
 * Renders a line break with proper styling
 * @param {object} breakFormatting - The formatting object for the break
 * @param {number} index - The index of the break
 * @returns {React.ReactElement} The rendered line break
 */
const renderLineBreak = (breakFormatting, index) => {
  console.log(
    `🎨 Rendering line break ${index}: source=${breakFormatting.source}, type=${breakFormatting.breakType}`
  );

  // For paragraph breaks, add extra spacing
  if (breakFormatting.breakType === "paragraph") {
    return (
      <React.Fragment key={index}>
        <br />
        <br />
      </React.Fragment>
    );
  }

  // For regular line breaks
  return <br key={index} />;
};

/**
 * Renders formatted text with proper styling and contrast adjustment
 * @param {object} story - The story object containing formatted content
 * @param {number|null} containerHeight - The container height
 * @param {number|null} adjustedFontSize - The adjusted font size
 * @param {object} utils - Utility functions (convertColor, getFontStyle, getFontWeight, getTextAlign, extractTextDecorations, ensureTextContrast)
 * @param {string} backgroundColor - The background color for contrast calculation
 * @returns {React.ReactElement} The rendered formatted text
 */
export const renderFormattedText = (
  story,
  containerHeight = null,
  adjustedFontSize = null,
  utils,
  backgroundColor = "white"
) => {
  const {
    convertColor,
    getFontStyle,
    getFontWeight,
    getTextAlign,
    extractTextDecorations,
    ensureTextContrast,
  } = utils;

  if (!story.formattedContent || !Array.isArray(story.formattedContent)) {
    console.log("Text value:", story.text);
    if (typeof story.text === "string") {
      return (
        <span
          style={{
            whiteSpace: "pre-wrap",
            display: "block",
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {story.text}
        </span>
      );
    }
    return <span>{story.text}</span>;
  }

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
      if (content.formatting?.isBreak) {
        return renderLineBreak(content.formatting, index);
      }

      const formatting = content.formatting || {};
      const originalFontSize =
        formatting.fontSize || story.styling?.fontSize || 12;
      const fontSize = adjustedFontSize || originalFontSize;

      const hasFormatting =
        formatting.fontStyle ||
        formatting.characterStyle ||
        formatting.paragraphStyle;
      const finalFontStyle = getFontStyle(formatting.fontStyle);
      const finalFontWeight = getFontWeight(formatting.fontStyle);

      if (
        hasFormatting ||
        finalFontStyle === "italic" ||
        finalFontWeight !== "400"
      ) {
        console.log(
          "🎨 Style resolution for text:",
          JSON.stringify(content.text?.substring(0, 20) + "..."),
          {
            rawFormatting: formatting,
            fontStyle: formatting.fontStyle,
            storyDefaultStyle: story.styling?.fontStyle,
            finalFontStyle: finalFontStyle,
            finalFontWeight: finalFontWeight,
            characterStyle: formatting.characterStyle,
            paragraphStyle: formatting.paragraphStyle,
          }
        );
      }
      if (
        finalFontStyle === "italic" &&
        (!formatting.fontStyle || formatting.fontStyle === "Regular")
      ) {
        console.warn(
          "⚠️  UNEXPECTED ITALIC: Text is being styled as italic but fontStyle is:",
          formatting.fontStyle
        );
      }

      let lineHeight = "inherit";

      if (formatting.effectiveLineHeight) {
        lineHeight = formatting.effectiveLineHeight;
      } else if (formatting.leading !== undefined) {
        if (formatting.leading === "auto") {
          lineHeight = "inherit";
        } else if (typeof formatting.leading === "number") {
          const ratio = formatting.leading / fontSize;
          lineHeight = Math.max(1.1, Math.min(2.5, ratio));
        }
      }

      const completeStyles = formatting.completeStyles || {};

      const style = {
        fontSize: `${fontSize}px`,
        fontFamily:
          formatting.fontFamily ||
          story.styling?.fontFamily ||
          "Arial, sans-serif",

        fontWeight:
          completeStyles.fontWeight ||
          getFontWeight(formatting.fontStyle) ||
          "400",
        fontStyle:
          completeStyles.fontStyle ||
          getFontStyle(formatting.fontStyle) ||
          "normal",

        color: ensureTextContrast(
          convertColor(formatting.fillColor) || "black",
          backgroundColor
        ),
        textAlign: getTextAlign(formatting.alignment),
        lineHeight: lineHeight,
        letterSpacing: formatting.tracking
          ? `${formatting.tracking / 1000}em`
          : "normal",

        textDecoration:
          completeStyles.textDecoration || extractTextDecorations(formatting),

        textTransform: completeStyles.textTransform || "none",
        textShadow: completeStyles.textShadow || "none",

        margin: 0,
        padding: 0,

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

        // IMPROVED: More robust baselineShift handling
        ...(function () {
          // Check multiple sources for baselineShift
          const baselineShift =
            completeStyles.baselineShift ||
            formatting.baselineShift ||
            story.styling?.baselineShift ||
            null;

          if (baselineShift !== null && baselineShift !== undefined) {
            console.log(
              `🎯 Vertical alignment applied: ${baselineShift}px for text: "${content.text?.substring(
                0,
                20
              )}..."`
            );
            return { verticalAlign: `${baselineShift}px` };
          }

          // DEBUG: Log when baselineShift is missing
          if (content.text && content.text.length > 0) {
            console.log(
              `⚠️ No baselineShift found for text: "${content.text?.substring(
                0,
                20
              )}..."`,
              {
                completeStylesBaselineShift: completeStyles.baselineShift,
                formattingBaselineShift: formatting.baselineShift,
                storyStylingBaselineShift: story.styling?.baselineShift,
              }
            );
          }

          return {};
        })(),

        ...(completeStyles.horizontalScale &&
          completeStyles.horizontalScale !== 100 && {
            transform: `scaleX(${completeStyles.horizontalScale / 100})`,
          }),
      };

      const currentText = content.text || "";
      const nextContent = story.formattedContent[index + 1];

      // IMPROVED: Use the utility function for more precise space insertion logic
      const needsSpaceAfter = shouldAddSpaceBetween(
        currentText,
        formatting,
        nextContent?.text || "",
        nextContent?.formatting || {}
      );

      // DEBUG: Enhanced logging for spacing issues
      if (
        needsSpaceAfter ||
        currentText.includes("pa") ||
        nextContent?.text?.includes("voluptusda") ||
        currentText.includes("PORTFO") ||
        nextContent?.text?.includes("LIO")
      ) {
        const combinedText =
          currentText.trim() + (nextContent?.text?.trim() || "");
        console.log(`🔧 Space insertion check [${index}]:`, {
          currentText: JSON.stringify(currentText),
          nextText: nextContent ? JSON.stringify(nextContent.text) : "none",
          needsSpaceAfter,
          currentEndsWithSpace: currentText.endsWith(" "),
          nextStartsWithSpace: nextContent?.text?.startsWith(" "),
          currentFormatting: formatting.fontStyle,
          nextFormatting: nextContent?.formatting?.fontStyle,
          currentEndsWithPunct: /[.,;:!?)]$/.test(currentText.trim()),
          nextStartsWithPunct: /^[.,;:!?(]/.test(
            nextContent?.text?.trim() || ""
          ),
          combinedText: combinedText,
          isSingleWord: /^[a-zA-Z]+$/.test(combinedText),
          sameFormatting:
            formatting.fontStyle === nextContent?.formatting?.fontStyle,
          sameParagraphStyle:
            formatting.paragraphStyle ===
            nextContent?.formatting?.paragraphStyle,
          sameFontSize:
            formatting.fontSize === nextContent?.formatting?.fontSize,
          sameFontFamily:
            formatting.fontFamily === nextContent?.formatting?.fontFamily,
        });
      }

      return (
        <React.Fragment key={index}>
          <span style={style}>{content.text}</span>
          {needsSpaceAfter && " "}
        </React.Fragment>
      );
    })
    .filter(Boolean);
};

/**
 * Gets story styles for text elements with contrast adjustment
 * @param {object} story - The story object
 * @param {number|null} containerHeight - The container height
 * @param {number|null} containerWidth - The container width
 * @param {object} utils - Utility functions (convertColor, getFontWeight, getFontStyle, getTextAlign, ensureTextContrast)
 * @param {string} backgroundColor - The background color for contrast calculation
 * @returns {object} The computed story styles
 */
export const getStoryStyles = (
  story,
  containerHeight = null,
  containerWidth = null,
  utils,
  backgroundColor = "white"
) => {
  const {
    convertColor,
    getFontWeight,
    getFontStyle,
    getTextAlign,
    ensureTextContrast,
  } = utils;

  const styling = story.styling || {};
  const fontSize = styling.fontSize || 12;
  let lineHeight = "1.3";

  if (styling.effectiveLineHeight) {
    lineHeight = styling.effectiveLineHeight;
  } else if (styling.leading !== undefined) {
    if (styling.leading === "auto") {
      lineHeight = "1.3";
    } else if (typeof styling.leading === "number") {
      const ratio = styling.leading / fontSize;
      lineHeight = Math.max(1.1, Math.min(2.5, ratio)).toString();
    }
  }

  // Check if fontSize is already in pixels (numeric value) or needs px suffix
  const fontSizeValue =
    typeof fontSize === "number" ? fontSize : parseFloat(fontSize);
  const fontSizeCss =
    typeof fontSize === "string" && fontSize.includes("px")
      ? fontSize
      : `${fontSizeValue}px`;

  // IMPROVED: Add baselineShift handling to story styles
  const baselineShift = styling.baselineShift || null;

  // DEBUG: Log baselineShift availability
  if (baselineShift !== null && baselineShift !== undefined) {
    console.log(`🎯 Story-level vertical alignment: ${baselineShift}px`);
  } else {
    console.log(`⚠️ No story-level baselineShift found`);
  }

  return {
    fontSize: fontSizeCss,
    fontFamily: styling.fontFamily || "Arial, sans-serif",
    fontWeight: getFontWeight(styling.fontStyle),
    fontStyle: getFontStyle(styling.fontStyle),
    color: ensureTextContrast(
      convertColor(styling.fillColor) || "black",
      backgroundColor
    ),
    textAlign: getTextAlign(styling.alignment),
    lineHeight: lineHeight,
    letterSpacing: styling.tracking ? `${styling.tracking / 1000}em` : "normal",

    // IMPROVED: Add vertical alignment if baselineShift is available
    ...(baselineShift !== null &&
      baselineShift !== undefined && {
        verticalAlign: `${baselineShift}px`,
      }),

    padding: "1px 2px",
    margin: 0,

    height: "100%",
    width: "100%",
    minHeight: `${fontSizeValue * 1.4}px`,

    wordWrap: "break-word",
    overflow: "visible",
    boxSizing: "border-box",

    display: "block",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    lineBreak: "auto",

    textOverflow: "visible",
    lineClamp: "none",
  };
};

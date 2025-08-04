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
        console.log(
          `🎨 Rendering line break ${index}: source=${content.formatting.source}, type=${content.formatting.breakType}`
        );
        return <br key={index} />;
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

        ...(completeStyles.baselineShift && {
          verticalAlign: `${completeStyles.baselineShift}px`,
        }),
        ...(completeStyles.horizontalScale &&
          completeStyles.horizontalScale !== 100 && {
            transform: `scaleX(${completeStyles.horizontalScale / 100})`,
          }),
      };

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

    textOverflow: "visible",
    lineClamp: "none",
  };
};

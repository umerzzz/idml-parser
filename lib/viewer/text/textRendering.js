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
 * Gets optimal text styles based on fitting strategy
 * @param {object} baseStyles - The base text styles
 * @param {object} textMetrics - The calculated text metrics
 * @param {number} containerWidth - The container width
 * @param {number} containerHeight - The container height
 * @param {string} strategy - The text fitting strategy
 * @returns {object} Optimized text styles and adjustment details
 */
export const getOptimalTextStyles = (
  baseStyles,
  textMetrics,
  containerWidth,
  containerHeight,
  strategy = TEXT_FITTING_STRATEGIES.PRECISE_FIT
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
      const maxReduction =
        textMetrics.overflowSeverity === "severe"
          ? 0.7
          : textMetrics.overflowSeverity === "moderate"
          ? 0.8
          : 0.9;
      const scaleFactor = Math.max(maxReduction, 1 / textMetrics.overfillRatio);

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
      const targetHeight = textMetrics.availableHeight;
      const currentHeight = textMetrics.estimatedTextHeight;
      const compressionRatio = targetHeight / currentHeight;

      if (compressionRatio > 0.8) {
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
      const compressionNeeded =
        textMetrics.availableHeight / textMetrics.estimatedTextHeight;

      if (compressionNeeded >= 0.95) {
        return {
          styles: {
            ...baseStyles,
            overflow: "hidden",
          },
          wasAdjusted: false,
          adjustmentDetails: { type: "no_adjustment_needed" },
        };
      } else if (compressionNeeded > 0.85) {
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
        const fontScale = Math.max(0.9, Math.sqrt(compressionNeeded));
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
        const maxFontScale = 0.85;
        const maxLineScale = 0.8;

        return {
          styles: {
            ...baseStyles,
            fontSize: `${fontSize * maxFontScale}px`,
            lineHeight: Math.max(
              0.8,
              parseFloat(baseStyles.lineHeight) * maxLineScale
            ),
            overflow: "hidden",
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
          overflow: "visible",
        },
        wasAdjusted: false,
        adjustmentDetails: { type: "overflow_allowed" },
      };
    }
  }
};

/**
 * Renders formatted text with proper styling
 * @param {object} story - The story object containing formatted content
 * @param {number|null} containerHeight - The container height
 * @param {number|null} adjustedFontSize - The adjusted font size
 * @param {object} utils - Utility functions (convertColor, getFontStyle, getFontWeight, getTextAlign, extractTextDecorations)
 * @returns {React.ReactElement} The rendered formatted text
 */
export const renderFormattedText = (
  story,
  containerHeight = null,
  adjustedFontSize = null,
  utils
) => {
  const {
    convertColor,
    getFontStyle,
    getFontWeight,
    getTextAlign,
    extractTextDecorations,
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

        color: convertColor(formatting.fillColor) || "black",
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
 * Gets story styles for text elements
 * @param {object} story - The story object
 * @param {number|null} containerHeight - The container height
 * @param {number|null} containerWidth - The container width
 * @param {object} utils - Utility functions (convertColor, getFontWeight, getFontStyle, getTextAlign)
 * @returns {object} The computed story styles
 */
export const getStoryStyles = (
  story,
  containerHeight = null,
  containerWidth = null,
  utils
) => {
  const { convertColor, getFontWeight, getFontStyle, getTextAlign } = utils;

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
    color: convertColor(styling.fillColor) || "black",
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

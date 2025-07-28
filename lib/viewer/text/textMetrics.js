/**
 * Text metrics utilities for the IDML Viewer
 */

/**
 * Measures text accurately using canvas
 * @param {string} text - The text to measure
 * @param {number} fontSize - The font size in pixels
 * @param {string} fontFamily - The font family
 * @param {string} fontWeight - The font weight
 * @param {string} fontStyle - The font style
 * @returns {object} Text metrics including width, height, and actual bounds
 */
export const measureTextAccurately = (
  text,
  fontSize,
  fontFamily,
  fontWeight,
  fontStyle
) => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  const width = metrics.width;
  const height = fontSize * 1.2;

  return {
    width,
    height,
    actualBounds:
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
  };
};

/**
 * Calculates comprehensive text metrics for fitting
 * @param {string} text - The text to analyze
 * @param {number} fontSize - The font size in pixels
 * @param {string|number} lineHeight - The line height
 * @param {number} containerWidth - The container width
 * @param {number} containerHeight - The container height
 * @param {string} fontFamily - The font family
 * @param {string} fontWeight - The font weight
 * @param {string} fontStyle - The font style
 * @returns {object} Comprehensive text metrics
 */
export const calculateTextMetrics = (
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

  const canvasMetrics = measureTextAccurately(
    text,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle
  );

  let lineHeightPx;
  if (typeof lineHeight === "string" && lineHeight.includes("px")) {
    lineHeightPx = parseFloat(lineHeight);
  } else if (typeof lineHeight === "number") {
    lineHeightPx = lineHeight * fontSize;
  } else {
    const numericLineHeight = parseFloat(lineHeight) || 1.2;
    lineHeightPx = numericLineHeight * fontSize;
  }

  const effectiveWidth = containerWidth - 4;
  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const lines = [];
  let currentLine = "";
  let currentLineWidth = 0;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordWidth = ctx.measureText(word).width;
    const spaceWidth = ctx.measureText(" ").width;
    const wordWithSpaceWidth = currentLine ? wordWidth + spaceWidth : wordWidth;

    if (currentLine && currentLineWidth + wordWithSpaceWidth > effectiveWidth) {
      lines.push(currentLine);
      currentLine = word;
      currentLineWidth = wordWidth;
    } else {
      if (currentLine) {
        currentLine += " " + word;
        currentLineWidth += wordWithSpaceWidth;
      } else {
        currentLine = word;
        currentLineWidth = wordWidth;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  const estimatedLines = Math.max(1, lines.length);
  const estimatedTextHeight = estimatedLines * lineHeightPx;
  const availableHeight = containerHeight - 4;

  return {
    estimatedLines,
    estimatedTextHeight,
    lineHeightPx,
    availableHeight,
    actualLines: lines,
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

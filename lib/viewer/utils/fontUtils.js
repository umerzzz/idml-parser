/**
 * Font utilities for the IDML Viewer
 */

/**
 * Converts font style to CSS font weight
 * @param {string} fontStyle - The font style string
 * @returns {string} The CSS font weight value
 */
export const getFontWeight = (fontStyle) => {
  if (!fontStyle) return "400";

  const style = fontStyle.toLowerCase();

  // Handle complex styles like "Bold Italic", "Semibold Condensed", etc.
  if (style.includes("thin")) return "100";
  if (style.includes("extralight") || style.includes("ultra light"))
    return "200";
  if (style.includes("light")) return "300";
  if (style.includes("medium")) return "500";
  if (style.includes("demibold") || style.includes("semibold")) return "600";
  if (style.includes("bold")) return "700";
  if (style.includes("extrabold") || style.includes("ultra bold")) return "800";
  if (style.includes("black") || style.includes("heavy")) return "900";

  return "400"; // Regular/Normal
};

/**
 * Converts font style to CSS font style
 * @param {string} fontStyle - The font style string
 * @returns {string} The CSS font style value
 */
export const getFontStyle = (fontStyle) => {
  if (
    !fontStyle ||
    fontStyle === "" ||
    fontStyle === "Regular" ||
    fontStyle === "normal"
  ) {
    return "normal";
  }

  const style = fontStyle.toLowerCase().trim();

  // FIXED: More precise italic detection - only exact matches or explicit italic styles
  const willBeItalic =
    style === "italic" ||
    style === "oblique" ||
    style.endsWith(" italic") ||
    style.startsWith("italic ") ||
    style === "it" ||
    style.includes(" italic ") ||
    style.endsWith("-italic") ||
    style.startsWith("italic-");

  // DEBUG: Log when italic is being applied
  if (willBeItalic) {
    console.log("🎨 Font style applying ITALIC:", {
      input: fontStyle,
      inputType: typeof fontStyle,
      normalizedInput: style,
      reason: "Matched italic pattern",
    });
  }

  if (willBeItalic) {
    return "italic";
  }

  // Default to normal for everything else (including Regular, Medium, Bold, etc.)
  return "normal";
};

/**
 * Extracts text decorations from formatting object
 * @param {object} formatting - The formatting object
 * @returns {string} The CSS text decoration value
 */
export const extractTextDecorations = (formatting) => {
  const decorations = [];

  // Check for underline
  if (
    formatting.underline ||
    (formatting.characterStyle &&
      formatting.characterStyle.toLowerCase().includes("underline"))
  ) {
    decorations.push("underline");
  }

  // Check for strikethrough
  if (
    formatting.strikethrough ||
    formatting.strikeThrough ||
    (formatting.characterStyle &&
      formatting.characterStyle.toLowerCase().includes("strikethrough"))
  ) {
    decorations.push("line-through");
  }

  // Check for overline
  if (
    formatting.overline ||
    (formatting.characterStyle &&
      formatting.characterStyle.toLowerCase().includes("overline"))
  ) {
    decorations.push("overline");
  }

  return decorations.length > 0 ? decorations.join(" ") : "none";
};

/**
 * Converts InDesign alignment to CSS text align
 * @param {string} alignment - The InDesign alignment value
 * @returns {string} The CSS text align value
 */
export const getTextAlign = (alignment) => {
  const alignments = {
    LeftAlign: "left",
    RightAlign: "right",
    CenterAlign: "center",
    LeftJustified: "justify",
    RightJustified: "justify",
    CenterJustified: "center",
    FullyJustified: "justify",
  };
  return alignments[alignment] || "left";
};

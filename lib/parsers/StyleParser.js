const path = require("path");
const IDMLUtils = require("../utils/IDMLUtils");

class StyleParser {
  constructor() {
    this.styles = {
      paragraph: {},
      character: {},
      object: {},
      table: {},
      cell: {},
    };
    this.resources = {
      fonts: {},
      colors: {},
      gradients: {},
    };
    this.fontMap = new Map(); // Global font lookup map
  }

  async parseResourceFile(fileName, content, xmlParser) {
    console.log(`📋 Parsing resource: ${fileName}`);

    try {
      const parsed = xmlParser.parse(content);
      const resourceName = path.basename(fileName, ".xml");

      // Handle different resource types
      if (fileName.includes("Styles.xml")) {
        await this.extractStyles(parsed);
      } else if (fileName.includes("Fonts.xml")) {
        await this.extractFonts(parsed);
      } else if (fileName.includes("Graphic.xml")) {
        await this.extractGraphics(parsed);
      } else if (fileName.includes("Preferences.xml")) {
        await this.extractPreferences(parsed);
      }

      console.log(`✅ Resource ${resourceName} parsed`);
    } catch (error) {
      console.error(`❌ Error parsing ${fileName}:`, error.message);
    }
  }

  async extractStyles(stylesData) {
    console.log("Extracting styles...");

    const styles = stylesData.Styles || stylesData;

    // Extract Paragraph Styles
    if (styles.RootParagraphStyleGroup) {
      this.extractParagraphStyles(styles.RootParagraphStyleGroup);
    }

    // Extract Character Styles
    if (styles.RootCharacterStyleGroup) {
      this.extractCharacterStyles(styles.RootCharacterStyleGroup);
    }
  }

  extractParagraphStyles(styleGroup) {
    const extractStylesRecursively = (group) => {
      if (group.ParagraphStyle) {
        const styles = Array.isArray(group.ParagraphStyle)
          ? group.ParagraphStyle
          : [group.ParagraphStyle];

        styles.forEach((style) => {
          // CRITICAL: Extract font reference from multiple possible locations
          const fontRef = this.extractFontFromStyle(style);

          // ENHANCED: Process leading with proper InDesign logic
          const fontSize = parseFloat(style["@_PointSize"]) || 12;
          const rawLeading = style["@_Leading"];
          const processedLeading = this.processLeadingValue(
            rawLeading,
            fontSize
          );

          this.styles.paragraph[style["@_Self"]] = {
            self: style["@_Self"],
            name: style["@_Name"] || "",
            fontStyle: style["@_FontStyle"] || "Regular",
            pointSize: fontSize,
            leading: processedLeading,
            leadingType: this.determineLeadingType(rawLeading),
            effectiveLineHeight: this.calculateEffectiveLineHeight(
              processedLeading,
              fontSize
            ),
            alignment: style["@_Justification"] || "LeftAlign",
            leftIndent: parseFloat(style["@_LeftIndent"]) || 0,
            rightIndent: parseFloat(style["@_RightIndent"]) || 0,
            firstLineIndent: parseFloat(style["@_FirstLineIndent"]) || 0,
            spaceBefore: parseFloat(style["@_SpaceBefore"]) || 0,
            spaceAfter: parseFloat(style["@_SpaceAfter"]) || 0,

            // Typography enhancements
            tracking: parseFloat(style["@_Tracking"]) || 0,
            kerning: parseFloat(style["@_Kerning"]) || 0,
            horizontalScale: parseFloat(style["@_HorizontalScale"]) || 100,
            verticalScale: parseFloat(style["@_VerticalScale"]) || 100,

            // ENHANCED: Use the new extraction method
            appliedFont: fontRef,
            originalFontRef: fontRef,

            fillColor: style["@_FillColor"] || "Color/Black",
            rawStyle: style,
          };

          console.log(
            `✅ Paragraph Style: ${style["@_Name"]} -> Font: "${fontRef}"`
          );
        });
      }

      if (group.ParagraphStyleGroup) {
        const subGroups = Array.isArray(group.ParagraphStyleGroup)
          ? group.ParagraphStyleGroup
          : [group.ParagraphStyleGroup];
        subGroups.forEach(extractStylesRecursively);
      }
    };

    extractStylesRecursively(styleGroup);
  }

  extractFontFromStyle(style) {
    // Try direct attributes first
    let fontRef =
      style["@_AppliedFont"] || style["@_FontFamily"] || style["@_Font"] || "";

    // If not found, try Properties nested structure
    if (!fontRef && style.Properties) {
      if (style.Properties.AppliedFont) {
        fontRef =
          style.Properties.AppliedFont["#text"] ||
          style.Properties.AppliedFont ||
          "";
      }

      // Also try other property variations
      if (!fontRef && style.Properties.FontFamily) {
        fontRef =
          style.Properties.FontFamily["#text"] ||
          style.Properties.FontFamily ||
          "";
      }
    }

    return fontRef || "";
  }

  extractCharacterStyles(styleGroup) {
    const extractStylesRecursively = (group) => {
      if (group.CharacterStyle) {
        const styles = Array.isArray(group.CharacterStyle)
          ? group.CharacterStyle
          : [group.CharacterStyle];

        styles.forEach((style) => {
          const fontRef = this.extractFontFromStyle(style);

          this.styles.character[style["@_Self"]] = {
            self: style["@_Self"],
            name: style["@_Name"] || "",
            fontStyle: style["@_FontStyle"] || "Regular",
            pointSize: parseFloat(style["@_PointSize"]) || null,

            appliedFont: fontRef,
            originalFontRef: fontRef,

            fillColor: style["@_FillColor"] || null,
            strokeColor: style["@_StrokeColor"] || null,
            rawStyle: style,
          };

          console.log(
            `✅ Character Style: ${style["@_Name"]} -> Font: "${fontRef}"`
          );
        });
      }

      if (group.CharacterStyleGroup) {
        const subGroups = Array.isArray(group.CharacterStyleGroup)
          ? group.CharacterStyleGroup
          : [group.CharacterStyleGroup];
        subGroups.forEach(extractStylesRecursively);
      }
    };

    extractStylesRecursively(styleGroup);
  }

  async extractFonts(fontsData) {
    console.log("Extracting fonts with enhanced mapping...");

    const fonts = fontsData.Fonts || fontsData;
    this.resources.fonts = {};
    this.fontMap = new Map(); // Global font lookup map

    if (fonts.FontFamily) {
      const fontFamilies = Array.isArray(fonts.FontFamily)
        ? fonts.FontFamily
        : [fonts.FontFamily];

      fontFamilies.forEach((family) => {
        const familyInfo = {
          self: family["@_Self"],
          name: family["@_Name"] || "",
          fonts: [],
        };

        if (family.Font) {
          const fontList = Array.isArray(family.Font)
            ? family.Font
            : [family.Font];

          fontList.forEach((font) => {
            const fontInfo = {
              self: font["@_Self"],
              fontFamily: font["@_FontFamily"] || familyInfo.name,
              name: font["@_Name"] || "",
              postScriptName: font["@_PostScriptName"] || "",
              status: font["@_Status"] || "Unknown",
              fontStyleName: font["@_FontStyleName"] || "Regular",
            };

            familyInfo.fonts.push(fontInfo);

            // Create multiple lookup entries for this font
            this.fontMap.set(font["@_Self"], familyInfo.name);
            this.fontMap.set(font["@_PostScriptName"], familyInfo.name);
            this.fontMap.set(font["@_Name"], familyInfo.name);
            this.fontMap.set(font["@_FontFamily"], familyInfo.name);

            console.log(
              `Font mapping: ${font["@_Self"]} -> ${familyInfo.name}`
            );
          });
        }

        this.resources.fonts[family["@_Self"]] = familyInfo;
      });
    }

    console.log(
      `✅ Fonts extracted: ${Object.keys(this.resources.fonts).length} families`
    );
    console.log(`Font map entries: ${this.fontMap.size}`);
  }

  async extractGraphics(graphicsData) {
    console.log("Extracting graphics and colors...");

    const graphics = graphicsData.Graphic || graphicsData;
    this.resources.colors = {};
    this.resources.gradients = {};

    // Extract Colors
    if (graphics.Color) {
      const colors = Array.isArray(graphics.Color)
        ? graphics.Color
        : [graphics.Color];

      colors.forEach((color) => {
        this.resources.colors[color["@_Self"]] = {
          self: color["@_Self"],
          name: color["@_Name"] || "",
          model: color["@_Model"] || "Process",
          space: color["@_Space"] || "CMYK",
          cyan: parseFloat(color["@_Cyan"]) || 0,
          magenta: parseFloat(color["@_Magenta"]) || 0,
          yellow: parseFloat(color["@_Yellow"]) || 0,
          black: parseFloat(color["@_Black"]) || 0,
          red: parseFloat(color["@_Red"]) || 0,
          green: parseFloat(color["@_Green"]) || 0,
          blue: parseFloat(color["@_Blue"]) || 0,
        };
      });
    }

    // Extract Gradients
    if (graphics.Gradient) {
      const gradients = Array.isArray(graphics.Gradient)
        ? graphics.Gradient
        : [graphics.Gradient];

      gradients.forEach((gradient) => {
        this.resources.gradients[gradient["@_Self"]] = {
          self: gradient["@_Self"],
          name: gradient["@_Name"] || "",
          type: gradient["@_Type"] || "Linear",
          gradientStops: this.extractGradientStops(gradient),
        };
      });
    }
  }

  extractGradientStops(gradient) {
    const stops = [];

    if (gradient.GradientStop) {
      const stopList = Array.isArray(gradient.GradientStop)
        ? gradient.GradientStop
        : [gradient.GradientStop];

      stopList.forEach((stop) => {
        stops.push({
          self: stop["@_Self"],
          stopColor: stop["@_StopColor"] || "",
          location: parseFloat(stop["@_Location"]) || 0,
          midpoint: parseFloat(stop["@_Midpoint"]) || 50,
        });
      });
    }

    return stops;
  }

  async extractPreferences(preferencesData) {
    console.log("Extracting document preferences...");

    const prefs = preferencesData.Preferences || preferencesData;

    // Extract various document preferences
    this.documentInfo = {
      preferences: {
        documentPreferences: this.extractDocumentPrefs(
          prefs.DocumentPreference
        ),
        viewPreferences: this.extractViewPrefs(prefs.ViewPreference),
        guidePreferences: this.extractGuidePrefs(prefs.GuidePreference),
        gridPreferences: this.extractGridPrefs(prefs.GridPreference),
        marginPreferences: this.extractMarginPrefs(prefs.MarginPreference),
        columnPreferences: this.extractColumnPrefs(prefs.ColumnPreference),
      },
    };
  }

  extractDocumentPrefs(docPref) {
    if (!docPref) return {};

    return {
      pageWidth: parseFloat(docPref["@_PageWidth"]) || 0,
      pageHeight: parseFloat(docPref["@_PageHeight"]) || 0,
      left: parseFloat(docPref["@_Left"]) || 0,
      top: parseFloat(docPref["@_Top"]) || 0,
      right: parseFloat(docPref["@_Right"]) || 0,
      bottom: parseFloat(docPref["@_Bottom"]) || 0,
      columnCount: parseInt(docPref["@_ColumnCount"]) || 1,
      columnGutter: parseFloat(docPref["@_ColumnGutter"]) || 0,
      facingPages: docPref["@_FacingPages"] === true,
      allowPageShuffle: docPref["@_AllowPageShuffle"] !== false,
      slugBleedType: docPref["@_SlugBleedType"] || "None",
      documentBleedTopOffset:
        parseFloat(docPref["@_DocumentBleedTopOffset"]) || 0,
      documentBleedBottomOffset:
        parseFloat(docPref["@_DocumentBleedBottomOffset"]) || 0,
      documentBleedInsideOrLeftOffset:
        parseFloat(docPref["@_DocumentBleedInsideOrLeftOffset"]) || 0,
      documentBleedOutsideOrRightOffset:
        parseFloat(docPref["@_DocumentBleedOutsideOrRightOffset"]) || 0,
    };
  }

  extractViewPrefs(viewPref) {
    if (!viewPref) return {};

    return {
      horizontalMeasurementUnits:
        viewPref["@_HorizontalMeasurementUnits"] || "Points",
      verticalMeasurementUnits:
        viewPref["@_VerticalMeasurementUnits"] || "Points",
      rulerOrigin: viewPref["@_RulerOrigin"] || "SpreadOrigin",
      showRulers: viewPref["@_ShowRulers"] !== false,
    };
  }

  extractGuidePrefs(guidePref) {
    if (!guidePref) return {};

    return {
      rulerGuideColor: guidePref["@_RulerGuideColor"] || "Green",
      guidesInBack: guidePref["@_GuidesInBack"] === true,
      guidesLocked: guidePref["@_GuidesLocked"] === true,
      guidesShown: guidePref["@_GuidesShown"] !== false,
      guidesSnapto: guidePref["@_GuidesSnapto"] !== false,
    };
  }

  extractGridPrefs(gridPref) {
    if (!gridPref) return {};

    return {
      baselineStart: parseFloat(gridPref["@_BaselineStart"]) || 0,
      baselineDivision: parseFloat(gridPref["@_BaselineDivision"]) || 12,
      baselineShown: gridPref["@_BaselineShown"] === true,
      baselineSnapto: gridPref["@_BaselineSnapto"] === true,
      documentGridShown: gridPref["@_DocumentGridShown"] === true,
      documentGridSnapto: gridPref["@_DocumentGridSnapto"] === true,
    };
  }

  extractMarginPrefs(marginPref) {
    if (!marginPref) return {};

    return {
      top: parseFloat(marginPref["@_Top"]) || 0,
      bottom: parseFloat(marginPref["@_Bottom"]) || 0,
      left: parseFloat(marginPref["@_Left"]) || 0,
      right: parseFloat(marginPref["@_Right"]) || 0,
      columnCount: parseInt(marginPref["@_ColumnCount"]) || 1,
      columnGutter: parseFloat(marginPref["@_ColumnGutter"]) || 0,
    };
  }

  extractColumnPrefs(columnPref) {
    if (!columnPref) return {};

    return {
      textColumnCount: parseInt(columnPref["@_TextColumnCount"]) || 1,
      textColumnGutter: parseFloat(columnPref["@_TextColumnGutter"]) || 0,
    };
  }

  resolveStyleFormatting(formatting) {
    const resolved = { ...formatting };

    // DEBUG: Check if formatting is being applied (generic check)
    const hasAnyFormatting =
      formatting.paragraphStyle ||
      formatting.characterStyle ||
      formatting.fontStyle ||
      formatting.fontReference ||
      formatting.fontSize;

    if (hasAnyFormatting) {
      console.log("🔧 StyleParser.resolveStyleFormatting - Input:", {
        paragraphStyle: formatting.paragraphStyle,
        characterStyle: formatting.characterStyle,
        directFontStyle: formatting.fontStyle,
        directFontRef: formatting.fontReference,
        directFontSize: formatting.fontSize,
      });
    }

    // Resolve paragraph style (base layer)
    if (
      formatting.paragraphStyle &&
      this.styles.paragraph[formatting.paragraphStyle]
    ) {
      const pStyle = this.styles.paragraph[formatting.paragraphStyle];

      if (!resolved.fontSize && pStyle.pointSize)
        resolved.fontSize = pStyle.pointSize;
      if (!resolved.fillColor && pStyle.fillColor)
        resolved.fillColor = pStyle.fillColor;
      // CRITICAL FIX: Always inherit paragraph alignment unless explicitly overridden
      if (pStyle.alignment) resolved.alignment = pStyle.alignment;
      if (!resolved.fontStyle && pStyle.fontStyle) {
        resolved.fontStyle = pStyle.fontStyle;
        if (hasAnyFormatting) {
          console.log(
            `   FontStyle from paragraph style: "${pStyle.fontStyle}"`
          );
        }
      }

      // CRITICAL: Resolve font from paragraph style
      if (!resolved.fontFamily && pStyle.appliedFont) {
        resolved.fontFamily = this.resolveFontReference(pStyle.appliedFont);
        if (hasAnyFormatting) {
          console.log(
            `   Font from paragraph style: ${pStyle.appliedFont} -> ${resolved.fontFamily}`
          );
        }
      }

      // Add other paragraph properties with enhanced leading support
      resolved.leading = pStyle.leading;
      resolved.leadingType = pStyle.leadingType;
      resolved.effectiveLineHeight = pStyle.effectiveLineHeight;
      resolved.leftIndent = pStyle.leftIndent;
      resolved.rightIndent = pStyle.rightIndent;
      resolved.firstLineIndent = pStyle.firstLineIndent;
      resolved.spaceBefore = pStyle.spaceBefore;
      resolved.spaceAfter = pStyle.spaceAfter;
      resolved.tracking = pStyle.tracking;
      resolved.kerning = pStyle.kerning;
    }

    // Resolve character style (override layer)
    if (
      formatting.characterStyle &&
      this.styles.character[formatting.characterStyle]
    ) {
      const cStyle = this.styles.character[formatting.characterStyle];

      if (cStyle.pointSize) resolved.fontSize = cStyle.pointSize;
      if (cStyle.fillColor) resolved.fillColor = cStyle.fillColor;
      if (cStyle.fontStyle) {
        resolved.fontStyle = cStyle.fontStyle;
        if (hasAnyFormatting) {
          console.log(
            `   FontStyle from character style: "${cStyle.fontStyle}"`
          );
        }
      }
      if (cStyle.strokeColor) resolved.strokeColor = cStyle.strokeColor;

      // Include leading information from character style
      if (cStyle.leading) resolved.leading = cStyle.leading;
      if (cStyle.leadingType) resolved.leadingType = cStyle.leadingType;
      if (cStyle.effectiveLineHeight)
        resolved.effectiveLineHeight = cStyle.effectiveLineHeight;

      // CRITICAL: Character style font overrides paragraph style
      if (cStyle.appliedFont) {
        resolved.fontFamily = this.resolveFontReference(cStyle.appliedFont);
        if (hasAnyFormatting) {
          console.log(
            `   Font from character style: ${cStyle.appliedFont} -> ${resolved.fontFamily}`
          );
        }
      }
    }

    // Apply direct formatting (highest priority)
    if (formatting.fontReference) {
      resolved.fontFamily = this.resolveFontReference(formatting.fontReference);
      if (hasAnyFormatting) {
        console.log(
          `   Font from direct formatting: ${formatting.fontReference} -> ${resolved.fontFamily}`
        );
      }
    }

    // CRITICAL: Apply direct fontStyle if provided (this might be the issue)
    if (formatting.fontStyle) {
      resolved.fontStyle = formatting.fontStyle;
      if (hasAnyFormatting) {
        console.log(
          `   FontStyle from direct formatting: "${formatting.fontStyle}"`
        );
      }
    }

    // Apply direct leading information (highest priority)
    if (formatting.leading !== undefined) resolved.leading = formatting.leading;
    if (formatting.leadingType) resolved.leadingType = formatting.leadingType;
    if (formatting.effectiveLineHeight)
      resolved.effectiveLineHeight = formatting.effectiveLineHeight;

    // Apply other direct formatting attributes
    if (formatting.fontSize) resolved.fontSize = formatting.fontSize;
    if (formatting.tracking) resolved.tracking = formatting.tracking;
    if (formatting.kerning) resolved.kerning = formatting.kerning;

    // CRITICAL FIX: Apply direct alignment if explicitly specified (overrides paragraph alignment)
    if (formatting.alignment) {
      resolved.alignment = formatting.alignment;
      if (hasAnyFormatting) {
        console.log(
          `   Alignment from direct formatting: "${formatting.alignment}"`
        );
      }
    }

    // FIXED: Ensure fontStyle defaults to Regular/normal if not set
    if (!resolved.fontStyle || resolved.fontStyle === "") {
      resolved.fontStyle = "Regular";
      if (hasAnyFormatting) {
        console.log(`   FontStyle defaulted to: "Regular"`);
      }
    }

    // ADDITIONAL FIX: If no styles were applied from any source, ensure clean defaults
    if (
      !formatting.paragraphStyle &&
      !formatting.characterStyle &&
      !formatting.fontStyle &&
      !formatting.fontReference
    ) {
      resolved.fontStyle = "Regular";
      if (hasAnyFormatting) {
        console.log(`   No source styles found - ensuring clean defaults`);
      }
    }

    // Final fallback
    if (!resolved.fontFamily || resolved.fontFamily === "") {
      resolved.fontFamily = this.getDefaultFont();
      if (hasAnyFormatting) {
        console.log(`   Using fallback font: ${resolved.fontFamily}`);
      }
    }

    // Ensure line height is calculated if not explicitly set
    if (
      !resolved.effectiveLineHeight &&
      resolved.fontSize &&
      resolved.leading
    ) {
      resolved.effectiveLineHeight = this.calculateEffectiveLineHeight(
        resolved.leading,
        resolved.fontSize
      );
    }

    if (hasAnyFormatting) {
      console.log("🔧 StyleParser.resolveStyleFormatting - Final Output:", {
        fontSize: resolved.fontSize,
        fontFamily: resolved.fontFamily,
        fontStyle: resolved.fontStyle,
        fillColor: resolved.fillColor,
        leading: resolved.leading,
        effectiveLineHeight: resolved.effectiveLineHeight,
      });
    }

    return resolved;
  }

  resolveFontReference(fontRef) {
    if (!fontRef || fontRef === "") {
      console.log("Empty font reference, using fallback");
      return this.getDefaultFont();
    }

    // Try direct lookup in font map
    if (this.fontMap && this.fontMap.has(fontRef)) {
      const resolvedFont = this.fontMap.get(fontRef);
      console.log(`Font resolved: "${fontRef}" -> "${resolvedFont}"`);
      return resolvedFont;
    }

    // Try partial matching for font families
    if (this.resources.fonts) {
      for (const [familyId, familyInfo] of Object.entries(
        this.resources.fonts
      )) {
        // Check family name match
        if (
          familyInfo.name &&
          (familyInfo.name.toLowerCase().includes(fontRef.toLowerCase()) ||
            fontRef.toLowerCase().includes(familyInfo.name.toLowerCase()))
        ) {
          console.log(
            `Font partially matched: "${fontRef}" -> "${familyInfo.name}"`
          );
          return familyInfo.name;
        }

        // Check individual font matches
        if (familyInfo.fonts) {
          for (const font of familyInfo.fonts) {
            if (
              font.self === fontRef ||
              font.postScriptName === fontRef ||
              font.name === fontRef
            ) {
              console.log(
                `Font exactly matched: "${fontRef}" -> "${familyInfo.name}"`
              );
              return familyInfo.name;
            }
          }
        }
      }
    }

    console.log(`Font not found: "${fontRef}", using fallback`);
    return this.getDefaultFont() || fontRef;
  }

  getDefaultFont() {
    if (this.resources.fonts && Object.keys(this.resources.fonts).length > 0) {
      const firstFamily = Object.values(this.resources.fonts)[0];
      return firstFamily.name || "Arial";
    }
    return "Arial";
  }

  inferFontFromContext() {
    // If we have font definitions but no explicit references,
    // return the first available font as a fallback
    if (this.resources.fonts && Object.keys(this.resources.fonts).length > 0) {
      const firstFontFamily = Object.values(this.resources.fonts)[0];
      return firstFontFamily.name;
    }
    return null;
  }

  getStoryStyleSummary(story) {
    const summary = {
      fontSize: null,
      fontFamily: null,
      alignment: null,
      fillColor: null,
      fontStyle: null,
      leading: null,
      leadingType: null,
      effectiveLineHeight: null,
      tracking: null,
      kerning: null,
    };

    // Get the most common or first formatting values
    if (story.content?.formattedContent?.length > 0) {
      const firstFormatted = story.content.formattedContent.find(
        (item) => item.formatting && !item.formatting.isBreak
      );

      if (firstFormatted?.formatting) {
        const fmt = firstFormatted.formatting;
        summary.fontSize = fmt.fontSize;
        summary.fontFamily = fmt.fontFamily;
        summary.alignment = fmt.alignment;
        summary.fillColor = fmt.fillColor;
        summary.fontStyle = fmt.fontStyle;
        summary.leading = fmt.leading;
        summary.leadingType = fmt.leadingType;
        summary.effectiveLineHeight = fmt.effectiveLineHeight;
        summary.tracking = fmt.tracking;
        summary.kerning = fmt.kerning;
      }
    }

    return summary;
  }

  // NEW: Process leading values with InDesign-specific logic (shared with StoryParser)
  processLeadingValue(rawLeading, fontSize) {
    if (!rawLeading) return "auto";

    // Handle "auto" leading
    if (rawLeading === "auto" || rawLeading === "Auto") {
      return fontSize ? fontSize * 1.2 : "auto"; // InDesign default auto leading is 120%
    }

    // Handle numeric leading (in points)
    const numericLeading = parseFloat(rawLeading);
    if (!isNaN(numericLeading)) {
      return numericLeading;
    }

    // Handle percentage-based leading
    if (rawLeading.includes("%")) {
      const percentage = parseFloat(rawLeading.replace("%", ""));
      return fontSize ? (fontSize * percentage) / 100 : "auto";
    }

    return "auto";
  }

  // NEW: Determine the type of leading being used
  determineLeadingType(rawLeading) {
    if (!rawLeading || rawLeading === "auto" || rawLeading === "Auto") {
      return "auto";
    }

    if (rawLeading.includes("%")) {
      return "percentage";
    }

    if (!isNaN(parseFloat(rawLeading))) {
      return "absolute";
    }

    return "unknown";
  }

  // NEW: Calculate effective line height for CSS rendering
  calculateEffectiveLineHeight(leading, fontSize) {
    if (leading === "auto") {
      return 1.2; // CSS line-height ratio for auto
    }

    if (typeof leading === "number" && fontSize) {
      // Convert points to CSS line-height ratio
      return Math.max(0.8, leading / fontSize); // Ensure minimum line height
    }

    return 1.2; // Fallback
  }

  getStyles() {
    return this.styles;
  }

  getResources() {
    return this.resources;
  }

  getFontMap() {
    return this.fontMap;
  }

  // Add methods to return style and font definitions for debug
  getParagraphStyles() {
    return this.styles.paragraph;
  }
  getCharacterStyles() {
    return this.styles.character;
  }
  getFontDefinitions() {
    // Prefer plain object for debug output
    if (this.resources && this.resources.fonts) {
      return this.resources.fonts;
    }
    // Fallback: convert fontMap to object
    if (this.fontMap && typeof this.fontMap.entries === "function") {
      return Object.fromEntries(this.fontMap.entries());
    }
    return {};
  }

  // FIXED: Add method to access document preferences including ViewPreferences
  getDocumentInfo() {
    return this.documentInfo;
  }
}

module.exports = StyleParser;

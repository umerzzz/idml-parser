import path from "path";
import IDMLUtils from "../utils/IDMLUtils.js";

class StyleParser {
  constructor(unitConverter = null) {
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
    this.unitConverter = unitConverter; // ADDED: Unit converter for typography measurements
    this.documentUnits = null; // Will be set from document units
  }

  // ADDED: Method to set document units for typography conversion
  setDocumentUnits(units) {
    this.documentUnits = units;
    console.log("📐 StyleParser: Set document units to", units);
  }

  // ADDED: Method to convert typography measurements to pixels
  convertTypographyToPixels(value, alreadyConverted = false) {
    if (
      typeof value !== "number" ||
      isNaN(value) ||
      !this.unitConverter ||
      !this.documentUnits ||
      alreadyConverted
    ) {
      return value;
    }

    // Only convert if we have a supported unit and it's not already pixels
    if (this.unitConverter.isSupportedUnit(this.documentUnits)) {
      const convertedValue = this.unitConverter.toPixels(
        value,
        this.documentUnits
      );
      console.log(
        `📐 Converted typography: ${value} ${this.documentUnits} → ${convertedValue} px`
      );
      return convertedValue;
    }

    return value;
  }

  // ADDED: Method to convert an entire style object's measurements to pixels
  convertStyleMeasurementsToPixels(style, alreadyConverted = false) {
    if (
      !this.unitConverter ||
      !this.documentUnits ||
      alreadyConverted ||
      style._convertedToPixels
    ) {
      return style;
    }

    const convertedStyle = { ...style };

    // Convert measurements that need pixel conversion
    const measurementFields = [
      "leftIndent",
      "rightIndent",
      "firstLineIndent",
      "spaceBefore",
      "spaceAfter",
      "tracking",
      "kerning",
      "baselineShift", // IMPROVED: Add baselineShift for vertical alignment
    ];

    measurementFields.forEach((field) => {
      if (typeof convertedStyle[field] === "number") {
        convertedStyle[field] = this.convertTypographyToPixels(
          convertedStyle[field],
          false // Not already converted
        );
      }
    });

    // Convert leading if it's a numeric value
    if (typeof convertedStyle.leading === "number") {
      convertedStyle.leading = this.convertTypographyToPixels(
        convertedStyle.leading,
        false // Not already converted
      );
    }

    // Mark as converted to prevent future conversions
    convertedStyle._convertedToPixels = true;

    return convertedStyle;
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
    console.log("📋 Styles data structure:", Object.keys(stylesData));

    const styles = stylesData.Styles || stylesData;
    console.log("📋 Processed styles structure:", Object.keys(styles));

    // ENHANCED: Handle different possible styles structures
    let paragraphStylesFound = false;
    let characterStylesFound = false;

    // Try different possible structures for paragraph styles
    if (styles.RootParagraphStyleGroup) {
      console.log("✅ Found RootParagraphStyleGroup");
      this.extractParagraphStyles(styles.RootParagraphStyleGroup);
      paragraphStylesFound = true;
    } else if (styles.ParagraphStyleGroup) {
      console.log("✅ Found ParagraphStyleGroup");
      this.extractParagraphStyles(styles.ParagraphStyleGroup);
      paragraphStylesFound = true;
    } else if (styles.ParagraphStyle) {
      console.log("✅ Found direct ParagraphStyle");
      this.extractParagraphStyles({ ParagraphStyle: styles.ParagraphStyle });
      paragraphStylesFound = true;
    }

    // Try different possible structures for character styles
    if (styles.RootCharacterStyleGroup) {
      console.log("✅ Found RootCharacterStyleGroup");
      this.extractCharacterStyles(styles.RootCharacterStyleGroup);
      characterStylesFound = true;
    } else if (styles.CharacterStyleGroup) {
      console.log("✅ Found CharacterStyleGroup");
      this.extractCharacterStyles(styles.CharacterStyleGroup);
      characterStylesFound = true;
    } else if (styles.CharacterStyle) {
      console.log("✅ Found direct CharacterStyle");
      this.extractCharacterStyles({ CharacterStyle: styles.CharacterStyle });
      characterStylesFound = true;
    }

    if (!paragraphStylesFound) {
      console.warn("⚠️ No paragraph styles found in expected structure");
      console.log("📋 Available keys:", Object.keys(styles));
    }

    if (!characterStylesFound) {
      console.warn("⚠️ No character styles found in expected structure");
      console.log("📋 Available keys:", Object.keys(styles));
    }
  }

  extractParagraphStyles(styleGroup) {
    console.log(
      "📋 Extracting paragraph styles from:",
      Object.keys(styleGroup)
    );

    const extractStylesRecursively = (group) => {
      if (group.ParagraphStyle) {
        const styles = Array.isArray(group.ParagraphStyle)
          ? group.ParagraphStyle
          : [group.ParagraphStyle];

        console.log(`📋 Found ${styles.length} paragraph styles`);

        styles.forEach((style) => {
          // CRITICAL: Extract font reference from multiple possible locations
          const fontRef = this.extractFontFromStyle(style);

          // ENHANCED: Process font size with unit conversion
          const rawFontSize = parseFloat(style["@_PointSize"]) || 12;
          console.log(
            `📐 Raw font size for style "${style["@_Name"]}": ${rawFontSize}pt`
          );

          // Convert font size to pixels using document units
          let fontSize = rawFontSize;
          if (
            this.unitConverter &&
            this.documentUnits &&
            this.documentUnits !== "Pixels"
          ) {
            // Font sizes in IDML are typically in Points, but use document units as fallback
            const fontUnits =
              this.documentUnits === "Pixels" ? "Pixels" : "Points";
            fontSize = this.unitConverter.toPixels(rawFontSize, fontUnits);
            console.log(
              `📐 Converted font size in paragraph style "${style["@_Name"]}": ${rawFontSize} ${fontUnits} → ${fontSize} px`
            );
          } else {
            console.log(
              `📐 Font size for style "${style["@_Name"]}": ${fontSize}px (no conversion needed)`
            );
          }

          const rawLeading = style["@_Leading"];
          const processedLeading = this.processLeadingValue(
            rawLeading,
            fontSize
          );

          // FIXED: Extract raw typography measurements for conversion
          const rawLeftIndent = parseFloat(style["@_LeftIndent"]) || 0;
          const rawRightIndent = parseFloat(style["@_RightIndent"]) || 0;
          const rawFirstLineIndent =
            parseFloat(style["@_FirstLineIndent"]) || 0;
          const rawSpaceBefore = parseFloat(style["@_SpaceBefore"]) || 0;
          const rawSpaceAfter = parseFloat(style["@_SpaceAfter"]) || 0;
          const rawTracking = parseFloat(style["@_Tracking"]) || 0;
          const rawKerning = parseFloat(style["@_Kerning"]) || 0;

          // FIXED: Create base style object with raw values
          const baseStyle = {
            self: style["@_Self"],
            name: style["@_Name"] || "",
            fontStyle: style["@_FontStyle"] || "Regular",
            pointSize: rawFontSize, // Keep original point size
            fontSize: fontSize, // Add converted font size
            leading: processedLeading,
            leadingType: this.determineLeadingType(rawLeading),
            effectiveLineHeight: this.calculateEffectiveLineHeight(
              processedLeading,
              fontSize
            ),
            alignment: style["@_Justification"] || "LeftAlign",

            // Raw measurements (will be converted to pixels)
            leftIndent: rawLeftIndent,
            rightIndent: rawRightIndent,
            firstLineIndent: rawFirstLineIndent,
            spaceBefore: rawSpaceBefore,
            spaceAfter: rawSpaceAfter,
            tracking: rawTracking,
            kerning: rawKerning,

            // Store original values for reference
            originalLeftIndent: rawLeftIndent,
            originalRightIndent: rawRightIndent,
            originalFirstLineIndent: rawFirstLineIndent,
            originalSpaceBefore: rawSpaceBefore,
            originalSpaceAfter: rawSpaceAfter,
            originalTracking: rawTracking,
            originalKerning: rawKerning,

            horizontalScale: parseFloat(style["@_HorizontalScale"]) || 100,
            verticalScale: parseFloat(style["@_VerticalScale"]) || 100,

            // IMPROVED: Add baselineShift for vertical alignment
            baselineShift: parseFloat(style["@_BaselineShift"]) || null,

            // ENHANCED: Use the new extraction method
            appliedFont: fontRef,
            originalFontRef: fontRef,

            fillColor: style["@_FillColor"] || "Color/Black",
            rawStyle: style,
          };

          // FIXED: Apply unit conversion to create pixel-converted style
          this.styles.paragraph[style["@_Self"]] =
            this.convertStyleMeasurementsToPixels(baseStyle);

          console.log(
            `✅ Paragraph Style: ${style["@_Name"]} -> Font: "${fontRef}" -> Size: ${fontSize}px`
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
    console.log(
      "📋 Extracting character styles from:",
      Object.keys(styleGroup)
    );

    const extractStylesRecursively = (group) => {
      if (group.CharacterStyle) {
        const styles = Array.isArray(group.CharacterStyle)
          ? group.CharacterStyle
          : [group.CharacterStyle];

        console.log(`📋 Found ${styles.length} character styles`);

        styles.forEach((style) => {
          const fontRef = this.extractFontFromStyle(style);

          // ENHANCED: Process font size with unit conversion for character styles
          const rawFontSize = parseFloat(style["@_PointSize"]) || null;
          console.log(
            `📐 Raw font size for character style "${style["@_Name"]}": ${rawFontSize}pt`
          );

          // Convert font size to pixels using document units
          let fontSize = rawFontSize;
          if (
            this.unitConverter &&
            this.documentUnits &&
            rawFontSize &&
            this.documentUnits !== "Pixels"
          ) {
            // Font sizes in IDML are typically in Points, but use document units as fallback
            const fontUnits =
              this.documentUnits === "Pixels" ? "Pixels" : "Points";
            fontSize = this.unitConverter.toPixels(rawFontSize, fontUnits);
            console.log(
              `📐 Converted font size in character style "${style["@_Name"]}": ${rawFontSize} ${fontUnits} → ${fontSize} px`
            );
          } else if (rawFontSize) {
            console.log(
              `📐 Font size for character style "${style["@_Name"]}": ${fontSize}px (no conversion needed)`
            );
          } else {
            console.log(
              `📐 No font size for character style "${style["@_Name"]}"`
            );
          }

          this.styles.character[style["@_Self"]] = {
            self: style["@_Self"],
            name: style["@_Name"] || "",
            fontStyle: style["@_FontStyle"] || "Regular",
            pointSize: rawFontSize, // Keep original point size
            fontSize: fontSize, // Add converted font size

            appliedFont: fontRef,
            originalFontRef: fontRef,

            fillColor: style["@_FillColor"] || null,
            strokeColor: style["@_StrokeColor"] || null,

            // IMPROVED: Add baselineShift for vertical alignment
            baselineShift: parseFloat(style["@_BaselineShift"]) || null,

            rawStyle: style,
          };

          console.log(
            `✅ Character Style: ${style["@_Name"]} -> Font: "${fontRef}" -> Size: ${fontSize}px`
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
        // Extract individual channel values from attributes (if present)
        const cyan = parseFloat(color["@_Cyan"]) || 0;
        const magenta = parseFloat(color["@_Magenta"]) || 0;
        const yellow = parseFloat(color["@_Yellow"]) || 0;
        const black = parseFloat(color["@_Black"]) || 0;
        const red = parseFloat(color["@_Red"]) || 0;
        const green = parseFloat(color["@_Green"]) || 0;
        const blue = parseFloat(color["@_Blue"]) || 0;

        // Get color space and model information
        const colorSpace = color["@_Space"] || "CMYK";
        const colorModel = color["@_Model"] || "Process";
        const colorValue = color["@_ColorValue"];
        const colorName = color["@_Name"] || "";
        const colorSelf = color["@_Self"] || "";

        console.log(`🎨 Processing color: ${colorSelf}`);
        console.log(
          `   Name: "${colorName}", Space: ${colorSpace}, Model: ${colorModel}`
        );
        console.log(`   ColorValue: "${colorValue}"`);
        console.log(
          `   Individual channels - C:${cyan} M:${magenta} Y:${yellow} K:${black} R:${red} G:${green} B:${blue}`
        );

        // CRITICAL: Determine if this is a custom color that should use RGB ColorValue
        const isCustomColor = this.isCustomColorName(colorSelf, colorName);
        console.log(`   🔍 Is custom color: ${isCustomColor}`);

        // Initialize color data structure
        let finalColorData = {
          self: colorSelf,
          name: colorName,
          model: colorModel,
          space: colorSpace,
          cyan: 0,
          magenta: 0,
          yellow: 0,
          black: 0,
          red: 0,
          green: 0,
          blue: 0,
          // Additional fields to track color source
          colorSource: "unknown",
          hasDirectRGB: false,
          hasDirectCMYK: false,
          hasColorValue: !!colorValue,
          isCustomColor: isCustomColor,
        };

        // STRATEGY 1: Check for direct RGB values in individual attributes
        if (red > 0 || green > 0 || blue > 0) {
          console.log(
            `   ✅ Using direct RGB from individual channels: R:${red} G:${green} B:${blue}`
          );
          finalColorData.red = red;
          finalColorData.green = green;
          finalColorData.blue = blue;
          finalColorData.colorSource = "direct_rgb_channels";
          finalColorData.hasDirectRGB = true;
        }
        // STRATEGY 2: Check for direct CMYK values in individual attributes
        else if (cyan > 0 || magenta > 0 || yellow > 0 || black > 0) {
          console.log(
            `   ✅ Using direct CMYK from individual channels: C:${cyan} M:${magenta} Y:${yellow} K:${black}`
          );
          finalColorData.cyan = cyan;
          finalColorData.magenta = magenta;
          finalColorData.yellow = yellow;
          finalColorData.black = black;
          finalColorData.colorSource = "direct_cmyk_channels";
          finalColorData.hasDirectCMYK = true;
        }
        // STRATEGY 3: Parse ColorValue attribute (ONLY for custom colors)
        else if (colorValue && isCustomColor) {
          console.log(
            `   🔍 Parsing ColorValue for CUSTOM color: "${colorValue}"`
          );

          // Split ColorValue into numeric parts
          const valueParts = colorValue
            .split(/\s+/)
            .map(Number)
            .filter((v) => !isNaN(v));

          if (valueParts.length === 3 && colorSpace === "RGB") {
            // RGB ColorValue: "255 137 0" -> R:255 G:137 B:0
            console.log(
              `   ✅ Using RGB ColorValue for custom color: R:${valueParts[0]} G:${valueParts[1]} B:${valueParts[2]}`
            );
            finalColorData.red = valueParts[0];
            finalColorData.green = valueParts[1];
            finalColorData.blue = valueParts[2];
            finalColorData.colorSource = "colorvalue_rgb_custom";
            finalColorData.hasDirectRGB = true;
          } else if (valueParts.length === 4 && colorSpace === "CMYK") {
            // CMYK ColorValue: "0 0 0 100" -> C:0 M:0 Y:0 K:100
            console.log(
              `   ✅ Using CMYK ColorValue for custom color: C:${valueParts[0]} M:${valueParts[1]} Y:${valueParts[2]} K:${valueParts[3]}`
            );
            finalColorData.cyan = valueParts[0];
            finalColorData.magenta = valueParts[1];
            finalColorData.yellow = valueParts[2];
            finalColorData.black = valueParts[3];
            finalColorData.colorSource = "colorvalue_cmyk_custom";
            finalColorData.hasDirectCMYK = true;
          } else if (valueParts.length === 3) {
            // Assume RGB if space is unknown but we have 3 values (for custom colors)
            console.log(
              `   ⚠️  Assuming RGB for 3-value ColorValue on custom color: R:${valueParts[0]} G:${valueParts[1]} B:${valueParts[2]}`
            );
            finalColorData.red = valueParts[0];
            finalColorData.green = valueParts[1];
            finalColorData.blue = valueParts[2];
            finalColorData.space = "RGB";
            finalColorData.colorSource = "colorvalue_assumed_rgb_custom";
            finalColorData.hasDirectRGB = true;
          } else {
            console.log(
              `   ⚠️  Could not parse ColorValue for custom color: "${colorValue}" (${valueParts.length} parts)`
            );
            finalColorData.colorSource = "colorvalue_unparseable_custom";
          }
        }
        // STRATEGY 4: Handle ColorValue for standard colors (use for CMYK only, skip RGB)
        else if (colorValue && !isCustomColor) {
          console.log(
            `   🔍 Parsing ColorValue for STANDARD color: "${colorValue}"`
          );

          // Split ColorValue into numeric parts
          const valueParts = colorValue
            .split(/\s+/)
            .map(Number)
            .filter((v) => !isNaN(v));

          if (valueParts.length === 4 && colorSpace === "CMYK") {
            // Only use CMYK ColorValue for standard colors, ignore RGB ColorValue
            console.log(
              `   ✅ Using CMYK ColorValue for standard color: C:${valueParts[0]} M:${valueParts[1]} Y:${valueParts[2]} K:${valueParts[3]}`
            );
            finalColorData.cyan = valueParts[0];
            finalColorData.magenta = valueParts[1];
            finalColorData.yellow = valueParts[2];
            finalColorData.black = valueParts[3];
            finalColorData.colorSource = "colorvalue_cmyk_standard";
            finalColorData.hasDirectCMYK = true;
          } else if (valueParts.length === 3 && colorSpace === "RGB") {
            // Skip RGB ColorValue for standard colors to avoid "0 0 0" issues
            console.log(
              `   ⚠️  Skipping RGB ColorValue for standard color (avoiding black fallback): "${colorValue}"`
            );
            finalColorData.colorSource = "colorvalue_rgb_skipped_standard";
          } else {
            console.log(
              `   ⚠️  Could not parse ColorValue for standard color: "${colorValue}" (${valueParts.length} parts)`
            );
            finalColorData.colorSource = "colorvalue_unparseable_standard";
          }
        }

        // STRATEGY 5: Handle special color types (fallback)
        if (finalColorData.colorSource === "unknown") {
          console.log(`   🔄 Using fallback handling for color: ${colorSelf}`);
          finalColorData.colorSource = "fallback";

          // For standard colors with no data, don't store them at all
          // This will cause them to fall through to the gray fallback in ColorUtils
          if (
            !isCustomColor &&
            finalColorData.cyan === 0 &&
            finalColorData.magenta === 0 &&
            finalColorData.yellow === 0 &&
            finalColorData.black === 0 &&
            finalColorData.red === 0 &&
            finalColorData.green === 0 &&
            finalColorData.blue === 0
          ) {
            console.log(
              `   ⚠️  Standard color with no valid data - skipping storage to allow gray fallback`
            );
            return; // Skip storing this color completely
          }
        }

        // Store the color data
        this.resources.colors[colorSelf] = finalColorData;

        console.log(`   💾 Stored color data:`, {
          self: finalColorData.self,
          source: finalColorData.colorSource,
          hasRGB: finalColorData.hasDirectRGB,
          hasCMYK: finalColorData.hasDirectCMYK,
          isCustom: finalColorData.isCustomColor,
          rgb: `${finalColorData.red},${finalColorData.green},${finalColorData.blue}`,
          cmyk: `${finalColorData.cyan},${finalColorData.magenta},${finalColorData.yellow},${finalColorData.black}`,
        });
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

    console.log(
      `✅ Graphics extraction complete. Colors: ${
        Object.keys(this.resources.colors).length
      }, Gradients: ${Object.keys(this.resources.gradients).length}`
    );
  }

  // NEW METHOD: Determine if a color is custom and should use RGB ColorValue
  isCustomColorName(colorSelf, colorName) {
    // Standard/predefined InDesign colors that should NOT use RGB ColorValue
    const standardColors = [
      "Color/Black",
      "Color/White",
      "Color/Red",
      "Color/Green",
      "Color/Blue",
      "Color/Cyan",
      "Color/Magenta",
      "Color/Yellow",
      "Color/Paper",
      "Color/Registration",
      "Color/None",
    ];

    // Standard color patterns (CMYK values in the name)
    const cmykPattern = /Color\/C=[\d.]+\s*M=[\d.]+\s*Y=[\d.]+\s*K=[\d.]+/;
    const rgbPattern = /Color\/R=[\d.]+\s*G=[\d.]+\s*B=[\d.]+/;

    // Check if it's a standard color
    if (standardColors.includes(colorSelf)) {
      return false;
    }

    // Check if it follows CMYK or RGB pattern (these are auto-generated, not custom)
    if (cmykPattern.test(colorSelf) || rgbPattern.test(colorSelf)) {
      return false;
    }

    // Check for hidden/system colors
    if (colorSelf.includes("/u") && /\/u\d+$/.test(colorSelf)) {
      return false;
    }

    // If color name is generic or empty, it's likely not custom
    if (!colorName || colorName === "" || colorName === "$ID/") {
      return false;
    }

    // Custom colors typically have meaningful names like "Main", "Brand", "Accent", etc.
    const customColorPatterns = [
      /main/i,
      /brand/i,
      /accent/i,
      /primary/i,
      /secondary/i,
      /theme/i,
      /custom/i,
    ];

    // Check if the name matches custom patterns
    const hasCustomPattern = customColorPatterns.some(
      (pattern) => pattern.test(colorName) || pattern.test(colorSelf)
    );

    if (hasCustomPattern) {
      return true;
    }

    // If it's not a standard color and has a meaningful name, consider it custom
    return colorName.length > 2 && !colorName.includes("$ID/");
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
      console.log(
        `📐 Resolving paragraph style: ${formatting.paragraphStyle}`,
        {
          fontSize: pStyle.fontSize,
          pointSize: pStyle.pointSize,
          fontFamily: pStyle.appliedFont,
        }
      );

      if (!resolved.fontSize && pStyle.fontSize) {
        resolved.fontSize = pStyle.fontSize; // Use converted fontSize, not pointSize
        console.log(`📐 Font size from paragraph style: ${pStyle.fontSize} px`);
      }
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
      console.log(
        `📐 Resolving character style: ${formatting.characterStyle}`,
        {
          fontSize: cStyle.fontSize,
          pointSize: cStyle.pointSize,
          fontFamily: cStyle.appliedFont,
        }
      );

      if (cStyle.fontSize) {
        resolved.fontSize = cStyle.fontSize; // Use converted fontSize, not pointSize
        console.log(`📐 Font size from character style: ${cStyle.fontSize} px`);
      }
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

    // IMPROVED: Apply baselineShift for vertical alignment
    if (
      formatting.baselineShift !== undefined &&
      formatting.baselineShift !== null
    ) {
      resolved.baselineShift = formatting.baselineShift;
      if (hasAnyFormatting) {
        console.log(
          `   BaselineShift from direct formatting: ${formatting.baselineShift}`
        );
      }
    }

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

    // ENHANCED: Ensure font size is set with fallback
    if (!resolved.fontSize) {
      resolved.fontSize = 16; // Default font size in pixels
      console.log(`📐 Using fallback font size: ${resolved.fontSize} px`);
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

// ES6 exports
export default StyleParser;

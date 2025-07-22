/**
 * NextFontMapper.js - Dynamic Next.js font mapping based on font characteristics
 * NO HARDCODED MAPPINGS - Automatically maps any font to appropriate Next.js fonts
 */

class NextFontMapper {
  constructor() {
    // Available Next.js font categories and their characteristics
    this.nextFontDatabase = this.initializeNextFontDatabase();
    this.fontCache = new Map(); // Cache for resolved fonts
    this.nextFontImports = new Set(); // Track which fonts need to be imported
  }

  /**
   * Initialize comprehensive Next.js font database with characteristics
   * @returns {Object} Font database categorized by type and characteristics
   */
  initializeNextFontDatabase() {
    return {
      serif: {
        traditional: [
          {
            nextFont: "Crimson_Text",
            family: "Crimson Text",
            weights: ["400", "600", "700"],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: [
              "elegant",
              "traditional",
              "readable",
              "body-text",
            ],
            keywords: ["minion", "times", "garamond", "baskerville", "caslon"],
          },
          {
            nextFont: "Libre_Baskerville",
            family: "Libre Baskerville",
            weights: ["400", "700"],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: ["classic", "readable", "book"],
            keywords: ["baskerville", "libre", "book"],
          },
          {
            nextFont: "Lora",
            family: "Lora",
            weights: ["400", "500", "600", "700"],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: ["modern", "friendly", "calligraphic"],
            keywords: ["lora", "modern-serif"],
          },
        ],
        display: [
          {
            nextFont: "Playfair_Display",
            family: "Playfair Display",
            weights: ["400", "500", "600", "700", "800", "900"],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: ["elegant", "high-contrast", "display", "luxury"],
            keywords: ["playfair", "display", "elegant", "luxury"],
          },
          {
            nextFont: "Cormorant_Garamond",
            family: "Cormorant Garamond",
            weights: ["300", "400", "500", "600", "700"],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: ["refined", "garamond", "classic"],
            keywords: ["garamond", "cormorant", "refined"],
          },
        ],
      },

      "sans-serif": {
        geometric: [
          {
            nextFont: "Inter",
            family: "Inter",
            weights: [
              "100",
              "200",
              "300",
              "400",
              "500",
              "600",
              "700",
              "800",
              "900",
            ],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: [
              "modern",
              "clean",
              "ui",
              "versatile",
              "geometric",
            ],
            keywords: ["inter", "ui", "interface", "modern"],
          },
          {
            nextFont: "Nunito_Sans",
            family: "Nunito Sans",
            weights: ["200", "300", "400", "500", "600", "700", "800", "900"],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: ["friendly", "rounded", "geometric"],
            keywords: ["nunito", "friendly", "rounded", "futura", "avenir"],
          },
        ],
        humanist: [
          {
            nextFont: "Open_Sans",
            family: "Open Sans",
            weights: ["300", "400", "500", "600", "700", "800"],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: [
              "versatile",
              "readable",
              "neutral",
              "professional",
            ],
            keywords: ["open", "myriad", "professional", "clean"],
          },
          {
            nextFont: "Source_Sans_3",
            family: "Source Sans 3",
            weights: ["200", "300", "400", "500", "600", "700", "800", "900"],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: ["adobe", "technical", "clean"],
            keywords: ["source", "adobe", "technical", "calibri"],
          },
          {
            nextFont: "Lato",
            family: "Lato",
            weights: ["100", "300", "400", "700", "900"],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: ["warm", "friendly", "professional"],
            keywords: ["lato", "warm", "friendly"],
          },
        ],
        grotesque: [
          {
            nextFont: "Roboto",
            family: "Roboto",
            weights: ["100", "300", "400", "500", "700", "900"],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: ["android", "modern", "mechanical"],
            keywords: ["roboto", "android", "mechanical"],
          },
          {
            nextFont: "Work_Sans",
            family: "Work Sans",
            weights: [
              "100",
              "200",
              "300",
              "400",
              "500",
              "600",
              "700",
              "800",
              "900",
            ],
            styles: ["normal", "italic"],
            googleFont: true,
            characteristics: ["work", "professional", "clean"],
            keywords: ["work", "professional", "helvetica"],
          },
        ],
      },

      monospace: [
        {
          nextFont: "JetBrains_Mono",
          family: "JetBrains Mono",
          weights: ["100", "200", "300", "400", "500", "600", "700", "800"],
          styles: ["normal", "italic"],
          googleFont: true,
          characteristics: ["coding", "modern", "ligatures"],
          keywords: ["jetbrains", "code", "programming"],
        },
        {
          nextFont: "Courier_Prime",
          family: "Courier Prime",
          weights: ["400", "700"],
          styles: ["normal", "italic"],
          googleFont: true,
          characteristics: ["typewriter", "classic", "courier"],
          keywords: ["courier", "typewriter", "classic"],
        },
        {
          nextFont: "Source_Code_Pro",
          family: "Source Code Pro",
          weights: ["200", "300", "400", "500", "600", "700", "800", "900"],
          styles: ["normal", "italic"],
          googleFont: true,
          characteristics: ["adobe", "coding", "technical"],
          keywords: ["source", "code", "adobe", "technical"],
        },
      ],

      // Language-specific fonts
      japanese: [
        {
          nextFont: "Noto_Serif_JP",
          family: "Noto Serif JP",
          weights: ["200", "300", "400", "500", "600", "700", "900"],
          styles: ["normal"],
          googleFont: true,
          characteristics: ["japanese", "serif", "traditional"],
          keywords: ["japanese", "jp", "mincho", "kozuka", "noto"],
        },
        {
          nextFont: "Noto_Sans_JP",
          family: "Noto Sans JP",
          weights: ["100", "300", "400", "500", "700", "900"],
          styles: ["normal"],
          googleFont: true,
          characteristics: ["japanese", "sans-serif", "modern"],
          keywords: ["japanese", "jp", "gothic", "sans", "noto"],
        },
      ],

      chinese: [
        {
          nextFont: "Noto_Serif_SC",
          family: "Noto Serif SC",
          weights: ["200", "300", "400", "500", "600", "700", "900"],
          styles: ["normal"],
          googleFont: true,
          characteristics: ["chinese", "simplified", "serif"],
          keywords: ["chinese", "simplified", "sc", "simsun", "noto"],
        },
        {
          nextFont: "Noto_Sans_SC",
          family: "Noto Sans SC",
          weights: ["100", "300", "400", "500", "700", "900"],
          styles: ["normal"],
          googleFont: true,
          characteristics: ["chinese", "simplified", "sans-serif"],
          keywords: ["chinese", "simplified", "sc", "sans", "noto"],
        },
      ],
    };
  }

  /**
   * Dynamically map IDML font to Next.js font based on characteristics
   * @param {string} idmlFontFamily - Original IDML font family
   * @param {string} fontStyle - Font style (Regular, Bold, Italic, etc.)
   * @param {number} fontSize - Font size in pixels
   * @param {Object} fontMetadata - Additional font metadata from IDML
   * @returns {Object} Next.js font configuration
   */
  mapToNextFont(
    idmlFontFamily,
    fontStyle = "Regular",
    fontSize = 16,
    fontMetadata = {}
  ) {
    if (!idmlFontFamily) {
      console.log("⚠️  No font family provided, using default");
      return this.getDefaultFont();
    }

    // Create cache key
    const cacheKey = `${idmlFontFamily}-${fontStyle}-${fontSize}`;

    // Check cache first
    if (this.fontCache.has(cacheKey)) {
      return this.fontCache.get(cacheKey);
    }

    console.log(
      `🔍 Dynamically mapping font: "${idmlFontFamily}" (${fontStyle})`
    );

    // Analyze font characteristics
    const fontAnalysis = this.analyzeFontCharacteristics(
      idmlFontFamily,
      fontStyle,
      fontMetadata
    );

    console.log(`📊 Font analysis for "${idmlFontFamily}":`, {
      category: fontAnalysis.category,
      subcategory: fontAnalysis.subcategory,
      language: fontAnalysis.language,
      keywords: fontAnalysis.detectedKeywords,
      confidence: fontAnalysis.confidence,
    });

    // Find best matching Next.js font
    const bestMatch = this.findBestNextJSFont(fontAnalysis, idmlFontFamily);

    // Build final font configuration
    const finalConfig = this.buildFontConfig(
      bestMatch,
      fontStyle,
      fontSize,
      idmlFontFamily
    );

    // Add to cache
    this.fontCache.set(cacheKey, finalConfig);

    // Track for import generation
    this.nextFontImports.add(bestMatch.nextFont);

    console.log(
      `✅ Dynamic mapping: "${idmlFontFamily}" → "${finalConfig.fontFamily}" (${bestMatch.nextFont})`
    );

    return finalConfig;
  }

  /**
   * Analyze font characteristics to determine category and properties
   * @param {string} fontName - Font name to analyze
   * @param {string} fontStyle - Font style
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Font analysis result
   */
  analyzeFontCharacteristics(fontName, fontStyle, metadata = {}) {
    const lowerName = fontName.toLowerCase();
    const analysis = {
      category: "sans-serif", // default
      subcategory: "humanist", // default
      language: "latin",
      detectedKeywords: [],
      confidence: 0,
      weight: this.extractWeight(fontStyle),
      isDisplay: false,
      isCondensed: false,
    };

    // Language detection
    if (this.isJapaneseFont(lowerName)) {
      analysis.language = "japanese";
      analysis.category = this.isSerifFont(lowerName) ? "serif" : "sans-serif";
      analysis.confidence += 0.8;
      return analysis;
    }

    if (this.isChineseFont(lowerName)) {
      analysis.language = "chinese";
      analysis.category = this.isSerifFont(lowerName) ? "serif" : "sans-serif";
      analysis.confidence += 0.8;
      return analysis;
    }

    // Category detection
    if (this.isSerifFont(lowerName)) {
      analysis.category = "serif";
      analysis.subcategory = this.isDisplayFont(lowerName)
        ? "display"
        : "traditional";
      analysis.confidence += 0.6;
    } else if (this.isMonospaceFont(lowerName)) {
      analysis.category = "monospace";
      analysis.confidence += 0.8;
    } else {
      // Sans-serif subcategory detection
      analysis.category = "sans-serif";
      if (this.isGeometricFont(lowerName)) {
        analysis.subcategory = "geometric";
        analysis.confidence += 0.5;
      } else if (this.isGrotesqueFont(lowerName)) {
        analysis.subcategory = "grotesque";
        analysis.confidence += 0.5;
      } else {
        analysis.subcategory = "humanist"; // default
        analysis.confidence += 0.3;
      }
    }

    // Additional characteristics
    analysis.isDisplay = this.isDisplayFont(lowerName);
    analysis.isCondensed = this.isCondensedFont(lowerName);

    // Extract keywords for matching
    analysis.detectedKeywords = this.extractKeywords(lowerName);

    return analysis;
  }

  /**
   * Check if font is Japanese
   */
  isJapaneseFont(fontName) {
    const japaneseIndicators = [
      "kozuka",
      "mincho",
      "gothic",
      "hiragino",
      "yu",
      "meiryo",
      "noto",
      "jp",
    ];
    return japaneseIndicators.some((indicator) => fontName.includes(indicator));
  }

  /**
   * Check if font is Chinese
   */
  isChineseFont(fontName) {
    const chineseIndicators = [
      "simsun",
      "simhei",
      "microsoft yahei",
      "songti",
      "fangsong",
      "sc",
      "tc",
    ];
    return chineseIndicators.some((indicator) => fontName.includes(indicator));
  }

  /**
   * Check if font is serif
   */
  isSerifFont(fontName) {
    const serifIndicators = [
      "serif",
      "times",
      "minion",
      "georgia",
      "garamond",
      "baskerville",
      "caslon",
      "mincho",
      "songti",
      "book",
    ];
    return serifIndicators.some((indicator) => fontName.includes(indicator));
  }

  /**
   * Check if font is monospace
   */
  isMonospaceFont(fontName) {
    const monospaceIndicators = [
      "mono",
      "courier",
      "code",
      "console",
      "terminal",
      "typewriter",
    ];
    return monospaceIndicators.some((indicator) =>
      fontName.includes(indicator)
    );
  }

  /**
   * Check if font is geometric sans-serif
   */
  isGeometricFont(fontName) {
    const geometricIndicators = [
      "futura",
      "avenir",
      "nunito",
      "inter",
      "circular",
      "geometric",
    ];
    return geometricIndicators.some((indicator) =>
      fontName.includes(indicator)
    );
  }

  /**
   * Check if font is grotesque sans-serif
   */
  isGrotesqueFont(fontName) {
    const grotesqueIndicators = [
      "helvetica",
      "arial",
      "roboto",
      "work",
      "franklin",
      "akzidenz",
    ];
    return grotesqueIndicators.some((indicator) =>
      fontName.includes(indicator)
    );
  }

  /**
   * Check if font is display type
   */
  isDisplayFont(fontName) {
    const displayIndicators = [
      "display",
      "title",
      "headline",
      "poster",
      "banner",
      "playfair",
    ];
    return displayIndicators.some((indicator) => fontName.includes(indicator));
  }

  /**
   * Check if font is condensed
   */
  isCondensedFont(fontName) {
    const condensedIndicators = [
      "condensed",
      "compressed",
      "narrow",
      "compact",
    ];
    return condensedIndicators.some((indicator) =>
      fontName.includes(indicator)
    );
  }

  /**
   * Extract weight from font style
   */
  extractWeight(fontStyle) {
    const style = (fontStyle || "").toLowerCase();
    if (style.includes("thin")) return "thin";
    if (style.includes("light")) return "light";
    if (style.includes("medium")) return "medium";
    if (style.includes("semibold") || style.includes("semi bold"))
      return "semibold";
    if (style.includes("bold")) return "bold";
    if (style.includes("black") || style.includes("heavy")) return "black";
    return "regular";
  }

  /**
   * Extract keywords from font name for matching
   */
  extractKeywords(fontName) {
    // Remove common suffixes and split into words
    const cleaned = fontName
      .replace(
        /\s+(pro|std|regular|bold|italic|light|medium|heavy|black|mt)$/gi,
        ""
      )
      .replace(/[^\w\s]/g, " ")
      .toLowerCase();

    return cleaned.split(/\s+/).filter((word) => word.length > 2);
  }

  /**
   * Find best matching Next.js font based on analysis
   * @param {Object} analysis - Font analysis result
   * @param {string} originalName - Original font name for logging
   * @returns {Object} Best matching Next.js font configuration
   */
  findBestNextJSFont(analysis, originalName) {
    let candidates = [];

    // Get font category
    if (analysis.language === "japanese") {
      candidates = this.nextFontDatabase.japanese;
    } else if (analysis.language === "chinese") {
      candidates = this.nextFontDatabase.chinese;
    } else if (analysis.category === "monospace") {
      candidates = this.nextFontDatabase.monospace;
    } else if (analysis.category === "serif") {
      const subcategory = analysis.subcategory || "traditional";
      candidates =
        this.nextFontDatabase.serif[subcategory] ||
        this.nextFontDatabase.serif.traditional;
    } else {
      // sans-serif
      const subcategory = analysis.subcategory || "humanist";
      candidates =
        this.nextFontDatabase["sans-serif"][subcategory] ||
        this.nextFontDatabase["sans-serif"].humanist;
    }

    if (!candidates || candidates.length === 0) {
      console.log(`⚠️ No candidates found for ${originalName}, using default`);
      return this.getDefaultFontConfig();
    }

    // Score each candidate
    const scoredCandidates = candidates.map((font) => ({
      ...font,
      score: this.calculateFontScore(font, analysis, originalName),
    }));

    // Sort by score (highest first)
    scoredCandidates.sort((a, b) => b.score - a.score);

    const bestMatch = scoredCandidates[0];
    console.log(
      `🎯 Best match for "${originalName}": ${
        bestMatch.family
      } (score: ${bestMatch.score.toFixed(2)})`
    );

    return bestMatch;
  }

  /**
   * Calculate matching score between font and analysis
   */
  calculateFontScore(font, analysis, originalName) {
    let score = 0;
    const lowerOriginal = originalName.toLowerCase();

    // Keyword matching (high weight)
    const keywordMatches = analysis.detectedKeywords.filter((keyword) =>
      font.keywords.some(
        (fontKeyword) =>
          fontKeyword.includes(keyword) || keyword.includes(fontKeyword)
      )
    );
    score += keywordMatches.length * 2;

    // Exact keyword match (very high weight)
    if (font.keywords.some((keyword) => lowerOriginal.includes(keyword))) {
      score += 5;
    }

    // Family name similarity
    if (lowerOriginal.includes(font.family.toLowerCase().split(" ")[0])) {
      score += 3;
    }

    // Characteristics matching
    const characteristicMatches = font.characteristics.filter(
      (char) =>
        analysis.detectedKeywords.includes(char) || lowerOriginal.includes(char)
    );
    score += characteristicMatches.length * 1;

    // Weight availability
    const targetWeight = this.mapFontWeight(analysis.weight, font.weights);
    if (font.weights.includes(targetWeight)) {
      score += 0.5;
    }

    // Display font preference
    if (analysis.isDisplay && font.characteristics.includes("display")) {
      score += 2;
    }

    return score;
  }

  /**
   * Build final font configuration
   * @param {Object} fontConfig - Next.js font configuration
   * @param {string} fontStyle - Original font style
   * @param {number} fontSize - Font size
   * @param {string} originalFamily - Original font family name
   * @returns {Object} Complete font configuration
   */
  buildFontConfig(fontConfig, fontStyle, fontSize, originalFamily) {
    // Safety check
    if (!fontConfig) {
      console.error("⚠️ buildFontConfig received null/undefined fontConfig");
      fontConfig = this.getDefaultFontConfig();
    }

    const weight = this.mapFontWeight(fontStyle, fontConfig.weights);
    const style = this.mapFontStyle(fontStyle);

    // ENHANCED: Extract complete style analysis
    const styleAnalysis = this.analyzeComplexFontStyle(fontStyle);

    return {
      // Next.js specific
      nextFont: fontConfig.nextFont,
      nextFontVariable: `--font-${fontConfig.nextFont.toLowerCase()}`,

      // CSS properties
      fontFamily: fontConfig.family,
      fontSize: `${fontSize}px`,
      fontWeight: weight,
      fontStyle: style,

      // ENHANCED: Complete style information
      completeStyle: {
        weight: weight,
        style: style,
        isItalic: styleAnalysis.isItalic,
        isBold: styleAnalysis.isBold,
        originalStyle: fontStyle,
        complexStyle: styleAnalysis.complexStyle,

        // CSS class suggestions
        cssClasses: this.generateCSSClasses(styleAnalysis),

        // Multiple weights for Next.js font loading
        requiredWeights: this.getRequiredWeights(
          styleAnalysis,
          fontConfig.weights
        ),
        requiredStyles: this.getRequiredStyles(styleAnalysis),
      },

      // Fallback chain
      fontFamilyFallback: [
        fontConfig.family,
        "system-ui",
        "-apple-system",
        "sans-serif",
      ].join(", "),

      // Metadata
      category: fontConfig.characteristics
        ? fontConfig.characteristics[0]
        : "sans-serif",
      isGoogleFont: fontConfig.googleFont || false,
      isSystemFont: fontConfig.systemFont || false,

      // Original values
      originalFamily: originalFamily,
      originalStyle: fontStyle,
      originalSize: fontSize,

      // Mapping info
      mappingConfidence: fontConfig.score || 0,
      mappingReason: this.generateMappingReason(fontConfig, originalFamily),
    };
  }

  /**
   * Analyze complex font styles like "Bold Italic", "Semibold Condensed", etc.
   * @param {string} fontStyle - Font style string
   * @returns {Object} Style analysis result
   */
  analyzeComplexFontStyle(fontStyle) {
    if (!fontStyle) {
      return {
        isBold: false,
        isItalic: false,
        complexStyle: "regular",
        weight: "400",
        style: "normal",
      };
    }

    const style = fontStyle.toLowerCase();

    const analysis = {
      isBold: style.includes("bold"),
      isItalic: style.includes("italic") || style.includes("oblique"),
      isLight: style.includes("light"),
      isMedium: style.includes("medium"),
      isSemibold: style.includes("semibold") || style.includes("demibold"),
      isBlack: style.includes("black") || style.includes("heavy"),
      isCondensed: style.includes("condensed") || style.includes("compressed"),
      originalStyle: fontStyle,
    };

    // Determine complex style description
    let complexStyle = "regular";
    if (analysis.isBold && analysis.isItalic) {
      complexStyle = "bold-italic";
    } else if (analysis.isBold) {
      complexStyle = "bold";
    } else if (analysis.isItalic) {
      complexStyle = "italic";
    } else if (analysis.isSemibold) {
      complexStyle = analysis.isItalic ? "semibold-italic" : "semibold";
    } else if (analysis.isLight) {
      complexStyle = analysis.isItalic ? "light-italic" : "light";
    } else if (analysis.isMedium) {
      complexStyle = analysis.isItalic ? "medium-italic" : "medium";
    } else if (analysis.isBlack) {
      complexStyle = analysis.isItalic ? "black-italic" : "black";
    }

    analysis.complexStyle = complexStyle;
    analysis.weight = this.extractWeight(fontStyle);
    analysis.style = analysis.isItalic ? "italic" : "normal";

    return analysis;
  }

  /**
   * Generate CSS classes for styling
   * @param {Object} styleAnalysis - Style analysis result
   * @returns {Array} CSS class suggestions
   */
  generateCSSClasses(styleAnalysis) {
    const classes = [];

    if (styleAnalysis.isBold) classes.push("font-bold");
    else if (styleAnalysis.isSemibold) classes.push("font-semibold");
    else if (styleAnalysis.isMedium) classes.push("font-medium");
    else if (styleAnalysis.isLight) classes.push("font-light");
    else classes.push("font-normal");

    if (styleAnalysis.isItalic) classes.push("italic");

    return classes;
  }

  /**
   * Get required weights for Next.js font loading
   * @param {Object} styleAnalysis - Style analysis result
   * @param {Array} availableWeights - Available weights
   * @returns {Array} Required weights
   */
  getRequiredWeights(styleAnalysis, availableWeights) {
    const weights = ["400"]; // Always include normal

    if (styleAnalysis.isBold && availableWeights.includes("700")) {
      weights.push("700");
    }
    if (styleAnalysis.isSemibold && availableWeights.includes("600")) {
      weights.push("600");
    }
    if (styleAnalysis.isMedium && availableWeights.includes("500")) {
      weights.push("500");
    }
    if (styleAnalysis.isLight && availableWeights.includes("300")) {
      weights.push("300");
    }
    if (styleAnalysis.isBlack && availableWeights.includes("900")) {
      weights.push("900");
    }

    return [...new Set(weights)];
  }

  /**
   * Get required styles for Next.js font loading
   * @param {Object} styleAnalysis - Style analysis result
   * @returns {Array} Required styles
   */
  getRequiredStyles(styleAnalysis) {
    const styles = ["normal"];

    if (styleAnalysis.isItalic) {
      styles.push("italic");
    }

    return styles;
  }

  /**
   * Generate explanation for why this font was chosen
   */
  generateMappingReason(fontConfig, originalFamily) {
    const reasons = [];

    if (
      fontConfig.keywords &&
      fontConfig.keywords.some((k) => originalFamily.toLowerCase().includes(k))
    ) {
      reasons.push("keyword match");
    }

    if (fontConfig.characteristics) {
      reasons.push(`${fontConfig.characteristics[0]} characteristics`);
    }

    if (fontConfig.googleFont) {
      reasons.push("Google Font availability");
    }

    return reasons.length > 0 ? reasons.join(", ") : "category fallback";
  }

  /**
   * Map InDesign font style to CSS font weight
   * @param {string} fontStyle - InDesign font style
   * @param {Array} availableWeights - Available weights for font
   * @returns {string} CSS font weight
   */
  mapFontWeight(fontStyle, availableWeights = ["400"]) {
    const style = (fontStyle || "").toLowerCase();

    // Weight mapping
    const weightMap = {
      thin: "100",
      extralight: "200",
      light: "300",
      regular: "400",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
      black: "900",
      heavy: "900",
    };

    // Check for weight keywords in style
    for (const [keyword, weight] of Object.entries(weightMap)) {
      if (style.includes(keyword)) {
        // Ensure the weight is available
        return availableWeights.includes(weight)
          ? weight
          : availableWeights.includes("400")
          ? "400"
          : availableWeights[0];
      }
    }

    // Default to normal weight
    return availableWeights.includes("400") ? "400" : availableWeights[0];
  }

  /**
   * Map InDesign font style to CSS font style
   * @param {string} fontStyle - InDesign font style
   * @returns {string} CSS font style
   */
  mapFontStyle(fontStyle) {
    const style = (fontStyle || "").toLowerCase();

    if (style.includes("italic") || style.includes("oblique")) {
      return "italic";
    }

    return "normal";
  }

  /**
   * Get default fallback font configuration
   * @returns {Object} Default font configuration
   */
  getDefaultFontConfig() {
    return this.nextFontDatabase["sans-serif"].humanist[0]; // Inter
  }

  /**
   * Get default fallback font
   * @returns {Object} Default font configuration
   */
  getDefaultFont() {
    return this.buildFontConfig(
      this.getDefaultFontConfig(),
      "Regular",
      16,
      "Default Font"
    );
  }

  /**
   * Generate Next.js font imports code
   * @returns {string} Import statements for fonts
   */
  generateNextFontImports() {
    const imports = Array.from(this.nextFontImports).map((fontName) => {
      return `import { ${fontName} } from 'next/font/google';`;
    });

    return imports.join("\n");
  }

  /**
   * Generate Next.js font variable definitions
   * @returns {string} Font variable definitions
   */
  generateFontVariables() {
    const variables = Array.from(this.nextFontImports).map((fontName) => {
      // Find font config for weights and styles
      const fontConfig = this.findFontConfigByNextFont(fontName);

      // ENHANCED: Collect all required weights and styles from mapped fonts
      const allRequiredWeights = new Set(["400"]); // Always include normal
      const allRequiredStyles = new Set(["normal"]); // Always include normal

      // Check all cached fonts for this Next.js font to see what weights/styles are needed
      for (const [cacheKey, cachedFont] of this.fontCache.entries()) {
        if (cachedFont.nextFont === fontName) {
          if (cachedFont.completeStyle?.requiredWeights) {
            cachedFont.completeStyle.requiredWeights.forEach((w) =>
              allRequiredWeights.add(w)
            );
          }
          if (cachedFont.completeStyle?.requiredStyles) {
            cachedFont.completeStyle.requiredStyles.forEach((s) =>
              allRequiredStyles.add(s)
            );
          }
        }
      }

      const weights = Array.from(allRequiredWeights).filter((w) =>
        fontConfig.weights.includes(w)
      );
      const styles = Array.from(allRequiredStyles).filter((s) =>
        fontConfig.styles.includes(s)
      );

      return `const ${fontName.toLowerCase()} = ${fontName}({
  weight: [${weights.map((w) => `'${w}'`).join(", ")}],
  style: [${styles.map((s) => `'${s}'`).join(", ")}],
  subsets: ['latin'],
  variable: '--font-${fontName.toLowerCase()}',
  display: 'swap' // Optimize loading
});`;
    });

    return variables.join("\n\n");
  }

  /**
   * Find font config by Next.js font name
   */
  findFontConfigByNextFont(nextFontName) {
    // Search through all categories
    for (const category of Object.values(this.nextFontDatabase)) {
      if (Array.isArray(category)) {
        const found = category.find((f) => f.nextFont === nextFontName);
        if (found) return found;
      } else {
        for (const subcategory of Object.values(category)) {
          const found = subcategory.find((f) => f.nextFont === nextFontName);
          if (found) return found;
        }
      }
    }

    // Default fallback
    return this.getDefaultFontConfig();
  }

  /**
   * Get all unique fonts used in a document
   * @param {Object} documentData - Processed IDML document data
   * @returns {Array} Array of font configurations
   */
  extractDocumentFonts(documentData) {
    const usedFonts = new Set();
    const fontConfigs = [];

    console.log("🔍 Extracting fonts from document data...");

    // Extract fonts from stories
    if (documentData.stories) {
      Object.values(documentData.stories).forEach((story) => {
        if (story.content && story.content.formattedContent) {
          story.content.formattedContent.forEach((segment) => {
            if (segment.formatting && segment.formatting.fontFamily) {
              const key = `${segment.formatting.fontFamily}-${
                segment.formatting.fontStyle || "Regular"
              }`;
              if (!usedFonts.has(key)) {
                usedFonts.add(key);
                const config = this.mapToNextFont(
                  segment.formatting.fontFamily,
                  segment.formatting.fontStyle,
                  segment.formatting.fontSize || 16
                );
                fontConfigs.push(config);
              }
            }
          });
        }
      });
    }

    // Extract fonts from resources
    if (documentData.resources && documentData.resources.fonts) {
      Object.values(documentData.resources.fonts).forEach((fontFamily) => {
        if (fontFamily.fonts) {
          fontFamily.fonts.forEach((font) => {
            const key = `${font.fontFamily}-${font.fontStyleName}`;
            if (!usedFonts.has(key)) {
              usedFonts.add(key);
              const config = this.mapToNextFont(
                font.fontFamily,
                font.fontStyleName,
                16, // Default size for resource fonts
                {
                  postScriptName: font.postScriptName,
                  status: font.status,
                }
              );
              fontConfigs.push(config);
            }
          });
        }
      });
    }

    console.log(
      `📊 Extracted ${fontConfigs.length} unique fonts from document`
    );

    // Log summary
    fontConfigs.forEach((font, index) => {
      console.log(
        `   ${index + 1}. "${font.originalFamily}" → "${font.fontFamily}" (${
          font.mappingReason
        })`
      );
    });

    return fontConfigs;
  }

  /**
   * Clear caches
   */
  clearCache() {
    this.fontCache.clear();
    this.nextFontImports.clear();
  }
}

module.exports = NextFontMapper;

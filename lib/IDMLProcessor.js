// Core modules
const IDMLXMLParser = require("./parsers/XMLParser");
const FileExtractor = require("./extractors/FileExtractor");
const StyleParser = require("./parsers/StyleParser");
const StoryParser = require("./parsers/StoryParser");
const ElementParser = require("./parsers/ElementParser");
const DocumentParser = require("./parsers/DocumentParser");
const ImageProcessor = require("./processors/ImageProcessor");
const DebugAnalyzer = require("./debug/DebugAnalyzer");
const IDMLUtils = require("./utils/IDMLUtils");
const UnitConverter = require("./utils/UnitConverter"); // ADDED: Unit conversion support
const NextFontMapper = require("./utils/NextFontMapper"); // ADDED: Next.js font mapping

const path = require("path");

class IDMLProcessor {
  constructor(options = {}) {
    // Configuration options
    this.config = {
      dpi: options.dpi || 96, // Default web DPI, 300/600 for print
      convertToPixels: options.convertToPixels !== false, // Default true
      preserveOriginalUnits: options.preserveOriginalUnits !== false, // Default true
      enableNextFonts: options.enableNextFonts !== false, // Default true - NEW OPTION
      ...options,
    };

    // ADDED: Initialize unit converter with configured DPI first
    this.unitConverter = new UnitConverter(this.config.dpi);

    // ADDED: Initialize Next.js font mapper
    this.fontMapper = new NextFontMapper();

    // Initialize all modules
    this.xmlParser = new IDMLXMLParser();
    this.fileExtractor = new FileExtractor();
    this.styleParser = new StyleParser(this.unitConverter); // ADDED: Pass UnitConverter
    this.elementParser = new ElementParser(this.unitConverter); // ADDED: Pass UnitConverter
    this.storyParser = new StoryParser(this.styleParser, this.unitConverter); // ADDED: Pass UnitConverter
    this.documentParser = new DocumentParser(
      this.elementParser,
      this.styleParser,
      this.unitConverter
    ); // FIXED: Pass StyleParser and UnitConverter
    this.imageProcessor = new ImageProcessor(this.fileExtractor);
    this.debugAnalyzer = new DebugAnalyzer();

    // Maintain backward compatibility properties
    this.document = null;
    this.resources = {};
    this.spreads = {};
    this.stories = {};
    this.masterSpreads = {};
    this.documentInfo = {};
    this.pageInfo = {};
    this.elements = [];
    this.layers = [];
    this.styles = {
      paragraph: {},
      character: {},
      object: {},
      table: {},
      cell: {},
    };
  }

  async processIDML(filePath) {
    console.log("Processing IDML file:", filePath);

    try {
      // Extract ZIP contents
      const extractedData = await this.fileExtractor.extractIDMLContents(
        filePath
      );
      console.log(
        `Extracted ${Object.keys(extractedData).length} files from IDML`
      );

      // Parse main structure
      await this.parseDocumentStructure(extractedData);

      // Extract detailed information
      await this.extractDetailedInformation();

      // Return the correct structure
      const documentData = {
        document: {
          version: this.document?.["@_DOMVersion"] || "Unknown",
          pageCount: Math.max(1, this.elements.length > 0 ? 1 : 0),
          name: this.document?.["@_Name"] || "Untitled",
          dimensions: this.pageInfo.dimensions,
        },

        // ADDED: Unit conversion information
        unitConversion: {
          enabled: this.config.convertToPixels,
          dpi: this.config.dpi,
          originalUnits: this.pageInfo.dimensions?.units || "Unknown",
          convertedToPixels: !!this.pageInfo.dimensions?.pixelDimensions,
          conversionAppliedTo: [
            "document dimensions",
            "element geometric bounds",
            "element positions",
            "font sizes",
            "spacing measurements",
            "page margins",
            "transform coordinates",
            "stroke weights",
            "text frame insets",
          ].filter(Boolean),
        },

        // === ADD GLOBAL STYLE INFO ===
        paragraphStyles: this.styleParser.getParagraphStyles(),
        characterStyles: this.styleParser.getCharacterStyles(),
        fontDefinitions: this.styleParser.getFontDefinitions(),
        // === END GLOBAL STYLE INFO ===

        pageInfo: {
          dimensions: this.pageInfo.dimensions,
          margins: this.pageInfo.margins,
        },

        elements: this.elements.map((element) => {
          if (!element.pixelPosition) {
            console.warn(
              `⚠️ Element ${element.self} is missing pixelPosition! This may cause rendering issues.`
            );
          }
          return {
            id: element.self,
            type: element.type,
            name: element.name,
            // ENFORCED: Only output pixelPosition (in pixels)
            pixelPosition: element.pixelPosition,
            fill: element.fillColor,
            stroke: element.strokeColor,
            strokeWeight: element.strokeWeight,
            parentStory: element.parentStory,
            linkedImage: element.linkedImage,
            visible: element.visible,
            locked: element.locked,

            // Content frame specific properties
            isContentFrame: element.isContentFrame || false,
            hasPlacedContent: element.hasPlacedContent || false,
            contentType: element.contentType || null,

            // Image positioning within frame
            imagePosition: element.imagePosition || null,
            placedContent: element.placedContent || null,
          };
        }),

        stories: Object.keys(this.stories).reduce((acc, storyId) => {
          const story = this.stories[storyId];
          if (story?.content?.plainText) {
            acc[storyId] = {
              text: story.content.plainText,
              wordCount: story.content.wordCount,
              characterCount: story.content.characterCount,
              textColor: story.content.textColor,
              hasLineBreaks:
                story.content.lineBreakInfo?.hasLineBreaks || false,
              lineBreakCount: story.content.lineBreakInfo?.lineBreakCount || 0,

              // Include resolved styling information
              styling: this.styleParser.getStoryStyleSummary(story),

              // Include formatted content with resolved formatting
              formattedContent: story.content.formattedContent || [],
            };
          }
          return acc;
        }, {}),

        debug22: {
          measurementUnits:
            this.documentInfo.preferences?.viewPreferences
              ?.horizontalMeasurementUnits,
          coordinateOffset: this.calculateCoordinateOffset(),
          contentFramesCount: this.elements.filter((el) => el.isContentFrame)
            .length,
          imagesLinkedCount: this.elements.filter(
            (el) => el.linkedImage && !el.linkedImage.isEmbedded
          ).length,
          embeddedImagesCount: this.elements.filter(
            (el) => el.linkedImage && el.linkedImage.isEmbedded
          ).length,
        },
      };

      // ADDED: Process Next.js fonts if enabled
      if (this.config.enableNextFonts) {
        console.log("🔤 Processing Next.js fonts...");
        documentData.nextFonts = this.processNextFonts(documentData);
        console.log(
          `✅ Font processing completed. Mapped ${documentData.nextFonts.usedFonts.length} unique fonts`
        );
      }

      await this.addComprehensiveTextFormattingDebug();

      console.log(
        "✅ IDML processing completed. Elements:",
        documentData.elements.length
      );

      return documentData;
    } catch (error) {
      console.error("Error processing IDML:", error);
      throw error;
    }
  }

  async parseDocumentStructure(extractedData) {
    console.log("Parsing document structure...");

    // Parse Resources
    console.log("\n📋 === PARSING RESOURCES ===");
    for (const [fileName, content] of Object.entries(extractedData)) {
      if (fileName.startsWith("Resources/")) {
        console.log("🔍 Processing resource:", fileName);
        await this.styleParser.parseResourceFile(
          fileName,
          content,
          this.xmlParser
        );
      }
    }

    // Parse document structure (spreads, master spreads)
    await this.documentParser.parseDocumentStructure(
      extractedData,
      this.xmlParser
    );

    // Parse Stories
    console.log("\n📝 === PARSING STORIES ===");
    let storyCount = 0;
    for (const [fileName, content] of Object.entries(extractedData)) {
      if (fileName.startsWith("Stories/")) {
        console.log("🔍 Found story file:", fileName);
        console.log("   Content length:", content.length);
        console.log("   Content preview:", content.substring(0, 200));
        storyCount++;
        await this.storyParser.parseStoryFile(
          fileName,
          content,
          this.xmlParser
        );
      }
    }
    console.log(`📝 Total stories processed: ${storyCount}`);

    // Sync data from modules to maintain backward compatibility
    this.syncModuleData();
  }

  syncModuleData() {
    // Sync document data
    this.document = this.documentParser.getDocument();
    this.spreads = this.documentParser.getSpreads();
    this.masterSpreads = this.documentParser.getMasterSpreads();
    this.documentInfo = this.documentParser.getDocumentInfo();
    this.layers = this.documentParser.getLayers();

    // Sync style data
    this.styles = this.styleParser.getStyles();
    this.resources = this.styleParser.getResources();

    // Sync story data
    this.stories = this.storyParser.getStories();

    // Sync element data
    this.elements = this.elementParser.getElements();
  }

  async extractDetailedInformation() {
    console.log("Extracting detailed information with enhanced processing...");

    await this.documentParser.extractDetailedInformation();
    this.pageInfo = this.documentParser.getPageInfo();

    // ADDED: Set document units on StoryParser after pageInfo is available
    if (this.pageInfo?.dimensions?.units) {
      const documentUnits = this.pageInfo.dimensions.units;
      console.log(
        "📐 IDMLProcessor: Setting document units to",
        documentUnits,
        "on StoryParser"
      );

      if (this.storyParser.setDocumentUnits) {
        this.storyParser.setDocumentUnits(documentUnits);
      }
    }

    console.log("✅ Enhanced detailed information extracted");
  }

  calculateCoordinateOffset() {
    return this.documentParser.calculateCoordinateOffset();
  }

  async addComprehensiveTextFormattingDebug() {
    return await this.debugAnalyzer.addComprehensiveTextFormattingDebug(this);
  }

  // Package processing methods
  async processIDMLPackage(
    idmlFilePath,
    packageStructure,
    extractedImages = []
  ) {
    console.log("Processing IDML package:", idmlFilePath);

    try {
      // Process the IDML file first
      const documentData = await this.processIDML(idmlFilePath);

      // Process linked images and update elements
      await this.imageProcessor.processLinkedResources(
        documentData,
        packageStructure,
        extractedImages
      );

      // Add package info
      documentData.packageInfo = {
        hasLinks: packageStructure.resourceMap?.size > 1,
        hasFonts: false,
        linksCount: Array.from(
          packageStructure.resourceMap?.keys() || []
        ).filter((name) => IDMLUtils.isImageFile(name)).length,
        fontsCount: 0,
        extractedImagesCount: extractedImages.length,
      };

      return documentData;
    } catch (error) {
      console.error("Error processing IDML package:", error);
      throw error;
    }
  }

  // Image processing methods
  async extractAndSaveEmbeddedImages(idmlPath, uploadDir) {
    return await this.fileExtractor.extractAndSaveEmbeddedImages(
      idmlPath,
      uploadDir
    );
  }

  async extractEmbeddedImageFromSpread(idmlPath, uploadDir) {
    return await this.imageProcessor.extractEmbeddedImageFromSpread(
      idmlPath,
      uploadDir,
      this.xmlParser
    );
  }

  // Debug methods
  async debugIDMLContents(idmlPath) {
    return await this.fileExtractor.debugIDMLContents(idmlPath);
  }

  async debugIDMLContentsDetailed(idmlPath) {
    return await this.fileExtractor.debugIDMLContentsDetailed(idmlPath);
  }

  async analyzeSpreadForImageReferences(idmlPath) {
    return await this.imageProcessor.analyzeSpreadForImageReferences(
      idmlPath,
      this.xmlParser
    );
  }

  // Utility methods for backward compatibility
  getPageContent(pageId) {
    return this.documentParser.getPageContent(pageId);
  }

  // Getter methods for accessing module data
  getStyles() {
    return this.styleParser.getStyles();
  }

  getResources() {
    return this.styleParser.getResources();
  }

  getStories() {
    return this.storyParser.getStories();
  }

  getElements() {
    return this.elementParser.getElements();
  }

  getSpreads() {
    return this.documentParser.getSpreads();
  }

  getMasterSpreads() {
    return this.documentParser.getMasterSpreads();
  }

  getDocumentInfo() {
    return this.documentParser.getDocumentInfo();
  }

  getPageInfo() {
    return this.documentParser.getPageInfo();
  }

  getLayers() {
    return this.documentParser.getLayers();
  }

  // Module access for advanced usage
  getXMLParser() {
    return this.xmlParser;
  }

  getFileExtractor() {
    return this.fileExtractor;
  }

  getStyleParser() {
    return this.styleParser;
  }

  getStoryParser() {
    return this.storyParser;
  }

  getElementParser() {
    return this.elementParser;
  }

  getDocumentParser() {
    return this.documentParser;
  }

  getImageProcessor() {
    return this.imageProcessor;
  }

  getDebugAnalyzer() {
    return this.debugAnalyzer;
  }

  /**
   * Process Next.js fonts for the document
   * @param {Object} documentData - Processed IDML document data
   * @returns {Object} Next.js font configuration
   */
  processNextFonts(documentData) {
    console.log("🔤 Starting Next.js font processing...");

    // Clear previous cache
    this.fontMapper.clearCache();

    // Extract and map all unique fonts from the document
    const mappedFonts = this.fontMapper.extractDocumentFonts(documentData);

    // Process stories to add Next.js font info to formatted content
    if (documentData.stories) {
      Object.values(documentData.stories).forEach((story) => {
        if (story.formattedContent) {
          story.formattedContent.forEach((segment) => {
            if (segment.formatting && segment.formatting.fontFamily) {
              const nextFontConfig = this.fontMapper.mapToNextFont(
                segment.formatting.fontFamily,
                segment.formatting.fontStyle,
                segment.formatting.fontSize
              );

              // Add Next.js font information to the segment
              segment.formatting.nextFont = nextFontConfig;
            }
          });
        }
      });
    }

    // Generate Next.js code snippets
    const fontImports = this.fontMapper.generateNextFontImports();
    const fontVariables = this.fontMapper.generateFontVariables();
    const usedFontNames = Array.from(this.fontMapper.nextFontImports);

    // Create CSS variables for all fonts
    const cssVariables = mappedFonts
      .map((font) => `${font.nextFontVariable}: ${font.fontFamilyFallback};`)
      .join("\n  ");

    const nextFontConfig = {
      // Mapped fonts
      usedFonts: mappedFonts,
      totalFonts: mappedFonts.length,

      // Next.js code generation
      imports: fontImports,
      variables: fontVariables,
      cssVariables: cssVariables,
      usedFontNames: usedFontNames,

      // Usage examples
      examples: {
        className:
          mappedFonts.length > 0
            ? `\${${mappedFonts[0].nextFont.toLowerCase()}.className}`
            : "",
        variable: mappedFonts.length > 0 ? mappedFonts[0].nextFontVariable : "",
        fontFamily: mappedFonts.length > 0 ? mappedFonts[0].fontFamily : "",
      },

      // Implementation guide
      implementation: {
        step1: "Add the imports to your page or component",
        step2: "Initialize the fonts with the provided variables",
        step3: "Use the className or CSS variables in your components",
        step4: "All fonts are loaded from Next.js, not user's machine",
      },
    };

    console.log(`🎯 Next.js font processing summary:`);
    console.log(`   📊 Total fonts mapped: ${mappedFonts.length}`);
    console.log(
      `   📦 Google Fonts: ${mappedFonts.filter((f) => f.isGoogleFont).length}`
    );
    console.log(
      `   🖥️  System Fonts: ${mappedFonts.filter((f) => f.isSystemFont).length}`
    );
    console.log(`   🔗 Unique Next.js fonts: ${usedFontNames.length}`);

    return nextFontConfig;
  }
}

module.exports = IDMLProcessor;

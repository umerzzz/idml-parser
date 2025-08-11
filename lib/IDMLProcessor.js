// Core modules
import IDMLXMLParser from "./parsers/XMLParser.js";
import FileExtractor from "./extractors/FileExtractor.js";
import StyleParser from "./parsers/StyleParser.js";
import StoryParser from "./parsers/StoryParser.js";
import ElementParser from "./parsers/ElementParser.js";
import DocumentParser from "./parsers/DocumentParser.js";
import ImageProcessor from "./processors/ImageProcessor.js";

import IDMLUtils from "./utils/IDMLUtils.js";
import UnitConverter from "./utils/UnitConverter.js";
import NextFontMapper from "./utils/NextFontMapper.js";
import path from "path";

class IDMLProcessor {
  constructor(options = {}) {
    // Configuration options
    this.config = {
      dpi: options.dpi || 96, // Default web DPI, 300/600 for print
      convertToPixels: options.convertToPixels !== false, // Default true
      preserveOriginalUnits: options.preserveOriginalUnits !== false, // Default true
      enableNextFonts: options.enableNextFonts !== false, // Default true - NEW OPTION
      debug: options.debug !== false, // NEW
      fontMapping: options.fontMapping !== false, // NEW
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
    const uploadId = path.basename(filePath, ".idml"); // NEW

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

      // Associate elements with pages - NEW
      await this.associateElementsWithPages();

      // ENHANCED: Validate unit conversions
      // Note: We'll validate after documentData is built
      console.log(
        "📐 Unit conversion validation will be performed after data construction"
      );

      // ENHANCED: Comprehensive page validation and debugging
      const extractedPages = this.documentParser.getPages();
      console.log("🔍 Validating page extraction results...");
      console.log("🔍 DEBUG: extractedPages variable:");
      console.log("  - Type:", typeof extractedPages);
      console.log("  - Is array:", Array.isArray(extractedPages));
      console.log("  - Length:", extractedPages?.length);
      console.log("  - Value:", extractedPages);

      if (!extractedPages || extractedPages.length === 0) {
        console.error("❌ CRITICAL: No pages were extracted from document");
        throw new Error(
          "Document processing failed: No pages could be extracted"
        );
      }

      console.log(
        `✅ Page extraction successful: ${extractedPages.length} pages found`
      );

      // Log detailed page information
      extractedPages.forEach((page, index) => {
        console.log(`📄 Page ${index + 1}:`, {
          id: page.self,
          name: page.name || "Unnamed",
          dimensions: `${page.geometricBounds?.width || 0}x${
            page.geometricBounds?.height || 0
          }`,
          spreadParent: page.spreadParent || "None",
          backgroundColor: page.backgroundColor || "None",
          isDefault: page.isDefaultPage || false,
        });
      });

      // DEBUG: Log extracted pages before creating document data
      console.log(
        "🔍 DEBUG: Extracted pages before document data construction:"
      );
      console.log("Extracted pages length:", extractedPages?.length);
      console.log("Extracted pages:", extractedPages);

      // Build page-element mappings first
      const pageElementMappings = this.buildPageElementMappings(extractedPages);

      // Return the correct structure
      const documentData = {
        document: {
          version: this.document?.["@_DOMVersion"] || "Unknown",
          pageCount: extractedPages.length, // FIXED: Use validated page count
          name: this.document?.["@_Name"] || "Untitled",
          dimensions: this.pageInfo.dimensions,
          backgroundColor: this.document?.["@_BackgroundColor"] || null,
          // ENHANCED: Add document processing metadata
          processingStatus: "success",
          hasDefaultPages: extractedPages.some((p) => p.isDefaultPage),
          extractionMethod: extractedPages[0]?.detectionSource || "standard",
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
        // === ADD COLOR INFORMATION ===
        colorDefinitions: this.styleParser.getResources().colors || {},
        gradientDefinitions: this.styleParser.getResources().gradients || {},
        // === END GLOBAL STYLE INFO ===

        pageInfo: {
          dimensions: this.pageInfo.dimensions,
          margins: this.pageInfo.margins,
          backgroundColor: this.document?.["@_BackgroundColor"] || null, // NEW: Add background color to pageInfo
        },

        // ENHANCED: Add validated pages information
        pages: extractedPages, // Use the validated pages array

        // ENHANCED: Add page metadata for debugging
        pageMetadata: {
          totalPages: extractedPages.length,
          hasDefaultPages: extractedPages.some((p) => p.isDefaultPage),
          extractionMethods: [
            ...new Set(
              extractedPages.map((p) => p.detectionSource || "standard")
            ),
          ],
          pageDimensions: extractedPages.map((p) => ({
            pageId: p.self,
            width: p.geometricBounds?.width || 0,
            height: p.geometricBounds?.height || 0,
          })),
        },

        // ENHANCED: Group elements by page with validation and create mappings
        elementsByPage: pageElementMappings.elementsByPage,
        pageElementIds: pageElementMappings.pageElementIds,
        elementMap: pageElementMappings.elementMap,

        // Include spreads with background colors - ENHANCED
        spreads: Object.entries(this.spreads).reduce((acc, [key, spread]) => {
          acc[key] = {
            self: spread.self,
            backgroundColor: spread.backgroundColor, // NEW
            pages:
              spread.pages?.map((page) => ({
                self: page.self,
                backgroundColor: page.backgroundColor, // NEW
              })) || [],
          };
          return acc;
        }, {}),

        // Include master spreads with background colors - ENHANCED
        masterSpreads: Object.entries(this.masterSpreads).reduce(
          (acc, [key, master]) => {
            acc[key] = {
              self: master.self,
              backgroundColor: master.backgroundColor, // NEW
            };
            return acc;
          },
          {}
        ),

        // Map elements with proper formatting for frontend
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
            position: element.position, // NEW
            fill: element.fill || element.fillColor, // ENHANCED: Ensure fill is available
            stroke: element.stroke || element.strokeColor, // ENHANCED
            strokeWeight: element.strokeWeight,
            parentStory: element.parentStory,
            linkedImage: element.linkedImage,
            visible: element.visible,
            locked: element.locked,
            pageId: element.pageId, // NEW

            // Content frame specific properties
            isContentFrame: element.isContentFrame || false,
            hasPlacedContent: element.hasPlacedContent || false,
            contentType: element.contentType || null,

            // Image positioning within frame
            imagePosition: element.imagePosition || null,
            placedContent: element.placedContent || null,

            // Text frame properties - NEW
            textFramePreferences: element.textFramePreferences || null,

            // Additional properties for background colors and images - NEW
            geometricBounds: element.geometricBounds,
            itemTransform: element.itemTransform,
            fillColor: element.fillColor || element.fill, // NEW: Ensure fillColor is available
            strokeColor: element.strokeColor || element.stroke, // NEW
            fillTint: element.fillTint,
            strokeTint: element.strokeTint,
            overprintFill: element.overprintFill,
            overprintStroke: element.overprintStroke,
            topLeftCornerOption: element.topLeftCornerOption,
            topRightCornerOption: element.topRightCornerOption,
            bottomLeftCornerOption: element.bottomLeftCornerOption,
            bottomRightCornerOption: element.bottomRightCornerOption,
            topLeftCornerRadius: element.topLeftCornerRadius,
            topRightCornerRadius: element.topRightCornerRadius,
            bottomLeftCornerRadius: element.bottomLeftCornerRadius,
            bottomRightCornerRadius: element.bottomRightCornerRadius,

            // Embedded image properties - NEW
            embedInfo: element.embedInfo,
            embeddedImageFile: element.embeddedImageFile,

            // Additional text properties - NEW
            textContent: element.textContent,
            appliedParagraphStyle: element.appliedParagraphStyle,
            appliedCharacterStyle: element.appliedCharacterStyle,

            // Group properties - NEW
            groupItems: element.groupItems,

            // Any other properties that might be needed - NEW
            ...element,
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

      // DEBUG: Check if pages field is included in document data
      console.log(
        "🔍 DEBUG: Checking pages field in constructed document data:"
      );
      console.log("Document data keys:", Object.keys(documentData));
      console.log("Pages field exists:", !!documentData.pages);
      console.log("Pages field type:", typeof documentData.pages);
      console.log("Pages field length:", documentData.pages?.length);
      if (documentData.pages && documentData.pages.length > 0) {
        console.log("First page in document data:", documentData.pages[0]);
      }

      // ADDED: Process Next.js fonts if enabled
      if (this.config.enableNextFonts) {
        console.log("🔤 Processing Next.js fonts...");
        // Temporarily disable font processing to test if it's causing the issue
        // documentData.nextFonts = this.processNextFonts(documentData);
        documentData.nextFonts = { disabled: true };
        console.log("Font processing temporarily disabled for debugging");
      }

      // DEBUG: Check if pages field still exists after font processing
      console.log("🔍 DEBUG: Checking pages field after font processing:");
      console.log("Pages field exists:", !!documentData.pages);
      console.log("Pages field type:", typeof documentData.pages);
      console.log("Pages field length:", documentData.pages?.length);

      // DEBUG: Check if pages field still exists after debug processing
      console.log("🔍 DEBUG: Checking pages field after debug processing:");
      console.log("Pages field exists:", !!documentData.pages);
      console.log("Pages field type:", typeof documentData.pages);
      console.log("Pages field length:", documentData.pages?.length);

      // ENHANCED: Validate unit conversions after data is built
      const unitValidation = IDMLUtils.validateUnitConversions(
        documentData,
        this.unitConverter
      );
      console.log("📐 Unit conversion validation results:", unitValidation);

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

  // Package processing methods
  async processIDMLPackage(
    idmlFilePath,
    packageStructure,
    extractedImages = []
  ) {
    console.log("Processing IDML package:", idmlFilePath);
    console.log(
      `📊 Package has ${extractedImages.length} extracted embedded images`
    );

    try {
      // Process the IDML file first
      const documentData = await this.processIDML(idmlFilePath);

      // Process both embedded and linked images
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

      console.log(
        `✅ Package processing complete. Elements with images: ${
          documentData.elements?.filter((el) => el.linkedImage)?.length || 0
        }`
      );

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

  /**
   * Get comprehensive document data for validation and debugging
   * @returns {Object} Complete document data structure
   */
  getComprehensiveData() {
    return {
      document: this.document,
      pageInfo: this.pageInfo,
      elements: this.elements,
      stories: this.stories,
      styles: this.styles,
      resources: this.resources,
      spreads: this.spreads,
      masterSpreads: this.masterSpreads,
      layers: this.layers,
      documentInfo: this.documentInfo,
      config: this.config,
    };
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

  // NEW METHOD: Add a new method to organize elements by page
  organizeElementsByPage() {
    const pages = this.documentParser.getPages() || [];
    const elementsByPage = {};

    // Initialize an array for each page
    pages.forEach((page) => {
      elementsByPage[page.self] = [];
    });

    // If no pages found, use a default page
    if (pages.length === 0) {
      elementsByPage["default"] = this.elements;
      return elementsByPage;
    }

    // Assign elements to their respective pages
    this.elements.forEach((element) => {
      // Check if the element has a page association
      if (element.pageId) {
        if (elementsByPage[element.pageId]) {
          elementsByPage[element.pageId].push(element);
        } else {
          // If page doesn't exist in our map, add it to the first page
          const firstPageId = pages[0]?.self || "default";
          elementsByPage[firstPageId] = elementsByPage[firstPageId] || [];
          elementsByPage[firstPageId].push(element);
        }
      } else {
        // For elements without page association, add to the first page
        const firstPageId = pages[0]?.self || "default";
        elementsByPage[firstPageId] = elementsByPage[firstPageId] || [];
        elementsByPage[firstPageId].push(element);
      }
    });

    return elementsByPage;
  }

  // ENHANCED: Organize elements by page with better validation and fallbacks
  organizeElementsByPageEnhanced(validatedPages) {
    console.log("🔧 Enhanced element organization by pages...");
    const elementsByPage = {};

    // Initialize arrays for all validated pages
    validatedPages.forEach((page) => {
      elementsByPage[page.self] = [];
    });

    console.log(
      `📊 Organizing ${this.elements.length} elements across ${validatedPages.length} pages`
    );

    // If no pages, create emergency organization
    if (validatedPages.length === 0) {
      console.warn(
        "⚠️ No pages provided for element organization, using emergency fallback"
      );
      elementsByPage["emergency"] = this.elements;
      return elementsByPage;
    }

    // Enhanced element assignment with better logging
    let assignedElements = 0;
    let fallbackAssignments = 0;
    let unassignedCount = 0;

    // First pass: Assign elements with explicit pageId
    this.elements.forEach((element, index) => {
      if (element.pageId && elementsByPage[element.pageId]) {
        elementsByPage[element.pageId].push(element);
        assignedElements++;
        console.log(
          `✅ Element ${element.self} assigned to page ${element.pageId} (pageId already set)`
        );
      }
    });

    // Second pass: Handle elements without pageId using spatial analysis
    const unassignedElements = this.elements.filter(
      (element) => !element.pageId || !elementsByPage[element.pageId]
    );

    if (unassignedElements.length > 0) {
      console.log(
        `🔍 Analyzing ${unassignedElements.length} unassigned elements for spatial assignment...`
      );

      unassignedElements.forEach((element, index) => {
        // Use spatial analysis to determine which page the element belongs to
        const targetPage = this.findPageByElementPosition(
          element,
          validatedPages
        );

        if (targetPage && elementsByPage[targetPage.self]) {
          // CRITICAL: Set the pageId on the element itself
          element.pageId = targetPage.self;

          elementsByPage[targetPage.self].push(element);
          fallbackAssignments++;
          console.log(
            `📍 Element ${element.self} spatially assigned to page ${targetPage.self} (pageId set)`
          );
        } else {
          unassignedCount++;
          console.warn(
            `⚠️ Could not assign element ${element.self} to any page`
          );
        }
      });
    }

    // Final pass: Ensure all elements have a pageId set
    let finalUnassigned = 0;
    this.elements.forEach((element) => {
      if (!element.pageId) {
        // Fallback to first page
        element.pageId = validatedPages[0]?.self || "default";
        if (!elementsByPage[element.pageId]) {
          elementsByPage[element.pageId] = [];
        }
        elementsByPage[element.pageId].push(element);
        finalUnassigned++;
        console.log(
          `🔄 Element ${element.self} fallback assigned to page ${element.pageId}`
        );
      }
    });

    // Log organization results
    console.log(`✅ Element organization completed:`);
    console.log(`   📊 Direct assignments: ${assignedElements}`);
    console.log(`   📊 Spatial assignments: ${fallbackAssignments}`);
    console.log(`   📊 Final fallback assignments: ${finalUnassigned}`);
    console.log(`   📊 Total unassigned elements: ${unassignedCount}`);

    validatedPages.forEach((page, index) => {
      const pageElements = elementsByPage[page.self] || [];
      console.log(
        `   📄 Page ${index + 1} (${page.self}): ${
          pageElements.length
        } elements`
      );

      // Debug: List all elements on each page
      pageElements.forEach((element, elemIndex) => {
        console.log(
          `      ${elemIndex + 1}. ${element.type} (${
            element.self
          }) - pageId: ${element.pageId || "none"}`
        );
      });
    });

    return elementsByPage;
  }

  // NEW: Helper method to build page-element mappings
  buildPageElementMappings(validatedPages) {
    console.log("🔧 Building page-element mappings...");

    // Call organizeElementsByPageEnhanced once
    const elementsByPage = this.organizeElementsByPageEnhanced(validatedPages);

    // Create pageElementIds mapping
    const pageElementIds = {};
    for (const [pageId, elements] of Object.entries(elementsByPage)) {
      pageElementIds[pageId] = elements.map((el) => el.self || el.id);
    }
    console.log("🔍 pageElementIds mapping:", pageElementIds);

    // Create elementMap
    const elementMap = {};
    for (const el of this.elements) {
      elementMap[el.self || el.id] = {
        id: el.self || el.id,
        ...el,
      };
    }
    console.log("🔍 elementMap keys:", Object.keys(elementMap));

    return {
      elementsByPage,
      pageElementIds,
      elementMap,
    };
  }

  // NEW: Helper method to find the correct page for an element based on its position
  findPageByElementPosition(element, validatedPages) {
    if (!element.pixelPosition || validatedPages.length === 0) {
      return validatedPages[0]; // Fallback to first page
    }

    const elementCenter = {
      x: element.pixelPosition.x + element.pixelPosition.width / 2,
      y: element.pixelPosition.y + element.pixelPosition.height / 2,
    };

    console.log(`🔍 Spatial analysis for element ${element.self}:`);
    console.log(
      `   📍 Element center: (${elementCenter.x}, ${elementCenter.y})`
    );
    console.log(
      `   📍 Element bounds: (${element.pixelPosition.x}, ${element.pixelPosition.y}) ${element.pixelPosition.width}x${element.pixelPosition.height}`
    );
    console.log(
      `   📍 Coordinate offset: ${JSON.stringify(
        this.calculateCoordinateOffset()
      )}`
    );

    // Find the page that contains this element's center point
    for (const page of validatedPages) {
      if (page.geometricBounds) {
        const pageBounds = page.geometricBounds;

        // Convert page bounds to the same coordinate system as elements
        // Page bounds are in original IDML coordinates, need to apply the same transformation
        const coordinateOffset = this.calculateCoordinateOffset();

        // Apply the same coordinate offset that was used for elements
        // Note: pageBounds uses left/top, but we need x/y for consistency
        const adjustedPageBounds = {
          x: (pageBounds.left || 0) + coordinateOffset.x,
          y: (pageBounds.top || 0) + coordinateOffset.y,
          width: pageBounds.width || pageBounds.right - pageBounds.left,
          height: pageBounds.height || pageBounds.bottom - pageBounds.top,
        };

        console.log(`   📄 Checking page ${page.self}:`);
        console.log(`      Original bounds: ${JSON.stringify(pageBounds)}`);
        console.log(
          `      Adjusted bounds: (${adjustedPageBounds.x}, ${adjustedPageBounds.y}) ${adjustedPageBounds.width}x${adjustedPageBounds.height}`
        );

        // Check if element center is within adjusted page bounds
        if (
          elementCenter.x >= adjustedPageBounds.x &&
          elementCenter.x <= adjustedPageBounds.x + adjustedPageBounds.width &&
          elementCenter.y >= adjustedPageBounds.y &&
          elementCenter.y <= adjustedPageBounds.y + adjustedPageBounds.height
        ) {
          console.log(
            `   ✅ Element ${element.self} belongs to page ${page.self}`
          );
          return page;
        } else {
          console.log(`   ❌ Element ${element.self} not in page ${page.self}`);
        }
      }
    }

    console.log(
      `   ⚠️ No page found for element ${element.self}, using fallback`
    );
    // If no page found, return the first page as fallback
    return validatedPages[0];
  }

  // NEW METHOD: Add a new method to associate elements with pages
  async associateElementsWithPages() {
    console.log("Associating elements with pages...");

    const pages = this.documentParser.getPages() || [];
    if (pages.length === 0) {
      console.log("No pages found, skipping element association");

      return;
    }

    console.log(`Found ${pages.length} pages to associate elements with`);

    // Create a map of spread IDs to page IDs for quick lookup
    const spreadToPageMap = {};
    pages.forEach((page) => {
      if (page.spreadParent) {
        if (!spreadToPageMap[page.spreadParent]) {
          spreadToPageMap[page.spreadParent] = [];
        }
        spreadToPageMap[page.spreadParent].push(page.self);
      }
    });

    // Count elements per page for debugging
    const elementsPerPage = {};
    pages.forEach((page) => {
      elementsPerPage[page.self] = 0;
    });

    // For elements without a direct page association, try to associate them based on their spread
    this.elements.forEach((element) => {
      let assigned = false;

      if (!element.pageId && element.spreadId) {
        const pagesInSpread = spreadToPageMap[element.spreadId];
        if (pagesInSpread && pagesInSpread.length > 0) {
          // If there's only one page in the spread, assign the element to that page
          if (pagesInSpread.length === 1) {
            element.pageId = pagesInSpread[0];
            assigned = true;
            elementsPerPage[pagesInSpread[0]]++;
          }
          // If there are multiple pages, try to determine which page the element belongs to
          // based on its position (this is a simplified approach)
          else {
            // For now, just assign to the first page as a fallback
            // A more sophisticated approach would check element coordinates
            element.pageId = pagesInSpread[0];
            assigned = true;
            elementsPerPage[pagesInSpread[0]]++;
          }
        }
      }

      // If still no page association, assign to the first page as a fallback
      if (!element.pageId && pages.length > 0) {
        element.pageId = pages[0].self;
        assigned = true;
        elementsPerPage[pages[0].self]++;
      }

      if (!assigned) {
        console.warn("Element not assigned to any page", {
          elementId: element.self,
          elementType: element.type,
        });
      }
    });

    console.log(`✅ Associated ${this.elements.length} elements with pages`);
    console.log("Elements per page:", elementsPerPage);
  }

  // NEW: Comprehensive element-to-page mapping system
  createComprehensiveElementPageMapping() {
    console.log("🔧 Creating comprehensive element-to-page mapping...");

    const pages = this.documentParser.getPages() || [];
    const elements = this.elements || [];

    if (pages.length === 0) {
      console.warn("⚠️ No pages found for element mapping");
      return { elementToPageMap: {}, pageToElementsMap: {} };
    }

    if (elements.length === 0) {
      console.warn("⚠️ No elements found for mapping");
      return { elementToPageMap: {}, pageToElementsMap: {} };
    }

    console.log(
      `📊 Mapping ${elements.length} elements to ${pages.length} pages`
    );

    // Initialize mapping structures
    const elementToPageMap = {};
    const pageToElementsMap = {};
    pages.forEach((page) => {
      pageToElementsMap[page.self] = [];
    });

    // Build spread-to-pages mapping
    const spreadToPagesMap = {};
    pages.forEach((page) => {
      if (page.spreadParent) {
        if (!spreadToPagesMap[page.spreadParent]) {
          spreadToPagesMap[page.spreadParent] = [];
        }
        spreadToPagesMap[page.spreadParent].push(page);
      }
    });

    // Build parent-child relationship graph
    const parentChildMap = {};
    const childParentMap = {};

    elements.forEach((element) => {
      if (element.parentId) {
        if (!parentChildMap[element.parentId]) {
          parentChildMap[element.parentId] = [];
        }
        parentChildMap[element.parentId].push(element.self);
        childParentMap[element.self] = element.parentId;
      }
    });

    // Strategy 1: Direct pageId assignment
    console.log("📋 Strategy 1: Direct pageId assignment");
    let directAssignments = 0;
    elements.forEach((element) => {
      if (element.pageId && pageToElementsMap[element.pageId]) {
        elementToPageMap[element.self] = element.pageId;
        pageToElementsMap[element.pageId].push(element.self);
        directAssignments++;
        console.log(
          `✅ Element ${element.self} directly assigned to page ${element.pageId}`
        );
      }
    });
    console.log(`📊 Direct assignments: ${directAssignments}`);

    // Strategy 2: Parent page relationships
    console.log("📋 Strategy 2: Parent page relationships");
    let parentAssignments = 0;
    elements.forEach((element) => {
      if (
        !elementToPageMap[element.self] &&
        element.parentType === "Page" &&
        element.parentId
      ) {
        if (pageToElementsMap[element.parentId]) {
          elementToPageMap[element.self] = element.parentId;
          pageToElementsMap[element.parentId].push(element.self);
          parentAssignments++;
          console.log(
            `✅ Element ${element.self} assigned via parent page ${element.parentId}`
          );
        }
      }
    });
    console.log(`📊 Parent assignments: ${parentAssignments}`);

    // Strategy 3: Spread-based assignment
    console.log("📋 Strategy 3: Spread-based assignment");
    let spreadAssignments = 0;
    elements.forEach((element) => {
      if (!elementToPageMap[element.self] && element.spreadId) {
        const pagesInSpread = spreadToPagesMap[element.spreadId];
        if (pagesInSpread && pagesInSpread.length > 0) {
          // If only one page in spread, assign to that page
          if (pagesInSpread.length === 1) {
            const targetPage = pagesInSpread[0].self;
            elementToPageMap[element.self] = targetPage;
            pageToElementsMap[targetPage].push(element.self);
            spreadAssignments++;
            console.log(
              `✅ Element ${element.self} assigned via single-page spread to ${targetPage}`
            );
          } else {
            // Multiple pages in spread - use spatial analysis
            const targetPage = this.findPageByElementPosition(
              element,
              pagesInSpread
            );
            if (targetPage) {
              elementToPageMap[element.self] = targetPage.self;
              pageToElementsMap[targetPage.self].push(element.self);
              spreadAssignments++;
              console.log(
                `✅ Element ${element.self} assigned via multi-page spread to ${targetPage.self}`
              );
            }
          }
        }
      }
    });
    console.log(`📊 Spread assignments: ${spreadAssignments}`);

    // Strategy 4: Spatial analysis for remaining elements
    console.log("📋 Strategy 4: Spatial analysis");
    let spatialAssignments = 0;
    const unassignedElements = elements.filter(
      (element) => !elementToPageMap[element.self]
    );

    unassignedElements.forEach((element) => {
      const targetPage = this.findPageByElementPosition(element, pages);
      if (targetPage) {
        elementToPageMap[element.self] = targetPage.self;
        pageToElementsMap[targetPage.self].push(element.self);
        spatialAssignments++;
        console.log(
          `✅ Element ${element.self} assigned via spatial analysis to ${targetPage.self}`
        );
      }
    });
    console.log(`📊 Spatial assignments: ${spatialAssignments}`);

    // Strategy 5: Fallback assignment
    console.log("📋 Strategy 5: Fallback assignment");
    let fallbackAssignments = 0;
    const stillUnassigned = elements.filter(
      (element) => !elementToPageMap[element.self]
    );

    if (stillUnassigned.length > 0 && pages.length > 0) {
      const fallbackPage = pages[0].self;
      stillUnassigned.forEach((element) => {
        elementToPageMap[element.self] = fallbackPage;
        pageToElementsMap[fallbackPage].push(element.self);
        fallbackAssignments++;
        console.log(
          `⚠️ Element ${element.self} fallback assigned to ${fallbackPage}`
        );
      });
    }
    console.log(`📊 Fallback assignments: ${fallbackAssignments}`);

    // Update elements with their final pageId
    elements.forEach((element) => {
      if (elementToPageMap[element.self]) {
        element.pageId = elementToPageMap[element.self];
      }
    });

    // Log final mapping results
    console.log("📊 Final element-to-page mapping results:");
    Object.entries(pageToElementsMap).forEach(([pageId, elementIds]) => {
      console.log(`   📄 Page ${pageId}: ${elementIds.length} elements`);
      elementIds.forEach((elementId) => {
        const element = elements.find((e) => e.self === elementId);
        console.log(`      - ${elementId} (${element?.type || "unknown"})`);
      });
    });

    const totalAssigned = Object.keys(elementToPageMap).length;
    console.log(
      `✅ Mapping complete: ${totalAssigned}/${elements.length} elements assigned to pages`
    );

    return {
      elementToPageMap,
      pageToElementsMap,
      totalElements: elements.length,
      totalAssigned,
      unassignedCount: elements.length - totalAssigned,
    };
  }

  // NEW: Log detailed mapping results for debugging
  logMappingResults(mappingResult) {
    console.log("📊 DETAILED MAPPING RESULTS:");
    console.log(`   Total Elements: ${mappingResult.totalElements}`);
    console.log(`   Total Assigned: ${mappingResult.totalAssigned}`);
    console.log(`   Unassigned: ${mappingResult.unassignedCount}`);

    console.log("📄 ELEMENT-TO-PAGE MAPPING:");
    Object.entries(mappingResult.elementToPageMap).forEach(
      ([elementId, pageId]) => {
        const element = this.elements.find((e) => e.self === elementId);
        console.log(
          `   ${elementId} (${element?.type || "unknown"}) → ${pageId}`
        );
      }
    );

    console.log("📄 PAGE-TO-ELEMENTS MAPPING:");
    Object.entries(mappingResult.pageToElementsMap).forEach(
      ([pageId, elementIds]) => {
        console.log(`   Page ${pageId}: ${elementIds.length} elements`);
        elementIds.forEach((elementId) => {
          const element = this.elements.find((e) => e.self === elementId);
          console.log(`     - ${elementId} (${element?.type || "unknown"})`);
        });
      }
    );
  }
}

// ES6 exports
export default IDMLProcessor;

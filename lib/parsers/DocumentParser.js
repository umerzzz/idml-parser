const path = require("path");
const IDMLUtils = require("../utils/IDMLUtils");

class DocumentParser {
  constructor(elementParser, styleParser = null, unitConverter = null) {
    this.elementParser = elementParser;
    this.styleParser = styleParser; // ADDED: Reference to StyleParser for accessing ViewPreferences
    this.unitConverter = unitConverter; // ADDED: Reference to UnitConverter for unit conversions
    this.documentInfo = {};
    this.spreads = {};
    this.masterSpreads = {};
    this.layers = [];
    this.pages = []; // NEW: Initialize pages array
  }

  async parseDocumentStructure(extractedData, xmlParser) {
    console.log("Parsing document structure...");
    console.log(
      "🔍 Total files to process:",
      Object.keys(extractedData).length
    );

    // Parse designmap.xml first (main document structure) - ENHANCED
    if (extractedData["designmap.xml"]) {
      console.log("Parsing designmap.xml...");
      try {
        const designMapData = xmlParser.parse(extractedData["designmap.xml"]);
        this.document = designMapData.Document || designMapData;
        await this.extractDocumentInfo(this.document);
        console.log("✅ DesignMap parsed successfully");
      } catch (error) {
        console.error("Error parsing designmap.xml:", error);
      }
    }

    // Parse Spreads - ENHANCED with better logging
    console.log("\n📄 === PARSING SPREADS ===");
    let spreadCount = 0;
    for (const [fileName, content] of Object.entries(extractedData)) {
      if (fileName.startsWith("Spreads/")) {
        console.log("🔍 Processing spread:", fileName);
        await this.parseSpreadFile(fileName, content, xmlParser);
        spreadCount++;
      }
    }
    console.log(`📄 Total spreads processed: ${spreadCount}`);

    // Parse Master Spreads - ENHANCED with better logging
    console.log("\n🎨 === PARSING MASTER SPREADS ===");
    let masterSpreadCount = 0;
    for (const [fileName, content] of Object.entries(extractedData)) {
      if (fileName.startsWith("MasterSpreads/")) {
        console.log(`🔍 Found master spread file: ${fileName}`);
        await this.parseMasterSpreadFile(fileName, content, xmlParser);
        masterSpreadCount++;
      }
    }
    console.log(`📄 Total master spreads processed: ${masterSpreadCount}`);

    // ENHANCED: Robust page extraction with comprehensive error handling
    console.log("🔍 Starting enhanced page extraction process...");

    try {
      // Step 1: Try to extract pages from document structure
      console.log("📄 Step 1: Extracting pages from document structure...");
      console.log("🔍 DEBUG: this.document:", this.document);
      console.log(
        "🔍 DEBUG: this.document keys:",
        this.document
          ? Object.keys(this.document)
          : "this.document is null/undefined"
      );
      this.pages = this.extractPages(this.document);
      console.log(
        `📄 Pages extracted from document: ${this.pages?.length || 0}`
      );

      if (this.pages && this.pages.length > 0) {
        console.log("✅ Successfully extracted pages from document structure");
        this.pages.forEach((page, index) => {
          console.log(
            `   Page ${index + 1}: ${page.self} (${page.name || "Unnamed"})`
          );
        });
      }
    } catch (error) {
      console.error("❌ Error extracting pages from document:", error);
      this.pages = [];
    }

    // Step 2: If no pages found, try to extract from parsed spreads
    if (!this.pages || this.pages.length === 0) {
      console.log(
        "📄 Step 2: No pages in document, extracting from parsed spreads..."
      );
      console.log(
        `   Available spreads: ${Object.keys(this.spreads || {}).length}`
      );

      try {
        this.pages = this.extractPagesFromSpreads();
        console.log(
          `📄 Pages extracted from spreads: ${this.pages?.length || 0}`
        );

        if (this.pages && this.pages.length > 0) {
          console.log("✅ Successfully extracted pages from spreads");
          this.pages.forEach((page, index) => {
            console.log(
              `   Page ${index + 1}: ${page.self} (spread: ${
                page.spreadParent
              })`
            );
          });
        }
      } catch (error) {
        console.error("❌ Error extracting pages from spreads:", error);
        this.pages = [];
      }
    }

    // Step 3: Final fallback with enhanced default page creation
    if (!this.pages || this.pages.length === 0) {
      console.log(
        "📄 Step 3: Creating fallback default page with enhanced detection..."
      );
      this.pages = this.createEnhancedDefaultPage();
    }

    // Final validation and logging
    if (this.pages && this.pages.length > 0) {
      console.log(
        `✅ Page extraction completed successfully: ${this.pages.length} pages`
      );
      this.validateExtractedPages();
    } else {
      console.error("❌ CRITICAL: No pages could be extracted or created!");
      throw new Error("Failed to extract or create any pages from document");
    }

    console.log(`📄 Total pages available: ${this.pages.length}`);
  }

  async extractDocumentInfo(document) {
    console.log("Extracting document information...");

    if (!document) return;

    // Extract document preferences and page setup
    this.documentInfo = {
      version: document["@_DOMVersion"] || "Unknown",
      self: document["@_Self"] || "Unknown",
      activeLayer: document["@_ActiveLayer"] || null,
      unusedSwatches: document["@_UnusedSwatches"] || [],

      // Document preferences
      documentPreferences: this.extractDocumentPreferences(document),

      // Page setup
      pageSetup: this.extractPageSetup(document),

      // Layers
      layers: this.extractLayers(document),

      // Pages
      pages: this.extractPages(document),
    };

    console.log("✅ Document info extracted");
  }

  extractDocumentPreferences(document) {
    console.log("📋 Extracting document preferences...");
    console.log("Document keys:", Object.keys(document));

    const prefs = {};

    // Try multiple possible locations for document preferences
    let docPref = null;

    if (document.DocumentPreference) {
      docPref = document.DocumentPreference;
      console.log("Found DocumentPreference");
    } else if (document.documentPreference) {
      docPref = document.documentPreference;
      console.log("Found documentPreference (lowercase)");
    } else if (document.Properties && document.Properties.DocumentPreference) {
      docPref = document.Properties.DocumentPreference;
      console.log("Found DocumentPreference in Properties");
    }

    if (docPref) {
      console.log("DocumentPreference keys:", Object.keys(docPref));
      prefs.pageWidth = parseFloat(docPref["@_PageWidth"]) || 0;
      prefs.pageHeight = parseFloat(docPref["@_PageHeight"]) || 0;
      prefs.left = parseFloat(docPref["@_Left"]) || 0;
      prefs.top = parseFloat(docPref["@_Top"]) || 0;
      prefs.right = parseFloat(docPref["@_Right"]) || 0;
      prefs.bottom = parseFloat(docPref["@_Bottom"]) || 0;
      prefs.columnCount = parseInt(docPref["@_ColumnCount"]) || 1;
      prefs.columnGutter = parseFloat(docPref["@_ColumnGutter"]) || 0;
      prefs.facingPages =
        docPref["@_FacingPages"] === "true" ||
        docPref["@_FacingPages"] === true;

      console.log("📋 Extracted document preferences:", prefs);
    } else {
      console.log("⚠️ No DocumentPreference found in document");
    }

    // Also try to extract margin preferences
    let marginPref = null;
    if (document.MarginPreference) {
      marginPref = document.MarginPreference;
      console.log("Found MarginPreference");
    } else if (document.marginPreference) {
      marginPref = document.marginPreference;
      console.log("Found marginPreference (lowercase)");
    } else if (document.Properties && document.Properties.MarginPreference) {
      marginPref = document.Properties.MarginPreference;
      console.log("Found MarginPreference in Properties");
    }

    if (marginPref) {
      console.log("MarginPreference keys:", Object.keys(marginPref));
      prefs.marginTop = parseFloat(marginPref["@_Top"]) || 0;
      prefs.marginBottom = parseFloat(marginPref["@_Bottom"]) || 0;
      prefs.marginLeft = parseFloat(marginPref["@_Left"]) || 0;
      prefs.marginRight = parseFloat(marginPref["@_Right"]) || 0;
      prefs.marginColumnCount = parseInt(marginPref["@_ColumnCount"]) || 1;
      prefs.marginColumnGutter = parseFloat(marginPref["@_ColumnGutter"]) || 0;

      console.log("📏 Extracted margin preferences:", {
        top: prefs.marginTop,
        bottom: prefs.marginBottom,
        left: prefs.marginLeft,
        right: prefs.marginRight,
        columnCount: prefs.marginColumnCount,
        columnGutter: prefs.marginColumnGutter,
      });
    }

    return prefs;
  }

  extractPageSetup(document) {
    const pageSetup = {
      pages: [],
      masterPages: [],
      spreads: [],
    };

    // Extract page information from document
    if (document.Page) {
      const pages = Array.isArray(document.Page)
        ? document.Page
        : [document.Page];

      pages.forEach((page) => {
        pageSetup.pages.push({
          self: page["@_Self"],
          name: page["@_Name"] || "",
          appliedMaster: page["@_AppliedMaster"] || "",
          geometricBounds: IDMLUtils.parseGeometricBounds(
            page["@_GeometricBounds"]
          ),
          itemTransform: IDMLUtils.parseTransform(page["@_ItemTransform"]),
          overrideList: page["@_OverrideList"] || [],
          backgroundColor: page["@_BackgroundColor"] || null, // NEW: Add background color
        });
      });
    }

    return pageSetup;
  }

  extractLayers(document) {
    const layers = [];

    if (document.Layer) {
      const layerData = Array.isArray(document.Layer)
        ? document.Layer
        : [document.Layer];

      layerData.forEach((layer) => {
        layers.push({
          self: layer["@_Self"],
          name: layer["@_Name"] || "",
          visible: layer["@_Visible"] !== false,
          locked: layer["@_Locked"] === true,
          ignoreWrap: layer["@_IgnoreWrap"] === true,
          showGuides: layer["@_ShowGuides"] !== false,
          lockGuides: layer["@_LockGuides"] === true,
          ui: layer["@_UI"] || "",
          layerColor: layer["@_LayerColor"] || "LightBlue",
        });
      });
    }

    this.layers = layers;
    return layers;
  }

  extractPages(document) {
    console.log("Extracting pages from document...");
    console.log("🔍 DEBUG: extractPages called with document:", document);
    console.log(
      "🔍 DEBUG: document keys:",
      document ? Object.keys(document) : "document is null/undefined"
    );
    const pages = [];

    // First try to extract pages from document - NEW ENHANCED
    if (document && document.Page) {
      const docPages = Array.isArray(document.Page)
        ? document.Page
        : [document.Page];
      docPages.forEach((page) => {
        pages.push({
          self: page["@_Self"],
          name: page["@_Name"] || "",
          appliedMaster: page["@_AppliedMaster"] || "",
          geometricBounds: IDMLUtils.parseGeometricBounds(
            page["@_GeometricBounds"]
          ),
          itemTransform: IDMLUtils.parseTransform(page["@_ItemTransform"]),
          spreadParent: null, // Direct document page
          backgroundColor: page["@_BackgroundColor"] || null, // NEW: Extract background color
        });
      });
      console.log(`Found ${pages.length} pages directly in document`);
    }

    // Then extract pages from spreads - ENHANCED with background colors
    if (document && document.Spread) {
      const spreads = Array.isArray(document.Spread)
        ? document.Spread
        : [document.Spread];

      spreads.forEach((spread) => {
        // Extract spread-level background color - NEW
        const spreadBackgroundColor = spread["@_BackgroundColor"] || null;

        if (spread.Page) {
          const spreadPages = Array.isArray(spread.Page)
            ? spread.Page
            : [spread.Page];
          spreadPages.forEach((page) => {
            // Extract page-level background color, fallback to spread background color - NEW
            const pageBackgroundColor =
              page["@_BackgroundColor"] || spreadBackgroundColor;

            // Check if this page already exists in our pages array
            const existingPageIndex = pages.findIndex(
              (p) => p.self === page["@_Self"]
            );

            if (existingPageIndex >= 0) {
              // Update the existing page with spread parent info and background color
              pages[existingPageIndex].spreadParent = spread["@_Self"];
              if (pageBackgroundColor) {
                pages[existingPageIndex].backgroundColor = pageBackgroundColor;
              }
            } else {
              // Add as a new page
              pages.push({
                self: page["@_Self"],
                name: page["@_Name"] || "",
                appliedMaster: page["@_AppliedMaster"] || "",
                geometricBounds: IDMLUtils.parseGeometricBounds(
                  page["@_GeometricBounds"]
                ),
                itemTransform: IDMLUtils.parseTransform(
                  page["@_ItemTransform"]
                ),
                spreadParent: spread["@_Self"],
                backgroundColor: pageBackgroundColor, // NEW: Add background color
              });
            }
          });
        }
      });
    }

    // If still no pages found, try to extract from spreads directly - NEW
    if (pages.length === 0 && this.spreads) {
      console.log(
        "No pages found in document, trying to extract from parsed spreads..."
      );
      Object.values(this.spreads).forEach((spread) => {
        if (spread && spread.pages) {
          // Get spread-level background color - NEW
          const spreadBackgroundColor = spread.backgroundColor || null;

          spread.pages.forEach((page) => {
            pages.push({
              self: page.self,
              name: page.name || "",
              appliedMaster: page.appliedMaster || "",
              geometricBounds: page.geometricBounds,
              itemTransform: page.itemTransform,
              spreadParent: spread.self,
              backgroundColor: page.backgroundColor || spreadBackgroundColor, // NEW: Use page color or fallback to spread color
            });
          });
        }
      });
    }

    // Log background color information - NEW
    pages.forEach((page, index) => {
      console.log(
        `Page ${index + 1} (${page.self}) background color: ${
          page.backgroundColor || "None"
        }`
      );
    });

    console.log(`Total pages extracted: ${pages.length}`);
    return pages;
  }

  // NEW METHOD: Extract pages from already-parsed spreads
  extractPagesFromSpreads() {
    console.log("Extracting pages from parsed spreads...");
    const pages = [];

    if (this.spreads && Object.keys(this.spreads).length > 0) {
      Object.values(this.spreads).forEach((spread) => {
        if (spread && spread.pages) {
          // Get spread-level background color
          const spreadBackgroundColor = spread.backgroundColor || null;

          spread.pages.forEach((page) => {
            pages.push({
              self: page.self,
              name: page.name || "",
              appliedMaster: page.appliedMaster || "",
              geometricBounds: page.geometricBounds,
              itemTransform: page.itemTransform,
              spreadParent: spread.self,
              backgroundColor: page.backgroundColor || spreadBackgroundColor, // Use page color or fallback to spread color
            });
          });
        }
      });
    }

    console.log(`Extracted ${pages.length} pages from spreads`);
    return pages;
  }

  // ENHANCED: Create fallback default page with better dimension detection
  createEnhancedDefaultPage() {
    console.log("🔧 Creating enhanced default page...");

    try {
      // Try multiple sources for page dimensions
      let pageWidth = 612; // US Letter default
      let pageHeight = 792;
      let detectionSource = "hardcoded-default";

      // Source 1: Document preferences
      const docPrefs = this.documentInfo?.documentPreferences || {};
      if (docPrefs.pageWidth && docPrefs.pageHeight) {
        pageWidth = docPrefs.pageWidth;
        pageHeight = docPrefs.pageHeight;
        detectionSource = "document-preferences";
      }
      // Source 2: Master spread dimensions
      else if (
        this.masterSpreads &&
        Object.keys(this.masterSpreads).length > 0
      ) {
        const firstMaster = Object.values(this.masterSpreads)[0];
        if (firstMaster?.pages?.[0]?.geometricBounds) {
          const bounds = firstMaster.pages[0].geometricBounds;
          pageWidth = bounds.width || bounds.right - bounds.left || pageWidth;
          pageHeight =
            bounds.height || bounds.bottom - bounds.top || pageHeight;
          detectionSource = "master-spread";
        }
      }
      // Source 3: First available spread
      else if (this.spreads && Object.keys(this.spreads).length > 0) {
        const firstSpread = Object.values(this.spreads)[0];
        if (firstSpread?.pages?.[0]?.geometricBounds) {
          const bounds = firstSpread.pages[0].geometricBounds;
          pageWidth = bounds.width || bounds.right - bounds.left || pageWidth;
          pageHeight =
            bounds.height || bounds.bottom - bounds.top || pageHeight;
          detectionSource = "spread-data";
        }
      }

      console.log(
        `📐 Page dimensions detected from ${detectionSource}: ${pageWidth}x${pageHeight}`
      );

      const defaultPage = {
        self: "defaultPage_" + Date.now(),
        name: "Default Page",
        appliedMaster: "",
        geometricBounds: {
          top: 0,
          left: 0,
          bottom: pageHeight,
          right: pageWidth,
          width: pageWidth,
          height: pageHeight,
        },
        itemTransform: [1, 0, 0, 1, 0, 0], // Identity transform
        spreadParent: null,
        backgroundColor: null,
        isDefaultPage: true,
        detectionSource: detectionSource,
      };

      console.log("✅ Enhanced default page created successfully");
      return [defaultPage];
    } catch (error) {
      console.error("❌ Error creating enhanced default page:", error);

      // Ultra-safe fallback
      return [
        {
          self: "emergency_page",
          name: "Emergency Page",
          appliedMaster: "",
          geometricBounds: {
            top: 0,
            left: 0,
            bottom: 792,
            right: 612,
            width: 612,
            height: 792,
          },
          itemTransform: [1, 0, 0, 1, 0, 0],
          spreadParent: null,
          backgroundColor: null,
          isDefaultPage: true,
          detectionSource: "emergency-fallback",
        },
      ];
    }
  }

  // ENHANCED: Validate extracted pages for completeness
  validateExtractedPages() {
    console.log("🔍 Validating extracted pages...");

    let validPages = 0;
    let issues = [];

    this.pages.forEach((page, index) => {
      const pageNum = index + 1;

      // Check required properties
      if (!page.self) {
        issues.push(`Page ${pageNum}: Missing 'self' identifier`);
      }
      if (!page.geometricBounds) {
        issues.push(`Page ${pageNum}: Missing geometric bounds`);
      } else {
        const bounds = page.geometricBounds;
        if (!bounds.width || !bounds.height) {
          issues.push(
            `Page ${pageNum}: Invalid dimensions (${bounds.width}x${bounds.height})`
          );
        }
      }
      if (!page.itemTransform) {
        issues.push(`Page ${pageNum}: Missing item transform`);
      }

      if (issues.length === 0) {
        validPages++;
      }
    });

    if (issues.length > 0) {
      console.warn("⚠️ Page validation issues found:");
      issues.forEach((issue) => console.warn(`   ${issue}`));
    }

    console.log(
      `✅ Page validation completed: ${validPages}/${this.pages.length} pages valid`
    );

    return {
      totalPages: this.pages.length,
      validPages: validPages,
      issues: issues,
    };
  }

  async parseSpreadFile(fileName, content, xmlParser) {
    console.log(`📄 Parsing spread: ${fileName}`);

    try {
      const parsed = xmlParser.parse(content);
      const spreadId = path.basename(fileName, ".xml");

      const spreadData = parsed.Spread?.Spread || parsed.Spread || parsed;

      if (parsed.Spread) {
        console.log("Spread wrapper keys:", Object.keys(parsed.Spread));
        if (parsed.Spread.Spread) {
          console.log("Actual spread keys:", Object.keys(parsed.Spread.Spread));
        }
      }

      if (spreadData.Page) {
        const pages = Array.isArray(spreadData.Page)
          ? spreadData.Page
          : [spreadData.Page];
        console.log(`Found ${pages.length} pages in spread`);
        pages.forEach((page, index) => {
          console.log(`Page ${index} keys:`, Object.keys(page));

          // Look for elements in the page
          Object.keys(page).forEach((key) => {
            if (
              key !== "@_Self" &&
              key !== "@_Name" &&
              key !== "@_GeometricBounds" &&
              key !== "@_ItemTransform" &&
              key !== "@_AppliedMaster"
            ) {
              const value = page[key];
              if (Array.isArray(value)) {
                console.log(`  Found array ${key} with ${value.length} items`);
              } else if (typeof value === "object") {
                console.log(`  Found object ${key}:`, Object.keys(value));
              }
            }
          });
        });
      } else {
        console.log("No Page property found in spread");
      }

      // Check for direct elements in spread
      Object.keys(spreadData).forEach((key) => {
        if (
          key.includes("Frame") ||
          key.includes("Rectangle") ||
          key.includes("Text") ||
          key.includes("Group") ||
          key.includes("Oval")
        ) {
          console.log(
            `Found potential elements directly in spread: ${key}`,
            Array.isArray(spreadData[key]) ? spreadData[key].length : "single"
          );
        }
      });

      // Extract detailed spread information - ENHANCED with background color
      const detailedSpread = {
        self: spreadData["@_Self"],
        flattenerOverride: spreadData["@_FlattenerOverride"] || "",
        bindingLocation: parseFloat(spreadData["@_BindingLocation"]) || 0,
        allowPageShuffle: spreadData["@_AllowPageShuffle"] !== false,
        backgroundColor: spreadData["@_BackgroundColor"] || null, // NEW: Extract background color

        // Extract page elements
        pages: this.elementParser.extractSpreadPages(spreadData),

        // Extract all page items (text frames, rectangles, etc.)
        pageItems: this.elementParser.extractPageItems(spreadData),
      };

      // Log background color information - NEW
      console.log(
        `Spread ${spreadId} background color: ${
          detailedSpread.backgroundColor || "None"
        }`
      );

      this.spreads[spreadId] = detailedSpread;
      console.log(
        `✅ Spread ${spreadId} parsed with ${detailedSpread.pageItems.length} items`
      );
    } catch (error) {
      console.error(`❌ Error parsing spread ${fileName}:`, error.message);
    }
  }

  async parseMasterSpreadFile(fileName, content, xmlParser) {
    console.log(`🎨 Parsing master spread: ${fileName}`);

    try {
      const parsed = xmlParser.parse(content);
      const masterId = path.basename(fileName, ".xml");

      const masterData =
        parsed.MasterSpread?.MasterSpread || parsed.MasterSpread || parsed;

      console.log("Parsed master spread keys:", Object.keys(parsed));
      if (parsed.MasterSpread) {
        console.log(
          "MasterSpread wrapper keys:",
          Object.keys(parsed.MasterSpread)
        );
        if (parsed.MasterSpread.MasterSpread) {
          console.log(
            "Actual master spread keys:",
            Object.keys(parsed.MasterSpread.MasterSpread)
          );
        }
      }

      // Extract detailed master spread information - ENHANCED with background color
      const detailedMaster = {
        self: masterData["@_Self"],
        name: masterData["@_Name"] || "",
        namePrefix: masterData["@_NamePrefix"] || "",
        basedOn: masterData["@_BasedOn"] || "", // PRESERVED from first file
        baseName: masterData["@_BaseName"] || "", // PRESERVED from second file
        itemTransform: IDMLUtils.parseTransform(masterData["@_ItemTransform"]), // PRESERVED from first file
        backgroundColor: masterData["@_BackgroundColor"] || null, // NEW: Extract background color

        // Extract master pages
        pages: this.elementParser.extractMasterPages
          ? this.elementParser.extractMasterPages(masterData)
          : this.elementParser.extractSpreadPages(masterData), // PRESERVED: Use extractMasterPages if available, fallback to extractSpreadPages

        // Extract master page items
        pageItems: this.elementParser.extractPageItems(masterData),
      };

      // Log background color information - NEW
      console.log(
        `Master spread ${masterId} background color: ${
          detailedMaster.backgroundColor || "None"
        }`
      );

      this.masterSpreads[masterId] = detailedMaster;
      console.log(
        `✅ Master spread ${masterId} parsed with ${detailedMaster.pageItems.length} items`
      );
    } catch (error) {
      console.error(
        `❌ Error parsing master spread ${fileName}:`,
        error.message
      );
    }
  }

  async extractDetailedInformation() {
    console.log("Extracting detailed information with enhanced processing...");

    this.pageInfo = {
      dimensions: this.calculatePageDimensions(),
      margins: this.calculateMargins(),
      bleeds: this.calculateBleeds(),
      guides: this.extractGuides(),
      grids: this.extractGrids(),
    };

    this.elementParser.createElementPositionMapFixed(); // Use the fixed version

    console.log("✅ Enhanced detailed information extracted");
  }

  calculatePageDimensions() {
    // Try to get dimensions from spreads first (most reliable)
    if (this.spreads && Object.keys(this.spreads).length > 0) {
      const firstSpread = Object.values(this.spreads)[0];
      if (firstSpread.pages && firstSpread.pages.length > 0) {
        const firstPage = firstSpread.pages[0];
        if (firstPage.geometricBounds) {
          const bounds = firstPage.geometricBounds;

          // FIXED: Get units from ViewPreferences instead of hardcoding 'Points'
          let units = "Points"; // fallback

          // Try to get units from StyleParser's documentInfo first
          if (this.styleParser && this.styleParser.getDocumentInfo) {
            const styleParserInfo = this.styleParser.getDocumentInfo();
            if (
              styleParserInfo?.preferences?.viewPreferences
                ?.horizontalMeasurementUnits
            ) {
              units =
                styleParserInfo.preferences.viewPreferences
                  .horizontalMeasurementUnits;
              console.log(
                "📏 Using measurement units from StyleParser:",
                units
              );
            }
          }

          // Fallback to local documentInfo
          if (
            units === "Points" &&
            this.documentInfo?.preferences?.viewPreferences
              ?.horizontalMeasurementUnits
          ) {
            units =
              this.documentInfo.preferences.viewPreferences
                .horizontalMeasurementUnits;
            console.log(
              "📏 Using measurement units from local DocumentInfo:",
              units
            );
          }

          const width = bounds.width || bounds.right - bounds.left || 0;
          const height = bounds.height || bounds.bottom - bounds.top || 0;
          const facingPages = Object.values(this.spreads).some(
            (spread) => spread.pages && spread.pages.length > 1
          );

          const dimensions = {
            width: width,
            height: height,
            facingPages: facingPages,
            units: units,
          };

          // ADDED: Set document units on all parsers for consistent conversions
          if (this.elementParser && this.elementParser.setDocumentUnits) {
            this.elementParser.setDocumentUnits(units);
          }
          if (this.storyParser && this.storyParser.setDocumentUnits) {
            this.storyParser.setDocumentUnits(units);
          }
          if (this.styleParser && this.styleParser.setDocumentUnits) {
            this.styleParser.setDocumentUnits(units);
          }

          // ADDED: Convert to pixels if UnitConverter is available and conversion is enabled
          if (this.unitConverter && this.unitConverter.isSupportedUnit(units)) {
            return this.unitConverter.convertDimensions(dimensions);
          }

          return dimensions;
        }
      }
    }

    // Fallback to document preferences
    const docPrefs = this.documentInfo.preferences?.documentPreferences || {};

    // FIXED: Better units detection for fallback case
    let units = "Points"; // default fallback

    // Try StyleParser first
    if (this.styleParser && this.styleParser.getDocumentInfo) {
      const styleParserInfo = this.styleParser.getDocumentInfo();
      if (
        styleParserInfo?.preferences?.viewPreferences
          ?.horizontalMeasurementUnits
      ) {
        units =
          styleParserInfo.preferences.viewPreferences
            .horizontalMeasurementUnits;
      }
    }

    // Then try local documentInfo
    if (
      units === "Points" &&
      this.documentInfo?.preferences?.viewPreferences
        ?.horizontalMeasurementUnits
    ) {
      units =
        this.documentInfo.preferences.viewPreferences
          .horizontalMeasurementUnits;
    }

    console.log("📏 Final measurement units decision:", units);

    const dimensions = {
      width: docPrefs.pageWidth || 0,
      height: docPrefs.pageHeight || 0,
      facingPages: docPrefs.facingPages || false,
      units: units,
    };

    // ADDED: Set document units on ElementParser, StoryParser, and StyleParser for consistent conversions
    if (this.elementParser && this.elementParser.setDocumentUnits) {
      this.elementParser.setDocumentUnits(units);
    }
    if (this.storyParser && this.storyParser.setDocumentUnits) {
      this.storyParser.setDocumentUnits(units);
    }
    if (this.styleParser && this.styleParser.setDocumentUnits) {
      this.styleParser.setDocumentUnits(units);
    }

    // ADDED: Convert to pixels if UnitConverter is available and conversion is enabled
    if (this.unitConverter && this.unitConverter.isSupportedUnit(units)) {
      return this.unitConverter.convertDimensions(dimensions);
    }

    return dimensions;
  }

  calculateMargins() {
    console.log("📏 Calculating margins from multiple sources...");

    // Try to get margins from master pages first (most reliable)
    if (this.masterSpreads && Object.keys(this.masterSpreads).length > 0) {
      const firstMaster = Object.values(this.masterSpreads)[0];
      if (firstMaster.pages && firstMaster.pages.length > 0) {
        const firstMasterPage = firstMaster.pages[0];

        // Look for margin preferences in master page
        // This will be populated by the improved master spread parsing
        if (firstMasterPage.marginPreference) {
          const masterMargins = {
            top: firstMasterPage.marginPreference.top || 0,
            bottom: firstMasterPage.marginPreference.bottom || 0,
            left: firstMasterPage.marginPreference.left || 0,
            right: firstMasterPage.marginPreference.right || 0,
            columnCount: firstMasterPage.marginPreference.columnCount || 1,
            columnGutter: firstMasterPage.marginPreference.columnGutter || 0,
          };

          console.log("📏 Found margins from master page:", masterMargins);

          // ADDED: Convert margins to pixels if UnitConverter is available
          if (this.unitConverter && this.elementParser?.documentUnits) {
            const pixelMargins = this.unitConverter.convertObjectToPixels(
              masterMargins,
              this.elementParser.documentUnits
            );
            return {
              ...masterMargins,
              pixelMargins: pixelMargins,
            };
          }

          return masterMargins;
        }
      }
    }

    // Fallback to document preferences
    const docPrefs = this.documentInfo.documentPreferences || {};
    const marginPrefs = this.documentInfo.preferences?.marginPreferences || {};

    // Check for margin data in document preferences (fallback)
    const margins = {
      top: marginPrefs.top || docPrefs.marginTop || docPrefs.top || 0,
      bottom:
        marginPrefs.bottom || docPrefs.marginBottom || docPrefs.bottom || 0,
      left: marginPrefs.left || docPrefs.marginLeft || docPrefs.left || 0,
      right: marginPrefs.right || docPrefs.marginRight || docPrefs.right || 0,
      columnCount:
        marginPrefs.columnCount ||
        docPrefs.marginColumnCount ||
        docPrefs.columnCount ||
        1,
      columnGutter:
        marginPrefs.columnGutter ||
        docPrefs.marginColumnGutter ||
        docPrefs.columnGutter ||
        0,
    };

    console.log("📏 Calculated margins (fallback):", margins);

    // ADDED: Convert margins to pixels if UnitConverter is available
    if (this.unitConverter && this.elementParser?.documentUnits) {
      const pixelMargins = this.unitConverter.convertObjectToPixels(
        margins,
        this.elementParser.documentUnits
      );
      return {
        ...margins,
        pixelMargins: pixelMargins,
      };
    }

    return margins;
  }

  calculateBleeds() {
    const docPrefs = this.documentInfo.preferences?.documentPreferences || {};

    return {
      top: docPrefs.documentBleedTopOffset || 0,
      bottom: docPrefs.documentBleedBottomOffset || 0,
      inside: docPrefs.documentBleedInsideOrLeftOffset || 0,
      outside: docPrefs.documentBleedOutsideOrRightOffset || 0,
    };
  }

  extractGuides() {
    const guides = [];

    // Extract guides from spreads
    Object.values(this.spreads).forEach((spread) => {
      if (spread.pageItems) {
        spread.pageItems.forEach((item) => {
          if (item.type === "Guide") {
            guides.push({
              orientation: item.orientation || "Horizontal",
              location: item.location || 0,
              fitToPage: item.fitToPage || false,
              viewThreshold: item.viewThreshold || 0,
            });
          }
        });
      }
    });

    return guides;
  }

  extractGrids() {
    const gridPrefs = this.documentInfo.preferences?.gridPreferences || {};

    return {
      baseline: {
        start: gridPrefs.baselineStart || 0,
        division: gridPrefs.baselineDivision || 12,
        shown: gridPrefs.baselineShown || false,
        snapTo: gridPrefs.baselineSnapto || false,
      },
      document: {
        shown: gridPrefs.documentGridShown || false,
        snapTo: gridPrefs.documentGridSnapto || false,
      },
    };
  }

  // Utility method to get page content
  getPageContent(pageId) {
    return this.elementParser.getPageContent(pageId);
  }

  getDocument() {
    return this.document;
  }

  getSpreads() {
    return this.spreads;
  }

  getMasterSpreads() {
    return this.masterSpreads;
  }

  getDocumentInfo() {
    return this.documentInfo;
  }

  getPageInfo() {
    return this.pageInfo;
  }

  getLayers() {
    return this.layers;
  }

  // NEW METHOD: Get pages
  getPages() {
    return this.pages;
  }

  calculateCoordinateOffset() {
    return IDMLUtils.calculateCoordinateOffset(
      this.elementParser.getElements()
    );
  }
}

module.exports = DocumentParser;

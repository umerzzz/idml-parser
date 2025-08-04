// pages/api/upload.js
import multer from "multer";
import path from "path";
import fs from "fs";

// Import individual modules instead of the monolithic IDMLProcessor
import {
  IDMLXMLParser,
  FileExtractor,
  StyleParser,
  StoryParser,
  ElementParser,
  DocumentParser,
  ImageProcessor,
  DebugAnalyzer,
  IDMLUtils,
} from "../../lib/index.js";

// ADDED: Import NextFontMapper for automatic font processing
const NextFontMapper = require("../../lib/utils/NextFontMapper").default;
// ADDED: Import DataModularizer for modularizing processed data
const DataModularizer = require("../../lib/utils/DataModularizer");

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (!req.uploadTimestamp) {
        req.uploadTimestamp = Date.now().toString();
      }

      const uploadDir = path.join(
        process.cwd(),
        "uploads",
        req.uploadTimestamp
      );
      fs.mkdirSync(uploadDir, { recursive: true });
      req.uploadDir = uploadDir;
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    },
  }),
});

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

function createComprehensiveProcessedData(rawData, moduleData = {}) {
  console.log("🔧 Creating comprehensive processed data with ALL details...");
  console.log("Raw elements count:", rawData.elements?.length || 0);
  console.log("Raw stories count:", Object.keys(rawData.stories || {}).length);

  // Build comprehensive processed data with NO filtering and ALL details preserved
  const processedData = {
    // ===== DOCUMENT INFORMATION =====
    document: {
      // Core document info
      version: rawData.document?.version || "Unknown",
      pageCount: rawData.document?.pageCount || 1,
      name: rawData.document?.name || "Untitled",

      // Add dimensions to document level for easier access
      dimensions: rawData.pageInfo?.dimensions || {
        width: 612,
        height: 792,
        units: rawData.pageInfo?.dimensions?.units || "Points", // FIXED: Use actual units from document
      },

      // Include ALL raw document properties
      ...rawData.document,
    },

    // ===== PAGE INFORMATION =====
    pageInfo: {
      // Preserve all page info exactly as is
      ...(rawData.pageInfo || {}),

      // Ensure dimensions and margins exist
      dimensions: rawData.pageInfo?.dimensions || {
        width: 612,
        height: 792,
        units: rawData.pageInfo?.dimensions?.units || "Points", // FIXED: Use actual units from document
      },
      margins: rawData.pageInfo?.margins || {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    },

    // ===== ELEMENTS - NO FILTERING, ALL PRESERVED =====
    elements: (rawData.elements || []).map((element) => ({
      // Preserve ALL original element properties
      ...element,

      // Ensure consistent property names (but keep originals too)
      id: element.id || element.self,
      fill: element.fill || element.fillColor,
      stroke: element.stroke || element.strokeColor,

      // Ensure position exists
      position: element.position || {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
      },

      // Ensure boolean flags have defaults
      visible: element.visible !== false,
      locked: element.locked === true,
      isContentFrame: element.isContentFrame || false,
      hasPlacedContent: element.hasPlacedContent || false,

      // Content properties
      contentType: element.contentType || null,
      imagePosition: element.imagePosition || null,
      placedContent: element.placedContent || null,

      // Parent relationships
      parentStory: element.parentStory,
      linkedImage: element.linkedImage,
    })), // NO FILTERING - keep ALL elements including zero width/height

    // ===== STORIES - COMPLETE PRESERVATION =====
    stories: Object.keys(rawData.stories || {}).reduce((acc, key) => {
      const story = rawData.stories[key];
      if (story) {
        // Include ALL stories, not just those with text
        acc[key] = {
          // Preserve ALL original story properties
          ...story,

          // Ensure key properties have defaults
          text: story.text || "",
          wordCount: story.wordCount || 0,
          characterCount: story.characterCount || 0,
          textColor: story.textColor || null,
          hasLineBreaks: story.hasLineBreaks || false,
          lineBreakCount: story.lineBreakCount || 0,
          styling: story.styling || null,
          formattedContent: story.formattedContent || [],
        };
      }
      return acc;
    }, {}),

    // ===== PAGES =====
    pages: rawData.pages || [],

    // ===== ELEMENTS BY PAGE =====
    elementsByPage: rawData.elementsByPage || {},

    // ===== MODULE DATA - STYLES, SPREADS, ETC =====
    styles: moduleData.styles ||
      rawData.styles || {
        paragraph: {},
        character: {},
        object: {},
        table: {},
        cell: {},
      },

    spreads: moduleData.spreads || rawData.spreads || {},
    masterSpreads: moduleData.masterSpreads || rawData.masterSpreads || {},
    layers: moduleData.layers || rawData.layers || [],

    // ===== RESOURCES AND ASSETS =====
    resources: moduleData.resources || rawData.resources || {},

    // ===== DEBUG AND PROCESSING INFO =====
    debug22: rawData.debug22 || {},

    // ===== PACKAGE INFORMATION =====
    packageInfo: {
      // Preserve existing package info
      ...(rawData.packageInfo || {}),

      // Ensure defaults
      hasLinks: rawData.packageInfo?.hasLinks || false,
      hasFonts: rawData.packageInfo?.hasFonts || false,
      linksCount: rawData.packageInfo?.linksCount || 0,
      fontsCount: rawData.packageInfo?.fontsCount || 0,
      extractedImagesCount: rawData.packageInfo?.extractedImagesCount || 0,
    },

    // ===== PROCESSING METADATA =====
    processingInfo: {
      timestamp: new Date().toISOString(),
      moduleDataIncluded: !!moduleData,
      elementsCount: rawData.elements?.length || 0,
      storiesCount: Object.keys(rawData.stories || {}).length,
      pagesCount: rawData.pages?.length || 0,
      noDataFiltered: true, // Indicates we preserved ALL data
      processingVersion: "2.0-comprehensive",
    },

    // ===== PRESERVE ANY ADDITIONAL RAW DATA =====
    // Include any other properties from rawData that we might have missed
    ...Object.keys(rawData).reduce((acc, key) => {
      if (
        ![
          "document",
          "pageInfo",
          "elements",
          "stories",
          "debug22",
          "packageInfo",
        ].includes(key)
      ) {
        acc[key] = rawData[key];
      }
      return acc;
    }, {}),
  };

  console.log("✅ Comprehensive processed data created:");
  console.log(
    "- Elements:",
    processedData.elements.length,
    "(no filtering applied)"
  );
  console.log("- Stories:", Object.keys(processedData.stories).length);
  console.log("- Pages:", processedData.pages?.length || 0);
  console.log("- Styles included:", !!processedData.styles);
  console.log("- Spreads included:", !!processedData.spreads);
  console.log("- Resources included:", !!processedData.resources);

  return processedData;
}

/**
 * Extract complete character styles including text decorations, weights, etc.
 * @param {Object} segmentFormatting - Character-level formatting
 * @param {Object} storyFormatting - Story-level formatting fallback
 * @returns {Object} Complete style object with all properties preserved
 */
function extractCompleteCharacterStyles(
  segmentFormatting,
  storyFormatting = {}
) {
  const styles = {
    // Font properties
    fontFamily:
      segmentFormatting.fontFamily || storyFormatting.fontFamily || null,
    fontSize: segmentFormatting.fontSize || storyFormatting.fontSize || null,
    fontWeight: extractFontWeight(
      segmentFormatting.fontStyle || storyFormatting.fontStyle
    ),
    fontStyle: extractFontStyle(
      segmentFormatting.fontStyle || storyFormatting.fontStyle
    ),

    // Colors
    color: segmentFormatting.fillColor || storyFormatting.fillColor || null,
    backgroundColor: segmentFormatting.backgroundColor || null,

    // Text decorations
    textDecoration: extractTextDecorations(segmentFormatting),

    // Typography
    letterSpacing:
      segmentFormatting.tracking || storyFormatting.tracking || null,
    lineHeight: segmentFormatting.leading || storyFormatting.leading || null,

    // Text effects
    textShadow: extractTextShadow(segmentFormatting),
    textTransform: extractTextTransform(segmentFormatting),

    // Advanced properties
    characterStyle: segmentFormatting.characterStyle || null,
    paragraphStyle:
      segmentFormatting.paragraphStyle ||
      storyFormatting.paragraphStyle ||
      null,

    // InDesign specific
    baselineShift: segmentFormatting.baselineShift || null,
    horizontalScale: segmentFormatting.horizontalScale || null,
    verticalScale: segmentFormatting.verticalScale || null,
    kerning: segmentFormatting.kerning || null,

    // Stroke properties
    strokeColor: segmentFormatting.strokeColor || null,
    strokeWeight: segmentFormatting.strokeWeight || null,

    // Preserve selected original properties (avoid circular reference)
    originalFormatting: {
      fontFamily: segmentFormatting.fontFamily,
      fontStyle: segmentFormatting.fontStyle,
      fontSize: segmentFormatting.fontSize,
      fillColor: segmentFormatting.fillColor,
      characterStyle: segmentFormatting.characterStyle,
      paragraphStyle: segmentFormatting.paragraphStyle,
      tracking: segmentFormatting.tracking,
      baselineShift: segmentFormatting.baselineShift,
      horizontalScale: segmentFormatting.horizontalScale,
      verticalScale: segmentFormatting.verticalScale,
      kerning: segmentFormatting.kerning,
      strokeColor: segmentFormatting.strokeColor,
      strokeWeight: segmentFormatting.strokeWeight,
      underline: segmentFormatting.underline,
      strikethrough: segmentFormatting.strikethrough,
      strikeThrough: segmentFormatting.strikeThrough,
      overline: segmentFormatting.overline,
    },
  };

  return styles;
}

/**
 * Extract font weight from InDesign font style string
 * @param {string} fontStyle - InDesign font style
 * @returns {string} CSS font weight
 */
function extractFontWeight(fontStyle) {
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
}

/**
 * Extract font style from InDesign font style string
 * @param {string} fontStyle - InDesign font style
 * @returns {string} CSS font style
 */
function extractFontStyle(fontStyle) {
  if (!fontStyle) return "normal";

  const style = fontStyle.toLowerCase();

  if (style.includes("italic") || style.includes("oblique")) {
    return "italic";
  }

  return "normal";
}

/**
 * Extract text decorations from formatting
 * @param {Object} formatting - Character formatting
 * @returns {string} CSS text-decoration value
 */
function extractTextDecorations(formatting) {
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
}

/**
 * Extract text shadow effects
 * @param {Object} formatting - Character formatting
 * @returns {string} CSS text-shadow value
 */
function extractTextShadow(formatting) {
  // InDesign shadow effects - implement when available
  if (formatting.dropShadow || formatting.textShadow) {
    // Return CSS text-shadow format
    return formatting.textShadow || null;
  }
  return null;
}

/**
 * Extract text transform
 * @param {Object} formatting - Character formatting
 * @returns {string} CSS text-transform value
 */
function extractTextTransform(formatting) {
  if (formatting.capitalization || formatting.textCase) {
    const textCase = (
      formatting.capitalization ||
      formatting.textCase ||
      ""
    ).toLowerCase();

    if (textCase.includes("upper")) return "uppercase";
    if (textCase.includes("lower")) return "lowercase";
    if (textCase.includes("title") || textCase.includes("capital"))
      return "capitalize";
    if (textCase.includes("small")) return "small-caps";
  }

  return "none";
}

/**
 * Improved font extraction that handles the actual document structure
 * @param {Object} documentData - Processed IDML document data
 * @param {NextFontMapper} fontMapper - Font mapper instance
 * @returns {Array} Array of font configurations
 */
function extractDocumentFontsImproved(documentData, fontMapper) {
  const usedFonts = new Set();
  const fontConfigs = [];

  console.log("🔍 Extracting fonts from document data (improved)...");

  // Extract fonts from stories (main source)
  if (documentData.stories) {
    Object.values(documentData.stories).forEach((story) => {
      // Check story-level styling first
      if (story.styling && story.styling.fontFamily) {
        const key = `${story.styling.fontFamily}-${
          story.styling.fontStyle || "Regular"
        }`;
        if (!usedFonts.has(key)) {
          usedFonts.add(key);
          const config = fontMapper.mapToNextFont(
            story.styling.fontFamily,
            story.styling.fontStyle || "Regular",
            story.styling.fontSize || 16
          );
          fontConfigs.push(config);
          console.log(`   📝 Found story font: "${story.styling.fontFamily}"`);
        }
      }

      // Check formatted content segments
      if (story.formattedContent) {
        story.formattedContent.forEach((segment) => {
          if (segment.formatting) {
            const fontFamily =
              segment.formatting.fontFamily || story.styling?.fontFamily;
            const fontStyle =
              segment.formatting.fontStyle ||
              story.styling?.fontStyle ||
              "Regular";

            if (fontFamily) {
              const key = `${fontFamily}-${fontStyle}`;
              if (!usedFonts.has(key)) {
                usedFonts.add(key);
                const config = fontMapper.mapToNextFont(
                  fontFamily,
                  fontStyle,
                  segment.formatting.fontSize || story.styling?.fontSize || 16
                );
                fontConfigs.push(config);
                console.log(`   📝 Found segment font: "${fontFamily}"`);
              }
            }
          }
        });
      }
    });
  }

  // Extract fonts from resources (fallback/additional)
  if (documentData.resources && documentData.resources.fonts) {
    Object.values(documentData.resources.fonts).forEach((fontFamily) => {
      if (fontFamily.name) {
        const key = `${fontFamily.name}-Regular`;
        if (!usedFonts.has(key)) {
          usedFonts.add(key);
          const config = fontMapper.mapToNextFont(
            fontFamily.name,
            "Regular",
            16
          );
          fontConfigs.push(config);
          console.log(`   📝 Found resource font: "${fontFamily.name}"`);
        }
      }
    });
  }

  console.log(
    `📊 Extracted ${fontConfigs.length} unique fonts from document (improved)`
  );

  // Log summary
  fontConfigs.forEach((font, index) => {
    console.log(
      `   ${index + 1}. "${font.originalFamily}" → "${font.fontFamily}" (${
        font.nextFont
      })`
    );
  });

  return fontConfigs;
}

/**
 * Process Next.js fonts for the document
 * @param {Object} documentData - Processed IDML document data
 * @param {NextFontMapper} fontMapper - Font mapper instance
 * @returns {Object} Next.js font configuration
 */
function processNextFonts(documentData, fontMapper) {
  console.log("🔤 Starting Next.js font processing...");

  // Clear previous cache
  fontMapper.clearCache();

  // Extract and map all unique fonts from the document
  const mappedFonts = extractDocumentFontsImproved(documentData, fontMapper);

  // Process stories to add Next.js font info to formatted content
  if (documentData.stories) {
    Object.values(documentData.stories).forEach((story) => {
      // Process story-level styling
      if (story.styling && story.styling.fontFamily) {
        const nextFontConfig = fontMapper.mapToNextFont(
          story.styling.fontFamily,
          story.styling.fontStyle || "Regular",
          story.styling.fontSize || 16
        );

        // Add Next.js font information to the story
        story.styling.nextFont = nextFontConfig;
      }

      // Process formatted content segments
      if (story.formattedContent) {
        story.formattedContent.forEach((segment) => {
          if (segment.formatting) {
            // Try multiple font family sources
            const fontFamily =
              segment.formatting.fontFamily || story.styling?.fontFamily;
            const fontStyle =
              segment.formatting.fontStyle ||
              story.styling?.fontStyle ||
              "Regular";
            const fontSize =
              segment.formatting.fontSize || story.styling?.fontSize || 16;

            if (fontFamily) {
              // Enhanced font processing with complete style preservation
              const nextFontConfig = fontMapper.mapToNextFont(
                fontFamily,
                fontStyle,
                fontSize
              );

              // ENHANCED: Add complete character styling preservation
              segment.formatting.nextFont = nextFontConfig;
              segment.formatting.completeStyles =
                extractCompleteCharacterStyles(
                  segment.formatting,
                  story.styling
                );

              // Also add font family if missing
              if (!segment.formatting.fontFamily) {
                segment.formatting.fontFamily = fontFamily;
              }
            }
          }
        });
      }
    });
  }

  // Generate Next.js code snippets
  const fontImports = fontMapper.generateNextFontImports();
  const fontVariables = fontMapper.generateFontVariables();
  const usedFontNames = Array.from(fontMapper.nextFontImports);

  // Create CSS variables for all fonts
  const cssVariables =
    mappedFonts.length > 0
      ? mappedFonts
          .map(
            (font) => `${font.nextFontVariable}: ${font.fontFamilyFallback};`
          )
          .join("\n  ")
      : "";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await runMiddleware(req, res, upload.array("files"));

    const uploadDir = req.uploadDir;
    const uploadId = req.uploadTimestamp;

    console.log("🆔 Upload ID:", uploadId);
    console.log("📁 Upload Dir:", uploadDir);
    console.log(
      "📄 Files uploaded:",
      req.files.map((f) => f.filename)
    );

    const idmlFile = req.files.find((file) => file.filename.endsWith(".idml"));
    if (!idmlFile) {
      return res.status(400).json({ error: "No IDML file found" });
    }

    // ENHANCED: Detect upload type and setup package structure
    const isPackageUpload = req.files.length > 1;

    console.log(
      `📦 Upload type: ${isPackageUpload ? "Package" : "Single IDML"}`
    );

    // FIXED: Proper package structure setup
    const packageStructure = {
      uploadDir,
      uploadId,
      idmlFile: idmlFile.path,
      resourceMap: new Map(),
      allFiles: req.files,
      extractedPath: uploadDir, // FIX: Add this line
      // Folder paths for embedded content
      linksFolder: path.join(uploadDir, "Links"),
      fontsFolder: path.join(uploadDir, "Fonts"),
      isPackageUpload,
    };

    // Map all uploaded files
    req.files.forEach((file) => {
      const fileName = path.basename(file.filename);
      packageStructure.resourceMap.set(fileName, file.path);

      // Also map without extension for easier lookup
      const nameWithoutExt = path.parse(fileName).name;
      packageStructure.resourceMap.set(nameWithoutExt, file.path);
    });

    // ENHANCED: Create folder structure if package upload
    if (isPackageUpload) {
      // Create Links folder if it doesn't exist
      if (!fs.existsSync(packageStructure.linksFolder)) {
        fs.mkdirSync(packageStructure.linksFolder, { recursive: true });
      }

      // Move image files to Links folder
      const imageExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".tiff",
        ".tif",
        ".bmp",
        ".svg",
        ".eps",
        ".ai",
        ".psd",
      ];
      req.files.forEach((file) => {
        if (
          file.filename !== idmlFile.filename &&
          imageExtensions.some((ext) =>
            file.filename.toLowerCase().endsWith(ext)
          )
        ) {
          const targetPath = path.join(
            packageStructure.linksFolder,
            file.filename
          );

          // Move file to Links folder
          try {
            fs.renameSync(file.path, targetPath);
            // Update resource map
            packageStructure.resourceMap.set(
              path.basename(file.filename),
              targetPath
            );
            console.log(`📂 Moved ${file.filename} to Links folder`);
          } catch (error) {
            console.warn(
              `⚠️  Could not move ${file.filename} to Links folder:`,
              error.message
            );
          }
        }
      });
    }

    console.log("📦 Package structure:", {
      uploadDir: packageStructure.uploadDir,
      uploadId: packageStructure.uploadId,
      filesCount: packageStructure.resourceMap.size,
      hasIdml: !!idmlFile,
      isPackage: isPackageUpload,
      linksFolder: packageStructure.linksFolder,
    });

    console.log("🔍 Starting IDML debug analysis...");

    // Use the monolithic processor as requested
    const IDMLProcessor = require("../../lib/IDMLProcessor").default;
    const processor = new IDMLProcessor({
      uploadDir,
      uploadId,
      debugMode: true,
    });

    // Initialize debug analyzer
    const debugAnalyzer = new DebugAnalyzer();

    // Process the IDML using the monolithic processor
    console.log(
      "Processing IDML file with monolithic processor:",
      idmlFile.path
    );

    // Process the IDML file
    const processedData = await processor.processIDML(idmlFile.path);

    // Extract data from the processor
    const document = processor.documentParser?.getDocument();
    const elements = processor.elements || [];
    const stories = processor.storyParser?.getStories() || {};
    const styles = processor.styleParser?.getStyles() || {};
    const pages = processor.documentParser?.getPages() || [];
    const pageInfo = processor.documentParser?.getPageInfo();

    console.log(`📄 Pages extracted: ${pages?.length || 0}`);
    console.log(`📄 Elements extracted: ${elements?.length || 0}`);
    console.log(`📄 Stories extracted: ${Object.keys(stories).length || 0}`);

    // Use the processor's comprehensive mapping
    const mappingResult = processor.createComprehensiveElementPageMapping();
    const { elementToPageMap, pageToElementsMap } = mappingResult;

    // Log mapping results
    processor.logMappingResults(mappingResult);

    // Convert the mapping to elementsByPage format for compatibility
    const elementsByPage = {};
    pages.forEach((page) => {
      elementsByPage[page.self] = [];
    });

    // Populate elementsByPage using the comprehensive mapping
    elements.forEach((element) => {
      const targetPageId = elementToPageMap[element.self];
      if (targetPageId && elementsByPage[targetPageId]) {
        elementsByPage[targetPageId].push(element);
      }
    });

    console.log(
      `📄 Elements organized by page: ${
        Object.keys(elementsByPage).length
      } pages`
    );
    Object.keys(elementsByPage).forEach((pageId) => {
      console.log(
        `   Page ${pageId}: ${elementsByPage[pageId].length} elements`
      );
    });

    console.log(
      `✅ Comprehensive mapping complete: ${mappingResult.totalAssigned}/${mappingResult.totalElements} elements assigned`
    );

    // Initialize extracted images array (will be populated by processor)
    const extractedImages = [];

    const documentData = {
      document: {
        version:
          processor.documentParser?.getDocument()?.["@_DOMVersion"] ||
          "Unknown",
        pageCount: pages?.length || Math.max(1, elements.length > 0 ? 1 : 0),
        name: processor.documentParser?.getDocument()?.["@_Name"] || "Untitled",
      },

      pageInfo: {
        dimensions: pageInfo.dimensions,
        margins: pageInfo.margins,
      },

      pages: pages || [], // NEW: Include pages in document data

      // NEW: Include comprehensive mapping data
      elementToPageMap: elementToPageMap || {},
      pageToElementsMap: pageToElementsMap || {},
      mappingStats: {
        totalElements: mappingResult?.totalElements || 0,
        totalAssigned: mappingResult?.totalAssigned || 0,
        unassignedCount: mappingResult?.unassignedCount || 0,
      },

      elementsByPage: elementsByPage, // NEW: Include elements organized by page

      elements: elements.map((element) => ({
        id: element.self,
        type: element.type,
        name: element.name,
        position: element.position,
        // ADDED: Include pixel position created by ElementParser
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
      })),

      stories: Object.keys(stories).reduce((acc, storyId) => {
        const story = stories[storyId];
        if (story?.content?.plainText) {
          acc[storyId] = {
            text: story.content.plainText,
            wordCount: story.content.wordCount,
            characterCount: story.content.characterCount,
            textColor: story.content.textColor,
            hasLineBreaks: story.content.lineBreakInfo?.hasLineBreaks || false,
            lineBreakCount: story.content.lineBreakInfo?.lineBreakCount || 0,

            // Include resolved styling information
            styling: processor.styleParser?.getStoryStyleSummary(story),

            // Include formatted content with resolved formatting
            formattedContent: story.content.formattedContent || [],
          };
        }
        return acc;
      }, {}),

      debug22: {
        measurementUnits:
          processor.documentParser?.getDocumentInfo()?.preferences
            ?.viewPreferences?.horizontalMeasurementUnits,
        coordinateOffset: processor.documentParser?.calculateCoordinateOffset(),
        contentFramesCount: elements.filter((el) => el.isContentFrame).length,
        imagesLinkedCount: elements.filter(
          (el) => el.linkedImage && !el.linkedImage.isEmbedded
        ).length,
        embeddedImagesCount: elements.filter(
          (el) => el.linkedImage && el.linkedImage.isEmbedded
        ).length,
      },
    };

    // Step 5: Add comprehensive text formatting debug
    await debugAnalyzer.addComprehensiveTextFormattingDebug({
      getStyles: () => processor.styleParser?.getStyles() || {},
      getStories: () => processor.storyParser?.getStories() || {},
      getElements: () => processor.elements || [],
    });

    // Step 6: Process linked images and update elements
    // Step 6a: Extract embedded images for ALL uploads (both single IDML and package)
    console.log("🖼️ Extracting embedded images...");
    console.log("📁 Upload directory:", uploadDir);
    console.log("📁 Upload directory exists:", fs.existsSync(uploadDir));
    console.log(
      "📁 Upload directory writable:",
      fs.accessSync ? "checking..." : "unknown"
    );
    console.log("📄 IDML file path:", idmlFile.path);
    console.log("📄 IDML file exists:", fs.existsSync(idmlFile.path));
    console.log("📄 IDML file size:", fs.statSync(idmlFile.path).size);

    try {
      if (fs.accessSync) {
        fs.accessSync(uploadDir, fs.constants.W_OK);
        console.log("✅ Upload directory is writable");
      }
    } catch (error) {
      console.error("❌ Upload directory is not writable:", error.message);
    }

    console.log("🚀 Starting embedded image extraction...");
    const embeddedImages = await processor.extractEmbeddedImageFromSpread(
      idmlFile.path,
      uploadDir
    );
    console.log(`✅ Extracted ${embeddedImages.length} embedded images`);
    console.log(
      "📊 Embedded images details:",
      embeddedImages.map((img) => ({
        fileName: img.fileName,
        size: img.size,
        path: img.extractedPath,
      }))
    );

    if (isPackageUpload) {
      // Step 6b: Use processIDMLPackage for package uploads to properly handle both embedded and linked images
      const packageProcessedData = await processor.processIDMLPackage(
        idmlFile.path,
        packageStructure,
        embeddedImages
      );

      // Update documentData with the processed data
      documentData.elements =
        packageProcessedData.elements || documentData.elements;
      documentData.packageInfo = packageProcessedData.packageInfo;
    } else {
      // For single IDML files, use the existing processLinkedResources with extracted images
      await processor.imageProcessor.processLinkedResources(
        documentData,
        packageStructure,
        embeddedImages
      );
    }

    // Step 6.5: Update mapping data after linked images are processed
    if (documentData.elements && documentData.pages) {
      console.log("🔄 Updating mapping data after linked image processing...");

      // Create a simple mapping update based on the updated elements
      const updatedElementToPageMap = { ...documentData.elementToPageMap };
      const updatedPageToElementsMap = {};

      // Initialize page-to-elements map
      documentData.pages.forEach((page) => {
        updatedPageToElementsMap[page.self] = [];
      });

      // Update mapping for elements that have linked images
      let updatedCount = 0;
      documentData.elements.forEach((element) => {
        const elementId = element.self || element.id;
        const currentPageId = updatedElementToPageMap[elementId];

        if (currentPageId && updatedPageToElementsMap[currentPageId]) {
          // Keep existing mapping
          if (!updatedPageToElementsMap[currentPageId].includes(elementId)) {
            updatedPageToElementsMap[currentPageId].push(elementId);
          }

          // If this element has a linked image, log it
          if (element.linkedImage) {
            console.log(
              `✅ Element ${elementId} with linked image mapped to page ${currentPageId}`
            );
            updatedCount++;
          }
        }
      });

      // Update the mapping data in documentData
      documentData.elementToPageMap = updatedElementToPageMap;
      documentData.pageToElementsMap = updatedPageToElementsMap;

      // Update elementsByPage with the new mapping
      const updatedElementsByPage = {};
      documentData.pages.forEach((page) => {
        updatedElementsByPage[page.self] = [];
      });

      documentData.elements.forEach((element) => {
        const elementId = element.self || element.id;
        const targetPageId = updatedElementToPageMap[elementId];
        if (targetPageId && updatedElementsByPage[targetPageId]) {
          updatedElementsByPage[targetPageId].push(element);
        }
      });

      documentData.elementsByPage = updatedElementsByPage;

      console.log("✅ Mapping data updated after linked image processing");
      console.log(`📊 Elements with linked images mapped: ${updatedCount}`);
    }

    // Step 7: Add package info (only for single IDML files, package uploads handle this in processIDMLPackage)
    if (!isPackageUpload) {
      documentData.packageInfo = {
        hasLinks: packageStructure.resourceMap?.size > 1,
        hasFonts: false,
        linksCount: Array.from(
          packageStructure.resourceMap?.keys() || []
        ).filter((name) => IDMLUtils.isImageFile(name)).length,
        fontsCount: 0,
        extractedImagesCount: extractedImages.length,
      };
    }

    console.log(
      "✅ IDML processing completed. Elements:",
      documentData.elements.length
    );

    // ADDED: Automatic Next.js font processing
    console.log("🔤 Processing Next.js fonts automatically...");
    const fontMapper = new NextFontMapper();
    documentData.nextFonts = processNextFonts(documentData, fontMapper);
    console.log(
      `✅ Font processing completed. Mapped ${documentData.nextFonts.usedFonts.length} unique fonts`
    );

    // Create ENHANCED debug JSON file
    const debugData = {
      timestamp: new Date().toISOString(),
      uploadId: uploadId,

      // Basic file info
      idmlFile: {
        name: idmlFile.filename,
        size: idmlFile.size,
        path: idmlFile.path,
      },

      // ENHANCED: Detailed IDML contents analysis
      idmlContents: {
        basic: {
          totalFiles: 0, // Will be updated by processor
          allFiles: [], // Will be updated by processor
          folders: [], // Will be updated by processor
          imageFiles: [], // Will be updated by processor
          hasLinksFolder: false, // Will be updated by processor
          linksFolderContents: [], // Will be updated by processor
        },
        detailed: {}, // Will be updated by processor
        spreadAnalysis: {}, // Will be updated by processor
        suspiciousFileSamples: [], // Will be updated by processor
      },

      // Rest of existing debug data...
      packageUpload: {
        totalUploadedFiles: req.files.length,
        uploadedFiles: req.files.map((f) => ({
          name: f.filename,
          size: f.size,
          mimetype: f.mimetype,
        })),
        isPackageUpload: req.files.length > 1,
      },

      processingResults: {
        elementsFound: documentData.elements?.length || 0,
        storiesFound: Object.keys(documentData.stories || {}).length,
        contentFrames:
          documentData.elements?.filter((el) => el.isContentFrame) || [],
        embeddedImages:
          documentData.elements?.filter((el) => el.linkedImage?.isEmbedded) ||
          [],
        placeholders:
          documentData.elements?.filter(
            (el) => el.linkedImage?.isPlaceholder
          ) || [],
      },

      // Add extraction results to debug data
      imageExtraction: {
        totalFound: extractedImages.length,
        totalExtracted: extractedImages.length,
        extractedImages: extractedImages,
        extractionSuccess: extractedImages.length > 0,
        method: extractedImages.length > 0 ? "spread_xml_base64" : "none",
      },
    };

    // MODULARIZED ONLY: Debug data is now included in modularized structure
    console.log("✅ Debug data included in modularized structure");

    console.log("🔍 Raw document data structure:");
    console.log("- Elements:", documentData.elements?.length || 0);
    console.log("- Stories:", Object.keys(documentData.stories || {}).length);
    console.log("- Pages:", documentData.pages?.length || 0);
    console.log("- PageInfo:", !!documentData.pageInfo);
    console.log("- Package Info:", documentData.packageInfo);

    // Create comprehensive processed data with ALL module data included
    const moduleData = {
      styles: processor.styleParser?.getStyles() || {},
      spreads: processor.documentParser?.getSpreads() || {},
      masterSpreads: processor.documentParser?.getMasterSpreads() || {},
      layers: processor.documentParser?.getLayers() || {},
      resources: processor.styleParser?.getResources() || {},
    };

    const comprehensiveProcessedData = createComprehensiveProcessedData(
      documentData,
      moduleData
    );

    // ADD extracted images to the processed data so frontend can access them
    comprehensiveProcessedData.extractedImages = extractedImages;
    console.log(
      `📸 Added ${extractedImages.length} extracted images to processed data`
    );

    // MODULARIZE: Create modularized data structure
    console.log("🔧 Starting data modularization...");
    const modularizer = new DataModularizer(uploadDir);
    const modularizationIndex = modularizer.modularize(
      comprehensiveProcessedData
    );

    // MODULARIZED ONLY: Remove legacy processed_data.json if it exists
    const legacyProcessedDataPath = path.join(uploadDir, "processed_data.json");
    if (fs.existsSync(legacyProcessedDataPath)) {
      fs.unlinkSync(legacyProcessedDataPath);
      console.log("🗑️ Removed legacy processed_data.json file");
    }

    // MODULARIZED ONLY: No longer saving raw_data.json or debug_analysis.json
    console.log(
      "✅ Modularized data structure complete - no legacy files created"
    );

    console.log(
      "✅ Processing complete. Elements found:",
      comprehensiveProcessedData.elements.length
    );
    console.log("✅ Comprehensive data includes:");
    console.log("  - Pages:", comprehensiveProcessedData.pages?.length || 0);
    console.log(
      "  - Elements by Page:",
      Object.keys(comprehensiveProcessedData.elementsByPage || {}).length
    );
    console.log(
      "  - Styles:",
      Object.keys(comprehensiveProcessedData.styles || {}).length
    );
    console.log(
      "  - Spreads:",
      Object.keys(comprehensiveProcessedData.spreads || {}).length
    );
    console.log(
      "  - Resources:",
      Object.keys(comprehensiveProcessedData.resources || {}).length
    );

    res.json({
      success: true,
      uploadId,
      data: comprehensiveProcessedData,
      modularized: true,
      modularizationIndex: modularizationIndex,
      debugAvailable: true,
      uploadType: isPackageUpload ? "package" : "single",
      filesProcessed: req.files.length,
      processingVersion: "2.0-comprehensive-modularized",
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};

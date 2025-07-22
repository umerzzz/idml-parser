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
const NextFontMapper = require("../../lib/utils/NextFontMapper");

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

    // Initialize individual modules instead of the monolithic processor
    const xmlParser = new IDMLXMLParser();
    const fileExtractor = new FileExtractor();

    // FIXED: Initialize UnitConverter before using it
    const UnitConverter = require("../../lib/utils/UnitConverter");
    const unitConverter = new UnitConverter(96); // Default web DPI

    const styleParser = new StyleParser(unitConverter); // ADDED: Pass UnitConverter
    const elementParser = new ElementParser(unitConverter); // ADDED: Pass UnitConverter
    const storyParser = new StoryParser(styleParser, unitConverter); // ADDED: Pass UnitConverter
    const documentParser = new DocumentParser(
      elementParser,
      styleParser,
      unitConverter
    ); // FIXED: Pass StyleParser and UnitConverter
    const imageProcessor = new ImageProcessor(fileExtractor);
    const debugAnalyzer = new DebugAnalyzer();

    // Run the basic debug method using fileExtractor
    const idmlContents = await fileExtractor.debugIDMLContents(idmlFile.path);

    // NEW: Run detailed analysis with error handling
    let detailedAnalysis = {
      suspiciousFiles: [],
      largeBinaryFiles: [],
      filesByType: {},
    };
    try {
      if (typeof fileExtractor.debugIDMLContentsDetailed === "function") {
        detailedAnalysis = await fileExtractor.debugIDMLContentsDetailed(
          idmlFile.path
        );
      } else {
        console.log(
          "⚠️ debugIDMLContentsDetailed method not found, using basic analysis"
        );
      }
    } catch (error) {
      console.error("Error in detailed analysis:", error);
    }

    // NEW: Analyze spreads for image references with error handling
    let spreadAnalysis = {
      imageReferences: [],
      linkReferences: [],
      placedContentDetails: [],
    };
    try {
      if (
        typeof imageProcessor.analyzeSpreadForImageReferences === "function"
      ) {
        spreadAnalysis = await imageProcessor.analyzeSpreadForImageReferences(
          idmlFile.path,
          xmlParser
        );
      } else {
        console.log("⚠️ analyzeSpreadForImageReferences method not found");
      }
    } catch (error) {
      console.error("Error in spread analysis:", error);
    }

    // NEW: Extract samples from suspicious files with safe handling
    const suspiciousFileSamples = [];
    if (
      detailedAnalysis.suspiciousFiles &&
      detailedAnalysis.suspiciousFiles.length > 0
    ) {
      for (const suspiciousFile of detailedAnalysis.suspiciousFiles.slice(
        0,
        3
      )) {
        try {
          if (typeof processor.extractSampleContent === "function") {
            const sample = await processor.extractSampleContent(
              idmlFile.path,
              suspiciousFile.fileName
            );
            suspiciousFileSamples.push(sample);
          }
        } catch (error) {
          console.error(`Error sampling ${suspiciousFile.fileName}:`, error);
        }
      }
    }

    // ENHANCED: Check for embedded images and extract them FIRST
    console.log("🖼️ Checking for embedded images...");
    let extractedImages = [];

    // First try the new spread-based extraction
    try {
      const spreadExtractedImages =
        await imageProcessor.extractEmbeddedImageFromSpread(
          idmlFile.path,
          uploadDir,
          xmlParser
        );
      extractedImages = extractedImages.concat(spreadExtractedImages);
      console.log(
        `✅ Spread extraction: Found ${spreadExtractedImages.length} images`
      );
    } catch (error) {
      console.error("❌ Spread extraction failed:", error);
    }

    // Fallback to old method if available
    if (
      extractedImages.length === 0 &&
      idmlContents.filter((f) => IDMLUtils.isImageFile(f)).length > 0
    ) {
      try {
        if (typeof fileExtractor.extractAndSaveEmbeddedImages === "function") {
          const oldMethodImages =
            await fileExtractor.extractAndSaveEmbeddedImages(
              idmlFile.path,
              uploadDir
            );
          extractedImages = extractedImages.concat(oldMethodImages);
        }
      } catch (error) {
        console.error("❌ Old extraction method failed:", error);
      }
    }

    console.log(
      `✅ Total image extraction complete. Extracted: ${extractedImages.length}`
    );

    // NOW process the IDML with full package support AND extracted images using individual modules
    console.log("Processing IDML file:", idmlFile.path);

    // Step 1: Extract ZIP contents
    const extractedData = await fileExtractor.extractIDMLContents(
      idmlFile.path
    );
    console.log(
      `Extracted ${Object.keys(extractedData).length} files from IDML`
    );

    // Step 2: Parse document structure
    console.log("Parsing document structure...");

    // Parse Resources
    console.log("\n📋 === PARSING RESOURCES ===");
    for (const [fileName, content] of Object.entries(extractedData)) {
      if (fileName.startsWith("Resources/")) {
        console.log("🔍 Processing resource:", fileName);
        await styleParser.parseResourceFile(fileName, content, xmlParser);
      }
    }

    // Parse document structure (spreads, master spreads) - FIXED: Pass StyleParser
    await documentParser.parseDocumentStructure(extractedData, xmlParser);

    // Parse Stories
    console.log("\n📝 === PARSING STORIES ===");
    let storyCount = 0;
    for (const [fileName, content] of Object.entries(extractedData)) {
      if (fileName.startsWith("Stories/")) {
        console.log("🔍 Found story file:", fileName);
        console.log("   Content length:", content.length);
        console.log("   Content preview:", content.substring(0, 200));
        storyCount++;
        await storyParser.parseStoryFile(fileName, content, xmlParser);
      }
    }
    console.log(`📝 Total stories processed: ${storyCount}`);

    // Step 3: Extract detailed information
    console.log("Extracting detailed information with enhanced processing...");
    await documentParser.extractDetailedInformation();
    const pageInfo = documentParser.getPageInfo();
    console.log("✅ Enhanced detailed information extracted");

    // Step 4: Build document data structure
    const document = documentParser.getDocument();
    const elements = elementParser.getElements();
    const stories = storyParser.getStories();
    const styles = styleParser.getStyles();

    const documentData = {
      document: {
        version: document?.["@_DOMVersion"] || "Unknown",
        pageCount: Math.max(1, elements.length > 0 ? 1 : 0),
        name: document?.["@_Name"] || "Untitled",
      },

      pageInfo: {
        dimensions: pageInfo.dimensions,
        margins: pageInfo.margins,
      },

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
            styling: styleParser.getStoryStyleSummary(story),

            // Include formatted content with resolved formatting
            formattedContent: story.content.formattedContent || [],
          };
        }
        return acc;
      }, {}),

      debug22: {
        measurementUnits:
          documentParser.getDocumentInfo().preferences?.viewPreferences
            ?.horizontalMeasurementUnits,
        coordinateOffset: documentParser.calculateCoordinateOffset(),
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
      getStyles: () => styleParser.getStyles(),
      getStories: () => storyParser.getStories(),
      getElements: () => elementParser.getElements(),
    });

    // Step 6: Process linked images and update elements
    await imageProcessor.processLinkedResources(
      documentData,
      packageStructure,
      extractedImages
    );

    // Step 7: Add package info
    documentData.packageInfo = {
      hasLinks: packageStructure.resourceMap?.size > 1,
      hasFonts: false,
      linksCount: Array.from(packageStructure.resourceMap?.keys() || []).filter(
        (name) => IDMLUtils.isImageFile(name)
      ).length,
      fontsCount: 0,
      extractedImagesCount: extractedImages.length,
    };

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
          totalFiles: idmlContents.length,
          allFiles: idmlContents,
          folders: [...new Set(idmlContents.map((f) => f.split("/")[0]))],
          imageFiles: idmlContents.filter((f) => IDMLUtils.isImageFile(f)),
          hasLinksFolder: idmlContents.some((f) => f.startsWith("Links/")),
          linksFolderContents: idmlContents.filter((f) =>
            f.startsWith("Links/")
          ),
        },
        detailed: detailedAnalysis,
        spreadAnalysis: spreadAnalysis,
        suspiciousFileSamples: suspiciousFileSamples,
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

    // Save debug file with extraction results
    fs.writeFileSync(
      path.join(uploadDir, "debug_analysis.json"),
      JSON.stringify(debugData, null, 2)
    );

    console.log("✅ Debug analysis saved to debug_analysis.json");

    console.log("🔍 Raw document data structure:");
    console.log("- Elements:", documentData.elements?.length || 0);
    console.log("- Stories:", Object.keys(documentData.stories || {}).length);
    console.log("- PageInfo:", !!documentData.pageInfo);
    console.log("- Package Info:", documentData.packageInfo);

    // Create comprehensive processed data with ALL module data included
    const moduleData = {
      styles: styleParser.getStyles(),
      spreads: documentParser.getSpreads(),
      masterSpreads: documentParser.getMasterSpreads(),
      layers: documentParser.getLayers(),
      resources: styleParser.getResources(),
    };

    const comprehensiveProcessedData = createComprehensiveProcessedData(
      documentData,
      moduleData
    );

    // Save comprehensive processed data (this will be the primary data source)
    fs.writeFileSync(
      path.join(uploadDir, "processed_data.json"),
      JSON.stringify(comprehensiveProcessedData, null, 2)
    );

    // Also save raw data for debugging/fallback purposes only
    fs.writeFileSync(
      path.join(uploadDir, "raw_data.json"),
      JSON.stringify(documentData, null, 2)
    );

    console.log(
      "✅ Processing complete. Elements found:",
      comprehensiveProcessedData.elements.length
    );
    console.log("✅ Comprehensive data includes:");
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
      debugAvailable: true,
      uploadType: isPackageUpload ? "package" : "single",
      filesProcessed: req.files.length,
      processingVersion: "2.0-comprehensive",
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

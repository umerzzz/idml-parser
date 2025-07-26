// Main processor
const IDMLProcessor = require("./IDMLProcessor");

// Individual modules for advanced usage
const IDMLXMLParser = require("./parsers/XMLParser");
const FileExtractor = require("./extractors/FileExtractor");
const StyleParser = require("./parsers/StyleParser");
const StoryParser = require("./parsers/StoryParser");
const ElementParser = require("./parsers/ElementParser");
const DocumentParser = require("./parsers/DocumentParser");
const ImageProcessor = require("./processors/ImageProcessor");
const DebugAnalyzer = require("./debug/DebugAnalyzer");
const PageDebugger = require("./debug/PageDebugger"); // NEW from second file
const IDMLUtils = require("./utils/IDMLUtils");
const ColorUtils = require("./utils/ColorUtils");
const UnitConverter = require("./utils/UnitConverter"); // NEW from second file
const InDesignTextMetrics = require("./utils/InDesignTextMetrics");
const NextFontMapper = require("./utils/NextFontMapper"); // NEW from second file

module.exports = {
  // Main class (default export)
  IDMLProcessor,

  // Individual modules
  IDMLXMLParser,
  FileExtractor,
  StyleParser,
  StoryParser,
  ElementParser,
  DocumentParser,
  ImageProcessor,
  DebugAnalyzer,
  PageDebugger, // NEW
  IDMLUtils,
  ColorUtils,
  UnitConverter, // NEW
  InDesignTextMetrics,
  NextFontMapper, // NEW

  // Convenience exports
  parsers: {
    XMLParser: IDMLXMLParser,
    StyleParser,
    StoryParser,
    ElementParser,
    DocumentParser,
  },

  extractors: {
    FileExtractor,
  },

  processors: {
    ImageProcessor,
  },

  debug: {
    DebugAnalyzer,
    PageDebugger, // NEW
  },

  utils: {
    IDMLUtils,
    ColorUtils,
    UnitConverter, // NEW
    InDesignTextMetrics, // MOVED from individual exports
    NextFontMapper, // NEW
  },
};

// Default export for backward compatibility
module.exports.default = IDMLProcessor;

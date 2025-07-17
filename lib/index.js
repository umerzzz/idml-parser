// Main processor
const IDMLProcessor = require('./IDMLProcessor');

// Individual modules for advanced usage
const IDMLXMLParser = require('./parsers/XMLParser');
const FileExtractor = require('./extractors/FileExtractor');
const StyleParser = require('./parsers/StyleParser');
const StoryParser = require('./parsers/StoryParser');
const ElementParser = require('./parsers/ElementParser');
const DocumentParser = require('./parsers/DocumentParser');
const ImageProcessor = require('./processors/ImageProcessor');
const DebugAnalyzer = require('./debug/DebugAnalyzer');
const IDMLUtils = require('./utils/IDMLUtils');
const ColorUtils = require('./utils/ColorUtils');
const InDesignTextMetrics = require('./utils/InDesignTextMetrics');

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
  IDMLUtils,
  ColorUtils,
  InDesignTextMetrics,
  
  // Convenience exports
  parsers: {
    XMLParser: IDMLXMLParser,
    StyleParser,
    StoryParser,
    ElementParser,
    DocumentParser
  },
  
  extractors: {
    FileExtractor
  },
  
  processors: {
    ImageProcessor
  },
  
  debug: {
    DebugAnalyzer
  },
  
  utils: {
    IDMLUtils,
    ColorUtils
  }
};

// Default export for backward compatibility
module.exports.default = IDMLProcessor; 
// Main processor
import IDMLProcessor from "./IDMLProcessor.js";

// Individual modules for advanced usage
import IDMLXMLParser from "./parsers/XMLParser.js";
import FileExtractor from "./extractors/FileExtractor.js";
import StyleParser from "./parsers/StyleParser.js";
import StoryParser from "./parsers/StoryParser.js";
import ElementParser from "./parsers/ElementParser.js";
import DocumentParser from "./parsers/DocumentParser.js";
import ImageProcessor from "./processors/ImageProcessor.js";
import DebugAnalyzer from "./debug/DebugAnalyzer.js";
import PageDebugger from "./debug/PageDebugger.js";
import IDMLUtils from "./utils/IDMLUtils.js";
import ColorUtils from "./utils/ColorUtils.js";
import UnitConverter from "./utils/UnitConverter.js";
import InDesignTextMetrics from "./utils/InDesignTextMetrics.js";
import NextFontMapper from "./utils/NextFontMapper.js";
import DataModularizer from "./utils/DataModularizer.js";
import CleanupUtility from "./utils/CleanupUtility.js";

// Main exports
export {
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
  PageDebugger,
  IDMLUtils,
  ColorUtils,
  UnitConverter,
  InDesignTextMetrics,
  NextFontMapper,
  DataModularizer,
  CleanupUtility,
};

// Convenience exports
export const parsers = {
  XMLParser: IDMLXMLParser,
  StyleParser,
  StoryParser,
  ElementParser,
  DocumentParser,
};

export const extractors = {
  FileExtractor,
};

export const processors = {
  ImageProcessor,
};

export const debug = {
  DebugAnalyzer,
  PageDebugger,
};

export const utils = {
  IDMLUtils,
  ColorUtils,
  UnitConverter,
  InDesignTextMetrics,
  NextFontMapper,
  DataModularizer,
  CleanupUtility,
};

// Default export for backward compatibility
export default IDMLProcessor;

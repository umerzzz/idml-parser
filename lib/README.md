# IDML Processor - Modular Architecture

This document describes the modular architecture of the refactored IDML Processor, which has been broken down into specialized modules for better maintainability, testability, and extensibility.

## Module Overview

### Core Architecture

```
IDMLProcessor (Main Orchestrator)
├── parsers/
│   ├── XMLParser.js          # XML parsing configuration and utilities
│   ├── StyleParser.js        # Paragraph/character styles and font resolution
│   ├── StoryParser.js        # Text content and formatting extraction
│   ├── ElementParser.js      # Page items and geometric calculations
│   └── DocumentParser.js     # Main document structure and spreads
├── extractors/
│   └── FileExtractor.js      # ZIP file handling and content extraction
├── processors/
│   └── ImageProcessor.js     # Image linking and embedded content
├── debug/
│   └── DebugAnalyzer.js      # Comprehensive debugging and analysis
└── utils/
    └── IDMLUtils.js          # Helper functions and utilities
```

## Module Descriptions

### 1. IDMLProcessor (Main Class)
The main orchestrator that coordinates all modules while maintaining backward compatibility with the original API.

**Key Responsibilities:**
- Coordinates the processing pipeline
- Maintains backward compatibility
- Provides unified API for IDML processing

**Usage:**
```javascript
const { IDMLProcessor } = require('./lib');
const processor = new IDMLProcessor();
const result = await processor.processIDML('document.idml');
```

### 2. Parsers

#### XMLParser (`parsers/XMLParser.js`)
Handles XML parsing configuration and provides XML utility functions.

**Features:**
- Fast-xml-parser configuration for IDML files
- XML validation and error handling
- Element search and attribute extraction utilities

#### StyleParser (`parsers/StyleParser.js`)
Manages paragraph styles, character styles, fonts, and color definitions.

**Features:**
- Paragraph and character style extraction
- Font mapping and resolution
- Color and gradient parsing
- Style inheritance and overrides

#### StoryParser (`parsers/StoryParser.js`)
Extracts text content with sophisticated formatting analysis.

**Features:**
- Text content extraction with line break preservation
- Character and paragraph style range processing
- Font and formatting resolution
- Advanced line break detection

#### ElementParser (`parsers/ElementParser.js`)
Handles page items, geometric bounds, and element positioning.

**Features:**
- Page item extraction (rectangles, text frames, etc.)
- Geometric bounds calculation
- Transform matrix processing
- Content frame detection

#### DocumentParser (`parsers/DocumentParser.js`)
Manages the main document structure, spreads, and master spreads.

**Features:**
- Document metadata extraction
- Spread and master spread parsing
- Page setup and preferences
- Layer and guide information

### 3. Extractors

#### FileExtractor (`extractors/FileExtractor.js`)
Handles ZIP file operations and content extraction from IDML files.

**Features:**
- IDML ZIP file extraction
- Embedded image extraction
- File content analysis
- Debug file listing and analysis

### 4. Processors

#### ImageProcessor (`processors/ImageProcessor.js`)
Manages image linking, embedded content detection, and image mapping.

**Features:**
- Image reference detection
- Embedded vs. linked image handling
- Image map building and linking
- Base64 image extraction from spreads

### 5. Debug

#### DebugAnalyzer (`debug/DebugAnalyzer.js`)
Provides comprehensive debugging and analysis tools for IDML processing.

**Features:**
- Text formatting analysis
- Style hierarchy examination
- XML structure analysis
- Missing formatting detection
- Comprehensive debug reports

### 6. Utils

#### IDMLUtils (`utils/IDMLUtils.js`)
Contains helper functions and utilities used across all modules.

**Features:**
- Geometric calculations
- Color conversion (CMYK to RGB)
- Text processing utilities
- XML entity decoding
- File type detection

## Usage Examples

### Basic Usage (Backward Compatible)
```javascript
const { IDMLProcessor } = require('./lib');
const processor = new IDMLProcessor();
const result = await processor.processIDML('document.idml');
```

### Advanced Usage with Individual Modules
```javascript
const { 
  IDMLXMLParser, 
  FileExtractor, 
  StyleParser,
  StoryParser 
} = require('./lib');

// Create individual modules
const xmlParser = new IDMLXMLParser();
const fileExtractor = new FileExtractor();
const styleParser = new StyleParser();
const storyParser = new StoryParser(styleParser);

// Use modules independently
const extractedData = await fileExtractor.extractIDMLContents('document.idml');
// ... process with individual modules
```

### Accessing Module Data
```javascript
const processor = new IDMLProcessor();
await processor.processIDML('document.idml');

// Access individual module data
const styles = processor.getStyles();
const stories = processor.getStories();
const elements = processor.getElements();
const documentInfo = processor.getDocumentInfo();

// Access modules directly for advanced operations
const debugAnalyzer = processor.getDebugAnalyzer();
const imageProcessor = processor.getImageProcessor();
```

## Benefits of Modular Architecture

### 1. **Separation of Concerns**
Each module has a single, well-defined responsibility, making the codebase easier to understand and maintain.

### 2. **Testability**
Individual modules can be unit tested in isolation, improving test coverage and reliability.

### 3. **Extensibility**
New features can be added by creating new modules or extending existing ones without affecting the entire system.

### 4. **Reusability**
Modules can be used independently in other projects or combined in different ways.

### 5. **Debugging**
Issues can be isolated to specific modules, making debugging more efficient.

### 6. **Performance**
Modules can be optimized individually, and unnecessary modules can be omitted for lighter deployments.

## Migration Guide

The refactored version maintains full backward compatibility. Existing code using the original `IDMLProcessor` will continue to work without modifications:

```javascript
// This still works exactly as before
const IDMLProcessor = require('./lib/IDMLProcessor');
const processor = new IDMLProcessor();
const result = await processor.processIDML('document.idml');
```

## Module Dependencies

```
IDMLProcessor
├── XMLParser (no dependencies)
├── FileExtractor (depends on: IDMLUtils)
├── StyleParser (depends on: IDMLUtils)
├── StoryParser (depends on: StyleParser, IDMLUtils)
├── ElementParser (depends on: IDMLUtils)
├── DocumentParser (depends on: ElementParser, IDMLUtils)
├── ImageProcessor (depends on: FileExtractor, IDMLUtils)
└── DebugAnalyzer (depends on: IDMLUtils)
```

## Performance Considerations

- **Lazy Loading**: Modules are only instantiated when needed
- **Memory Efficiency**: Each module manages its own data lifecycle
- **Parallel Processing**: Independent modules can process data concurrently where possible
- **Caching**: Module-level caching reduces redundant operations

## Future Enhancements

The modular architecture enables several future enhancements:

1. **Plugin System**: Allow third-party modules to extend functionality
2. **Streaming Processing**: Process large IDML files in chunks
3. **Caching Layer**: Add persistent caching for frequently accessed data
4. **Web Workers**: Move processing to background threads
5. **TypeScript Support**: Add type definitions for better developer experience

## Contributing

When contributing to the IDML Processor:

1. **Single Responsibility**: Each module should have one clear purpose
2. **Minimal Dependencies**: Avoid unnecessary cross-module dependencies
3. **Error Handling**: Each module should handle its own errors gracefully
4. **Documentation**: Update this README when adding new modules
5. **Testing**: Add comprehensive tests for new modules
6. **Backward Compatibility**: Ensure changes don't break existing APIs 
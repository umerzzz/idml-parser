# IDML Document Viewer & Parser

A comprehensive **InDesign Markup Language (IDML)** parser and viewer built with Next.js, designed to extract, process, and render Adobe InDesign documents in a web browser with pixel-perfect accuracy.

## Table of Contents

- [Overview](#overview)
- [Architecture & Workflow](#architecture--workflow)
- [Core Features](#core-features)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [Implementation Strategy](#implementation-strategy)
- [API Documentation](#api-documentation)
- [Development Process](#development-process)
- [Code Snippets](#code-snippets)
- [Technical Details](#technical-details)

## Overview

The IDML Document Viewer is a sophisticated web application that transforms Adobe InDesign documents (IDML format) into interactive, web-renderable content. It handles complex typography, layouts, images, and styling while maintaining the original design integrity.

### What is IDML?

IDML (InDesign Markup Language) is Adobe's XML-based format for InDesign documents. It contains all the design elements, typography, images, and layout information in a structured format that can be parsed and processed programmatically.

### Key Capabilities

- **Multi-page document support** with accurate page-by-page rendering
- **Complex typography** with font mapping, kerning, and text fitting
- **Image processing** for both embedded and linked images
- **Advanced styling** including gradients, colors, and effects
- **List formatting** with bullets, numbering, and indentation
- **Responsive design** with pixel-perfect scaling
- **Modular architecture** for maintainability and extensibility

## Architecture & Workflow

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    ┌─────────────────┐    ┌─────────────────┐
│   (Next.js)     │◄──►│   Backend       │◄──►│   File System   │
│                 │    │   (API Routes)  │    │   (Uploads)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Viewer        │    │   IDMLProcessor │    │   Extracted     │
│   Components    │    │   (Core Logic)  │    │   Images        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Processing Workflow

1. **Upload Phase**

   - User uploads IDML package (folder containing IDML file + assets)
   - Files are stored in timestamped directory
   - Initial validation and extraction begins

2. **Extraction Phase**

   - IDML file is parsed as ZIP archive using our custom extractor
   - XML content is extracted and parsed with our proprietary XML parser
   - Images are extracted and processed
   - Font information is mapped

3. **Processing Phase**

   - Document structure is analyzed using our custom parsers
   - Elements are parsed and categorized dynamically
   - Styles are processed and normalized
   - Text content is extracted and formatted

4. **Modularization Phase**

   - Data is split into modular JSON files
   - Elements are organized by page
   - Resources are cataloged and linked
   - Metadata is preserved

5. **Rendering Phase**
   - Frontend loads modular data
   - Pages are rendered with accurate positioning
   - Text is formatted with proper styling
   - Images are displayed with correct sizing

## Core Features

### Document Processing

- **Multi-page Support**: Handles documents with any number of pages
- **Element Parsing**: Extracts TextFrames, Rectangles, ContentFrames, and more
- **Style Preservation**: Maintains paragraph and character-level formatting
- **Font Mapping**: Converts InDesign fonts to web-compatible alternatives
- **Unit Conversion**: Converts picas, points, mm, inches to pixels

### Text Rendering

- **Typography**: Accurate font rendering with kerning and tracking
- **Alignment**: Text alignment (left, center, right, justify)
- **Line Height**: Proper leading and baseline shift
- **Special Characters**: Unicode support and character encoding
- **Text Fitting**: Automatic text scaling and fitting strategies

### Image Processing

- **Embedded Images**: Extracts and processes images within IDML
- **Linked Images**: Handles external image references
- **Format Support**: PNG, JPG, TIFF, and other formats
- **Optimization**: Web-optimized image serving
- **Thumbnail Generation**: Page previews with image content

### Visual Elements

- **Shapes**: Rectangles, ellipses, and custom shapes
- **Gradients**: Linear and radial gradient fills
- **Colors**: CMYK to RGB conversion with fallbacks
- **Effects**: Drop shadows, transparency, and blending
- **Lists**: Bulleted and numbered list formatting

### User Interface

- **Page Navigation**: Tab-based page switching
- **Thumbnail Previews**: Visual page previews
- **Responsive Design**: Adapts to different screen sizes
- **Real-time Updates**: Live preview during processing
- **Error Handling**: Graceful error recovery and user feedback

## Installation & Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Modern web browser

### Dependencies

This project uses a carefully selected set of dependencies to handle the complex IDML parsing requirements:

**Core Dependencies:**

- `next: 14.0.0` - React framework for server-side rendering and API routes
- `react: ^18.0.0` - UI library for building interactive components
- `react-dom: ^18.0.0` - React rendering for web browsers
- `fast-xml-parser: ^4.5.3` - High-performance XML parser for processing IDML files
- `adm-zip: ^0.5.16` - ZIP archive handling for IDML package extraction
- `yauzl: ^2.10.0` - Additional ZIP processing capabilities
- `multer: ^1.4.5-lts.1` - File upload middleware for handling IDML packages

**Development Dependencies:**

- `typescript: ^5.0.0` - Type safety and enhanced development experience
- `eslint: ^8.0.0` - Code linting and quality assurance
- `@types/*` - TypeScript type definitions for Node.js, React, and React DOM

### Project Structure

```
IDML/
├── lib/                          # Core processing logic
│   ├── components/               # Reusable components
│   ├── extractors/              # File extraction utilities
│   ├── parsers/                 # XML and content parsers
│   ├── processors/              # Image and data processors
│   ├── utils/                   # Utility functions
│   └── viewer/                  # Frontend viewer components
├── pages/                       # Next.js pages and API routes
│   ├── api/                     # Backend API endpoints
│   ├── view/                    # Document viewer pages

├── uploads/                     # Uploaded file storage
└── public/                      # Static assets
```

## Usage

### Basic Usage

1. **Upload IDML Package**

   - Navigate to the application
   - Select the folder containing your IDML file and assets
   - Click "Upload and Process IDML"

2. **View Document**

   - Wait for processing to complete
   - Navigate through pages using tabs
   - View thumbnails for page previews

3. **Interact with Content**
   - Zoom and pan through document
   - Inspect individual elements
   - Access extracted images and resources

### Advanced Usage

```javascript
// Programmatic document loading
const response = await fetch("/api/document/uploadId");
const documentData = await response.json();

// Access specific page content
const pageElements = documentData.elementsByPage["pageId"];
const pageStories = documentData.stories;
const pageStyles = documentData.styles;
```

## Implementation Strategy

### Custom Parser Architecture

Unlike other IDML viewers that rely on third-party services or libraries, this project implements a complete custom parsing solution. Every aspect of the IDML processing is handled by our proprietary parsers:

#### 1. **Core Processing Layer**

- `IDMLProcessor`: Main orchestrator that coordinates all parsing operations
- `XMLParser`: Custom XML parser built on fast-xml-parser for IDML-specific requirements
- `FileExtractor`: Handles ZIP extraction and file management

#### 2. **Content Parsing Layer**

- `DocumentParser`: Extracts document-level information and metadata
- `ElementParser`: Processes individual design elements (TextFrames, Rectangles, etc.)
- `StoryParser`: Handles text content, typography, and character encoding
- `StyleParser`: Manages paragraph and character-level styling

#### 3. **Resource Processing Layer**

- `ImageProcessor`: Handles image extraction, linking, and optimization
- `NextFontMapper`: Converts InDesign fonts to web-compatible alternatives
- `UnitConverter`: Converts measurement units (picas, points, mm, inches to pixels)

#### 4. **Data Management Layer**

- `DataModularizer`: Splits large documents into manageable JSON modules
- `IDMLUtils`: Common utility functions for IDML processing

#### 5. **Frontend Layer**

- `Viewer Components`: React components for document display
- `Hooks`: Custom React hooks for state management
- `Rendering Engine`: Page and element rendering logic

### Data Flow Strategy

flow chart here

### Performance Optimization

- **Lazy Loading**: Pages and images loaded on demand
- **Modular Data**: Large documents split into manageable chunks
- **Caching**: Processed data cached for faster subsequent loads
- **Image Optimization**: Web-optimized image formats and sizes
- **Memory Management**: Efficient data structures and cleanup

## API Documentation

### Upload API

**Endpoint**: `POST /api/upload`

**Purpose**: Upload and process IDML documents

**Request**:

```javascript
const formData = new FormData();
formData.append("files", file);

const response = await fetch("/api/upload", {
  method: "POST",
  body: formData,
});
```

**Response**:

```json
{
  "success": true,
  "uploadId": "1754046132088",
  "message": "Document processed successfully"
}
```

### Document API

**Endpoint**: `GET /api/document/[uploadId]`

**Purpose**: Retrieve processed document data

**Response**:

```json
{
  "document": {
    "version": "7.0",
    "pageCount": 3,
    "name": "Sample Document"
  },
  "elements": [...],
  "stories": {...},
  "styles": {...},
  "resources": {...},
  "elementsByPage": {...}
}
```

### Image API

**Endpoint**: `GET /api/image/[uploadId]/[...params]`

**Purpose**: Serve extracted images

**Parameters**:

- `uploadId`: Document upload identifier
- `params`: Image path and filename

**Response**: Image file (PNG, JPG, etc.)

## Development Process

### Evolution from MVP to Production

The project evolved through several development phases:

#### Phase 1: Basic Parsing (MVP)

- Simple XML parsing with custom logic
- Basic text extraction
- Single-page support
- Monolithic codebase (~4000 lines)

#### Phase 2: Modularization

- Split into focused modules
- Separated concerns (parsing, processing, rendering)
- Improved maintainability
- Reduced code complexity

#### Phase 3: Feature Enhancement

- Multi-page support
- Advanced typography
- Image processing
- Style preservation

#### Phase 4: Performance Optimization

- Modular data storage
- Lazy loading
- Caching strategies
- Memory optimization

#### Phase 5: User Experience

- Interactive viewer
- Thumbnail previews
- Error handling
- Responsive design

## Code Snippets

### 1. Core IDML Processing

The main processor orchestrates the entire document parsing workflow:

```javascript
// IDMLProcessor.js - Main processing orchestration
class IDMLProcessor {
  async processIDML(filePath) {
    const uploadId = path.basename(filePath, ".idml");

    // Extract ZIP contents using our custom extractor
    const extractedData = await this.fileExtractor.extractIDMLContents(
      filePath
    );

    // Parse main structure with our custom XML parser
    await this.parseDocumentStructure(extractedData);

    // Extract detailed information from all components
    await this.extractDetailedInformation();

    // Associate elements with pages for rendering
    await this.associateElementsWithPages();

    return this.getComprehensiveData();
  }
}
```

This code demonstrates how our custom processor handles the complete IDML parsing pipeline, from ZIP extraction to final data organization.

### 2. Text Rendering with Typography

Our text rendering system preserves complex typography from InDesign:

```javascript
// textRendering.js - Advanced text formatting
export function renderFormattedText(textFrame, stories, styles) {
  const story = stories[textFrame.parentStory];
  const paragraphStyle = styles.paragraph[story.paragraphStyle];

  return {
    content: story.content,
    formatting: {
      fontFamily: paragraphStyle.fontFamily,
      fontSize: paragraphStyle.fontSize,
      fontWeight: paragraphStyle.fontWeight,
      lineHeight: paragraphStyle.leading,
      textAlign: paragraphStyle.justification,
      color: paragraphStyle.fillColor,
    },
    positioning: {
      x: textFrame.geometricBounds[0],
      y: textFrame.geometricBounds[1],
      width: textFrame.geometricBounds[2] - textFrame.geometricBounds[0],
      height: textFrame.geometricBounds[3] - textFrame.geometricBounds[1],
    },
  };
}
```

This snippet shows how we extract and preserve complex typography settings including font families, sizes, weights, line heights, and positioning from the original InDesign document.

### 3. Image Processing and Linking

Our image processor handles both embedded and linked images:

```javascript
// ImageProcessor.js - Image extraction and linking
class ImageProcessor {
  async processLinkedResources(elements, extractedImages) {
    const imageMap = this.buildImageMap(extractedImages);

    elements.forEach((element) => {
      if (this.hasImageReference(element)) {
        const linkedImage = this.linkElementToImage(element, imageMap);
        if (linkedImage) {
          element.linkedImage = {
            url: `/api/image/${uploadId}/ExtractedImages/${linkedImage.fileName}`,
            fileName: linkedImage.fileName,
            type: linkedImage.type,
          };
        }
      }
    });
  }
}
```

This code demonstrates how we dynamically link design elements to their corresponding images, creating a seamless connection between the layout and visual assets.

### 4. Page Rendering with Thumbnails

Our page renderer creates accurate previews of document pages:

```javascript
// pageRenderer.js - Page and thumbnail rendering
export function renderPagePreview(pageId, documentData, scale = 0.2) {
  const pageElements = getElementsForPage(pageId, documentData);
  const pageInfo = documentData.pageInfo;

  return (
    <div className="page-preview" style={{ transform: `scale(${scale})` }}>
      {pageElements.map((element) => {
        if (element.type === "TextFrame") {
          return renderTextElement(element, documentData);
        } else if (element.linkedImage) {
          return renderImageElement(element);
        } else if (element.type === "Rectangle") {
          return renderShapeElement(element, documentData);
        }
      })}
    </div>
  );
}
```

This snippet shows how we dynamically render different element types (text, images, shapes) to create accurate page previews that maintain the original design layout.

### 5. Dynamic List Formatting

Our list processor handles complex bullet and numbering formats:

```javascript
// textFormatting.js - Dynamic list processing
export function applyListFormatting(text, listStyle) {
  const lines = text.split("\n");

  if (listStyle.numberingFormat) {
    // Numbered list with custom formatting
    return lines
      .filter((line) => line.trim())
      .map((line, index) => `${index + 1}. ${line}`)
      .join("\n");
  } else if (listStyle.bulletChar) {
    // Bulleted list with custom characters
    return lines
      .filter((line) => line.trim())
      .map((line) => `${listStyle.bulletChar} ${line}`)
      .join("\n");
  }

  return text;
}
```

This code demonstrates how we dynamically process list formatting, applying custom bullet characters and numbering formats extracted directly from the InDesign document.

## Technical Details

### IDML Structure Understanding

IDML files are ZIP archives containing XML files:

```
document.idml
├── designmap.xml          # Document structure
├── Resources/             # Images, fonts, etc.
│   ├── Fonts/
│   ├── Graphic.xml
│   └── Images/
├── Stories/               # Text content
│   └── Story_*.xml
├── Spreads/               # Page layouts
│   └── Spread_*.xml
└── Styles/                # Styling definitions
    ├── CharacterStyles.xml
    └── ParagraphStyles.xml
```

### Custom Data Processing Pipeline

1. **XML Parsing**: Our custom XML parser handles IDML-specific structures
2. **Element Extraction**: Hierarchical element processing with dynamic categorization
3. **Style Resolution**: Cascading style application with custom logic
4. **Text Processing**: Unicode and typography handling with font mapping
5. **Image Processing**: Format conversion and optimization
6. **Unit Conversion**: Measurement system normalization (picas, points, mm, inches to pixels)
7. **Font Mapping**: Web-compatible font substitution

### Performance Considerations

- **Memory Management**: Efficient data structures for large documents
- **Caching Strategy**: Processed data caching for repeated access
- **Lazy Loading**: On-demand page and resource loading
- **Image Optimization**: Web-optimized formats and sizes
- **Code Splitting**: Modular loading for better performance

### Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **ES6+ Features**: Arrow functions, destructuring, async/await
- **CSS Grid/Flexbox**: Modern layout techniques
- **Canvas API**: For complex rendering operations
- **File API**: For drag-and-drop uploads

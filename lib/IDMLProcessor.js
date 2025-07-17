// Core modules
const IDMLXMLParser = require('./parsers/XMLParser');
const FileExtractor = require('./extractors/FileExtractor');
const StyleParser = require('./parsers/StyleParser');
const StoryParser = require('./parsers/StoryParser');
const ElementParser = require('./parsers/ElementParser');
const DocumentParser = require('./parsers/DocumentParser');
const ImageProcessor = require('./processors/ImageProcessor');
const DebugAnalyzer = require('./debug/DebugAnalyzer');
const IDMLUtils = require('./utils/IDMLUtils');

const path = require('path');

class IDMLProcessor {
  constructor() {
    // Initialize all modules
    this.xmlParser = new IDMLXMLParser();
    this.fileExtractor = new FileExtractor();
    this.styleParser = new StyleParser();
    this.elementParser = new ElementParser();
    this.storyParser = new StoryParser(this.styleParser);
    this.documentParser = new DocumentParser(this.elementParser);
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
      cell: {}
    };
  }

  async processIDML(filePath) {
    console.log('Processing IDML file:', filePath);
    
    try {
      // Extract ZIP contents
      const extractedData = await this.fileExtractor.extractIDMLContents(filePath);
      console.log(`Extracted ${Object.keys(extractedData).length} files from IDML`);
      
      // Parse main structure
      await this.parseDocumentStructure(extractedData);
      
      // Extract detailed information
      await this.extractDetailedInformation();
      
      // Return the correct structure
      const documentData = {
        document: {
          version: this.document?.['@_DOMVersion'] || 'Unknown',
          pageCount: Math.max(1, this.elements.length > 0 ? 1 : 0),
          name: this.document?.['@_Name'] || 'Untitled'
        },
        
        pageInfo: {
          dimensions: this.pageInfo.dimensions,
          margins: this.pageInfo.margins
        },
        
        elements: this.elements.map(element => ({
          id: element.self,
          type: element.type,
          name: element.name,
          position: element.position,
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
          placedContent: element.placedContent || null
        })),

        stories: Object.keys(this.stories).reduce((acc, storyId) => {
          const story = this.stories[storyId];
          if (story?.content?.plainText) {
            acc[storyId] = {
              text: story.content.plainText,
              wordCount: story.content.wordCount,
              characterCount: story.content.characterCount,
              textColor: story.content.textColor,
              hasLineBreaks: story.content.lineBreakInfo?.hasLineBreaks || false,
              lineBreakCount: story.content.lineBreakInfo?.lineBreakCount || 0,
              
              // Include resolved styling information
              styling: this.styleParser.getStoryStyleSummary(story),
              
              // Include formatted content with resolved formatting
              formattedContent: story.content.formattedContent || []
            };
          }
          return acc;
        }, {}),
        
        debug22: {
          measurementUnits: this.documentInfo.preferences?.viewPreferences?.horizontalMeasurementUnits,
          coordinateOffset: this.calculateCoordinateOffset(),
          contentFramesCount: this.elements.filter(el => el.isContentFrame).length,
          imagesLinkedCount: this.elements.filter(el => el.linkedImage && !el.linkedImage.isEmbedded).length,
          embeddedImagesCount: this.elements.filter(el => el.linkedImage && el.linkedImage.isEmbedded).length
        }
      };

      await this.addComprehensiveTextFormattingDebug();
      
      console.log('✅ IDML processing completed. Elements:', documentData.elements.length);
      
      return documentData;
      
    } catch (error) {
      console.error('Error processing IDML:', error);
      throw error;
    }
  }

  async parseDocumentStructure(extractedData) {
    console.log('Parsing document structure...');
    
    // Parse Resources
    console.log('\n📋 === PARSING RESOURCES ===');
    for (const [fileName, content] of Object.entries(extractedData)) {
      if (fileName.startsWith('Resources/')) {
        console.log('🔍 Processing resource:', fileName);
        await this.styleParser.parseResourceFile(fileName, content, this.xmlParser);
      }
    }
    
    // Parse document structure (spreads, master spreads)
    await this.documentParser.parseDocumentStructure(extractedData, this.xmlParser);
    
    // Parse Stories
    console.log('\n📝 === PARSING STORIES ===');
    let storyCount = 0;
    for (const [fileName, content] of Object.entries(extractedData)) {
      if (fileName.startsWith('Stories/')) {
        console.log('🔍 Found story file:', fileName);
        console.log('   Content length:', content.length);
        console.log('   Content preview:', content.substring(0, 200));
        storyCount++;
        await this.storyParser.parseStoryFile(fileName, content, this.xmlParser);
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
    console.log('Extracting detailed information with enhanced processing...');
    
    await this.documentParser.extractDetailedInformation();
    this.pageInfo = this.documentParser.getPageInfo();
    
    console.log('✅ Enhanced detailed information extracted');
  }

  calculateCoordinateOffset() {
    return this.documentParser.calculateCoordinateOffset();
  }

  async addComprehensiveTextFormattingDebug() {
    return await this.debugAnalyzer.addComprehensiveTextFormattingDebug(this);
  }

  // Package processing methods
  async processIDMLPackage(idmlFilePath, packageStructure, extractedImages = []) {
    console.log('Processing IDML package:', idmlFilePath);
    
    try {
      // Process the IDML file first
      const documentData = await this.processIDML(idmlFilePath);
      
      // Process linked images and update elements
      await this.imageProcessor.processLinkedResources(documentData, packageStructure, extractedImages);
      
      // Add package info
      documentData.packageInfo = {
        hasLinks: packageStructure.resourceMap?.size > 1,
        hasFonts: false,
        linksCount: Array.from(packageStructure.resourceMap?.keys() || [])
          .filter(name => IDMLUtils.isImageFile(name)).length,
        fontsCount: 0,
        extractedImagesCount: extractedImages.length
      };
      
      return documentData;
      
    } catch (error) {
      console.error('Error processing IDML package:', error);
      throw error;
    }
  }

  // Image processing methods
  async extractAndSaveEmbeddedImages(idmlPath, uploadDir) {
    return await this.fileExtractor.extractAndSaveEmbeddedImages(idmlPath, uploadDir);
  }

  async extractEmbeddedImageFromSpread(idmlPath, uploadDir) {
    return await this.imageProcessor.extractEmbeddedImageFromSpread(idmlPath, uploadDir, this.xmlParser);
  }

  // Debug methods
  async debugIDMLContents(idmlPath) {
    return await this.fileExtractor.debugIDMLContents(idmlPath);
  }

  async debugIDMLContentsDetailed(idmlPath) {
    return await this.fileExtractor.debugIDMLContentsDetailed(idmlPath);
  }

  async analyzeSpreadForImageReferences(idmlPath) {
    return await this.imageProcessor.analyzeSpreadForImageReferences(idmlPath, this.xmlParser);
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
}

module.exports = IDMLProcessor;
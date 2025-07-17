const path = require('path');
const IDMLUtils = require('../utils/IDMLUtils');

class DocumentParser {
  constructor(elementParser) {
    this.elementParser = elementParser;
    this.document = null;
    this.spreads = {};
    this.masterSpreads = {};
    this.documentInfo = {};
    this.pageInfo = {};
    this.layers = [];
  }

  async parseDocumentStructure(extractedData, xmlParser) {
    console.log('Parsing document structure...');
    console.log('🔍 Total files to process:', Object.keys(extractedData).length);
    
    // Parse designmap.xml first (main document structure)
    if (extractedData['designmap.xml']) {
      console.log('Parsing designmap.xml...');
      try {
        const designMapData = xmlParser.parse(extractedData['designmap.xml']);
        this.document = designMapData.Document || designMapData;
        await this.extractDocumentInfo(this.document);
        console.log('✅ DesignMap parsed successfully');
      } catch (error) {
        console.error('Error parsing designmap.xml:', error);
      }
    }
    
    // Parse Spreads
    console.log('\n📄 === PARSING SPREADS ===');
    for (const [fileName, content] of Object.entries(extractedData)) {
      if (fileName.startsWith('Spreads/')) {
        console.log('🔍 Processing spread:', fileName);
        await this.parseSpreadFile(fileName, content, xmlParser);
      }
    }
    
    // Parse Master Spreads
    console.log('\n🎨 === PARSING MASTER SPREADS ===');
    for (const [fileName, content] of Object.entries(extractedData)) {
      if (fileName.startsWith('MasterSpreads/')) {
        console.log('🔍 Processing master spread:', fileName);
        await this.parseMasterSpreadFile(fileName, content, xmlParser);
      }
    }
  }

  async extractDocumentInfo(document) {
    console.log('Extracting document information...');
    
    if (!document) return;
    
    // Extract document preferences and page setup
    this.documentInfo = {
      version: document['@_DOMVersion'] || 'Unknown',
      self: document['@_Self'] || 'Unknown',
      activeLayer: document['@_ActiveLayer'] || null,
      unusedSwatches: document['@_UnusedSwatches'] || [],
      
      // Document preferences
      documentPreferences: this.extractDocumentPreferences(document),
      
      // Page setup
      pageSetup: this.extractPageSetup(document),
      
      // Layers
      layers: this.extractLayers(document),
      
      // Pages
      pages: this.extractPages(document)
    };
    
    console.log('✅ Document info extracted');
  }

  extractDocumentPreferences(document) {
    const prefs = {};
    
    if (document.DocumentPreference) {
      const pref = document.DocumentPreference;
      prefs.pageWidth = pref['@_PageWidth'] || 0;
      prefs.pageHeight = pref['@_PageHeight'] || 0;
      prefs.left = pref['@_Left'] || 0;
      prefs.top = pref['@_Top'] || 0;
      prefs.right = pref['@_Right'] || 0;
      prefs.bottom = pref['@_Bottom'] || 0;
      prefs.columnCount = pref['@_ColumnCount'] || 1;
      prefs.columnGutter = pref['@_ColumnGutter'] || 0;
      prefs.facingPages = pref['@_FacingPages'] || false;
    }
    
    return prefs;
  }

  extractPageSetup(document) {
    const pageSetup = {
      pages: [],
      masterPages: [],
      spreads: []
    };
    
    // Extract page information from document
    if (document.Page) {
      const pages = Array.isArray(document.Page) ? document.Page : [document.Page];
      
      pages.forEach(page => {
        pageSetup.pages.push({
          self: page['@_Self'],
          name: page['@_Name'] || '',
          appliedMaster: page['@_AppliedMaster'] || '',
          geometricBounds: IDMLUtils.parseGeometricBounds(page['@_GeometricBounds']),
          itemTransform: IDMLUtils.parseTransform(page['@_ItemTransform']),
          overrideList: page['@_OverrideList'] || []
        });
      });
    }
    
    return pageSetup;
  }

  extractLayers(document) {
    const layers = [];
    
    if (document.Layer) {
      const layerData = Array.isArray(document.Layer) ? document.Layer : [document.Layer];
      
      layerData.forEach(layer => {
        layers.push({
          self: layer['@_Self'],
          name: layer['@_Name'] || '',
          visible: layer['@_Visible'] !== false,
          locked: layer['@_Locked'] === true,
          ignoreWrap: layer['@_IgnoreWrap'] === true,
          showGuides: layer['@_ShowGuides'] !== false,
          lockGuides: layer['@_LockGuides'] === true,
          ui: layer['@_UI'] || '',
          layerColor: layer['@_LayerColor'] || 'LightBlue'
        });
      });
    }
    
    this.layers = layers;
    return layers;
  }

  extractPages(document) {
    const pages = [];
    
    if (document.Spread) {
      const spreads = Array.isArray(document.Spread) ? document.Spread : [document.Spread];
      
      spreads.forEach(spread => {
        if (spread.Page) {
          const spreadPages = Array.isArray(spread.Page) ? spread.Page : [spread.Page];
          spreadPages.forEach(page => {
            pages.push({
              self: page['@_Self'],
              name: page['@_Name'] || '',
              appliedMaster: page['@_AppliedMaster'] || '',
              geometricBounds: IDMLUtils.parseGeometricBounds(page['@_GeometricBounds']),
              itemTransform: IDMLUtils.parseTransform(page['@_ItemTransform']),
              spreadParent: spread['@_Self']
            });
          });
        }
      });
    }
    
    return pages;
  }

  async parseSpreadFile(fileName, content, xmlParser) {
    console.log(`📄 Parsing spread: ${fileName}`);
    
    try {
      const parsed = xmlParser.parse(content);
      const spreadId = path.basename(fileName, '.xml');
      
      const spreadData = parsed.Spread?.Spread || parsed.Spread || parsed;

      if (parsed.Spread) {
        console.log('Spread wrapper keys:', Object.keys(parsed.Spread));
        if (parsed.Spread.Spread) {
          console.log('Actual spread keys:', Object.keys(parsed.Spread.Spread));
        }
      }

      if (spreadData.Page) {
        const pages = Array.isArray(spreadData.Page) ? spreadData.Page : [spreadData.Page];
        console.log(`Found ${pages.length} pages in spread`);
        pages.forEach((page, index) => {
          console.log(`Page ${index} keys:`, Object.keys(page));
          
          // Look for elements in the page
          Object.keys(page).forEach(key => {
            if (key !== '@_Self' && key !== '@_Name' && key !== '@_GeometricBounds' && key !== '@_ItemTransform' && key !== '@_AppliedMaster') {
              const value = page[key];
              if (Array.isArray(value)) {
                console.log(`  Found array ${key} with ${value.length} items`);
              } else if (typeof value === 'object') {
                console.log(`  Found object ${key}:`, Object.keys(value));
              }
            }
          });
        });
      } else {
        console.log('No Page property found in spread');
      }

      // Check for direct elements in spread
      Object.keys(spreadData).forEach(key => {
        if (key.includes('Frame') || key.includes('Rectangle') || key.includes('Text') || key.includes('Group') || key.includes('Oval')) {
          console.log(`Found potential elements directly in spread: ${key}`, Array.isArray(spreadData[key]) ? spreadData[key].length : 'single');
        }
      });
      
      // Extract detailed spread information
      const detailedSpread = {
        self: spreadData['@_Self'],
        flattenerOverride: spreadData['@_FlattenerOverride'] || '',
        bindingLocation: parseFloat(spreadData['@_BindingLocation']) || 0,
        allowPageShuffle: spreadData['@_AllowPageShuffle'] !== false,
        
        // Extract page elements
        pages: this.elementParser.extractSpreadPages(spreadData),
        
        // Extract all page items (text frames, rectangles, etc.)
        pageItems: this.elementParser.extractPageItems(spreadData)
      };
      
      this.spreads[spreadId] = detailedSpread;
      console.log(`✅ Spread ${spreadId} parsed with ${detailedSpread.pageItems.length} items`);
      
    } catch (error) {
      console.error(`❌ Error parsing spread ${fileName}:`, error.message);
    }
  }

  async parseMasterSpreadFile(fileName, content, xmlParser) {
    console.log(`🎨 Parsing master spread: ${fileName}`);
    
    try {
      const parsed = xmlParser.parse(content);
      const masterId = path.basename(fileName, '.xml');
      
      const masterData = parsed.MasterSpread?.MasterSpread || parsed.MasterSpread || parsed;

      console.log('Parsed master spread keys:', Object.keys(parsed));
      if (parsed.MasterSpread) {
        console.log('MasterSpread wrapper keys:', Object.keys(parsed.MasterSpread));
        if (parsed.MasterSpread.MasterSpread) {
          console.log('Actual master spread keys:', Object.keys(parsed.MasterSpread.MasterSpread));
        }
      }     
      
      // Extract detailed master spread information
      const detailedMaster = {
        self: masterData['@_Self'],
        name: masterData['@_Name'] || '',
        namePrefix: masterData['@_NamePrefix'] || '',
        basedOn: masterData['@_BasedOn'] || '',
        itemTransform: IDMLUtils.parseTransform(masterData['@_ItemTransform']),
        
        // Extract master pages
        pages: this.elementParser.extractMasterPages(masterData),
        
        // Extract master page items
        pageItems: this.elementParser.extractPageItems(masterData)
      };
      
      this.masterSpreads[masterId] = detailedMaster;
      console.log(`✅ Master spread ${masterId} parsed with ${detailedMaster.pageItems.length} items`);
      
    } catch (error) {
      console.error(`❌ Error parsing master spread ${fileName}:`, error.message);
    }
  }

  async extractDetailedInformation() {
    console.log('Extracting detailed information with enhanced processing...');
    
    this.pageInfo = {
      dimensions: this.calculatePageDimensions(),
      margins: this.calculateMargins(),
      bleeds: this.calculateBleeds(),
      guides: this.extractGuides(),
      grids: this.extractGrids()
    };
    
    this.elementParser.createElementPositionMapFixed(); // Use the fixed version
    
    console.log('✅ Enhanced detailed information extracted');
  }

  calculatePageDimensions() {
    const docPrefs = this.documentInfo.preferences?.documentPreferences || {};
    
    return {
      width: docPrefs.pageWidth || 0,
      height: docPrefs.pageHeight || 0,
      facingPages: docPrefs.facingPages || false,
      units: this.documentInfo.preferences?.viewPreferences?.horizontalMeasurementUnits || 'Points'
    };
  }

  calculateMargins() {
    const marginPrefs = this.documentInfo.preferences?.marginPreferences || {};
    
    return {
      top: marginPrefs.top || 0,
      bottom: marginPrefs.bottom || 0,
      left: marginPrefs.left || 0,
      right: marginPrefs.right || 0,
      columnCount: marginPrefs.columnCount || 1,
      columnGutter: marginPrefs.columnGutter || 0
    };
  }

  calculateBleeds() {
    const docPrefs = this.documentInfo.preferences?.documentPreferences || {};
    
    return {
      top: docPrefs.documentBleedTopOffset || 0,
      bottom: docPrefs.documentBleedBottomOffset || 0,
      inside: docPrefs.documentBleedInsideOrLeftOffset || 0,
      outside: docPrefs.documentBleedOutsideOrRightOffset || 0
    };
  }

  extractGuides() {
    const guides = [];
    
    // Extract guides from spreads
    Object.values(this.spreads).forEach(spread => {
      if (spread.pageItems) {
        spread.pageItems.forEach(item => {
          if (item.type === 'Guide') {
            guides.push({
              orientation: item.orientation || 'Horizontal',
              location: item.location || 0,
              fitToPage: item.fitToPage || false,
              viewThreshold: item.viewThreshold || 0
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
        snapTo: gridPrefs.baselineSnapto || false
      },
      document: {
        shown: gridPrefs.documentGridShown || false,
        snapTo: gridPrefs.documentGridSnapto || false
      }
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

  calculateCoordinateOffset() {
    return IDMLUtils.calculateCoordinateOffset(this.elementParser.getElements());
  }
}

module.exports = DocumentParser; 
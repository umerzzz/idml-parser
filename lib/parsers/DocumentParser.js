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
    console.log('📋 Extracting document preferences...');
    console.log('Document keys:', Object.keys(document));
    
    const prefs = {};
    
    // Try multiple possible locations for document preferences
    let docPref = null;
    
    if (document.DocumentPreference) {
      docPref = document.DocumentPreference;
      console.log('Found DocumentPreference');
    } else if (document.documentPreference) {
      docPref = document.documentPreference;
      console.log('Found documentPreference (lowercase)');
    } else if (document.Properties && document.Properties.DocumentPreference) {
      docPref = document.Properties.DocumentPreference;
      console.log('Found DocumentPreference in Properties');
    }
    
    if (docPref) {
      console.log('DocumentPreference keys:', Object.keys(docPref));
      prefs.pageWidth = parseFloat(docPref['@_PageWidth']) || 0;
      prefs.pageHeight = parseFloat(docPref['@_PageHeight']) || 0;
      prefs.left = parseFloat(docPref['@_Left']) || 0;
      prefs.top = parseFloat(docPref['@_Top']) || 0;
      prefs.right = parseFloat(docPref['@_Right']) || 0;
      prefs.bottom = parseFloat(docPref['@_Bottom']) || 0;
      prefs.columnCount = parseInt(docPref['@_ColumnCount']) || 1;
      prefs.columnGutter = parseFloat(docPref['@_ColumnGutter']) || 0;
      prefs.facingPages = docPref['@_FacingPages'] === 'true' || docPref['@_FacingPages'] === true;
      
      console.log('📋 Extracted document preferences:', prefs);
    } else {
      console.log('⚠️ No DocumentPreference found in document');
    }
    
    // Also try to extract margin preferences
    let marginPref = null;
    if (document.MarginPreference) {
      marginPref = document.MarginPreference;
      console.log('Found MarginPreference');
    } else if (document.marginPreference) {
      marginPref = document.marginPreference;
      console.log('Found marginPreference (lowercase)');
    } else if (document.Properties && document.Properties.MarginPreference) {
      marginPref = document.Properties.MarginPreference;
      console.log('Found MarginPreference in Properties');
    }
    
    if (marginPref) {
      console.log('MarginPreference keys:', Object.keys(marginPref));
      prefs.marginTop = parseFloat(marginPref['@_Top']) || 0;
      prefs.marginBottom = parseFloat(marginPref['@_Bottom']) || 0;
      prefs.marginLeft = parseFloat(marginPref['@_Left']) || 0;
      prefs.marginRight = parseFloat(marginPref['@_Right']) || 0;
      prefs.marginColumnCount = parseInt(marginPref['@_ColumnCount']) || 1;
      prefs.marginColumnGutter = parseFloat(marginPref['@_ColumnGutter']) || 0;
      
      console.log('📏 Extracted margin preferences:', {
        top: prefs.marginTop,
        bottom: prefs.marginBottom,
        left: prefs.marginLeft,
        right: prefs.marginRight,
        columnCount: prefs.marginColumnCount,
        columnGutter: prefs.marginColumnGutter
      });
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
    // Try to get dimensions from spreads first (most reliable)
    if (this.spreads && Object.keys(this.spreads).length > 0) {
      const firstSpread = Object.values(this.spreads)[0];
      if (firstSpread.pages && firstSpread.pages.length > 0) {
        const firstPage = firstSpread.pages[0];
        if (firstPage.geometricBounds) {
          const bounds = firstPage.geometricBounds;
          return {
            width: bounds.width || bounds.right - bounds.left || 0,
            height: bounds.height || bounds.bottom - bounds.top || 0,
            facingPages: Object.values(this.spreads).some(spread => spread.pages && spread.pages.length > 1),
            units: 'Points'
          };
        }
      }
    }
    
    // Fallback to document preferences
    const docPrefs = this.documentInfo.preferences?.documentPreferences || {};
    
    return {
      width: docPrefs.pageWidth || 0,
      height: docPrefs.pageHeight || 0,
      facingPages: docPrefs.facingPages || false,
      units: this.documentInfo.preferences?.viewPreferences?.horizontalMeasurementUnits || 'Points'
    };
  }

  calculateMargins() {
    console.log('📏 Calculating margins from multiple sources...');
    
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
            columnGutter: firstMasterPage.marginPreference.columnGutter || 0
          };
          
          console.log('📏 Found margins from master page:', masterMargins);
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
      bottom: marginPrefs.bottom || docPrefs.marginBottom || docPrefs.bottom || 0,
      left: marginPrefs.left || docPrefs.marginLeft || docPrefs.left || 0,
      right: marginPrefs.right || docPrefs.marginRight || docPrefs.right || 0,
      columnCount: marginPrefs.columnCount || docPrefs.marginColumnCount || docPrefs.columnCount || 1,
      columnGutter: marginPrefs.columnGutter || docPrefs.marginColumnGutter || docPrefs.columnGutter || 0
    };
    
    console.log('📏 Calculated margins (fallback):', margins);
    return margins;
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

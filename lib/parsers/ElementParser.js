const path = require('path');
const IDMLUtils = require('../utils/IDMLUtils');

class ElementParser {
  constructor() {
    this.elements = [];
  }

  extractSpreadPages(spreadData) {
    const pages = [];
   
    if (spreadData.Page) {
      const pageList = Array.isArray(spreadData.Page) ? spreadData.Page : [spreadData.Page];
      
      pageList.forEach((page, index) => {
        pages.push({
          self: page['@_Self'],
          name: page['@_Name'] || '',
          appliedMaster: page['@_AppliedMaster'] || '',
          geometricBounds: IDMLUtils.parseGeometricBounds(page['@_GeometricBounds']),
          itemTransform: IDMLUtils.parseTransform(page['@_ItemTransform'])
        });
      });
    } else {
      console.log('No pages found in spread data');
    }
    
    console.log(`Extracted ${pages.length} pages`);
    return pages;
  }

  extractPageItems(spreadData) {
    const pageItems = [];
   
    // Extract different types of page items
    const itemTypes = [
      'Rectangle', 'Oval', 'Polygon', 'GraphicLine', 
      'TextFrame', 'Group', 'Button', 'Table',
      'Image', 'EPS', 'PDF', 'PlacedItem', 'ContentFrame'  // Add these
    ];
    
    itemTypes.forEach(itemType => {
      if (spreadData[itemType]) {
        const items = Array.isArray(spreadData[itemType]) ? spreadData[itemType] : [spreadData[itemType]];
        
        items.forEach(item => {
          console.log(`Processing ${itemType}:`, item['@_Self']);
          const pageItem = this.parsePageItem(item, itemType);
          if (pageItem) {
            pageItems.push(pageItem);
            this.elements.push(pageItem);
          }
        });
      }
    });

    this.checkForNestedContent(spreadData, pageItems);
    
    // ALSO CHECK FOR NESTED ITEMS IN PAGES
    if (spreadData.Page) {
      const pages = Array.isArray(spreadData.Page) ? spreadData.Page : [spreadData.Page];
      pages.forEach(page => {
      
        itemTypes.forEach(itemType => {
          if (page[itemType]) {
            console.log(`Found ${itemType} in page:`, Array.isArray(page[itemType]) ? page[itemType].length : 1);
            const items = Array.isArray(page[itemType]) ? page[itemType] : [page[itemType]];
            
            items.forEach(item => {
              const pageItem = this.parsePageItem(item, itemType);
              if (pageItem) {
                pageItems.push(pageItem);
                this.elements.push(pageItem);
              }
            });
          }
        });
      });
    }
    
    console.log(`Total page items extracted: ${pageItems.length}`);
    return pageItems;
  }

  checkForNestedContent(spreadData, pageItems) {
    console.log('🔍 Checking for nested content in elements...');
    
    // Check rectangles for placed images
    if (spreadData.Rectangle) {
      const rectangles = Array.isArray(spreadData.Rectangle) ? spreadData.Rectangle : [spreadData.Rectangle];
      
      rectangles.forEach(rect => {
        
        // Look for ANY content inside rectangle - be more aggressive
        const possibleContent = rect.Image || rect.PlacedImage || rect.EPS || rect.PDF || 
                              rect.Properties?.Image || rect.Properties?.PlacedImage ||
                              rect.Link || rect.Properties?.Link;
         
        if (possibleContent) {
          console.log(`📷 Found placed content in rectangle ${rect['@_Self']}:`, possibleContent);
           
          // Update the rectangle to indicate it's a content frame
          const existingRect = pageItems.find(item => item.self === rect['@_Self']);
          if (existingRect) {
            existingRect.hasPlacedContent = true;
            existingRect.contentType = 'Image';
            
            // Extract placed content details with better handling
            existingRect.placedContent = this.extractPlacedContent(possibleContent);
            
            // IMPORTANT: Calculate the image position within the frame
            existingRect.imagePosition = IDMLUtils.calculateImagePositionInFrame(
              existingRect.geometricBounds,
              existingRect.itemTransform,
              existingRect.placedContent
            );
          }
        }
      });
    }
  }

  extractPlacedContent(content) {
    if (!content) return null;
    
    console.log('🔍 Extracting placed content:', content);
    
    const contentItem = Array.isArray(content) ? content[0] : content;
    
    console.log('Content item keys:', Object.keys(contentItem));
    
    // ENHANCED: Better href handling for embedded images
    let href = contentItem['@_href'] || contentItem['@_ActualPpi'] || '';
    let isEmbedded = false;
    
    // Check if this is an embedded image reference
    if (href && !href.startsWith('file://') && !href.includes('/')) {
      // This looks like an embedded image reference
      isEmbedded = true;
      console.log('🖼️ Detected embedded image reference:', href);
    }
    
    return {
      type: contentItem['@_type'] || 'Image',
      href: href,
      isEmbedded: isEmbedded, // ADD THIS
      bounds: contentItem['@_GeometricBounds'] ? 
        IDMLUtils.parseGeometricBounds(contentItem['@_GeometricBounds']) : 
        null,
      transform: contentItem['@_ItemTransform'] ? 
        IDMLUtils.parseTransform(contentItem['@_ItemTransform']) : 
        null,
      actualPpi: contentItem['@_ActualPpi'],
      effectivePpi: contentItem['@_EffectivePpi'],
      imageTypeName: contentItem['@_ImageTypeName'],
      space: contentItem['@_Space']
    };
  }

  parsePageItem(item, itemType) {
    // ADD: Validation
    if (!item || !item['@_Self']) {
      console.warn(`Invalid ${itemType} item - missing self ID`);
      return null;
    }
    
    const baseItem = {
      type: itemType,
      self: item['@_Self'],
      name: item['@_Name'] || '',
      visible: item['@_Visible'] !== false,
      locked: item['@_Locked'] === true,
      
      geometricBounds: IDMLUtils.calculateBoundsFromPath(item),
      itemTransform: IDMLUtils.parseTransform(item['@_ItemTransform']),
      
      itemLayer: item['@_ItemLayer'] || '',
      fillColor: item['@_FillColor'] || 'Color/None',
      strokeColor: item['@_StrokeColor'] || 'Color/None',
      strokeWeight: parseFloat(item['@_StrokeWeight']) || 0,
      
      parentStory: item['@_ParentStory'] || null,
      
      // ENHANCED: Better content frame detection
      isContentFrame: false,
      hasPlacedContent: false,
      contentType: null
    };
    
    // ADD: Detect content frames more accurately
   // ENHANCED: Better embedded image detection
  if (itemType === 'Rectangle') {
    // Check for embedded images more thoroughly
    const embeddedInfo = this.detectEmbeddedImages(item);
    
    if (embeddedInfo.hasEmbeddedContent || embeddedInfo.isPlaceholder) {
      baseItem.isContentFrame = true;
      baseItem.hasPlacedContent = embeddedInfo.hasEmbeddedContent;
      baseItem.contentType = embeddedInfo.embeddedType || 'placeholder';
      baseItem.isEmbedded = embeddedInfo.hasEmbeddedContent;
      baseItem.isPlaceholder = embeddedInfo.isPlaceholder;
      
      console.log(`📦 Detected ${embeddedInfo.hasEmbeddedContent ? 'embedded' : 'placeholder'} content frame: ${baseItem.self}`);
    }
    
    // Existing content frame detection logic...
    const hasContent = !!(item.Image || item.PlacedImage || item.EPS || item.PDF || 
                         item.Properties?.Image || item.Properties?.PlacedImage);
    
    if (hasContent && !baseItem.isContentFrame) {
      baseItem.isContentFrame = true;
      baseItem.hasPlacedContent = true;
      baseItem.contentType = 'Image';
      
      // Extract placed content transform for positioning
      const placedContent = item.Image || item.PlacedImage || item.EPS || item.PDF;
      if (placedContent) {
        baseItem.placedContent = this.extractPlacedContent(placedContent);
      }
      
      console.log(`📦 Detected external content frame: ${baseItem.self}`);
    }
  }
    
    // Type-specific processing...
    switch (itemType) {
      case 'TextFrame':
        baseItem.textFramePreferences = this.parseTextFramePreferences(item.TextFramePreference);
        break;
      case 'Rectangle':
        baseItem.cornerEffects = this.parseCornerEffects(item);
        break;
      case 'Group':
        baseItem.groupItems = this.extractGroupItems(item);
        break;
    }
    
    return baseItem;
  }

  detectEmbeddedImages(element) {
    const embeddedIndicators = {
      hasEmbeddedContent: false,
      embeddedType: null,
      embeddedData: null,
      embeddedFileName: null, // ADD THIS
      isPlaceholder: false
    };
    
    // Check if element name indicates placeholder
    if (element.name && (
      element.name.includes('[YOUR IMAGE HERE]') ||
      element.name.includes('[IMAGE]') ||
      element.name.toLowerCase().includes('placeholder')
    )) {
      embeddedIndicators.isPlaceholder = true;
      embeddedIndicators.embeddedType = 'placeholder';
    }
    
    // ENHANCED: Check for actual embedded image data
    if (element.placedContent) {
      const content = element.placedContent;
      
      // Check if href looks like an embedded reference
      if (content.href && content.isEmbedded) {
        embeddedIndicators.hasEmbeddedContent = true;
        embeddedIndicators.embeddedType = content.imageTypeName || 'unknown';
        embeddedIndicators.embeddedData = content.href;
        embeddedIndicators.embeddedFileName = `${content.href}.${IDMLUtils.getImageExtension(content.imageTypeName)}`;
      }
    }
    
    return embeddedIndicators;
  }

  parseTextFramePreferences(textFramePreference) {
    if (!textFramePreference) return null;
    
    return {
      textColumnCount: parseInt(textFramePreference['@_TextColumnCount']) || 1,
      textColumnGutter: parseFloat(textFramePreference['@_TextColumnGutter']) || 0,
      firstBaselineOffset: textFramePreference['@_FirstBaselineOffset'] || 'AscentOffset',
      autoSizingReferencePoint: textFramePreference['@_AutoSizingReferencePoint'] || 'CenterPoint',
      autoSizingType: textFramePreference['@_AutoSizingType'] || 'Off',
      verticalJustification: textFramePreference['@_VerticalJustification'] || 'TopAlign',
      
      // ENHANCED: Extract text frame insets for precise positioning
      insetSpacing: {
        top: parseFloat(textFramePreference['@_InsetSpacing']?.split(' ')[0]) || 
             parseFloat(textFramePreference['@_TextInsetTop']) || 0,
        right: parseFloat(textFramePreference['@_InsetSpacing']?.split(' ')[1]) || 
               parseFloat(textFramePreference['@_TextInsetRight']) || 0,
        bottom: parseFloat(textFramePreference['@_InsetSpacing']?.split(' ')[2]) || 
                parseFloat(textFramePreference['@_TextInsetBottom']) || 0,
        left: parseFloat(textFramePreference['@_InsetSpacing']?.split(' ')[3]) || 
              parseFloat(textFramePreference['@_TextInsetLeft']) || 0
      },
      
      // Additional InDesign-specific properties for precise text layout
      useMinimumHeight: textFramePreference['@_UseMinimumHeight'] === true,
      minimumFirstBaselineOffset: parseFloat(textFramePreference['@_MinimumFirstBaselineOffset']) || 0,
      ignoreWrap: textFramePreference['@_IgnoreWrap'] === true
    };
  }

  parseCornerEffects(item) {
    // Parse corner effects for rectangles
    return {
      topLeftCornerRadius: parseFloat(item['@_TopLeftCornerRadius']) || 0,
      topRightCornerRadius: parseFloat(item['@_TopRightCornerRadius']) || 0,
      bottomLeftCornerRadius: parseFloat(item['@_BottomLeftCornerRadius']) || 0,
      bottomRightCornerRadius: parseFloat(item['@_BottomRightCornerRadius']) || 0
    };
  }

  extractGroupItems(groupItem) {
    const groupItems = [];
    
    // Groups can contain other page items
    const itemTypes = ['Rectangle', 'Oval', 'Polygon', 'TextFrame'];
    
    itemTypes.forEach(itemType => {
      if (groupItem[itemType]) {
        const items = Array.isArray(groupItem[itemType]) ? groupItem[itemType] : [groupItem[itemType]];
        
        items.forEach(item => {
          const parsedItem = this.parsePageItem(item, itemType);
          if (parsedItem) {
            groupItems.push(parsedItem);
          }
        });
      }
    });
    
    return groupItems;
  }

  parseTransparency(transparencySettings) {
    if (!transparencySettings) return null;
    
    return {
      blendingSettings: transparencySettings.BlendingSetting ? {
        blendMode: transparencySettings.BlendingSetting['@_BlendMode'] || 'Normal',
        opacity: parseFloat(transparencySettings.BlendingSetting['@_Opacity']) || 100
      } : null
    };
  }

  createElementPositionMapFixed() {
    console.log('Creating FIXED element position map...');
    
    // Calculate coordinate offset to handle negative coordinates
    const coordinateOffset = IDMLUtils.calculateCoordinateOffset(this.elements);
    console.log('Coordinate offset:', coordinateOffset);
    
    this.elements.forEach((element, index) => {
      const bounds = element.geometricBounds || element.originalBounds;
      const transform = element.itemTransform || { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
      
      // CORRECT: Apply transform to bounds, then add offset
      let x = (bounds?.left || 0) + (transform.tx || 0) + coordinateOffset.x;
      let y = (bounds?.top || 0) + (transform.ty || 0) + coordinateOffset.y;
      
      // For the textframe with negative Y, apply special handling
      if (y < 0) {
        y = Math.abs(y); // Convert negative to positive
      }
      
      let width = Math.abs(bounds?.width || 0);
      let height = Math.abs(bounds?.height || 0);
      
      // DETAILED DEBUGGING: Track the exact coordinate calculation
      console.log(`🔍 ELEMENT ${index} [${element.type}] COORDINATE CALCULATION:`);
      console.log(`   📄 Raw bounds:`, bounds);
      console.log(`   🔄 Raw transform:`, transform);
      console.log(`   📐 Step 1 - bounds.left: ${bounds?.left}`);
      console.log(`   📐 Step 2 - bounds.top: ${bounds?.top}`);
      console.log(`   📐 Step 3 - transform.tx: ${transform.tx}`);
      console.log(`   📐 Step 4 - transform.ty: ${transform.ty}`);
      console.log(`   📐 Step 5 - coordinateOffset.x: ${coordinateOffset.x}`);
      console.log(`   📐 Step 6 - coordinateOffset.y: ${coordinateOffset.y}`);
      console.log(`   🧮 CALCULATION: x = ${bounds?.left} + ${transform.tx} + ${coordinateOffset.x} = ${x}`);
      console.log(`   🧮 CALCULATION: y = ${bounds?.top} + ${transform.ty} + ${coordinateOffset.y} = ${y}`);
      
      element.position = {
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
        rotation: IDMLUtils.calculateRotation(transform)
      };
      
      console.log(`   ✅ FINAL POSITION:`, element.position);
    });
  }

  extractMasterPages(masterData) {
    const pages = [];
    
    if (masterData.Page) {
      const pageList = Array.isArray(masterData.Page) ? masterData.Page : [masterData.Page];
      
      pageList.forEach(page => {
        // Extract margin preferences from master page
        let marginPreference = null;
        if (page.MarginPreference) {
          marginPreference = {
            top: parseFloat(page.MarginPreference['@_Top']) || 0,
            bottom: parseFloat(page.MarginPreference['@_Bottom']) || 0,
            left: parseFloat(page.MarginPreference['@_Left']) || 0,
            right: parseFloat(page.MarginPreference['@_Right']) || 0,
            columnCount: parseInt(page.MarginPreference['@_ColumnCount']) || 1,
            columnGutter: parseFloat(page.MarginPreference['@_ColumnGutter']) || 0,
            columnDirection: page.MarginPreference['@_ColumnDirection'] || 'Horizontal',
            columnsPositions: page.MarginPreference['@_ColumnsPositions'] || ''
          };
          console.log('📏 Extracted margin preference from master page:', marginPreference);
        }
        
        pages.push({
          self: page['@_Self'],
          name: page['@_Name'] || '',
          geometricBounds: IDMLUtils.parseGeometricBounds(page['@_GeometricBounds']),
          itemTransform: IDMLUtils.parseTransform(page['@_ItemTransform']),
          appliedMaster: page['@_AppliedMaster'] || '',
          masterPageTransform: IDMLUtils.parseTransform(page['@_MasterPageTransform']),
          marginPreference: marginPreference
        });
      });
    }
    
    return pages;
  }

  getElements() {
    return this.elements;
  }

  clearElements() {
    this.elements = [];
  }

  getElementIndex(element) {
    return this.elements.findIndex(el => el.self === element.self);
  }

  getPageContent(pageId) {
    const pageElements = this.elements.filter(element => {
      // Check if element belongs to this page based on its bounds
      return true; // TODO: Implement proper page boundary checking
    });
    
    return {
      elements: pageElements
    };
  }
}

module.exports = ElementParser; 

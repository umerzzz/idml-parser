const IDMLUtils = require('../utils/IDMLUtils');

class DebugAnalyzer {
  constructor() {
    this.debugData = {};
  }

  async addComprehensiveTextFormattingDebug(processor) {
    console.log('\n🔍 ======= COMPREHENSIVE TEXT FORMATTING DEBUG =======');
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      totalStories: Object.keys(processor.stories || {}).length,
      totalElements: processor.elements ? processor.elements.length : 0,
      styleDefinitions: processor.styleParser ? processor.styleParser.getStyles() : {},
      detailedStoryAnalysis: {},
      spreadElementAnalysis: {},
      resourcesAnalysis: {},
      xmlStructureAnalysis: {},
      formattingAttributeMapping: {},
      missingFormattingReasons: []
    };

    // 1. ANALYZE STORY CONTENT IN EXTREME DETAIL
    console.log('\n📝 === DETAILED STORY CONTENT ANALYSIS ===');
    
    if (processor.storyParser && processor.storyParser.getStories) {
      const stories = processor.storyParser.getStories();
      for (const [storyId, story] of Object.entries(stories)) {
        console.log(`\n--- STORY ${storyId} DEEP DIVE ---`);
        
        debugInfo.detailedStoryAnalysis[storyId] = {
          storyStructure: this.analyzeStoryStructure(story),
          formattingExtraction: this.analyzeFormattingExtraction(story),
          xmlAttributes: this.extractAllXMLAttributes(story),
          nestedElements: this.findNestedFormattingElements(story),
          characterStyleRanges: this.extractCharacterStyleRanges(story),
          paragraphStyleRanges: this.extractParagraphStyleRanges(story),
          directFormattingAttributes: this.extractDirectFormattingAttributes(story),
          styleReferences: this.extractStyleReferences(story)
        };
      }
    }

    // 2. ANALYZE SPREAD ELEMENTS FOR TEXT FRAMES
    if (processor.spreads) {
      for (const [spreadId, spread] of Object.entries(processor.spreads)) {
        debugInfo.spreadElementAnalysis[spreadId] = {
          textFrames: spread.pageItems?.filter(item => item.type === 'TextFrame') || [],
          textFrameDetails: this.analyzeTextFrameFormatting(spread.pageItems || [])
        };
      }
    }

    // 3. ANALYZE RESOURCES AND STYLE DEFINITIONS
    if (processor.styleParser) {
      debugInfo.resourcesAnalysis = {
        paragraphStyles: this.analyzeParagraphStyles(processor.styleParser),
        characterStyles: this.analyzeCharacterStyles(processor.styleParser),
        styleHierarchy: this.analyzeStyleHierarchy(processor.styleParser),
        fontDefinitions: this.analyzeFontDefinitions(processor.styleParser)
      };
    }

    // 4. ANALYZE XML STRUCTURE FOR FORMATTING ATTRIBUTES
    debugInfo.xmlStructureAnalysis = this.performXMLStructureAnalysis(processor);

    // 5. CREATE FORMATTING ATTRIBUTE MAPPING
    debugInfo.formattingAttributeMapping = this.createFormattingAttributeMapping();

    // 6. IDENTIFY MISSING FORMATTING REASONS
    debugInfo.missingFormattingReasons = this.identifyMissingFormattingReasons(processor);

    // 7. SAVE DEBUG INFO TO FILE
    const debugFileName = `idml-text-formatting-debug-${Date.now()}.json`;
    IDMLUtils.saveDebugInfo(debugInfo, debugFileName);
    
    console.log(`\n✅ Comprehensive debug completed. Check file: ${debugFileName}`);
    
    this.debugData = debugInfo;
    return debugInfo;
  }

  // NEW: Output a debug file with ONLY style definitions (paragraph, character, font)
  async addStyleOnlyDebug(processor) {
    console.log('\n🔍 ======= STYLE-ONLY DEBUG =======');
    const styleDebug = {
      timestamp: new Date().toISOString(),
      paragraphStyles: processor.styleParser ? processor.styleParser.getParagraphStyles && processor.styleParser.getParagraphStyles() : {},
      characterStyles: processor.styleParser ? processor.styleParser.getCharacterStyles && processor.styleParser.getCharacterStyles() : {},
      fontDefinitions: processor.styleParser ? processor.styleParser.getFontDefinitions && processor.styleParser.getFontDefinitions() : {},
    };
    const debugFileName = `idml-style-debug-${Date.now()}.json`;
    IDMLUtils.saveDebugInfo(styleDebug, debugFileName);
    console.log(`\n✅ Style-only debug completed. Check file: ${debugFileName}`);
    this.debugData = styleDebug;
    return styleDebug;
  }

  // NEW: Output a debug file with all extracted story text for whitespace debugging
  async addExtractedTextDebug(processor) {
    console.log('\n🔍 ======= EXTRACTED TEXT DEBUG =======');
    const stories = processor.storyParser && processor.storyParser.getStories ? processor.storyParser.getStories() : {};
    const textDebug = {
      timestamp: new Date().toISOString(),
      stories: Object.fromEntries(
        Object.entries(stories).map(([storyId, story]) => [
          storyId,
          {
            plainText: story.content?.plainText || '',
            preview: (story.content?.plainText || '').substring(0, 100),
            whitespaceSample: (story.content?.plainText || '').replace(/[^\s]/g, '_').substring(0, 100)
          }
        ])
      )
    };
    const debugFileName = `idml-extracted-text-debug-${Date.now()}.json`;
    IDMLUtils.saveDebugInfo(textDebug, debugFileName);
    console.log(`\n✅ Extracted text debug completed. Check file: ${debugFileName}`);
    this.debugData = textDebug;
    return textDebug;
  }

  analyzeStoryStructure(story) {
    const structure = {
      rawStoryKeys: Object.keys(story),
      contentKeys: story.content ? Object.keys(story.content) : [],
      textFormattingKeys: story.textFormatting ? Object.keys(story.textFormatting) : [],
      hasFormattedContent: !!(story.content && story.content.formattedContent),
      formattedContentLength: story.content?.formattedContent?.length || 0,
      rawStoryData: JSON.stringify(story, null, 2).substring(0, 1000) + '...'
    };
    
    return structure;
  }

  analyzeFormattingExtraction(story) {
    const formatting = {
      extractedFormatting: story.content?.formattedContent || [],
      formattingTypes: {},
      attributesFound: new Set(),
      formattingSample: []
    };
    
    if (story.content?.formattedContent) {
      story.content.formattedContent.forEach((item, index) => {
        if (item.formatting) {
          Object.keys(item.formatting).forEach(key => {
            formatting.attributesFound.add(key);
            if (!formatting.formattingTypes[key]) {
              formatting.formattingTypes[key] = [];
            }
            formatting.formattingTypes[key].push(item.formatting[key]);
          });
          
          if (index < 3) { // Sample first 3 items
            formatting.formattingSample.push({
              text: item.text?.substring(0, 50),
              formatting: item.formatting
            });
          }
        }
      });
    }
    
    formatting.attributesFound = Array.from(formatting.attributesFound);
    return formatting;
  }

  extractAllXMLAttributes(story) {
    console.log('Extracting all XML attributes...');
    
    const attributes = {
      storyLevelAttributes: {},
      contentLevelAttributes: {},
      allAttributeNames: new Set()
    };
    
    // Extract attributes from story object recursively
    const extractAttributes = (obj, path = '') => {
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          if (key.startsWith('@_')) {
            attributes.allAttributeNames.add(key);
            const fullPath = path ? `${path}.${key}` : key;
            if (!attributes.storyLevelAttributes[fullPath]) {
              attributes.storyLevelAttributes[fullPath] = obj[key];
            }
          } else if (typeof obj[key] === 'object') {
            extractAttributes(obj[key], path ? `${path}.${key}` : key);
          }
        });
      }
    };
    
    extractAttributes(story);
    
    attributes.allAttributeNames = Array.from(attributes.allAttributeNames);
    console.log('XML attributes found:', attributes.allAttributeNames);
    return attributes;
  }

  findNestedFormattingElements(story) {
    console.log('Finding nested formatting elements...');
    
    const nested = {
      characterStyleRanges: [],
      paragraphStyleRanges: [],
      directFormatting: [],
      fontReferences: [],
      colorReferences: []
    };
    
    const findNested = (obj, path = '') => {
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          const currentPath = path ? `${path}.${key}` : key;
          
          if (key === 'CharacterStyleRange') {
            nested.characterStyleRanges.push({ path: currentPath, data: value });
          } else if (key === 'ParagraphStyleRange') {
            nested.paragraphStyleRanges.push({ path: currentPath, data: value });
          } else if (key.includes('Font') || key.includes('font')) {
            nested.fontReferences.push({ path: currentPath, value: value });
          } else if (key.includes('Color') || key.includes('color')) {
            nested.colorReferences.push({ path: currentPath, value: value });
          } else if (key.startsWith('@_') && IDMLUtils.isFormattingAttribute(key)) {
            nested.directFormatting.push({ path: currentPath, attribute: key, value: value });
          } else if (typeof value === 'object') {
            findNested(value, currentPath);
          }
        });
      }
    };
    
    findNested(story);
    
    console.log('Nested formatting elements:', {
      characterStyleRanges: nested.characterStyleRanges.length,
      paragraphStyleRanges: nested.paragraphStyleRanges.length,
      directFormatting: nested.directFormatting.length,
      fontReferences: nested.fontReferences.length,
      colorReferences: nested.colorReferences.length
    });
    
    return nested;
  }

  extractCharacterStyleRanges(story) {
    console.log('Extracting character style ranges...');
    
    const ranges = [];
    
    const extractRanges = (obj) => {
      if (typeof obj === 'object' && obj !== null) {
        if (obj.CharacterStyleRange) {
          const charRanges = Array.isArray(obj.CharacterStyleRange) 
            ? obj.CharacterStyleRange 
            : [obj.CharacterStyleRange];
          
          charRanges.forEach(range => {
            ranges.push({
              appliedCharacterStyle: range['@_AppliedCharacterStyle'],
              pointSize: range['@_PointSize'],
              appliedFont: range['@_AppliedFont'],
              fontStyle: range['@_FontStyle'],
              fillColor: range['@_FillColor'],
              strokeColor: range['@_StrokeColor'],
              tracking: range['@_Tracking'],
              leading: range['@_Leading'],
              allAttributes: Object.keys(range).filter(k => k.startsWith('@_')),
              contentLength: range.Content ? (Array.isArray(range.Content) ? range.Content.join('').length : String(range.Content).length) : 0,
              rawRange: range
            });
          });
        }
        
        Object.values(obj).forEach(value => {
          if (typeof value === 'object') {
            extractRanges(value);
          }
        });
      }
    };
    
    extractRanges(story);
    
    console.log(`Found ${ranges.length} character style ranges`);
    ranges.forEach((range, index) => {
      console.log(`  Range ${index + 1}:`, {
        style: range.appliedCharacterStyle,
        fontSize: range.pointSize,
        font: range.appliedFont,
        color: range.fillColor,
        contentLength: range.contentLength
      });
    });
    
    return ranges;
  }

  extractParagraphStyleRanges(story) {
    console.log('Extracting paragraph style ranges...');
    
    const ranges = [];
    
    const extractRanges = (obj) => {
      if (typeof obj === 'object' && obj !== null) {
        if (obj.ParagraphStyleRange) {
          const paraRanges = Array.isArray(obj.ParagraphStyleRange) 
            ? obj.ParagraphStyleRange 
            : [obj.ParagraphStyleRange];
          
          paraRanges.forEach(range => {
            ranges.push({
              appliedParagraphStyle: range['@_AppliedParagraphStyle'],
              justification: range['@_Justification'],
              leftIndent: range['@_LeftIndent'],
              rightIndent: range['@_RightIndent'],
              firstLineIndent: range['@_FirstLineIndent'],
              spaceBefore: range['@_SpaceBefore'],
              spaceAfter: range['@_SpaceAfter'],
              allAttributes: Object.keys(range).filter(k => k.startsWith('@_')),
              hasCharacterStyleRanges: !!range.CharacterStyleRange,
              characterStyleRangeCount: range.CharacterStyleRange 
                ? (Array.isArray(range.CharacterStyleRange) ? range.CharacterStyleRange.length : 1)
                : 0,
              rawRange: range
            });
          });
        }
        
        Object.values(obj).forEach(value => {
          if (typeof value === 'object') {
            extractRanges(value);
          }
        });
      }
    };
    
    extractRanges(story);
    
    console.log(`Found ${ranges.length} paragraph style ranges`);
    ranges.forEach((range, index) => {
      console.log(`  Range ${index + 1}:`, {
        style: range.appliedParagraphStyle,
        justification: range.justification,
        characterRanges: range.characterStyleRangeCount
      });
    });
    
    return ranges;
  }

  extractDirectFormattingAttributes(story) {
    console.log('Extracting direct formatting attributes...');
    
    const directFormatting = [];
    
    const extractDirect = (obj, path = '') => {
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          if (key.startsWith('@_') && IDMLUtils.isFormattingAttribute(key)) {
            directFormatting.push({
              path: path,
              attribute: key,
              value: obj[key]
            });
          } else if (typeof obj[key] === 'object') {
            extractDirect(obj[key], path ? `${path}.${key}` : key);
          }
        });
      }
    };
    
    extractDirect(story);
    
    console.log(`Found ${directFormatting.length} direct formatting attributes`);
    return directFormatting;
  }

  extractStyleReferences(story) {
    console.log('Extracting style references...');
    
    const references = {
      paragraphStyleReferences: new Set(),
      characterStyleReferences: new Set(),
      fontReferences: new Set(),
      colorReferences: new Set()
    };
    
    const extractRefs = (obj) => {
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          const value = obj[key];
          
          if (key === '@_AppliedParagraphStyle' && value) {
            references.paragraphStyleReferences.add(value);
          } else if (key === '@_AppliedCharacterStyle' && value) {
            references.characterStyleReferences.add(value);
          } else if (key === '@_AppliedFont' && value) {
            references.fontReferences.add(value);
          } else if ((key === '@_FillColor' || key === '@_StrokeColor') && value) {
            references.colorReferences.add(value);
          } else if (typeof value === 'object') {
            extractRefs(value);
          }
        });
      }
    };
    
    extractRefs(story);
    
    // Convert sets to arrays
    Object.keys(references).forEach(key => {
      references[key] = Array.from(references[key]);
    });
    
    console.log('Style references found:', references);
    return references;
  }

  analyzeTextFrameFormatting(pageItems) {
    console.log('Analyzing text frame formatting...');
    
    const textFrames = pageItems.filter(item => item.type === 'TextFrame');
    const analysis = textFrames.map(frame => ({
      id: frame.self,
      parentStory: frame.parentStory,
      hasParentStory: !!frame.parentStory,
      textFramePreferences: frame.textFramePreferences,
      fillColor: frame.fillColor,
      strokeColor: frame.strokeColor,
      rawFrame: frame
    }));
    
    console.log(`Analyzed ${textFrames.length} text frames`);
    return analysis;
  }

  analyzeParagraphStyles(styleParser) {
    console.log('Analyzing paragraph styles...');
    
    const styles = styleParser.getStyles();
    const analysis = {
      totalStyles: Object.keys(styles.paragraph).length,
      styleDetails: {},
      attributeCoverage: {}
    };
    
    Object.entries(styles.paragraph).forEach(([styleId, style]) => {
      analysis.styleDetails[styleId] = {
        name: style.name,
        pointSize: style.pointSize,
        appliedFont: style.appliedFont,
        alignment: style.alignment,
        fillColor: style.fillColor,
        allProperties: Object.keys(style)
      };
      
      // Track which attributes are available
      Object.keys(style).forEach(attr => {
        if (!analysis.attributeCoverage[attr]) {
          analysis.attributeCoverage[attr] = 0;
        }
        analysis.attributeCoverage[attr]++;
      });
    });
    
    console.log('Paragraph styles analysis:', analysis);
    return analysis;
  }

  analyzeCharacterStyles(styleParser) {
    console.log('Analyzing character styles...');
    
    const styles = styleParser.getStyles();
    const analysis = {
      totalStyles: Object.keys(styles.character).length,
      styleDetails: {},
      attributeCoverage: {}
    };
    
    Object.entries(styles.character).forEach(([styleId, style]) => {
      analysis.styleDetails[styleId] = {
        name: style.name,
        pointSize: style.pointSize,
        appliedFont: style.appliedFont,
        fontStyle: style.fontStyle,
        fillColor: style.fillColor,
        allProperties: Object.keys(style)
      };
      
      // Track which attributes are available
      Object.keys(style).forEach(attr => {
        if (!analysis.attributeCoverage[attr]) {
          analysis.attributeCoverage[attr] = 0;
        }
        analysis.attributeCoverage[attr]++;
      });
    });
    
    console.log('Character styles analysis:', analysis);
    return analysis;
  }

  analyzeStyleHierarchy(styleParser) {
    console.log('Analyzing style hierarchy...');
    
    return {
      paragraphStyleHierarchy: this.extractStyleHierarchy(styleParser.getStyles().paragraph),
      characterStyleHierarchy: this.extractStyleHierarchy(styleParser.getStyles().character),
      styleInheritance: this.analyzeStyleInheritance()
    };
  }

  extractStyleHierarchy(styles) {
    const hierarchy = {};
    
    Object.entries(styles).forEach(([styleId, style]) => {
      hierarchy[styleId] = {
        basedOn: style.basedOn || null,
        children: [],
        level: 0
      };
    });
    
    // Build parent-child relationships
    Object.entries(hierarchy).forEach(([styleId, info]) => {
      if (info.basedOn && hierarchy[info.basedOn]) {
        hierarchy[info.basedOn].children.push(styleId);
        info.level = hierarchy[info.basedOn].level + 1;
      }
    });
    
    return hierarchy;
  }

  analyzeStyleInheritance() {
    return {
      inheritanceChains: this.findInheritanceChains(),
      overrides: this.findStyleOverrides()
    };
  }

  findInheritanceChains() {
    // Implementation for finding inheritance chains
    return {};
  }

  findStyleOverrides() {
    // Implementation for finding style overrides
    return {};
  }

  analyzeFontDefinitions(styleParser) {
    console.log('Analyzing font definitions...');
    
    const resources = styleParser.getResources();
    return {
      availableFonts: resources.fonts || {},
      fontUsage: this.analyzeFontUsage(styleParser),
      missingFonts: this.findMissingFonts(styleParser)
    };
  }

  analyzeFontUsage(styleParser) {
    const usage = {};
    const styles = styleParser.getStyles();
    
    // Analyze font usage in paragraph styles
    Object.values(styles.paragraph).forEach(style => {
      if (style.appliedFont) {
        if (!usage[style.appliedFont]) {
          usage[style.appliedFont] = { paragraphStyles: 0, characterStyles: 0 };
        }
        usage[style.appliedFont].paragraphStyles++;
      }
    });
    
    // Analyze font usage in character styles
    Object.values(styles.character).forEach(style => {
      if (style.appliedFont) {
        if (!usage[style.appliedFont]) {
          usage[style.appliedFont] = { paragraphStyles: 0, characterStyles: 0 };
        }
        usage[style.appliedFont].characterStyles++;
      }
    });
    
    return usage;
  }

  findMissingFonts(styleParser) {
    const usedFonts = new Set();
    const resources = styleParser.getResources();
    const availableFonts = new Set(Object.keys(resources.fonts || {}));
    const styles = styleParser.getStyles();
    
    // Collect used fonts
    Object.values(styles.paragraph).forEach(style => {
      if (style.appliedFont) usedFonts.add(style.appliedFont);
    });
    
    Object.values(styles.character).forEach(style => {
      if (style.appliedFont) usedFonts.add(style.appliedFont);
    });
    
    // Find missing fonts
    const missing = Array.from(usedFonts).filter(font => !availableFonts.has(font));
    
    return {
      usedFonts: Array.from(usedFonts),
      availableFonts: Array.from(availableFonts),
      missingFonts: missing
    };
  }

  performXMLStructureAnalysis(processor) {
    console.log('Performing XML structure analysis...');
    
    const analysis = {
      storyXMLStructure: {},
      spreadXMLStructure: {},
      resourceXMLStructure: {}
    };

    if (processor.storyParser) {
      const stories = processor.storyParser.getStories();
      Object.entries(stories).forEach(([storyId, story]) => {
        analysis.storyXMLStructure[storyId] = IDMLUtils.getXMLStructure(story);
      });
    }

    if (processor.spreads) {
      Object.entries(processor.spreads).forEach(([spreadId, spread]) => {
        analysis.spreadXMLStructure[spreadId] = IDMLUtils.getXMLStructure(spread);
      });
    }

    if (processor.styleParser) {
      const styles = processor.styleParser.getStyles();
      const resources = processor.styleParser.getResources();
      analysis.resourceXMLStructure = {
        styles: IDMLUtils.getXMLStructure(styles),
        fonts: IDMLUtils.getXMLStructure(resources.fonts),
        colors: IDMLUtils.getXMLStructure(resources.colors)
      };
    }
    
    return analysis;
  }

  createFormattingAttributeMapping() {
    console.log('Creating formatting attribute mapping...');
    
    return {
      inDesignToCSS: {
        '@_PointSize': 'font-size',
        '@_AppliedFont': 'font-family',
        '@_FontStyle': 'font-weight',
        '@_FillColor': 'color',
        '@_Justification': 'text-align',
        '@_Leading': 'line-height',
        '@_Tracking': 'letter-spacing',
        '@_LeftIndent': 'margin-left',
        '@_RightIndent': 'margin-right',
        '@_FirstLineIndent': 'text-indent',
        '@_SpaceBefore': 'margin-top',
        '@_SpaceAfter': 'margin-bottom'
      },
      attributeLocations: {
        fontSize: ['CharacterStyleRange@_PointSize', 'ParagraphStyle.pointSize', 'CharacterStyle.pointSize'],
        fontFamily: ['CharacterStyleRange@_AppliedFont', 'ParagraphStyle.appliedFont', 'CharacterStyle.appliedFont'],
        alignment: ['ParagraphStyleRange@_Justification', 'ParagraphStyle.alignment'],
        color: ['CharacterStyleRange@_FillColor', 'ParagraphStyle.fillColor', 'CharacterStyle.fillColor']
      }
    };
  }

  identifyMissingFormattingReasons(processor) {
    console.log('Identifying missing formatting reasons...');
    
    const reasons = [];
    
    // Check if styles are being extracted properly
    if (processor.styleParser) {
      const styles = processor.styleParser.getStyles();
      if (Object.keys(styles.paragraph).length === 0) {
        reasons.push('No paragraph styles extracted - check Resources/Styles.xml parsing');
      }
      
      if (Object.keys(styles.character).length === 0) {
        reasons.push('No character styles extracted - check Resources/Styles.xml parsing');
      }
    } else {
      reasons.push('StyleParser not available - check initialization');
    }
    
    // Check if story content has formatting
    if (processor.storyParser) {
      const stories = processor.storyParser.getStories();
      const storiesWithFormatting = Object.values(stories).filter(story => 
        story.content?.formattedContent?.some(item => 
          item.formatting && Object.keys(item.formatting).length > 1
        )
      );
      
      if (storiesWithFormatting.length === 0) {
        reasons.push('No stories have detailed formatting - check CharacterStyleRange extraction');
      }
    }
    
    // Check if text frames are linked to stories
    if (processor.elements) {
      const textFrames = processor.elements.filter(el => el.type === 'TextFrame');
      const linkedFrames = textFrames.filter(frame => {
        if (processor.storyParser) {
          const stories = processor.storyParser.getStories();
          return frame.parentStory && stories[frame.parentStory];
        }
        return false;
      });
      
      if (textFrames.length > 0 && linkedFrames.length === 0) {
        reasons.push('Text frames not properly linked to stories - check parentStory references');
      }
    }
    
    return reasons;
  }

  getDebugData() {
    return this.debugData;
  }

  clearDebugData() {
    this.debugData = {};
  }
}

module.exports = DebugAnalyzer; 

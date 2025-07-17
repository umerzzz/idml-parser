const path = require('path');
const IDMLUtils = require('../utils/IDMLUtils');

class StoryParser {
  constructor(styleParser) {
    this.styleParser = styleParser;
    this.stories = {};
  }

  async parseStoryFile(fileName, content, xmlParser) {
    console.log(`📝 Parsing story: ${fileName}`);
    
    try {
      const parsed = xmlParser.parse(content);
      const storyId = path.basename(fileName, '.xml');
      
      const storyData = parsed.Story || parsed;
      
      // ADD THESE SIMPLE LOGS FIRST:
      console.log('=== SIMPLE DEBUG TEST ===');
      console.log('Story file name:', fileName);
      console.log('Parsed story keys:', Object.keys(storyData));
      console.log('Raw story data sample:', JSON.stringify(storyData, null, 2).substring(0, 500));
      
      // Extract detailed story information
      const detailedStory = {
        self: storyData['@_Self'],
        appliedTOCStyle: storyData['@_AppliedTOCStyle'] || 'n',
        userText: storyData['@_UserText'] !== false,
        
        // Extract story content with formatting
        content: this.extractDetailedStoryContent(storyData),
        
        // Extract text formatting
        textFormatting: this.extractTextFormatting(storyData)
      };
      
      const cleanStoryId = storyId.replace('Story_', '');
      this.stories[cleanStoryId] = detailedStory;
      
      // Enhanced logging to show line breaks
      const { plainText, lineBreakInfo } = detailedStory.content;
      console.log(`✅ Story ${storyId} parsed:`);
      console.log(`   - Characters: ${plainText.length}`);
      console.log(`   - Words: ${detailedStory.content.wordCount}`);
      console.log(`   - Line breaks: ${lineBreakInfo?.lineBreakCount || 0}`);
      console.log(`   - Text preview: "${plainText.substring(0, 50).replace(/\n/g, '\\n')}..."`);
      
    } catch (error) {
      console.error(`❌ Error parsing story ${fileName}:`, error.message);
    }
  }

  // Replace the existing extractDetailedStoryContent method with this corrected version
  extractDetailedStoryContent(storyData) {
    let content = '';
    let formattedContent = [];
    let textColor = null;
    let debugInfo = [];
    
    const extractTextRecursively = (element, depth = 0, context = {}) => {
      if (typeof element === 'string') {
        content += element;
        return;
      }
      
      if (element && typeof element === 'object') {
        // ENHANCED: Special handling for CharacterStyleRange with sophisticated Br detection
        if (element.CharacterStyleRange) {
          const ranges = Array.isArray(element.CharacterStyleRange) ? 
            element.CharacterStyleRange : [element.CharacterStyleRange];
          
          // SIMPLIFIED DEBUG: Just log problematic text ranges
          const allRangeContent = ranges.map(r => r.Content ? 
            (Array.isArray(r.Content) ? r.Content.join('') : String(r.Content)) : '').join('');
          if (allRangeContent.includes('pavoluptusda') || allRangeContent.includes('pa') || allRangeContent.includes('voluptusda')) {
            console.log('🚨 FOUND RANGES WITH PROBLEMATIC TEXT:');
            ranges.forEach((range, index) => {
              const content = range.Content ? 
                (Array.isArray(range.Content) ? range.Content.join('') : String(range.Content)) : '';
              console.log(`   Range ${index}: "${content}"`);
            });
          }
          
          ranges.forEach((range, rangeIndex) => {
            // Extract direct font references from the XML range
            const directFontRef = range['@_AppliedFont'] || 
                                 range['@_FontFamily'] || 
                                 range['@_Font'] || '';
            
            const formatting = {
              paragraphStyle: element['@_AppliedParagraphStyle'] || context.appliedStyle || null,
              characterStyle: range['@_AppliedCharacterStyle'] || null,
              fontSize: range['@_PointSize'] ? parseFloat(range['@_PointSize']) : null,
              fontReference: directFontRef,
              fillColor: range['@_FillColor'] || null,
              fontStyle: range['@_FontStyle'] || null,
              // CRITICAL FIX: Inherit paragraph alignment from context if not explicitly set
              alignment: range['@_Justification'] || range['@_Alignment'] || context.paragraphAlignment || null
            };
            
            // DEBUG: Log formatting extraction for any styled text (generic check)
            const rangeContent = range.Content ? 
              (Array.isArray(range.Content) ? range.Content.join('') : String(range.Content)) : '';
            const hasStyleInfo = range['@_FontStyle'] || range['@_AppliedCharacterStyle'] || 
                                element['@_AppliedParagraphStyle'] || range['@_AppliedFont'];
            
            if (hasStyleInfo && rangeContent.trim()) {
              console.log('🔧 StoryParser - Extracting formatting for range:', JSON.stringify(rangeContent.substring(0, 30) + '...'), {
                rawRangeAttributes: Object.keys(range).filter(k => k.startsWith('@_')),
                extractedFormatting: formatting,
                fontStyleFromXML: range['@_FontStyle'],
                characterStyleFromXML: range['@_AppliedCharacterStyle'],
                paragraphStyleFromXML: element['@_AppliedParagraphStyle']
              });
            }

            const resolvedFormatting = this.styleParser.resolveStyleFormatting(formatting);
            
            // FIXED: Process content with proper space preservation
            if (range.Content) {
              const contents = Array.isArray(range.Content) ? range.Content : [range.Content];
              contents.forEach((contentItem, contentIndex) => {
                const text = IDMLUtils.decodeXMLEntities(String(contentItem));
                content += text;
                formattedContent.push({
                  text: text,
                  formatting: resolvedFormatting
                });
                
                // CRITICAL FIX: Check for Br elements AFTER each content item within the same range
                if (range.Br !== undefined && contentIndex < contents.length - 1) {
                  const lineBreakText = '\n';
                  content += lineBreakText;
                  formattedContent.push({
                    text: lineBreakText,
                    formatting: { 
                      isBreak: true,
                      breakType: 'line',
                      position: 'between_content',
                      source: 'Br element within range'
                    }
                  });
                  
                  debugInfo.push({
                    type: 'Line break detected within content',
                    location: `CharacterStyleRange[${rangeIndex}], between content[${contentIndex}] and content[${contentIndex + 1}]`,
                    breakType: 'line',
                    context: context
                  });
                }
              });
            }
            
            // Handle Br elements at the end of the range
            if (range.Br !== undefined && (!range.Content || Array.isArray(range.Content) === false)) {
              const brElements = this.extractBrElements(range);
              brElements.forEach((brInfo, brIndex) => {
                const lineBreakText = this.determineLineBreakType(brInfo, context);
                content += lineBreakText;
                
                formattedContent.push({
                  text: lineBreakText,
                  formatting: { 
                    isBreak: true,
                    breakType: brInfo.type || 'line',
                    position: brInfo.position || 'end',
                    source: 'Br element at end of range'
                  }
                });
                
                debugInfo.push({
                  type: 'Line break detected at end of range',
                  location: `CharacterStyleRange[${rangeIndex}], Br[${brIndex}]`,
                  breakType: brInfo.type || 'line',
                  context: context
                });
              });
            }
            
            // CRITICAL FIX: Add space between character style ranges if needed
            if (rangeIndex < ranges.length - 1) {
              const nextRange = ranges[rangeIndex + 1];
              
              // More robust space detection
              const currentText = content.slice(-10); // Check last 10 characters
              const currentRangeEndsWithSpace = /\s$/.test(currentText); // Any whitespace at end
              
              const nextContent = nextRange.Content ? 
                String(Array.isArray(nextRange.Content) ? nextRange.Content[0] : nextRange.Content) : '';
              const nextRangeStartsWithSpace = /^\s/.test(nextContent); // Any whitespace at start
              
              // AGGRESSIVE FIX: Add space between ALL ranges unless explicitly not needed
              const shouldSkipSpace = currentRangeEndsWithSpace || 
                                     nextRangeStartsWithSpace || 
                                     this.shouldInsertImplicitLineBreak(range, nextRange, context) ||
                                     !nextRange.Content || // Skip if next range has no content
                                     nextContent.trim() === ''; // Skip if next content is only whitespace
              
              if (!shouldSkipSpace) {
                const currentStyle = range['@_AppliedCharacterStyle'] || 'none';
                const nextStyle = nextRange['@_AppliedCharacterStyle'] || 'none';
                
                const spaceText = ' ';
                content += spaceText;
                formattedContent.push({
                  text: spaceText,
                  formatting: {
                    isSpace: true,
                    source: 'between character style ranges (aggressive)',
                    currentStyle,
                    nextStyle
                  }
                });
                
                debugInfo.push({
                  type: 'Space inserted between character styles (aggressive)',
                  location: `Between ranges ${rangeIndex} and ${rangeIndex + 1}`,
                  currentStyle,
                  nextStyle,
                  reason: 'Default space insertion - words likely split across ranges',
                  currentTextEnd: currentText.slice(-5),
                  nextTextStart: nextContent.slice(0, 5)
                });
              } else {
                debugInfo.push({
                  type: 'Space insertion skipped',
                  location: `Between ranges ${rangeIndex} and ${rangeIndex + 1}`,
                  reason: currentRangeEndsWithSpace ? 'Current range ends with space' :
                          nextRangeStartsWithSpace ? 'Next range starts with space' :
                          !nextRange.Content ? 'Next range has no content' : 
                          nextContent.trim() === '' ? 'Next content is only whitespace' : 'Line break would be inserted',
                  currentTextEnd: currentText.slice(-5),
                  nextTextStart: nextContent.slice(0, 5)
                });
              }
              
              // Handle explicit line breaks between ranges (for cases where shouldInsertImplicitLineBreak is true)
              if (this.shouldInsertImplicitLineBreak(range, nextRange, context)) {
                const implicitBreak = '\n';
                content += implicitBreak;
                formattedContent.push({
                  text: implicitBreak,
                  formatting: {
                    isBreak: true,
                    breakType: 'implicit',
                    source: 'between ranges'
                  }
                });
                
                debugInfo.push({
                  type: 'Implicit line break',
                  location: `Between ranges ${rangeIndex} and ${rangeIndex + 1}`
                });
              }
            }
          });
          return; // Don't continue processing to avoid duplication
        }
        
        // ENHANCED: Handle ParagraphStyleRange with context
        if (element.ParagraphStyleRange) {
          const ranges = Array.isArray(element.ParagraphStyleRange) ? 
            element.ParagraphStyleRange : [element.ParagraphStyleRange];
          
          ranges.forEach((range, index) => {
            const paragraphContext = {
              ...context,
              paragraphIndex: index,
              totalParagraphs: ranges.length,
              appliedStyle: range['@_AppliedParagraphStyle'],
              // CRITICAL FIX: Pass down direct paragraph-level alignment
              paragraphAlignment: range['@_Justification'] || range['@_Alignment']
            };
            
            extractTextRecursively(range, depth + 1, paragraphContext);
            
            // Add paragraph break between paragraphs (but not after the last one)
            if (index < ranges.length - 1) {
              const paragraphBreak = '\n';
              content += paragraphBreak;
              formattedContent.push({
                text: paragraphBreak,
                formatting: {
                  isBreak: true,
                  breakType: 'paragraph',
                  source: 'between paragraphs'
                }
              });
              debugInfo.push({ 
                type: 'Paragraph break', 
                location: `between paragraphs ${index} and ${index + 1}` 
              });
            }
          });
          return;
        }
        
        // Handle direct Content elements (when not inside CharacterStyleRange)
        if (element.Content && !element.CharacterStyleRange) {
          let text = Array.isArray(element.Content) ? element.Content.join('') : String(element.Content);
          text = IDMLUtils.decodeXMLEntities(text);
          content += text;
          
          const formatting = {
            paragraphStyle: element['@_AppliedParagraphStyle'] || context.appliedStyle || null,
            characterStyle: element['@_AppliedCharacterStyle'] || null,
            fontSize: element['@_PointSize'] || null,
            fontFamily: element['@_AppliedFont'] || null,
            fillColor: element['@_FillColor'] || null,
            // CRITICAL FIX: Inherit paragraph alignment from context if not explicitly set
            alignment: element['@_Justification'] || element['@_Alignment'] || context.paragraphAlignment || null
          };

          const resolvedFormatting = this.styleParser.resolveStyleFormatting(formatting);
          
          formattedContent.push({
            text: text,
            formatting: resolvedFormatting
          });
        }
        
        // ENHANCED: Direct Br element handling (outside of ranges)
        if (element.Br !== undefined) {
          const brElements = Array.isArray(element.Br) ? element.Br : [element.Br];
          brElements.forEach((br, index) => {
            const lineBreakText = '\n';
            content += lineBreakText;
            formattedContent.push({
              text: lineBreakText,
              formatting: {
                isBreak: true,
                breakType: 'explicit',
                source: 'direct Br element'
              }
            });
            debugInfo.push({
              type: 'Direct Br element',
              location: `Direct element, index ${index}`
            });
          });
        }
        
        // Continue with other nested elements
        Object.entries(element).forEach(([key, value]) => {
          if (!key.startsWith('@_') && 
              key !== 'Content' && 
              key !== 'Br' && 
              key !== 'CharacterStyleRange' &&
              key !== 'ParagraphStyleRange') {
            if (Array.isArray(value)) {
              value.forEach(item => extractTextRecursively(item, depth + 1, context));
            } else if (typeof value === 'object' && depth < 10) {
              extractTextRecursively(value, depth + 1, context);
            }
          }
        });
      }
    };
    
    extractTextRecursively(storyData);
    
    // ENHANCED: Process and clean up the content with sophisticated line break preservation
    const processedContent = IDMLUtils.sophisticatedLineBreakProcessing(content);
    
    // DEBUG: Log space preservation results
    console.log('📝 Text extraction results:');
    console.log('   - Original content length:', content.length);
    console.log('   - Processed content length:', processedContent.length);
    console.log('   - Space preservation events:', debugInfo.filter(info => info.type.includes('Space inserted')).length);
    
    // SPECIFIC DEBUG: Check for the problematic "pavoluptusda" text (simplified)
    if (processedContent.includes('pavoluptusda') || processedContent.includes('pa') && processedContent.includes('voluptusda')) {
      console.log('🚨 FOUND PROBLEMATIC TEXT:');
      console.log('   - Contains "pavoluptusda":', processedContent.includes('pavoluptusda'));
      console.log('   - Contains "pa voluptusda":', processedContent.includes('pa voluptusda'));
      console.log('   - FormattedContent breakdown:', formattedContent.map(item => item.text).join('|'));
    }
    

    
    const lineBreakInfo = {
      hasLineBreaks: processedContent.includes('\n'),
      lineBreakCount: (processedContent.match(/\n/g) || []).length,
      lineBreakTypes: this.analyzeLineBreakTypes(formattedContent),
      debugInfo: debugInfo,
      spacePreservationCount: debugInfo.filter(info => info.type.includes('Space inserted')).length
    };
    
    return {
      plainText: processedContent,
      formattedContent: formattedContent.filter(item => item.text && item.text.length > 0),
      wordCount: IDMLUtils.countWords(processedContent.replace(/\n/g, ' ')),
      characterCount: processedContent.length,
      textColor: textColor,
      lineBreakInfo: lineBreakInfo
    };
  }

  // Add this helper method to better handle mixed content and Br elements
  analyzeContentStructure(range) {
    const structure = {
      hasContent: !!range.Content,
      hasBr: range.Br !== undefined,
      contentItems: range.Content ? (Array.isArray(range.Content) ? range.Content : [range.Content]) : [],
      brElements: range.Br ? (Array.isArray(range.Br) ? range.Br : [range.Br]) : []
    };
    
    console.log('Content structure analysis:', structure);
    return structure;
  }

  // Enhanced helper for processing interleaved content and breaks
  processInterleavedContent(range, resolvedFormatting) {
    const results = [];
    let content = '';
    
    // This method would need access to the actual XML structure to determine
    // the exact order of Content and Br elements. For now, we'll use the 
    // approach above which handles the most common case.
    
    return results;
  }

  // SOPHISTICATED: Helper method to extract Br elements with context
  extractBrElements(range) {
    const brElements = [];
    
    if (range.Br !== undefined) {
      if (Array.isArray(range.Br)) {
        range.Br.forEach((br, index) => {
          brElements.push({
            type: 'line',
            position: index === 0 ? 'start' : 'middle',
            element: br
          });
        });
      } else {
        brElements.push({
          type: 'line',
          position: 'end',
          element: range.Br
        });
      }
    }
    
    return brElements;
  }

  // SOPHISTICATED: Determine the appropriate line break type
  determineLineBreakType(brInfo, context) {
    // Different line break characters based on context
    switch (brInfo.type) {
      case 'paragraph':
        return '\n\n'; // Double line break for paragraph separation
      case 'forced':
        return '\n'; // Forced line break (Shift+Enter equivalent)
      case 'line':
      default:
        return '\n'; // Standard line break
    }
  }

  // SOPHISTICATED: Determine if an implicit line break should be inserted
  shouldInsertImplicitLineBreak(currentRange, nextRange, context) {
    // Don't insert implicit breaks if explicit Br elements are present
    if (currentRange.Br !== undefined || nextRange.Br !== undefined) {
      return false;
    }
    
    // Insert breaks between different character styles in different paragraphs
    const currentCharStyle = currentRange['@_AppliedCharacterStyle'];
    const nextCharStyle = nextRange['@_AppliedCharacterStyle'];
    
    // If we're in a context where styles change significantly, add a break
    if (currentCharStyle && nextCharStyle && currentCharStyle !== nextCharStyle) {
      // Check if this might be a title/heading followed by body text
      const styleIndicatesBreak = this.styleIndicatesLineBreak(currentCharStyle, nextCharStyle);
      return styleIndicatesBreak;
    }
    
    return false;
  }

  // SOPHISTICATED: Analyze if style change indicates a line break
  styleIndicatesLineBreak(currentStyle, nextStyle) {
    const titleIndicators = ['title', 'heading', 'header'];
    const bodyIndicators = ['body', 'text', 'normal'];
    
    const currentIsTitle = titleIndicators.some(indicator => 
      currentStyle.toLowerCase().includes(indicator));
    const nextIsBody = bodyIndicators.some(indicator => 
      nextStyle.toLowerCase().includes(indicator));
    
    return currentIsTitle && nextIsBody;
  }

  // SOPHISTICATED: Analyze line break types in formatted content
  analyzeLineBreakTypes(formattedContent) {
    const types = {
      explicit: 0,      // From <Br/> elements
      implicit: 0,      // Inferred from style changes
      paragraph: 0,     // Between paragraphs
      direct: 0        // Direct Br elements
    };
    
    formattedContent.forEach(item => {
      if (item.formatting?.isBreak) {
        const breakType = item.formatting.breakType || 'unknown';
        if (types.hasOwnProperty(breakType)) {
          types[breakType]++;
        }
      }
    });
    
    return types;
  }

  extractDetailedFormattingFromRange(range) {
    const formatting = {};
    
    // Extract all possible font attributes
    const fontAttributes = [
      '@_AppliedFont', '@_FontFamily', '@_Font', 
      '@_PostScriptName', '@_FontName'
    ];
    
    fontAttributes.forEach(attr => {
      if (range[attr]) {
        formatting.fontReference = range[attr];
      }
    });
    
    // Extract font and size attributes
    formatting.fontSize = IDMLUtils.parseNumeric(range['@_PointSize']);
    
    // ENHANCED: Extract leading with proper processing
    const rawLeading = range['@_Leading'];
    formatting.leading = this.processLeadingValue(rawLeading, formatting.fontSize);
    formatting.leadingType = this.determineLeadingType(rawLeading);
    
    // Extract color and style attributes
    formatting.fillColor = range['@_FillColor'];
    formatting.strokeColor = range['@_StrokeColor'];
    formatting.fontStyle = range['@_FontStyle'];
    
    // Extract advanced typography attributes
    formatting.tracking = IDMLUtils.parseNumeric(range['@_Tracking']);
    formatting.baselineShift = IDMLUtils.parseNumeric(range['@_BaselineShift']);
    formatting.kerning = IDMLUtils.parseNumeric(range['@_Kerning']);
    formatting.horizontalScale = IDMLUtils.parseNumeric(range['@_HorizontalScale']) || 100;
    formatting.verticalScale = IDMLUtils.parseNumeric(range['@_VerticalScale']) || 100;
    
    // ENHANCED: Extract InDesign-specific text layout properties for precise rendering
    formatting.baselineGridAlign = range['@_AlignToBaseline'] || 'None';
    formatting.dropCapLines = IDMLUtils.parseNumeric(range['@_DropCapLines']) || 0;
    formatting.dropCapCharacters = IDMLUtils.parseNumeric(range['@_DropCapCharacters']) || 0;
    
    // Extract paragraph-level attributes if present
    // CRITICAL FIX: Only set alignment if explicitly specified, allowing paragraph inheritance
    const explicitAlignment = range['@_Justification'] || range['@_Alignment'];
    if (explicitAlignment) {
      formatting.alignment = explicitAlignment;
    }
    formatting.leftIndent = IDMLUtils.parseNumeric(range['@_LeftIndent']);
    formatting.rightIndent = IDMLUtils.parseNumeric(range['@_RightIndent']);
    formatting.firstLineIndent = IDMLUtils.parseNumeric(range['@_FirstLineIndent']);
    formatting.spaceBefore = IDMLUtils.parseNumeric(range['@_SpaceBefore']);
    formatting.spaceAfter = IDMLUtils.parseNumeric(range['@_SpaceAfter']);
    
    // Calculate effective line height for CSS
    formatting.effectiveLineHeight = this.calculateEffectiveLineHeight(formatting);
    
    return formatting;
  }

  // NEW: Process leading values with InDesign-specific logic
  processLeadingValue(rawLeading, fontSize) {
    if (!rawLeading) return 'auto';
    
    // Handle "auto" leading
    if (rawLeading === 'auto' || rawLeading === 'Auto') {
      return fontSize ? fontSize * 1.2 : 'auto'; // InDesign default auto leading is 120%
    }
    
    // Handle numeric leading (in points)
    const numericLeading = IDMLUtils.parseNumeric(rawLeading);
    if (numericLeading) {
      return numericLeading;
    }
    
    // Handle percentage-based leading
    if (rawLeading.includes('%')) {
      const percentage = parseFloat(rawLeading.replace('%', ''));
      return fontSize ? (fontSize * percentage / 100) : 'auto';
    }
    
    return 'auto';
  }

  // NEW: Determine the type of leading being used
  determineLeadingType(rawLeading) {
    if (!rawLeading || rawLeading === 'auto' || rawLeading === 'Auto') {
      return 'auto';
    }
    
    if (rawLeading.includes('%')) {
      return 'percentage';
    }
    
    if (IDMLUtils.parseNumeric(rawLeading)) {
      return 'absolute';
    }
    
    return 'unknown';
  }

  // NEW: Calculate effective line height for CSS rendering
  calculateEffectiveLineHeight(formatting) {
    const fontSize = formatting.fontSize || 12;
    const leading = formatting.leading;
    
    if (leading === 'auto') {
      return 1.2; // CSS line-height ratio for auto
    }
    
    if (typeof leading === 'number') {
      // Convert points to CSS line-height ratio
      return leading / fontSize;
    }
    
    return 1.2; // Fallback
  }

  extractTextFormatting(storyData) {
    const formatting = {
      paragraphStyles: [],
      characterStyles: [],
      appliedStyles: []
    };
    
    // Extract applied paragraph styles
    if (storyData.ParagraphStyleRange) {
      const ranges = Array.isArray(storyData.ParagraphStyleRange) ? storyData.ParagraphStyleRange : [storyData.ParagraphStyleRange];
      
      ranges.forEach(range => {
        const appliedStyle = range['@_AppliedParagraphStyle'];
        if (appliedStyle && !formatting.paragraphStyles.includes(appliedStyle)) {
          formatting.paragraphStyles.push(appliedStyle);
        }
        
        // Extract character styles within paragraph ranges
        if (range.CharacterStyleRange) {
          const charRanges = Array.isArray(range.CharacterStyleRange) ? range.CharacterStyleRange : [range.CharacterStyleRange];
          
          charRanges.forEach(charRange => {
            const charStyle = charRange['@_AppliedCharacterStyle'];
            if (charStyle && !formatting.characterStyles.includes(charStyle)) {
              formatting.characterStyles.push(charStyle);
            }
          });
        }
      });
    }
    
    return formatting;
  }

  // Add this method to debug raw story content
  debugRawStoryContent(storyData) {
    console.log('\n🔍 RAW STORY CONTENT DEBUG:');
    console.log('Story keys:', Object.keys(storyData));
    
    const findCharacterRanges = (obj, path = '') => {
      if (typeof obj === 'object' && obj !== null) {
        Object.keys(obj).forEach(key => {
          if (key === 'CharacterStyleRange') {
            console.log(`\n📝 Found CharacterStyleRange at ${path}:`, obj[key]);
            const ranges = Array.isArray(obj[key]) ? obj[key] : [obj[key]];
            ranges.forEach((range, index) => {
              console.log(`  Range ${index + 1} attributes:`, 
                Object.keys(range).filter(k => k.startsWith('@_'))
              );
              console.log(`  Range ${index + 1} font info:`, {
                AppliedFont: range['@_AppliedFont'],
                FontStyle: range['@_FontStyle'],
                PointSize: range['@_PointSize']
              });
            });
          } else if (typeof obj[key] === 'object') {
            findCharacterRanges(obj[key], `${path}.${key}`);
          }
        });
      }
    };
    
    findCharacterRanges(storyData);
  }

  getStories() {
    return this.stories;
  }

  getStory(storyId) {
    return this.stories[storyId];
  }

  clearStories() {
    this.stories = {};
  }
}

module.exports = StoryParser; 
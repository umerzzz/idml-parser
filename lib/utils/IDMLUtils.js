const path = require('path');
const fs = require('fs');

class IDMLUtils {
  static parseGeometricBounds(boundsString) {
    console.log('DEBUG: boundsString =', boundsString);
    if (!boundsString || boundsString === 'undefined') {
      console.log('Warning: Missing geometric bounds, using defaults');
      return { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 };
    }
    
    const bounds = boundsString.split(' ').map(parseFloat);
    const result = {
      top: bounds[0] || 0,
      left: bounds[1] || 0,
      bottom: bounds[2] || 0,
      right: bounds[3] || 0,
      width: (bounds[3] || 0) - (bounds[1] || 0),
      height: (bounds[2] || 0) - (bounds[0] || 0)
    };
    
    console.log('Parsed bounds:', result);
    return result;
  }

  static parseTransform(transformString) {
    if (!transformString) return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
    
    const values = transformString.split(' ').map(parseFloat);
    return {
      a: values[0] || 1,   // x scale
      b: values[1] || 0,   // y skew
      c: values[2] || 0,   // x skew
      d: values[3] || 1,   // y scale
      tx: values[4] || 0,  // x translation
      ty: values[5] || 0   // y translation
    };
  }

  static calculateRotation(transform) {
    // Calculate rotation angle from transform matrix
    return Math.atan2(transform.b, transform.a) * (180 / Math.PI);
  }

  static calculateCorners(bounds, transform) {
    const corners = {
      topLeft: { x: bounds.left, y: bounds.top },
      topRight: { x: bounds.right, y: bounds.top },
      bottomLeft: { x: bounds.left, y: bounds.bottom },
      bottomRight: { x: bounds.right, y: bounds.bottom }
    };
    
    // Apply transformation to corners
    Object.keys(corners).forEach(corner => {
      const point = corners[corner];
      corners[corner] = {
        x: (transform.a * point.x) + (transform.c * point.y) + transform.tx,
        y: (transform.b * point.x) + (transform.d * point.y) + transform.ty
      };
    });
    
    return corners;
  }

  static cmykToRgb(c, m, y, k) {
    // Convert CMYK percentages (0-100) to RGB (0-255)
    c = c / 100;
    m = m / 100;
    y = y / 100;
    k = k / 100;

    const r = Math.round(255 * (1 - c) * (1 - k));
    const g = Math.round(255 * (1 - m) * (1 - k));
    const b = Math.round(255 * (1 - y) * (1 - k));

    return { r, g, b };
  }

  static parseInDesignColor(colorRef) {
    if (!colorRef || colorRef === 'Color/None') return null;
    
    // Handle CMYK colors
    const cmykMatch = colorRef.match(/Color\/C=(\d+)\s*M=(\d+)\s*Y=(\d+)\s*K=(\d+)/);
    if (cmykMatch) {
      const [, c, m, y, k] = cmykMatch.map(Number);
      const rgb = this.cmykToRgb(c, m, y, k);
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
    
    // Handle RGB colors
    const rgbMatch = colorRef.match(/Color\/R=(\d+)\s*G=(\d+)\s*B=(\d+)/);
    if (rgbMatch) {
      const [, r, g, b] = rgbMatch.map(Number);
      return `rgb(${r}, ${g}, ${b})`;
    }
    
    // Standard colors
    const standardColors = {
      'Color/Black': 'rgb(0, 0, 0)',
      'Color/White': 'rgb(255, 255, 255)',
      'Color/Red': 'rgb(255, 0, 0)',
      'Color/Green': 'rgb(0, 255, 0)',
      'Color/Blue': 'rgb(0, 0, 255)',
      'Color/Cyan': 'rgb(0, 255, 255)',
      'Color/Magenta': 'rgb(255, 0, 255)',
      'Color/Yellow': 'rgb(255, 255, 0)',
      'Color/Paper': 'rgb(255, 255, 255)',
      'Color/Registration': 'rgb(0, 0, 0)'
    };
    
    return standardColors[colorRef] || null;
  }

  static decodeXMLEntities(text) {
    if (!text) return '';
    
    return text
      .replace(/&#x000A;/g, '\n')      // Line feed
      .replace(/&#x000D;/g, '\r')      // Carriage return
      .replace(/&#x0009;/g, '\t')      // Tab
      .replace(/&#x00A0;/g, '\u00A0')  // Non-breaking space
      .replace(/&#x2028;/g, '\u2028')  // Line separator
      .replace(/&#x2029;/g, '\u2029')  // Paragraph separator
      .replace(/&#10;/g, '\n')         // Decimal line feed
      .replace(/&#13;/g, '\r')         // Decimal carriage return
      .replace(/&#9;/g, '\t')          // Decimal tab
      .replace(/&#160;/g, '\u00A0')    // Decimal non-breaking space
      .replace(/&lt;/g, '<')           // Less than
      .replace(/&gt;/g, '>')           // Greater than
      .replace(/&amp;/g, '&')          // Ampersand (must be last)
      .replace(/&quot;/g, '"')         // Quote
      .replace(/&apos;/g, "'");        // Apostrophe
  }

  static cleanTextContent(content) {
    return content
      .replace(/\r\n/g, '\n')      // Normalize Windows line breaks
      .replace(/\r/g, '\n')        // Normalize old Mac line breaks
      .replace(/\t/g, '    ')      // Convert tabs to spaces
      .replace(/\u00A0/g, ' ')     // Convert non-breaking spaces
      .replace(/ +/g, ' ')         // Collapse multiple spaces
      .replace(/\n{3,}/g, '\n\n')  // Maximum 2 consecutive line breaks
      .trim();
  }

  static preserveLineBreaks(content) {
    return content
      .replace(/\r\n/g, '\n')      // Normalize Windows line breaks
      .replace(/\r/g, '\n')        // Normalize old Mac line breaks
      .replace(/\u2028/g, '\n')    // Convert line separators
      .replace(/\u2029/g, '\n\n')  // Convert paragraph separators
      .replace(/\n{3,}/g, '\n\n'); // Maximum 2 consecutive line breaks
  }

  // NEW: Clean up excessive line breaks to prevent text overflow  
  static cleanTextForRendering(text) {
    if (!text) return '';
    
    return text
      // Remove excessive line breaks (more than 2 consecutive)
      .replace(/\n{3,}/g, '\n\n')
      // Remove line breaks followed by only whitespace and then another line break
      .replace(/\n\s*\n/g, '\n\n')
      // Remove trailing whitespace on lines (but preserve single spaces between words)
      .replace(/[ \t]+\n/g, '\n')
      // Clean up multiple spaces (but preserve single spaces - IMPORTANT for word separation)
      .replace(/[ \t]{3,}/g, '  ') // Reduce 3+ spaces to 2 spaces max
      // Remove leading/trailing whitespace
      .trim();
  }

  // ENHANCED: Better line break processing that preserves word spaces
  static sophisticatedLineBreakProcessing(content) {
    if (!content) return '';
    
    // DEBUG: Track if problematic text is being processed
    const hasProblematicText = content.includes('pavoluptusda') || (content.includes('pa') && content.includes('voluptusda'));
    if (hasProblematicText) {
      console.log('🔧 IDMLUtils.sophisticatedLineBreakProcessing:');
      console.log('   - Input:', JSON.stringify(content));
    }
    
    // First clean up the content but preserve word spaces
    let processed = this.cleanTextForRendering(content);
    
    if (hasProblematicText) {
      console.log('   - After cleanTextForRendering:', JSON.stringify(processed));
    }
    
    // Normalize line breaks but don't touch word spaces
    processed = processed
      .replace(/\r\n/g, '\n')      // Normalize Windows line breaks
      .replace(/\r/g, '\n')        // Normalize old Mac line breaks
      .replace(/\u2028/g, '\n')    // Convert line separators
      .replace(/\u2029/g, '\n\n')  // Convert paragraph separators to double breaks
      .replace(/\u000A/g, '\n');   // Convert explicit line feed characters
    
    // Ensure paragraph breaks are properly spaced
    processed = processed.replace(/\n\n+/g, '\n\n');
    
    if (hasProblematicText) {
      console.log('   - Final output:', JSON.stringify(processed));
      console.log('   - Contains "pa voluptusda":', processed.includes('pa voluptusda'));
      console.log('   - Contains "pavoluptusda":', processed.includes('pavoluptusda'));
    }
    
    return processed;
  }

  static countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  static parseNumeric(value) {
    if (value === null || value === undefined || value === '') return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  static isImageFile(fileName) {
    const imageExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.tiff', '.tif', '.bmp', '.svg', 
      '.eps', '.ai', '.psd', '.webp', '.ico', '.jfif', '.jp2', '.jpx'
    ];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  }

  static getImageExtension(imageTypeName) {
    const typeMap = {
      '$ID/JPEG': 'jpg',
      '$ID/PNG': 'png', 
      '$ID/TIFF': 'tif',
      '$ID/GIF': 'gif',
      '$ID/BMP': 'bmp'
    };
    return typeMap[imageTypeName] || 'jpg';
  }

  static getImageExtensionFromFormat(format) {
    const formatMap = {
      '$ID/JPEG': 'jpg',
      '$ID/PNG': 'png',
      '$ID/TIFF': 'tif',
      '$ID/GIF': 'gif',
      '$ID/BMP': 'bmp'
    };
    return formatMap[format] || 'jpg';
  }

  static extractImageNameFromLink(linkUri) {
    if (!linkUri) return null;
    
    // Extract filename from path like "file:C:/Users/lalo/Downloads/Tesla-Model-3.jpg 13325 "
    const match = linkUri.match(/([^\/\\]+)\.[^.]+$/);
    return match ? match[1] : null;
  }

  static calculateCoordinateOffset(elements) {
    let minX = 0, minY = 0;
    let maxStrokeWidth = 0;
    
    // First pass: find minimum coordinates and maximum stroke width
    elements.forEach(element => {
      const bounds = element.geometricBounds || element.originalBounds;
      const transform = element.itemTransform || { tx: 0, ty: 0 };
      
      if (bounds) {
        // Calculate final position after transform
        const finalX = (bounds.left || 0) + (transform.tx || 0);
        const finalY = (bounds.top || 0) + (transform.ty || 0);
        
        minX = Math.min(minX, finalX);
        minY = Math.min(minY, finalY);
        
        // Track maximum stroke width for intelligent padding
        const strokeWidth = element.strokeWeight || 0;
        maxStrokeWidth = Math.max(maxStrokeWidth, strokeWidth);
      }
    });
    
    // ULTRA-SMART PADDING CALCULATION:
    // - No padding if no strokes exist or strokes are minimal
    // - Half of max stroke width to prevent stroke clipping
    // - Only when actually needed (negative coordinates)
    let intelligentPadding = 0;
    if (maxStrokeWidth > 0) {
      intelligentPadding = Math.ceil(maxStrokeWidth / 2); // Half stroke width to prevent clipping
    } else {
      intelligentPadding = 0; // No padding needed if no strokes
    }
    
    // PERFECT OFFSET CALCULATION:
    // - Zero offset if all coordinates are positive (most common case)
    // - Exact offset to make negative coordinates positive + minimal stroke padding only when needed
    const offsetX = minX < 0 ? Math.abs(minX) + intelligentPadding : 0;
    const offsetY = minY < 0 ? Math.abs(minY) + intelligentPadding : 0;
    
    console.log(`🎯 SMART OFFSET: X: ${offsetX}, Y: ${offsetY} (minX: ${minX}, minY: ${minY})`);
    console.log(`   Max stroke width: ${maxStrokeWidth}px → intelligent padding: ${intelligentPadding}px`);
    console.log(`   ${minX < 0 ? `⚠️  Negative X: ${minX} → offset ${Math.abs(minX)} + padding ${intelligentPadding}` : '✅ X positive → no offset'}`);
    console.log(`   ${minY < 0 ? `⚠️  Negative Y: ${minY} → offset ${Math.abs(minY)} + padding ${intelligentPadding}` : '✅ Y positive → no offset'}`);
    
    return { x: offsetX, y: offsetY };
  }

  static calculateBoundsFromPath(item) {
    try {
      // First try to get bounds from GeometricBounds attribute
      if (item['@_GeometricBounds']) {
        return this.parseGeometricBounds(item['@_GeometricBounds']);
      }
      
      // Then try path geometry
      const pathGeometry = item?.Properties?.PathGeometry?.GeometryPathType?.PathPointArray?.PathPointType;
      
      if (!pathGeometry || !Array.isArray(pathGeometry)) {
        console.log(`Warning: No geometry found for ${item['@_Self']}, using item transform`);
        
        // Fallback to item transform if available
        const transform = this.parseTransform(item['@_ItemTransform']);
        return {
          top: transform.ty || 0,
          left: transform.tx || 0,
          bottom: (transform.ty || 0) + 100, // Default height
          right: (transform.tx || 0) + 100,  // Default width
          width: 100,
          height: 100
        };
      }
      
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      pathGeometry.forEach(point => {
        const anchor = point['@_Anchor'];
        if (anchor) {
          const [x, y] = anchor.split(' ').map(parseFloat);
          if (!isNaN(x) && !isNaN(y)) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      });
      
      if (minX === Infinity || minY === Infinity) {
        console.log(`Warning: Could not calculate bounds for ${item['@_Self']}`);
        return { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 };
      }
      
      return {
        top: minY,
        left: minX,
        bottom: maxY,
        right: maxX,
        width: maxX - minX,
        height: maxY - minY
      };
      
    } catch (error) {
      console.error(`Error calculating bounds for ${item['@_Self']}:`, error);
      return { top: 0, left: 0, bottom: 100, right: 100, width: 100, height: 100 };
    }
  }

  static calculateRelativePosition(frameBounds, contentBounds, frameTransform, contentTransform) {
    if (!frameBounds || !contentBounds) return null;
    
    return {
      offsetX: (contentBounds.left || 0) - (frameBounds.left || 0),
      offsetY: (contentBounds.top || 0) - (frameBounds.top || 0),
      scaleX: contentTransform?.a || 1,
      scaleY: contentTransform?.d || 1,
      transformDifference: {
        frame: frameTransform,
        content: contentTransform
      }
    };
  }

  static calculateGap(frameBounds, contentBounds) {
    if (!frameBounds || !contentBounds) return null;
    
    return {
      top: (contentBounds.top || 0) - (frameBounds.top || 0),
      left: (contentBounds.left || 0) - (frameBounds.left || 0),
      bottom: (frameBounds.bottom || 0) - (contentBounds.bottom || 0),
      right: (frameBounds.right || 0) - (contentBounds.right || 0)
    };
  }

  static calculateImagePositionInFrame(frameBounds, frameTransform, placedContent) {
    if (!frameBounds || !placedContent?.transform) {
      return null;
    }
    
    const imageTransform = placedContent.transform;
    
    // Calculate image position relative to frame
    const imageX = (frameBounds.left || 0) + (imageTransform.tx || 0);
    const imageY = (frameBounds.top || 0) + (imageTransform.ty || 0);
    
    // Calculate image size with scaling
    const imageWidth = (frameBounds.width || 0) * (imageTransform.a || 1);
    const imageHeight = (frameBounds.height || 0) * (imageTransform.d || 1);
    
    return {
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
      scaleX: imageTransform.a || 1,
      scaleY: imageTransform.d || 1
    };
  }

  static getXMLStructure(obj, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth || typeof obj !== 'object' || obj === null) {
      return typeof obj;
    }
    
    const structure = {};
    
    Object.keys(obj).forEach(key => {
      if (Array.isArray(obj[key])) {
        structure[key] = `Array[${obj[key].length}]`;
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        structure[key] = this.getXMLStructure(obj[key], maxDepth, currentDepth + 1);
      } else {
        structure[key] = typeof obj[key];
      }
    });
    
    return structure;
  }

  static isFormattingAttribute(attributeName) {
    const formattingAttributes = [
      '@_PointSize', '@_Leading', '@_Tracking', '@_FontStyle',
      '@_AppliedFont', '@_FillColor', '@_StrokeColor', '@_Justification',
      '@_LeftIndent', '@_RightIndent', '@_FirstLineIndent',
      '@_SpaceBefore', '@_SpaceAfter', '@_Alignment'
    ];
    return formattingAttributes.includes(attributeName);
  }

  static saveDebugInfo(debugInfo, fileName) {
    try {
      fs.writeFileSync(fileName, JSON.stringify(debugInfo, null, 2));
      console.log(`✅ Debug info saved to ${fileName}`);
    } catch (error) {
      console.error('❌ Error saving debug info:', error);
      console.log('Debug info (first 2000 chars):', JSON.stringify(debugInfo, null, 2).substring(0, 2000));
    }
  }
}

module.exports = IDMLUtils; 

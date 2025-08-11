import path from "path";
import fs from "fs";

class IDMLUtils {
  static parseGeometricBounds(boundsString) {
    if (!boundsString || boundsString === "undefined") {
      return {
        top: 0,
        left: 0,
        bottom: 100,
        right: 100,
        width: 100,
        height: 100,
      };
    }

    const bounds = boundsString.split(" ").map(parseFloat);
    const result = {
      top: bounds[0] || 0,
      left: bounds[1] || 0,
      bottom: bounds[2] || 0,
      right: bounds[3] || 0,
      width: (bounds[3] || 0) - (bounds[1] || 0),
      height: (bounds[2] || 0) - (bounds[0] || 0),
    };

    return result;
  }

  static parseTransform(transformString) {
    if (!transformString) return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

    const values = transformString.split(" ").map(parseFloat);
    return {
      a: values[0] || 1, // x scale
      b: values[1] || 0, // y skew
      c: values[2] || 0, // x skew
      d: values[3] || 1, // y scale
      tx: values[4] || 0, // x translation
      ty: values[5] || 0, // y translation
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
      bottomRight: { x: bounds.right, y: bounds.bottom },
    };

    // Apply transformation to corners
    Object.keys(corners).forEach((corner) => {
      const point = corners[corner];
      corners[corner] = {
        x: transform.a * point.x + transform.c * point.y + transform.tx,
        y: transform.b * point.x + transform.d * point.y + transform.ty,
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
    if (!colorRef || colorRef === "Color/None") return null;

    // Handle CMYK colors
    const cmykMatch = colorRef.match(
      /Color\/C=(\d+)\s*M=(\d+)\s*Y=(\d+)\s*K=(\d+)/
    );
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
      "Color/Black": "rgb(0, 0, 0)",
      "Color/White": "rgb(255, 255, 255)",
      "Color/Red": "rgb(255, 0, 0)",
      "Color/Green": "rgb(0, 255, 0)",
      "Color/Blue": "rgb(0, 0, 255)",
      "Color/Cyan": "rgb(0, 255, 255)",
      "Color/Magenta": "rgb(255, 0, 255)",
      "Color/Yellow": "rgb(255, 255, 0)",
      "Color/Paper": "rgb(255, 255, 255)",
      "Color/Registration": "rgb(0, 0, 0)",
    };

    return standardColors[colorRef] || null;
  }

  static decodeXMLEntities(text) {
    if (!text) return "";

    return text
      .replace(/&#x000A;/g, "\n") // Line feed
      .replace(/&#x000D;/g, "\r") // Carriage return
      .replace(/&#x0009;/g, "\t") // Tab
      .replace(/&#x00A0;/g, "\u00A0") // Non-breaking space
      .replace(/&#x2028;/g, "\n") // Line separator
      .replace(/&#x2029;/g, "\u2029") // Paragraph separator
      .replace(/&#10;/g, "\n") // Decimal line feed
      .replace(/&#13;/g, "\r") // Decimal carriage return
      .replace(/&#9;/g, "\t") // Decimal tab
      .replace(/&#160;/g, "\u00A0") // Decimal non-breaking space
      .replace(/&lt;/g, "<") // Less than
      .replace(/&gt;/g, ">") // Greater than
      .replace(/&amp;/g, "&") // Ampersand (must be last)
      .replace(/&quot;/g, '"') // Quote
      .replace(/&apos;/g, "'"); // Apostrophe
  }

  static cleanTextContent(content) {
    return (
      content
        .replace(/\r\n/g, "\n") // Normalize Windows line breaks
        .replace(/\r/g, "\n") // Normalize old Mac line breaks
        .replace(/\t/g, "    ") // Convert tabs to spaces
        .replace(/\u00A0/g, " ") // Convert non-breaking spaces
        .replace(/ +/g, " ") // Collapse multiple spaces
        // REMOVED: .replace(/\n{3,}/g, '\n\n')  // Allow unlimited consecutive line breaks
        .trim()
    );
  }

  static preserveLineBreaks(content) {
    return content
      .replace(/\r\n/g, "\n") // Normalize Windows line breaks
      .replace(/\r/g, "\n") // Normalize old Mac line breaks
      .replace(/\u2028/g, "\n") // Convert line separators
      .replace(/\u2029/g, "\n\n"); // Convert paragraph separators
    // REMOVED: .replace(/\n{3,}/g, '\n\n'); // Allow unlimited consecutive line breaks
  }

  // NEW: Clean up excessive line breaks to prevent text overflow
  static cleanTextForRendering(text) {
    if (!text) return "";
    return (
      text
        // Normalize line endings
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        // Remove trailing whitespace on each line only
        .replace(/[ \t]+\n/g, "\n")
    );
    // DO NOT collapse multiple spaces, tabs, or newlines
    // DO NOT trim the whole string
  }

  // ENHANCED: Better line break processing that preserves word spaces
  static sophisticatedLineBreakProcessing(content) {
    if (!content) return "";

    // DEBUG: Track if problematic text is being processed
    const hasProblematicText =
      content.includes("pavoluptusda") ||
      (content.includes("pa") && content.includes("voluptusda"));
    if (hasProblematicText) {
    }

    // First clean up the content but preserve word spaces
    let processed = this.cleanTextForRendering(content).replace(
      /\u2028/g,
      "\n"
    );

    if (hasProblematicText) {
      console.log(
        "   - After cleanTextForRendering:",
        JSON.stringify(processed)
      );
    }

    // Normalize line breaks but don't touch word spaces
    // processed = processed
    //   .replace(/\r\n/g, '\n')      // Normalize Windows line breaks
    //   .replace(/\r/g, '\n')        // Normalize old Mac line breaks
    //   .replace(/\u2029/g, '\n')    // Convert line separators
    //   .replace(/\u2028/g, '\n\n')  // Convert paragraph separators to double breaks
    //   .replace(/\u000A/g, '\n');   // Convert explicit line feed characters

    // Ensure paragraph breaks are properly spaced
    // processed = processed.replace(/\n\n+/g, '\n\n'); // REMOVE THIS LINE to preserve all consecutive newlines

    return processed;
  }

  static countWords(text) {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  static parseNumeric(value) {
    if (value === null || value === undefined || value === "") return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  }

  static isImageFile(fileName) {
    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".tiff",
      ".tif",
      ".bmp",
      ".svg",
      ".eps",
      ".ai",
      ".psd",
      ".webp",
      ".ico",
      ".jfif",
      ".jp2",
      ".jpx",
    ];
    return imageExtensions.some((ext) => fileName.toLowerCase().endsWith(ext));
  }

  static getImageExtension(imageTypeName) {
    const typeMap = {
      "$ID/JPEG": "jpg",
      "$ID/PNG": "png",
      "$ID/TIFF": "tif",
      "$ID/GIF": "gif",
      "$ID/BMP": "bmp",
    };
    return typeMap[imageTypeName] || "jpg";
  }

  static getImageExtensionFromFormat(format) {
    const formatMap = {
      "$ID/JPEG": "jpg",
      "$ID/PNG": "png",
      "$ID/TIFF": "tif",
      "$ID/GIF": "gif",
      "$ID/BMP": "bmp",
    };
    return formatMap[format] || "jpg";
  }

  static extractImageNameFromLink(linkUri) {
    if (!linkUri) return null;

    // Extract filename from path like "file:C:/Users/lalo/Downloads/Tesla-Model-3.jpg 13325 "
    const match = linkUri.match(/([^\/\\]+)\.[^.]+$/);
    return match ? match[1] : null;
  }

  static calculateCoordinateOffset(elements) {
    if (!elements || elements.length === 0) {
      console.log("🚫 No elements provided for coordinate offset calculation");
      return { x: 0, y: 0 };
    }

    let minX = Infinity,
      minY = Infinity;
    let maxStrokeWidth = 0;
    let validElements = 0;

    console.log(
      `🔍 ANALYZING ${elements.length} elements for coordinate offset...`
    );

    // First pass: find TRUE minimum coordinates across all elements
    elements.forEach((element, index) => {
      const bounds = element.geometricBounds || element.originalBounds;
      const transform = element.itemTransform || { tx: 0, ty: 0 };

      if (bounds && (bounds.left !== undefined || bounds.top !== undefined)) {
        // Calculate final position after transform
        const finalX = (bounds.left || 0) + (transform.tx || 0);
        const finalY = (bounds.top || 0) + (transform.ty || 0);

        console.log(
          `   Element ${index}: bounds(${bounds.left}, ${bounds.top}) + transform(${transform.tx}, ${transform.ty}) = final(${finalX}, ${finalY})`
        );

        minX = Math.min(minX, finalX);
        minY = Math.min(minY, finalY);
        validElements++;

        // Track maximum stroke width for intelligent padding
        const strokeWidth = element.strokeWeight || 0;
        maxStrokeWidth = Math.max(maxStrokeWidth, strokeWidth);
      } else {
        console.log(`   Element ${index}: No valid bounds - skipping`);
      }
    });

    // Handle case where no valid elements found
    if (validElements === 0) {
      console.log(
        "⚠️  No valid elements with bounds found - using zero offset"
      );
      return { x: 0, y: 0 };
    }

    // Reset infinite values to 0 if no valid coordinates found
    if (minX === Infinity) minX = 0;
    if (minY === Infinity) minY = 0;

    console.log(
      `📊 ANALYSIS COMPLETE: minX=${minX}, minY=${minY}, maxStroke=${maxStrokeWidth}px, validElements=${validElements}`
    );

    // ZERO-BASED OFFSET CALCULATION:
    // The goal is to have NO OFFSET unless absolutely necessary for negative coordinates
    let offsetX = 0;
    let offsetY = 0;

    // Only add offset if coordinates are actually negative
    if (minX < 0) {
      offsetX = Math.abs(minX);
      console.log(
        `❌ Negative X detected: ${minX} → adding offset: ${offsetX}`
      );
    }

    if (minY < 0) {
      offsetY = Math.abs(minY);
      console.log(
        `❌ Negative Y detected: ${minY} → adding offset: ${offsetY}`
      );
    }

    // Add minimal stroke padding only if we already have an offset
    if ((offsetX > 0 || offsetY > 0) && maxStrokeWidth > 0) {
      const strokePadding = Math.ceil(maxStrokeWidth / 2);
      if (offsetX > 0) offsetX += strokePadding;
      if (offsetY > 0) offsetY += strokePadding;
    }

    console.log(`🎯 FINAL OFFSET: X=${offsetX}, Y=${offsetY}`);
    console.log(
      `   ${
        offsetX === 0
          ? "✅ Perfect! No X offset needed"
          : `⚠️ X offset: ${offsetX}px (${minX} was negative)`
      }`
    );
    console.log(
      `   ${
        offsetY === 0
          ? "✅ Perfect! No Y offset needed"
          : `⚠️ Y offset: ${offsetY}px (${minY} was negative)`
      }`
    );

    return { x: offsetX, y: offsetY };
  }

  /**
   * Calculate precise coordinate offset for pixel-perfect InDesign coordinate system transformation
   * This ensures accurate positioning similar to professional tools like IMG.LY InDesign
   * @param {Array} elements - Array of elements with bounds and transforms
   * @returns {Object} - {x, y} offset for coordinate transformation
   */
  static calculateCoordinateOffsetPrecise(elements) {
    if (!elements || elements.length === 0) {
      console.warn("🎯 No elements provided for coordinate offset calculation");
      return { x: 0, y: 0 };
    }

    console.log(
      "🔍 ANALYZING",
      elements.length,
      "elements for PRECISE coordinate offset..."
    );

    let minX = Infinity;
    let minY = Infinity;
    let maxStroke = 0;
    let validElements = 0;

    elements.forEach((element, index) => {
      if (!element.geometricBounds || !element.itemTransform) {
        console.warn(
          `   ⚠️ Element ${index} missing bounds/transform - skipping`
        );
        return;
      }

      // Calculate final position (bounds + transform)
      const finalX = element.geometricBounds.left + element.itemTransform.tx;
      const finalY = element.geometricBounds.top + element.itemTransform.ty;

      // Track stroke width for precise positioning
      const strokeWidth = element.strokeWeight || 0;
      maxStroke = Math.max(maxStroke, strokeWidth);

      console.log(
        `   Element ${index}: bounds(${element.geometricBounds.left}, ${element.geometricBounds.top}) + transform(${element.itemTransform.tx}, ${element.itemTransform.ty}) = final(${finalX}, ${finalY})`
      );

      minX = Math.min(minX, finalX);
      minY = Math.min(minY, finalY);
      validElements++;
    });

    console.log(
      "📊 ANALYSIS COMPLETE:",
      `minX=${minX}, minY=${minY}, maxStroke=${maxStroke}px, validElements=${validElements}`
    );

    // FIXED: Only add offset if coordinates are actually negative
    // Don't force elements to start at origin - preserve InDesign positioning
    let offsetX = 0;
    let offsetY = 0;

    // Only handle negative coordinates that would be clipped by the browser
    if (minX < 0) {
      offsetX = Math.abs(minX) + maxStroke;
      console.log(
        `❌ Negative X detected: ${minX} → adding offset: ${offsetX}`
      );
    } else {
    }

    if (minY < 0) {
      offsetY = Math.abs(minY) + maxStroke;
      console.log(
        `❌ Negative Y detected: ${minY} → adding offset: ${offsetY}`
      );
    } else {
    }

    const finalOffset = { x: offsetX, y: offsetY };

    console.log("🎯 FINAL PRECISE OFFSET:", `X=${offsetX}, Y=${offsetY}`);
    console.log(
      `   ${
        offsetX === 0
          ? "✅ Perfect! No X offset needed"
          : `⚠️ X offset: ${offsetX}px (compensating for negative coordinates)`
      }`
    );
    console.log(
      `   ${
        offsetY === 0
          ? "✅ Perfect! No Y offset needed"
          : `⚠️ Y offset: ${offsetY}px (compensating for negative coordinates)`
      }`
    );

    return finalOffset;
  }

  static calculateBoundsFromPath(item) {
    try {
      // First try to get bounds from GeometricBounds attribute
      if (item["@_GeometricBounds"]) {
        return this.parseGeometricBounds(item["@_GeometricBounds"]);
      }

      // Then try path geometry
      const pathGeometry =
        item?.Properties?.PathGeometry?.GeometryPathType?.PathPointArray
          ?.PathPointType;

      if (!pathGeometry || !Array.isArray(pathGeometry)) {
        console.log(
          `Warning: No geometry found for ${item["@_Self"]}, using item transform`
        );

        // Fallback to item transform if available
        const transform = this.parseTransform(item["@_ItemTransform"]);
        return {
          top: transform.ty || 0,
          left: transform.tx || 0,
          bottom: (transform.ty || 0) + 100, // Default height
          right: (transform.tx || 0) + 100, // Default width
          width: 100,
          height: 100,
        };
      }

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      pathGeometry.forEach((point) => {
        const anchor = point["@_Anchor"];
        if (anchor) {
          const [x, y] = anchor.split(" ").map(parseFloat);
          if (!isNaN(x) && !isNaN(y)) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        }
      });

      if (minX === Infinity || minY === Infinity) {
        console.log(
          `Warning: Could not calculate bounds for ${item["@_Self"]}`
        );
        return {
          top: 0,
          left: 0,
          bottom: 100,
          right: 100,
          width: 100,
          height: 100,
        };
      }

      return {
        top: minY,
        left: minX,
        bottom: maxY,
        right: maxX,
        width: maxX - minX,
        height: maxY - minY,
      };
    } catch (error) {
      console.error(`Error calculating bounds for ${item["@_Self"]}:`, error);
      return {
        top: 0,
        left: 0,
        bottom: 100,
        right: 100,
        width: 100,
        height: 100,
      };
    }
  }

  static calculateRelativePosition(
    frameBounds,
    contentBounds,
    frameTransform,
    contentTransform
  ) {
    if (!frameBounds || !contentBounds) return null;

    return {
      offsetX: (contentBounds.left || 0) - (frameBounds.left || 0),
      offsetY: (contentBounds.top || 0) - (frameBounds.top || 0),
      scaleX: contentTransform?.a || 1,
      scaleY: contentTransform?.d || 1,
      transformDifference: {
        frame: frameTransform,
        content: contentTransform,
      },
    };
  }

  static calculateGap(frameBounds, contentBounds) {
    if (!frameBounds || !contentBounds) return null;

    return {
      top: (contentBounds.top || 0) - (frameBounds.top || 0),
      left: (contentBounds.left || 0) - (frameBounds.left || 0),
      bottom: (frameBounds.bottom || 0) - (contentBounds.bottom || 0),
      right: (frameBounds.right || 0) - (contentBounds.right || 0),
    };
  }

  static calculateImagePositionInFrame(
    frameBounds,
    frameTransform,
    placedContent
  ) {
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
      scaleY: imageTransform.d || 1,
    };
  }

  static getXMLStructure(obj, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth || typeof obj !== "object" || obj === null) {
      return typeof obj;
    }

    const structure = {};

    Object.keys(obj).forEach((key) => {
      if (Array.isArray(obj[key])) {
        structure[key] = `Array[${obj[key].length}]`;
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        structure[key] = this.getXMLStructure(
          obj[key],
          maxDepth,
          currentDepth + 1
        );
      } else {
        structure[key] = typeof obj[key];
      }
    });

    return structure;
  }

  static isFormattingAttribute(attributeName) {
    const formattingAttributes = [
      "@_PointSize",
      "@_Leading",
      "@_Tracking",
      "@_FontStyle",
      "@_AppliedFont",
      "@_FillColor",
      "@_StrokeColor",
      "@_Justification",
      "@_LeftIndent",
      "@_RightIndent",
      "@_FirstLineIndent",
      "@_SpaceBefore",
      "@_SpaceAfter",
      "@_Alignment",
    ];
    return formattingAttributes.includes(attributeName);
  }

  /**
   * Validate unit conversion results and log any issues
   * @param {Object} documentData - Processed document data
   * @param {Object} unitConverter - UnitConverter instance
   * @returns {Object} Validation results
   */
  static validateUnitConversions(documentData, unitConverter) {
    const validation = {
      pageDimensions: { valid: true, issues: [] },
      fontSizes: { valid: true, issues: [] },
      doubleConversions: { valid: true, issues: [] },
      totalIssues: 0,
    };

    // Validate page dimensions
    if (documentData.pageInfo?.dimensions) {
      const dims = documentData.pageInfo.dimensions;
      if (dims.units && dims.units !== "Pixels" && !dims.pixelDimensions) {
        validation.pageDimensions.valid = false;
        validation.pageDimensions.issues.push(
          `Page dimensions in ${dims.units} not converted to pixels`
        );
        validation.totalIssues++;
      } else if (dims.pixelDimensions) {
        console.log(
          `✅ Page dimensions converted: ${dims.width}x${dims.height} ${dims.units} → ${dims.pixelDimensions.width}x${dims.pixelDimensions.height} px`
        );
      }
    }

    // Validate font sizes in styles
    if (documentData.styles) {
      // Check paragraph styles
      Object.values(documentData.styles.paragraph || {}).forEach(
        (style, index) => {
          if (style.pointSize && !style.fontSize && unitConverter) {
            validation.fontSizes.valid = false;
            validation.fontSizes.issues.push(
              `Paragraph style ${index}: font size not converted to pixels`
            );
            validation.totalIssues++;
          }
        }
      );

      // Check character styles
      Object.values(documentData.styles.character || {}).forEach(
        (style, index) => {
          if (style.pointSize && !style.fontSize && unitConverter) {
            validation.fontSizes.valid = false;
            validation.fontSizes.issues.push(
              `Character style ${index}: font size not converted to pixels`
            );
            validation.totalIssues++;
          }
        }
      );
    }

    // Validate font sizes in stories
    if (documentData.stories) {
      Object.values(documentData.stories).forEach((story, storyIndex) => {
        if (story.formattedContent) {
          story.formattedContent.forEach((segment, segmentIndex) => {
            if (
              segment.formatting?.fontSize &&
              typeof segment.formatting.fontSize === "number"
            ) {
              // Check if font size is reasonable (between 1 and 200 pixels)
              if (
                segment.formatting.fontSize < 1 ||
                segment.formatting.fontSize > 200
              ) {
                validation.fontSizes.valid = false;
                validation.fontSizes.issues.push(
                  `Story ${storyIndex}, segment ${segmentIndex}: suspicious font size ${segment.formatting.fontSize}px`
                );
                validation.totalIssues++;
              }
            }
          });
        }
      });
    }

    // ENHANCED: Check for double conversion issues
    if (documentData.elements) {
      documentData.elements.forEach((element, index) => {
        // Check if geometric bounds have conversion flags
        if (
          element.geometricBounds &&
          element.geometricBounds._convertedToPixels
        ) {
          console.log(
            `✅ Element ${index}: Geometric bounds properly marked as converted`
          );
        } else if (
          element.geometricBounds &&
          element.position &&
          element.position._conversionInfo
        ) {
        } else if (element.geometricBounds) {
          validation.doubleConversions.valid = false;
          validation.doubleConversions.issues.push(
            `Element ${index}: Geometric bounds may not be converted to pixels`
          );
          validation.totalIssues++;
        }
      });
    }

    if (validation.totalIssues === 0) {
      console.log(
        "✅ All unit conversions validated successfully - no double conversions detected"
      );
    } else {
      console.warn(
        `⚠️ Found ${validation.totalIssues} unit conversion issues:`
      );
      validation.pageDimensions.issues.forEach((issue) =>
        console.warn(`  - ${issue}`)
      );
      validation.fontSizes.issues.forEach((issue) =>
        console.warn(`  - ${issue}`)
      );
      validation.doubleConversions.issues.forEach((issue) =>
        console.warn(`  - ${issue}`)
      );
    }

    return validation;
  }
}

// ES6 exports
export default IDMLUtils;

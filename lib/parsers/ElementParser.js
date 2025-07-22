const path = require("path");
const IDMLUtils = require("../utils/IDMLUtils");

class ElementParser {
  constructor(unitConverter = null) {
    this.elements = [];
    this.unitConverter = unitConverter; // ADDED: Unit converter for geometric bounds
    this.documentUnits = null; // Will be set by DocumentParser
  }

  // ADDED: Method to set document units for element conversion
  setDocumentUnits(units) {
    this.documentUnits = units;
    console.log("📐 ElementParser: Set document units to", units);
  }

  // ADDED: Method to convert geometric bounds if needed
  convertBoundsToPixels(bounds) {
    if (!bounds || !this.unitConverter || !this.documentUnits) {
      return bounds;
    }

    // Only convert if we have a supported unit and it's not already pixels
    if (this.unitConverter.isSupportedUnit(this.documentUnits)) {
      const convertedBounds = this.unitConverter.convertObjectToPixels(
        bounds,
        this.documentUnits
      );
      console.log(`📐 Converted bounds from ${this.documentUnits} to pixels:`, {
        original: bounds,
        converted: convertedBounds,
      });
      return convertedBounds;
    }

    return bounds;
  }

  // ADDED: Method to convert transform coordinates (tx, ty) to pixels
  convertTransformToPixels(transform) {
    if (!transform || !this.unitConverter || !this.documentUnits) {
      return transform;
    }

    // Only convert if we have a supported unit and it's not already pixels
    if (this.unitConverter.isSupportedUnit(this.documentUnits)) {
      // Convert only the translation values (tx, ty) to pixels
      // Keep scale/rotation values (a, b, c, d) unchanged as they're ratios
      const convertedTransform = {
        ...transform,
        tx: transform.tx
          ? this.unitConverter.toPixels(transform.tx, this.documentUnits)
          : 0,
        ty: transform.ty
          ? this.unitConverter.toPixels(transform.ty, this.documentUnits)
          : 0,
      };

      console.log(
        `📐 Converted transform from ${this.documentUnits} to pixels:`,
        {
          original: { tx: transform.tx, ty: transform.ty },
          converted: { tx: convertedTransform.tx, ty: convertedTransform.ty },
        }
      );

      return convertedTransform;
    }

    return transform;
  }

  // ADDED: Method to convert single measurement values to pixels
  convertMeasurementToPixels(value) {
    if (
      typeof value !== "number" ||
      isNaN(value) ||
      !this.unitConverter ||
      !this.documentUnits
    ) {
      return value;
    }

    // Only convert if we have a supported unit and it's not already pixels
    if (this.unitConverter.isSupportedUnit(this.documentUnits)) {
      const convertedValue = this.unitConverter.toPixels(
        value,
        this.documentUnits
      );
      console.log(
        `📐 Converted measurement: ${value} ${this.documentUnits} → ${convertedValue} px`
      );
      return convertedValue;
    }

    return value;
  }

  extractSpreadPages(spreadData) {
    const pages = [];

    if (spreadData.Page) {
      const pageList = Array.isArray(spreadData.Page)
        ? spreadData.Page
        : [spreadData.Page];

      pageList.forEach((page, index) => {
        pages.push({
          self: page["@_Self"],
          name: page["@_Name"] || "",
          appliedMaster: page["@_AppliedMaster"] || "",
          geometricBounds: IDMLUtils.parseGeometricBounds(
            page["@_GeometricBounds"]
          ),
          itemTransform: IDMLUtils.parseTransform(page["@_ItemTransform"]),
        });
      });
    } else {
      console.log("No pages found in spread data");
    }

    console.log(`Extracted ${pages.length} pages`);
    return pages;
  }

  extractPageItems(spreadData) {
    const pageItems = [];

    // Extract different types of page items
    const itemTypes = [
      "Rectangle",
      "Oval",
      "Polygon",
      "GraphicLine",
      "TextFrame",
      "Group",
      "Button",
      "Table",
      "Image",
      "EPS",
      "PDF",
      "PlacedItem",
      "ContentFrame", // Add these
    ];

    itemTypes.forEach((itemType) => {
      if (spreadData[itemType]) {
        const items = Array.isArray(spreadData[itemType])
          ? spreadData[itemType]
          : [spreadData[itemType]];

        items.forEach((item) => {
          console.log(`Processing ${itemType}:`, item["@_Self"]);
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
      const pages = Array.isArray(spreadData.Page)
        ? spreadData.Page
        : [spreadData.Page];
      pages.forEach((page) => {
        itemTypes.forEach((itemType) => {
          if (page[itemType]) {
            console.log(
              `Found ${itemType} in page:`,
              Array.isArray(page[itemType]) ? page[itemType].length : 1
            );
            const items = Array.isArray(page[itemType])
              ? page[itemType]
              : [page[itemType]];

            items.forEach((item) => {
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
    console.log("🔍 Checking for nested content in elements...");

    // Check rectangles for placed images
    if (spreadData.Rectangle) {
      const rectangles = Array.isArray(spreadData.Rectangle)
        ? spreadData.Rectangle
        : [spreadData.Rectangle];

      rectangles.forEach((rect) => {
        // Look for ANY content inside rectangle - be more aggressive
        const possibleContent =
          rect.Image ||
          rect.PlacedImage ||
          rect.EPS ||
          rect.PDF ||
          rect.Properties?.Image ||
          rect.Properties?.PlacedImage ||
          rect.Link ||
          rect.Properties?.Link;

        if (possibleContent) {
          console.log(
            `📷 Found placed content in rectangle ${rect["@_Self"]}:`,
            possibleContent
          );

          // Update the rectangle to indicate it's a content frame
          const existingRect = pageItems.find(
            (item) => item.self === rect["@_Self"]
          );
          if (existingRect) {
            existingRect.hasPlacedContent = true;
            existingRect.contentType = "Image";

            // Extract placed content details with better handling
            existingRect.placedContent =
              this.extractPlacedContent(possibleContent);

            // IMPORTANT: Calculate the image position within the frame
            existingRect.imagePosition =
              IDMLUtils.calculateImagePositionInFrame(
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

    console.log("🔍 Extracting placed content:", content);

    const contentItem = Array.isArray(content) ? content[0] : content;

    console.log("Content item keys:", Object.keys(contentItem));

    // ENHANCED: Better href handling for embedded images
    let href = contentItem["@_href"] || contentItem["@_ActualPpi"] || "";
    let isEmbedded = false;

    // Check if this is an embedded image reference
    if (href && !href.startsWith("file://") && !href.includes("/")) {
      // This looks like an embedded image reference
      isEmbedded = true;
      console.log("🖼️ Detected embedded image reference:", href);
    }

    return {
      type: contentItem["@_type"] || "Image",
      href: href,
      isEmbedded: isEmbedded, // ADD THIS
      bounds: contentItem["@_GeometricBounds"]
        ? IDMLUtils.parseGeometricBounds(contentItem["@_GeometricBounds"])
        : null,
      transform: contentItem["@_ItemTransform"]
        ? IDMLUtils.parseTransform(contentItem["@_ItemTransform"])
        : null,
      actualPpi: contentItem["@_ActualPpi"],
      effectivePpi: contentItem["@_EffectivePpi"],
      imageTypeName: contentItem["@_ImageTypeName"],
      space: contentItem["@_Space"],
    };
  }

  parsePageItem(item, itemType) {
    // ADD: Validation
    if (!item || !item["@_Self"]) {
      console.warn(`Invalid ${itemType} item - missing self ID`);
      return null;
    }

    const baseItem = {
      type: itemType,
      self: item["@_Self"],
      name: item["@_Name"] || "",
      visible: item["@_Visible"] !== false,
      locked: item["@_Locked"] === true,

      // FIXED: Store original bounds and transforms without conversion
      // Unit conversion will be handled later in createElementPositionMapFixed
      geometricBounds: IDMLUtils.calculateBoundsFromPath(item),
      itemTransform: IDMLUtils.parseTransform(item["@_ItemTransform"]),

      itemLayer: item["@_ItemLayer"] || "",
      fillColor: item["@_FillColor"] || "Color/None",
      strokeColor: item["@_StrokeColor"] || "Color/None",
      // FIXED: Only convert stroke weight, not positioning data
      strokeWeight: this.convertMeasurementToPixels(
        parseFloat(item["@_StrokeWeight"]) || 0
      ),

      parentStory: item["@_ParentStory"] || null,

      // ENHANCED: Better content frame detection
      isContentFrame: false,
      hasPlacedContent: false,
      contentType: null,
    };

    // ADD: Detect content frames more accurately
    // ENHANCED: Better embedded image detection
    if (itemType === "Rectangle") {
      // Check for embedded images more thoroughly
      const embeddedInfo = this.detectEmbeddedImages(item);

      if (embeddedInfo.hasEmbeddedContent || embeddedInfo.isPlaceholder) {
        baseItem.isContentFrame = true;
        baseItem.hasPlacedContent = embeddedInfo.hasEmbeddedContent;
        baseItem.contentType = embeddedInfo.embeddedType || "placeholder";
        baseItem.isEmbedded = embeddedInfo.hasEmbeddedContent;
        baseItem.isPlaceholder = embeddedInfo.isPlaceholder;

        console.log(
          `📦 Detected ${
            embeddedInfo.hasEmbeddedContent ? "embedded" : "placeholder"
          } content frame: ${baseItem.self}`
        );
      }

      // Existing content frame detection logic...
      const hasContent = !!(
        item.Image ||
        item.PlacedImage ||
        item.EPS ||
        item.PDF ||
        item.Properties?.Image ||
        item.Properties?.PlacedImage
      );

      if (hasContent && !baseItem.isContentFrame) {
        baseItem.isContentFrame = true;
        baseItem.hasPlacedContent = true;
        baseItem.contentType = "Image";

        // Extract placed content transform for positioning
        const placedContent =
          item.Image || item.PlacedImage || item.EPS || item.PDF;
        if (placedContent) {
          baseItem.placedContent = this.extractPlacedContent(placedContent);
        }

        console.log(`📦 Detected external content frame: ${baseItem.self}`);
      }
    }

    // Type-specific processing...
    switch (itemType) {
      case "TextFrame":
        baseItem.textFramePreferences = this.parseTextFramePreferences(
          item.TextFramePreference
        );
        break;
      case "Rectangle":
        baseItem.cornerEffects = this.parseCornerEffects(item);
        break;
      case "Group":
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
      isPlaceholder: false,
    };

    // Check if element name indicates placeholder
    if (
      element.name &&
      (element.name.includes("[YOUR IMAGE HERE]") ||
        element.name.includes("[IMAGE]") ||
        element.name.toLowerCase().includes("placeholder"))
    ) {
      embeddedIndicators.isPlaceholder = true;
      embeddedIndicators.embeddedType = "placeholder";
    }

    // ENHANCED: Check for actual embedded image data
    if (element.placedContent) {
      const content = element.placedContent;

      // Check if href looks like an embedded reference
      if (content.href && content.isEmbedded) {
        embeddedIndicators.hasEmbeddedContent = true;
        embeddedIndicators.embeddedType = content.imageTypeName || "unknown";
        embeddedIndicators.embeddedData = content.href;
        embeddedIndicators.embeddedFileName = `${
          content.href
        }.${IDMLUtils.getImageExtension(content.imageTypeName)}`;
      }
    }

    return embeddedIndicators;
  }

  parseTextFramePreferences(textFramePreference) {
    if (!textFramePreference) return null;

    // FIXED: Convert all text frame measurements to pixels
    const rawTextColumnGutter =
      parseFloat(textFramePreference["@_TextColumnGutter"]) || 0;
    const rawInsetTop =
      parseFloat(textFramePreference["@_InsetSpacing"]?.split(" ")[0]) ||
      parseFloat(textFramePreference["@_TextInsetTop"]) ||
      0;
    const rawInsetRight =
      parseFloat(textFramePreference["@_InsetSpacing"]?.split(" ")[1]) ||
      parseFloat(textFramePreference["@_TextInsetRight"]) ||
      0;
    const rawInsetBottom =
      parseFloat(textFramePreference["@_InsetSpacing"]?.split(" ")[2]) ||
      parseFloat(textFramePreference["@_TextInsetBottom"]) ||
      0;
    const rawInsetLeft =
      parseFloat(textFramePreference["@_InsetSpacing"]?.split(" ")[3]) ||
      parseFloat(textFramePreference["@_TextInsetLeft"]) ||
      0;
    const rawMinimumFirstBaselineOffset =
      parseFloat(textFramePreference["@_MinimumFirstBaselineOffset"]) || 0;

    const preferences = {
      textColumnCount: parseInt(textFramePreference["@_TextColumnCount"]) || 1,
      textColumnGutter: this.convertMeasurementToPixels(rawTextColumnGutter),
      firstBaselineOffset:
        textFramePreference["@_FirstBaselineOffset"] || "AscentOffset",
      autoSizingReferencePoint:
        textFramePreference["@_AutoSizingReferencePoint"] || "CenterPoint",
      autoSizingType: textFramePreference["@_AutoSizingType"] || "Off",
      verticalJustification:
        textFramePreference["@_VerticalJustification"] || "TopAlign",

      // FIXED: Convert text frame insets to pixels
      insetSpacing: {
        top: this.convertMeasurementToPixels(rawInsetTop),
        right: this.convertMeasurementToPixels(rawInsetRight),
        bottom: this.convertMeasurementToPixels(rawInsetBottom),
        left: this.convertMeasurementToPixels(rawInsetLeft),
      },

      // FIXED: Store original values for reference
      originalInsetSpacing: {
        top: rawInsetTop,
        right: rawInsetRight,
        bottom: rawInsetBottom,
        left: rawInsetLeft,
      },

      // FIXED: Convert additional measurements to pixels
      useMinimumHeight: textFramePreference["@_UseMinimumHeight"] === true,
      minimumFirstBaselineOffset: this.convertMeasurementToPixels(
        rawMinimumFirstBaselineOffset
      ),
      originalMinimumFirstBaselineOffset: rawMinimumFirstBaselineOffset,
      ignoreWrap: textFramePreference["@_IgnoreWrap"] === true,
    };

    console.log(`📐 Converted text frame preferences to pixels:`, {
      textColumnGutter: `${rawTextColumnGutter} → ${preferences.textColumnGutter}px`,
      insets: `${rawInsetTop},${rawInsetRight},${rawInsetBottom},${rawInsetLeft} → ${preferences.insetSpacing.top},${preferences.insetSpacing.right},${preferences.insetSpacing.bottom},${preferences.insetSpacing.left}px`,
    });

    return preferences;
  }

  parseCornerEffects(item) {
    // Parse corner effects for rectangles
    return {
      topLeftCornerRadius: parseFloat(item["@_TopLeftCornerRadius"]) || 0,
      topRightCornerRadius: parseFloat(item["@_TopRightCornerRadius"]) || 0,
      bottomLeftCornerRadius: parseFloat(item["@_BottomLeftCornerRadius"]) || 0,
      bottomRightCornerRadius:
        parseFloat(item["@_BottomRightCornerRadius"]) || 0,
    };
  }

  extractGroupItems(groupItem) {
    const groupItems = [];

    // Groups can contain other page items
    const itemTypes = ["Rectangle", "Oval", "Polygon", "TextFrame"];

    itemTypes.forEach((itemType) => {
      if (groupItem[itemType]) {
        const items = Array.isArray(groupItem[itemType])
          ? groupItem[itemType]
          : [groupItem[itemType]];

        items.forEach((item) => {
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
      blendingSettings: transparencySettings.BlendingSetting
        ? {
            blendMode:
              transparencySettings.BlendingSetting["@_BlendMode"] || "Normal",
            opacity:
              parseFloat(transparencySettings.BlendingSetting["@_Opacity"]) ||
              100,
          }
        : null,
    };
  }

  createElementPositionMapFixed() {
    console.log("Creating PIXEL-PERFECT element position map...");
    console.log(
      `📐 Unit conversion status: converter=${!!this
        .unitConverter}, documentUnits=${this.documentUnits}`
    );

    // ENHANCED: Use precise coordinate offset calculation for pixel-perfect positioning
    const coordinateOffset = IDMLUtils.calculateCoordinateOffsetPrecise(
      this.elements
    );
    console.log(
      "📐 Calculated PRECISE coordinate offset for pixel-perfect positioning:",
      coordinateOffset
    );

    this.elements.forEach((element, index) => {
      console.log(
        `📐 ELEMENT ${index + 1} [${element.type}]: Coordinate transformation`
      );
      console.log(
        `   📍 Bounds: left=${element.geometricBounds.left}, top=${element.geometricBounds.top}, width=${element.geometricBounds.width}, height=${element.geometricBounds.height}`
      );
      console.log(
        `   📍 Transform: tx=${element.itemTransform.tx}, ty=${element.itemTransform.ty}`
      );
      console.log(
        `   📍 Coordinate offset: x=${coordinateOffset.x}, y=${coordinateOffset.y}`
      );

      // Apply coordinate system transformation to convert from InDesign to web coordinates
      const webX =
        element.geometricBounds.left +
        element.itemTransform.tx +
        coordinateOffset.x;
      const webY =
        element.geometricBounds.top +
        element.itemTransform.ty +
        coordinateOffset.y;

      console.log(
        `   📍 Web coordinates: (${webX}, ${webY}) ${element.geometricBounds.width}x${element.geometricBounds.height}`
      );

      // Create position object in original units
      element.position = {
        x: webX,
        y: webY,
        width: element.geometricBounds.width,
        height: element.geometricBounds.height,
        rotation: element.itemTransform.rotation || 0,
        _conversionInfo: {
          unitsConverted: false,
          originalUnits: this.documentUnits,
          pixelConversionApplied: false,
          dpi: this.unitConverter?.dpi || 96,
          coordinateOffset: coordinateOffset,
        },
      };

      // Apply unit conversion to pixels if converter is available
      if (this.unitConverter) {
        console.log("   📐 Applying unit conversion: Points → pixels");

        const pixelX = this.unitConverter.toPixels(webX, this.documentUnits);
        const pixelY = this.unitConverter.toPixels(webY, this.documentUnits);
        const pixelWidth = this.unitConverter.toPixels(
          element.geometricBounds.width,
          this.documentUnits
        );
        const pixelHeight = this.unitConverter.toPixels(
          element.geometricBounds.height,
          this.documentUnits
        );

        element.pixelPosition = {
          x: pixelX,
          y: pixelY,
          width: pixelWidth,
          height: pixelHeight,
          rotation: element.itemTransform.rotation || 0,
          _isConverted: true,
          _originalUnits: this.documentUnits,
          _dpi: this.unitConverter.dpi,
        };

        console.log(`   📐 CONVERTED TO PIXELS: {
  x: ${pixelX},
  y: ${pixelY},
  width: ${pixelWidth},
  height: ${pixelHeight},
  rotation: ${element.itemTransform.rotation || 0},
  _isConverted: true,
  _originalUnits: '${this.documentUnits}',
  _dpi: ${this.unitConverter.dpi}
}`);

        // Update original position conversion info
        element.position._conversionInfo.unitsConverted = true;
        element.position._conversionInfo.pixelConversionApplied = true;
      }

      console.log(
        `   ✅ FINAL POSITIONS (after coordinate system transformation):`
      );
      console.log(
        `      Original: ${JSON.stringify(element.position, null, 2)}`
      );
      if (element.pixelPosition) {
        console.log(
          `      Pixels: ${JSON.stringify(element.pixelPosition, null, 2)}`
        );
      }

      // PIXEL-PERFECT VALIDATION
      this.validatePixelPerfectPositioning(element, index + 1);
    });

    console.log("✅ PIXEL-PERFECT positioning map created successfully");
  }

  /**
   * Validate pixel-perfect positioning accuracy
   * @param {Object} element - Element to validate
   * @param {number} elementNumber - Element number for logging
   */
  validatePixelPerfectPositioning(element, elementNumber) {
    console.log(`🔍 PIXEL-PERFECT VALIDATION - Element ${elementNumber}:`);

    const position = element.pixelPosition || element.position;

    // Check for sub-pixel precision issues
    const hasSubPixelX = position.x % 1 !== 0;
    const hasSubPixelY = position.y % 1 !== 0;

    if (hasSubPixelX || hasSubPixelY) {
      console.log(`   ⚠️ Sub-pixel positioning detected:`);
      if (hasSubPixelX)
        console.log(
          `      X: ${position.x} (fractional: ${(position.x % 1).toFixed(3)})`
        );
      if (hasSubPixelY)
        console.log(
          `      Y: ${position.y} (fractional: ${(position.y % 1).toFixed(3)})`
        );
      console.log(
        `   📝 Note: Sub-pixel positioning is normal for precise layouts`
      );
    } else {
      console.log(
        `   ✅ Perfect pixel alignment: X=${position.x}, Y=${position.y}`
      );
    }

    // Check for negative coordinates (should be resolved by offset)
    if (position.x < 0 || position.y < 0) {
      console.warn(
        `   🚨 NEGATIVE COORDINATES DETECTED: X=${position.x}, Y=${position.y}`
      );
      console.warn(
        `   🚨 This indicates coordinate offset calculation may need adjustment`
      );
    }

    // Check for reasonable positioning bounds
    const isReasonable =
      position.x >= 0 &&
      position.y >= 0 &&
      position.x < 10000 &&
      position.y < 10000;

    if (!isReasonable) {
      console.warn(
        `   🚨 UNREASONABLE POSITIONING: X=${position.x}, Y=${position.y}`
      );
      console.warn(
        `   🚨 Coordinates are outside expected range for web display`
      );
    } else {
      console.log(`   ✅ Positioning within reasonable bounds`);
    }

    // Validate conversion consistency
    if (element.pixelPosition && element.position._conversionInfo) {
      const info = element.position._conversionInfo;
      console.log(`   📊 Conversion validation:`);
      console.log(`      Units converted: ${info.unitsConverted}`);
      console.log(`      Original units: ${info.originalUnits}`);
      console.log(`      DPI: ${info.dpi}`);
      console.log(
        `      Coordinate offset applied: X=${info.coordinateOffset.x}, Y=${info.coordinateOffset.y}`
      );
    }
  }

  extractMasterPages(masterData) {
    const pages = [];

    if (masterData.Page) {
      const pageList = Array.isArray(masterData.Page)
        ? masterData.Page
        : [masterData.Page];

      pageList.forEach((page) => {
        // Extract margin preferences from master page
        let marginPreference = null;
        if (page.MarginPreference) {
          marginPreference = {
            top: parseFloat(page.MarginPreference["@_Top"]) || 0,
            bottom: parseFloat(page.MarginPreference["@_Bottom"]) || 0,
            left: parseFloat(page.MarginPreference["@_Left"]) || 0,
            right: parseFloat(page.MarginPreference["@_Right"]) || 0,
            columnCount: parseInt(page.MarginPreference["@_ColumnCount"]) || 1,
            columnGutter:
              parseFloat(page.MarginPreference["@_ColumnGutter"]) || 0,
            columnDirection:
              page.MarginPreference["@_ColumnDirection"] || "Horizontal",
            columnsPositions: page.MarginPreference["@_ColumnsPositions"] || "",
          };
          console.log(
            "📏 Extracted margin preference from master page:",
            marginPreference
          );
        }

        pages.push({
          self: page["@_Self"],
          name: page["@_Name"] || "",
          geometricBounds: IDMLUtils.parseGeometricBounds(
            page["@_GeometricBounds"]
          ),
          itemTransform: IDMLUtils.parseTransform(page["@_ItemTransform"]),
          appliedMaster: page["@_AppliedMaster"] || "",
          masterPageTransform: IDMLUtils.parseTransform(
            page["@_MasterPageTransform"]
          ),
          marginPreference: marginPreference,
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
    return this.elements.findIndex((el) => el.self === element.self);
  }

  getPageContent(pageId) {
    const pageElements = this.elements.filter((element) => {
      // Check if element belongs to this page based on its bounds
      return true; // TODO: Implement proper page boundary checking
    });

    return {
      elements: pageElements,
    };
  }
}

module.exports = ElementParser;

import path from "path";
import IDMLUtils from "../utils/IDMLUtils.js";

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

  // ENHANCED: Method to convert geometric bounds to pixels
  convertGeometricBoundsToPixels(bounds) {
    if (
      !bounds ||
      !this.unitConverter ||
      !this.documentUnits ||
      this.documentUnits === "Pixels" ||
      bounds._convertedToPixels // FIXED: Check if already converted
    ) {
      return bounds;
    }

    const convertedBounds = {
      top: this.unitConverter.toPixels(bounds.top, this.documentUnits),
      left: this.unitConverter.toPixels(bounds.left, this.documentUnits),
      bottom: this.unitConverter.toPixels(bounds.bottom, this.documentUnits),
      right: this.unitConverter.toPixels(bounds.right, this.documentUnits),
      width: this.unitConverter.toPixels(bounds.width, this.documentUnits),
      height: this.unitConverter.toPixels(bounds.height, this.documentUnits),
      _convertedToPixels: true, // FIXED: Mark as converted
    };

    console.log(
      `📐 Converted element bounds: ${bounds.width}x${bounds.height} ${this.documentUnits} → ${convertedBounds.width}x${convertedBounds.height} px`
    );

    return convertedBounds;
  }

  // REMOVED: Unused conversion methods that were causing confusion
  // convertBoundsToPixels, convertTransformToPixels, convertMeasurementToPixels
  // These methods were not being used and could cause double conversion issues

  extractSpreadPages(spreadData) {
    const pages = [];
    if (!spreadData || !spreadData.Page) {
      console.log("No pages found in spread data");
      return pages;
    }

    const pageList = Array.isArray(spreadData.Page)
      ? spreadData.Page
      : [spreadData.Page];

    // Get spread-level background color - NEW
    const spreadBackgroundColor = spreadData["@_BackgroundColor"] || null;

    pageList.forEach((page, index) => {
      // Get page-specific background color, fallback to spread background color - NEW
      const pageBackgroundColor =
        page["@_BackgroundColor"] || spreadBackgroundColor;

      pages.push({
        self: page["@_Self"],
        name: page["@_Name"] || "",
        appliedMaster: page["@_AppliedMaster"] || "",
        geometricBounds: IDMLUtils.parseGeometricBounds(
          page["@_GeometricBounds"]
        ),
        itemTransform: IDMLUtils.parseTransform(page["@_ItemTransform"]),
        backgroundColor: pageBackgroundColor, // NEW: Add background color
      });
    });

    console.log(`Extracted ${pages.length} pages`);
    return pages;
  }

  extractPageItems(spreadData) {
    const pageItems = [];
    const spreadId = spreadData["@_Self"]; // NEW: Get spread ID

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
            // Add spread ID to the element - NEW
            pageItem.spreadId = spreadId;
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
        const pageId = page["@_Self"]; // NEW: Get page ID

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
              const pageItem = this.parsePageItem(
                item,
                itemType,
                pageId, // NEW: Pass page ID
                "Page" // NEW: Pass parent type
              );
              if (pageItem) {
                // Add spread ID to the element - NEW
                pageItem.spreadId = spreadId;
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
    const spreadId = spreadData["@_Self"]; // NEW: Get spread ID

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

            // Only set placedContent if not already set
            if (!existingRect.placedContent) {
              const nestedLink = possibleContent.Link || null;
              existingRect.placedContent = this.extractPlacedContent(
                possibleContent,
                nestedLink
              );
            }

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

    // Check for nested content in groups - NEW ENHANCEMENT
    if (spreadData.Group) {
      const groups = Array.isArray(spreadData.Group)
        ? spreadData.Group
        : [spreadData.Group];

      groups.forEach((group) => {
        const groupId = group["@_Self"];

        // Process all possible nested item types
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
        ];

        itemTypes.forEach((itemType) => {
          if (group[itemType]) {
            const items = Array.isArray(group[itemType])
              ? group[itemType]
              : [group[itemType]];

            items.forEach((item) => {
              const pageItem = this.parsePageItem(
                item,
                itemType,
                groupId,
                "Group"
              );
              if (pageItem) {
                // Add spread ID to the element
                pageItem.spreadId = spreadId;
                pageItems.push(pageItem);
                this.elements.push(pageItem);
              }
            });
          }
        });
      });
    }
  }

  extractPlacedContent(content, linkObject) {
    if (!content) return null;

    console.log("🔍 Extracting placed content:", content);

    const contentItem = Array.isArray(content) ? content[0] : content;

    console.log("Content item keys:", Object.keys(contentItem));

    // ENHANCED: Better href handling using Link object
    let href = "";
    if (linkObject && linkObject["@_LinkResourceURI"]) {
      // Remove 'file:' prefix and extract just the filename
      const uri = linkObject["@_LinkResourceURI"];
      href = uri
        .replace(/^file:/, "")
        .split(/[\\/]/)
        .pop();
    } else {
      href = contentItem["@_href"] || contentItem["@_ActualPpi"] || "";
    }

    let isEmbedded = false;
    // Check if this is an embedded image reference
    if (href && !href.startsWith("file://") && !href.includes("/")) {
      isEmbedded = true;
      console.log("🖼️ Detected embedded image reference:", href);
    }

    console.log("Returning placedContent:", { href, linkObject });

    return {
      type: contentItem["@_type"] || "Image",
      href: href,
      isEmbedded: isEmbedded,
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

  parsePageItem(item, itemType, parentId = null, parentType = null) {
    try {
      // ADD: Validation
      if (!item || !item["@_Self"]) {
        console.warn(`Invalid ${itemType} item - missing self ID`);
        return null;
      }

      const id = item["@_Self"];
      const name = item["@_Name"] || `${itemType}_${id}`;

      const baseItem = {
        type: itemType,
        self: id,
        name: name,
        visible: item["@_Visible"] !== false,
        locked: item["@_Locked"] === true,

        // FIXED: Store original bounds and transforms without conversion
        // Conversion will happen later in createElementPositionMapFixed to avoid double conversion
        geometricBounds: IDMLUtils.calculateBoundsFromPath(item),
        itemTransform: IDMLUtils.parseTransform(item["@_ItemTransform"]),

        itemLayer: item["@_ItemLayer"] || "",
        fillColor: item["@_FillColor"] || "Color/None",
        fill: item["@_FillColor"] || "Color/None", // NEW: Add fill property to match both files
        strokeColor: item["@_StrokeColor"] || "Color/None",
        stroke: item["@_StrokeColor"] || "Color/None", // NEW: Add stroke property to match both files
        // FIXED: Only convert stroke weight, not positioning data
        strokeWeight:
          this.unitConverter && this.documentUnits
            ? this.unitConverter.toPixels(
                parseFloat(item["@_StrokeWeight"]) || 0,
                this.documentUnits
              )
            : parseFloat(item["@_StrokeWeight"]) || 0,

        parentStory: item["@_ParentStory"] || null,

        // ENHANCED: Better content frame detection
        isContentFrame: false,
        hasPlacedContent: false,
        contentType: null,

        // NEW: Add parent and page association
        parentId: parentId,
        parentType: parentType,
      };

      // NEW: Determine page association
      let pageId = null;
      if (item["@_ParentPage"]) {
        pageId = item["@_ParentPage"];
      } else if (parentId && parentType === "Page") {
        pageId = parentId;
      }
      baseItem.pageId = pageId;

      // NEW: Add enhanced position object for backward compatibility
      const geometricBounds = baseItem.geometricBounds;
      baseItem.position = {
        x: geometricBounds ? geometricBounds.x : 0,
        y: geometricBounds ? geometricBounds.y : 0,
        width: geometricBounds ? geometricBounds.width : 0,
        height: geometricBounds ? geometricBounds.height : 0,
      };
      baseItem.transform = baseItem.itemTransform;

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
          console.log("ITEM:", JSON.stringify(item, null, 2));
          const placedContent =
            item.Image || item.PlacedImage || item.EPS || item.PDF;
          const linkObject =
            placedContent && placedContent.Link ? placedContent.Link : null;
          if (placedContent) {
            baseItem.placedContent = this.extractPlacedContent(
              placedContent,
              linkObject
            );
          }
          console.log("Link object for placed content:", linkObject);

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
    } catch (error) {
      console.error(
        `Error parsing ${itemType} item with ID ${item["@_Self"]}:`,
        error
      );
      return null;
    }
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
      textColumnGutter:
        this.unitConverter && this.documentUnits
          ? this.unitConverter.toPixels(rawTextColumnGutter, this.documentUnits)
          : rawTextColumnGutter,
      firstBaselineOffset:
        textFramePreference["@_FirstBaselineOffset"] || "AscentOffset",
      autoSizingReferencePoint:
        textFramePreference["@_AutoSizingReferencePoint"] || "CenterPoint",
      autoSizingType: textFramePreference["@_AutoSizingType"] || "Off",
      verticalJustification:
        textFramePreference["@_VerticalJustification"] || "TopAlign",

      // FIXED: Convert text frame insets to pixels
      insetSpacing: {
        top:
          this.unitConverter && this.documentUnits
            ? this.unitConverter.toPixels(rawInsetTop, this.documentUnits)
            : rawInsetTop,
        right:
          this.unitConverter && this.documentUnits
            ? this.unitConverter.toPixels(rawInsetRight, this.documentUnits)
            : rawInsetRight,
        bottom:
          this.unitConverter && this.documentUnits
            ? this.unitConverter.toPixels(rawInsetBottom, this.documentUnits)
            : rawInsetBottom,
        left:
          this.unitConverter && this.documentUnits
            ? this.unitConverter.toPixels(rawInsetLeft, this.documentUnits)
            : rawInsetLeft,
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
      minimumFirstBaselineOffset:
        this.unitConverter && this.documentUnits
          ? this.unitConverter.toPixels(
              rawMinimumFirstBaselineOffset,
              this.documentUnits
            )
          : rawMinimumFirstBaselineOffset,
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
        `   📍 Original Bounds: left=${element.geometricBounds.left}, top=${element.geometricBounds.top}, width=${element.geometricBounds.width}, height=${element.geometricBounds.height}`
      );
      console.log(
        `   📍 Transform: tx=${element.itemTransform.tx}, ty=${element.itemTransform.ty}`
      );
      console.log(
        `   📍 Coordinate offset: x=${coordinateOffset.x}, y=${coordinateOffset.y}`
      );

      // FIXED: Convert geometric bounds to pixels FIRST, before coordinate calculations
      let convertedBounds = element.geometricBounds;
      let convertedTransform = element.itemTransform;

      if (
        this.unitConverter &&
        this.unitConverter.isSupportedUnit(this.documentUnits) &&
        !element.geometricBounds._convertedToPixels // FIXED: Check if already converted
      ) {
        console.log("   📐 Converting geometric bounds to pixels FIRST...");

        // Convert geometric bounds to pixels
        convertedBounds = this.unitConverter.convertObjectToPixels(
          element.geometricBounds,
          this.documentUnits
        );

        // Convert transform coordinates to pixels
        convertedTransform = {
          ...element.itemTransform,
          tx: this.unitConverter.toPixels(
            element.itemTransform.tx || 0,
            this.documentUnits
          ),
          ty: this.unitConverter.toPixels(
            element.itemTransform.ty || 0,
            this.documentUnits
          ),
        };

        console.log(`   📐 Converted bounds:`, convertedBounds);
        console.log(`   📐 Converted transform:`, {
          tx: convertedTransform.tx,
          ty: convertedTransform.ty,
        });
      }

      // FIXED: Apply coordinate offset to the ORIGINAL bounds, not after transformation
      // This ensures the offset is applied to the base coordinates before any transforms
      const offsetX =
        this.unitConverter &&
        this.unitConverter.isSupportedUnit(this.documentUnits)
          ? this.unitConverter.toPixels(coordinateOffset.x, this.documentUnits)
          : coordinateOffset.x;
      const offsetY =
        this.unitConverter &&
        this.unitConverter.isSupportedUnit(this.documentUnits)
          ? this.unitConverter.toPixels(coordinateOffset.y, this.documentUnits)
          : coordinateOffset.y;

      // Apply offset to the converted bounds first, then add transform
      const adjustedBounds = {
        ...convertedBounds,
        left: convertedBounds.left + offsetX,
        top: convertedBounds.top + offsetY,
      };

      // Now apply the transform to the adjusted bounds
      const webX = adjustedBounds.left + convertedTransform.tx;
      const webY = adjustedBounds.top + convertedTransform.ty;

      console.log(
        `   📍 Adjusted bounds (with offset): left=${adjustedBounds.left}, top=${adjustedBounds.top}`
      );
      console.log(
        `   📍 Web coordinates (after transform): (${webX}, ${webY}) ${convertedBounds.width}x${convertedBounds.height}`
      );

      // Create position object - now using corrected values
      element.position = {
        ...element.position, // Preserve any existing position data
        x: webX,
        y: webY,
        width: convertedBounds.width,
        height: convertedBounds.height,
        rotation: element.itemTransform.rotation || 0,
        _conversionInfo: {
          unitsConverted: true,
          originalUnits: this.documentUnits,
          pixelConversionApplied: true,
          dpi: this.unitConverter?.dpi || 96,
          coordinateOffset: coordinateOffset,
        },
      };

      // FIXED: No need for additional unit conversion since we already converted above
      element.pixelPosition = {
        x: webX,
        y: webY,
        width: convertedBounds.width,
        height: convertedBounds.height,
        rotation: element.itemTransform.rotation || 0,
        _isConverted: true,
        _originalUnits: this.documentUnits,
        _dpi: this.unitConverter?.dpi || 96,
      };

      console.log(`   📐 FINAL PIXEL POSITION: {
  x: ${webX},
  y: ${webY},
  width: ${convertedBounds.width},
  height: ${convertedBounds.height},
  rotation: ${element.itemTransform.rotation || 0},
  _isConverted: true,
  _originalUnits: '${this.documentUnits}',
  _dpi: ${this.unitConverter?.dpi || 96}
}`);

      console.log(
        `   ✅ FINAL POSITIONS (after coordinate system transformation):`
      );
      console.log(
        `      Position: (${element.position.x}, ${element.position.y}) ${element.position.width}x${element.position.height}`
      );
      console.log(
        `      PixelPosition: (${element.pixelPosition.x}, ${element.pixelPosition.y}) ${element.pixelPosition.width}x${element.pixelPosition.height}`
      );

      // Validate the positioning
      this.validatePixelPerfectPositioning(element, index + 1);
    });

    console.log("✅ PIXEL-PERFECT element position map created successfully!");
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

// ES6 exports
export default ElementParser;

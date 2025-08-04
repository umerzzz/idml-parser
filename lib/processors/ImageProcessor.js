import path from "path";
import fs from "fs";
import IDMLUtils from "../utils/IDMLUtils.js";

class ImageProcessor {
  constructor(fileExtractor) {
    this.fileExtractor = fileExtractor;
  }

  async processIDMLPackage(
    idmlFilePath,
    packageStructure,
    extractedImages = []
  ) {
    console.log("Processing IDML package:", idmlFilePath);

    try {
      // Process linked images and update elements
      const imageMap = await this.buildImageMap(packageStructure);

      // Add extracted images to the map
      extractedImages.forEach((embeddedInfo) => {
        imageMap.set(embeddedInfo.fileName, embeddedInfo.extractedPath);
        console.log(
          `📎 Added extracted image to map: ${embeddedInfo.fileName}`
        );
      });

      return imageMap;
    } catch (error) {
      console.error("Error processing IDML package:", error);
      throw error;
    }
  }

  async buildImageMap(packageStructure) {
    const imageMap = new Map();

    console.log("Building image map...");
    console.log("Package structure:", {
      uploadDir: packageStructure.uploadDir,
      linksFolder: packageStructure.linksFolder,
      resourceMapSize: packageStructure.resourceMap?.size || 0,
      isPackageUpload: packageStructure.isPackageUpload,
    });

    // Check all files in resourceMap first
    if (packageStructure.resourceMap) {
      console.log("Resource map contents:");
      packageStructure.resourceMap.forEach((filePath, fileName) => {
        console.log(`  - ${fileName} -> ${filePath}`);
        if (IDMLUtils.isImageFile(fileName)) {
          imageMap.set(fileName, filePath);

          // Also add without extension for matching
          const nameWithoutExt = path.parse(fileName).name;
          imageMap.set(nameWithoutExt, filePath);

          console.log("Added to image map:", fileName, "->", filePath);
        }
      });
    }

    // Check Links folder if it exists
    if (
      packageStructure.linksFolder &&
      fs.existsSync(packageStructure.linksFolder)
    ) {
      const files = fs.readdirSync(packageStructure.linksFolder);
      console.log("Links folder contents:", files);
      console.log("Links folder path:", packageStructure.linksFolder);

      for (const fileName of files) {
        if (IDMLUtils.isImageFile(fileName)) {
          const fullPath = path.join(packageStructure.linksFolder, fileName);
          imageMap.set(fileName, fullPath);

          const nameWithoutExt = path.parse(fileName).name;
          imageMap.set(nameWithoutExt, fullPath);

          console.log("Added from Links folder:", fileName, "->", fullPath);
        }
      }
    } else {
      console.log(
        "Links folder does not exist or is not defined:",
        packageStructure.linksFolder
      );
    }

    console.log(`📸 Image map built with ${imageMap.size / 2} unique images`);
    Array.from(imageMap.keys()).forEach((key) => {
      console.log("  - Image key:", key);
    });

    return imageMap;
  }

  async processLinkedResources(
    documentData,
    packageStructure,
    extractedImages = []
  ) {
    console.log("🖼️ Processing linked resources...");
    console.log(
      `📊 Document has ${documentData.elements?.length || 0} elements`
    );
    console.log(`📊 Package has ${extractedImages.length} extracted images`);
    console.log(`📊 Package structure uploadId: ${packageStructure.uploadId}`);

    const imageMap = await this.buildImageMap(packageStructure);
    console.log(`📊 Image map has ${imageMap.size} images`);

    // Add extracted images to the map
    console.log("📎 Adding extracted embedded images to image map:");
    extractedImages.forEach((embeddedInfo) => {
      imageMap.set(embeddedInfo.fileName, embeddedInfo.extractedPath);
      console.log(
        `  - ${embeddedInfo.fileName} -> ${embeddedInfo.extractedPath}`
      );
    });

    // Process elements and link them to package resources
    let linkedCount = 0;
    let embeddedCount = 0;
    let externalCount = 0;

    for (const element of documentData.elements || []) {
      if (this.hasImageReference(element)) {
        console.log(`🔍 Processing element for image linking:`, {
          id: element.id || element.self,
          name: element.name,
          type: element.type,
          isContentFrame: element.isContentFrame,
          hasPlacedContent: element.hasPlacedContent,
        });

        const linked = await this.linkElementToImage(
          element,
          packageStructure,
          imageMap,
          extractedImages
        );

        if (linked) {
          linkedCount++;
          if (element.linkedImage?.isEmbedded) {
            embeddedCount++;
          } else if (element.linkedImage) {
            externalCount++;
          }
        }
      }

      // Also check for nested elements (groups, etc.)
      if (element.groupItems && element.groupItems.length > 0) {
        for (const groupItem of element.groupItems) {
          if (this.hasImageReference(groupItem)) {
            const linked = await this.linkElementToImage(
              groupItem,
              packageStructure,
              imageMap,
              extractedImages
            );

            if (linked) {
              linkedCount++;
              if (groupItem.linkedImage?.isEmbedded) {
                embeddedCount++;
              } else if (groupItem.linkedImage) {
                externalCount++;
              }
            }
          }
        }
      }
    }

    await this.processTextImages(documentData, packageStructure, imageMap);

    console.log("✅ Linked resources processed");
    console.log(
      `📊 Summary: ${externalCount} external images, ${embeddedCount} embedded images`
    );
    console.log(`📊 Successfully linked ${linkedCount} elements to images`);
  }

  hasImageReference(element) {
    // ENHANCED: Check for embedded images first
    if (element.isContentFrame && element.hasPlacedContent) {
      console.log(
        `🔍 Element ${element.id || element.self} (${
          element.name
        }) is a content frame with placed content`
      );
      return true;
    }

    // Check for href directly on the element (as shown in the logs)
    if (element.href) {
      console.log(
        `🔍 Element ${element.id || element.self} (${
          element.name
        }) has href directly on element: "${element.href}"`
      );
      return true;
    }

    // Check for embedded image data in element properties
    if (
      element.placedContent &&
      (element.placedContent.href ||
        element.placedContent.imageTypeName ||
        element.placedContent.actualPpi)
    ) {
      console.log(
        `🔍 Element ${element.id || element.self} (${
          element.name
        }) has placed content with image data`
      );
      return true;
    }

    // For rectangles, check if they could be content frames
    if (element.type === "Rectangle") {
      console.log(
        `🔍 Element ${element.id || element.self} (${
          element.name
        }) is a rectangle - potential image container`
      );
      return true; // Most rectangles are potential image containers
    }

    // ENHANCED: Check for embedded image indicators
    const hasEmbeddedImage =
      (element.name &&
        element.name.includes("[") &&
        element.name.includes("]")) || // [YOUR IMAGE HERE]
      (element.fillColor && element.fillColor.includes("Image/")) ||
      (element.Properties &&
        (element.Properties.Image ||
          element.Properties.PlacedImage ||
          element.Properties.EPS ||
          element.Properties.PDF));

    const hasImageRef =
      hasEmbeddedImage ||
      element.Image ||
      element.Link ||
      element.PlacedImage ||
      element.imageReference ||
      element.linkedImage;

    if (hasImageRef) {
      console.log(
        `🔍 Element ${element.id || element.self} (${
          element.name
        }) has image reference indicators`
      );
    }

    return hasImageRef;
  }

  findImageByName(searchName, imageMap) {
    if (!searchName) return null;

    // Remove file: prefix and any leading slashes
    let cleanName = searchName.replace(/^file:/, "").replace(/^\/+/, "");

    // URL decode the filename to handle encoded characters like %20
    try {
      cleanName = decodeURIComponent(cleanName);
    } catch (error) {
      console.log(`⚠️ Could not URL decode "${searchName}", using as-is`);
    }

    // Only use the base filename for matching
    const baseName = path.basename(cleanName);
    const nameWithoutExt = path.parse(baseName).name;
    const originalExt = path.parse(baseName).ext;

    console.log(
      `🔍 Searching for image: "${searchName}" (decoded: "${cleanName}", base: "${baseName}", name: "${nameWithoutExt}", ext: "${originalExt}")`
    );
    console.log(`🔍 Available image keys:`, Array.from(imageMap.keys()));

    // Try exact match first (with decoded name)
    if (imageMap.has(baseName)) {
      console.log(`✅ Found exact match: "${baseName}"`);
      return baseName;
    }

    // Try with Links/ prefix
    if (imageMap.has(`Links/${baseName}`)) {
      console.log(`✅ Found with Links/ prefix: "Links/${baseName}"`);
      return `Links/${baseName}`;
    }

    // Try without extension
    if (imageMap.has(nameWithoutExt)) {
      console.log(`✅ Found without extension: "${nameWithoutExt}"`);
      return nameWithoutExt;
    }

    // Try different extensions for the same base name
    const commonExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".tiff",
      ".webp",
    ];
    for (const ext of commonExtensions) {
      const testName = nameWithoutExt + ext;
      if (imageMap.has(testName)) {
        console.log(`✅ Found with different extension: "${testName}"`);
        return testName;
      }
    }

    // Try URL-encoded versions with different extensions
    for (const ext of commonExtensions) {
      const encodedName = encodeURIComponent(nameWithoutExt) + ext;
      if (imageMap.has(encodedName)) {
        console.log(
          `✅ Found URL-encoded version with ${ext}: "${encodedName}"`
        );
        return encodedName;
      }
    }

    // Try the original encoded name as-is
    const originalBaseName = path.basename(searchName);
    if (imageMap.has(originalBaseName)) {
      console.log(`✅ Found original encoded name: "${originalBaseName}"`);
      return originalBaseName;
    }

    // Try the original encoded name with different extensions
    for (const ext of commonExtensions) {
      const testName = path.parse(originalBaseName).name + ext;
      if (imageMap.has(testName)) {
        console.log(
          `✅ Found original encoded name with ${ext}: "${testName}"`
        );
        return testName;
      }
    }

    // Try partial matching (case-insensitive)
    const possibleMatches = Array.from(imageMap.keys()).filter((key) => {
      const keyName = path.parse(key).name;
      return keyName.toLowerCase() === nameWithoutExt.toLowerCase();
    });

    if (possibleMatches.length > 0) {
      console.log(`✅ Found case-insensitive match: "${possibleMatches[0]}"`);
      return possibleMatches[0];
    }

    console.log(`❌ No match found for "${searchName}"`);
    return null;
  }

  async linkElementToImage(
    element,
    packageStructure,
    imageMap,
    extractedImages
  ) {
    console.log(
      "🔍 Linking images for element:",
      element.id || element.self,
      element.type
    );
    try {
      let imageFileName = null;
      const uploadId = packageStructure.uploadId;

      // --- LINKED IMAGE HANDLING (Check first for external file references) ---
      let href = null;

      // Check for href in different locations
      if (element.isContentFrame && element.hasPlacedContent) {
        href = element.placedContent?.href;
      }

      // Also check for href directly on the element (as shown in the logs)
      if (!href && element.href) {
        href = element.href;
        console.log(`🔍 Found href directly on element: "${href}"`);
      }

      // If we have an href that looks like a file reference (not base64), handle as linked image
      if (href && !href.startsWith("data:") && href.length < 1000) {
        // FIX: Decode URL-encoded filename
        const decodedHref = decodeURIComponent(href);
        const referencedImage = path.basename(decodedHref);
        console.log(
          `🔍 Looking for linked image: "${referencedImage}" (decoded from "${href}")`
        );

        // Try to find the image by name
        imageFileName = this.findImageByName(referencedImage, imageMap);

        // If not found, also try with the original encoded name
        if (!imageFileName) {
          const encodedImage = path.basename(href);
          imageFileName = this.findImageByName(encodedImage, imageMap);
          if (imageFileName) {
            console.log(`✅ Found image with encoded name: "${encodedImage}"`);
          }
        }

        if (imageFileName && imageMap.has(imageFileName)) {
          // Determine if the image is in Links or ExtractedImages
          let urlFolder = "Links";
          let isEmbedded = false;
          const imagePath = imageMap.get(imageFileName);
          if (imagePath && imagePath.includes("ExtractedImages")) {
            urlFolder = "ExtractedImages";
            isEmbedded = true;
          }
          element.linkedImage = {
            fileName: imageFileName,
            url: `/api/image/${uploadId}/${urlFolder}/${imageFileName}`,
            originalPath: imagePath,
            isEmbedded: isEmbedded,
            framePosition: element.position,
            imagePosition: element.imagePosition,
          };
          console.log(
            `✅ Successfully linked image: ${imageFileName} to element ${
              element.id || element.self
            }`
          );
          return true;
        }
      }

      // --- EMBEDDED IMAGE HANDLING (Only if no linked image found) ---
      const embeddedInfo = this.detectEmbeddedImages(element);
      if (embeddedInfo.hasEmbeddedContent) {
        // Find the extracted image in ExtractedImages
        const matchingExtractedImage = extractedImages?.find(
          (img) =>
            img.fileName === embeddedInfo.embeddedFileName ||
            img.fileName === element.placedContent?.fileName ||
            img.fileName.toLowerCase() ===
              (element.placedContent?.fileName || "").toLowerCase()
        );
        if (matchingExtractedImage) {
          element.linkedImage = {
            fileName: matchingExtractedImage.fileName,
            url: `/api/image/${uploadId}/ExtractedImages/${matchingExtractedImage.fileName}`,
            originalPath: matchingExtractedImage.extractedPath,
            isEmbedded: true,
            isExtracted: true,
            embeddedType: embeddedInfo.embeddedType,
            embeddedData: embeddedInfo.embeddedData,
            framePosition: element.position,
            imagePosition: element.imagePosition,
          };
          console.log(
            `✅ Linked extracted embedded image: ${matchingExtractedImage.fileName}`
          );
          return true;
        } else {
          // Fallback to placeholder if no extracted image found
          element.linkedImage = {
            fileName:
              embeddedInfo.embeddedFileName ||
              `embedded_${element.id || element.self}`,
            url: null,
            isEmbedded: true,
            embeddedType: embeddedInfo.embeddedType,
            embeddedData: embeddedInfo.embeddedData,
            framePosition: element.position,
            imagePosition: element.imagePosition,
          };
          console.log(
            `📋 Created placeholder for embedded image: ${
              element.id || element.self
            }`
          );
          return true;
        }
      }

      // If we get here, no image was found or linked
      console.log(`❌ No image linked for ${element.id || element.self}`);
      return false;
    } catch (error) {
      console.error(`❌ Error linking image:`, error);
      return false;
    }
  }
  detectEmbeddedImages(element) {
    const embeddedIndicators = {
      hasEmbeddedContent: false,
      embeddedType: null,
      embeddedData: null,
      embeddedFileName: null,
      isPlaceholder: false,
    };

    // Only set hasEmbeddedContent if there is actual base64 data
    if (
      element.placedContent &&
      element.placedContent.href &&
      element.placedContent.isEmbedded
    ) {
      // Check if href is a large base64 string (not just a number or short string)
      if (element.placedContent.href.length > 100) {
        // adjust threshold as needed
        embeddedIndicators.hasEmbeddedContent = true;
        embeddedIndicators.embeddedType =
          element.placedContent.imageTypeName || "unknown";
        embeddedIndicators.embeddedData = element.placedContent.href;
        embeddedIndicators.embeddedFileName = `${
          element.placedContent.href
        }.${IDMLUtils.getImageExtension(element.placedContent.imageTypeName)}`;
      }
    }

    return embeddedIndicators;
  }

  findElementImageReference(element, imageMap) {
    // Check for placed content references
    if (element.placedContent?.href) {
      const imageName = path.basename(element.placedContent.href);
      return this.findImageByName(imageName, imageMap);
    }

    // Check element name for image hints
    if (element.name && element.name !== "$ID/") {
      return this.findImageByName(element.name, imageMap);
    }

    return null;
  }

  matchImageBySize(element, imageMap) {
    // TODO: Implement image size matching if metadata available
    return null;
  }

  async processTextImages(documentData, packageStructure, imageMap) {
    // Process images that might be embedded in text stories
    Object.values(documentData.stories || {}).forEach((story) => {
      if (story.content && story.content.formattedContent) {
        story.content.formattedContent.forEach((content) => {
          // Look for image references in text content
          if (content.text && content.text.includes("Image/")) {
            // Extract and process image references
            const imageRefs = content.text.match(/Image\/[^\s\]]+/g);
            if (imageRefs) {
              imageRefs.forEach((ref) => {
                const imageName = ref.replace("Image/", "");
                const fileName = this.findImageByName(imageName, imageMap);
                if (fileName) {
                  content.linkedImage = fileName;
                }
              });
            }
          }
        });
      }
    });
  }

  async analyzeSpreadForImageReferences(idmlPath, xmlParser) {
    console.log("\n🔍 === ANALYZING SPREADS FOR IMAGE REFERENCES ===");
    console.log("📁 IDML path:", idmlPath);

    const spreadAnalysis = {
      spreadsAnalyzed: 0,
      imageReferences: [],
      linkReferences: [],
      placedContentDetails: [],
    };

    try {
      const extractedData = await this.fileExtractor.extractIDMLContents(
        idmlPath
      );

      console.log(`📊 Extracted data keys:`, Object.keys(extractedData));

      // Find spread files
      const spreadFiles = Object.keys(extractedData).filter(
        (name) => name.startsWith("Spreads/") && name.endsWith(".xml")
      );

      console.log(`📄 Found ${spreadFiles.length} spread files:`, spreadFiles);

      // Analyze each spread
      for (const spreadFile of spreadFiles) {
        try {
          console.log(`🔍 Analyzing spread file: ${spreadFile}`);
          const spreadContent = extractedData[spreadFile];
          const analysis = this.analyzeSpreadXMLForImages(
            spreadContent,
            spreadFile,
            xmlParser
          );

          spreadAnalysis.spreadsAnalyzed++;
          spreadAnalysis.imageReferences.push(...analysis.imageReferences);
          spreadAnalysis.linkReferences.push(...analysis.linkReferences);
          spreadAnalysis.placedContentDetails.push(
            ...analysis.placedContentDetails
          );

          console.log(`✅ Analyzed ${spreadFile}:`, {
            imageReferences: analysis.imageReferences.length,
            linkReferences: analysis.linkReferences.length,
            placedContentDetails: analysis.placedContentDetails.length,
          });
        } catch (error) {
          console.error(`❌ Error analyzing ${spreadFile}:`, error);
        }
      }

      console.log(`📊 Final analysis summary:`, {
        spreadsAnalyzed: spreadAnalysis.spreadsAnalyzed,
        imageReferences: spreadAnalysis.imageReferences.length,
        linkReferences: spreadAnalysis.linkReferences.length,
        placedContentDetails: spreadAnalysis.placedContentDetails.length,
      });

      return spreadAnalysis;
    } catch (error) {
      console.error("❌ Error analyzing spreads for image references:", error);
      return spreadAnalysis;
    }
  }

  analyzeSpreadXMLForImages(xmlContent, fileName, xmlParser) {
    console.log(`🔍 Analyzing ${fileName} for image references...`);

    const analysis = {
      imageReferences: [],
      linkReferences: [],
      placedContentDetails: [],
    };

    try {
      const parsed = xmlParser.parse(xmlContent);

      // Look for any image-related attributes
      const findImageRefs = (obj, path = "") => {
        if (typeof obj === "object" && obj !== null) {
          Object.keys(obj).forEach((key) => {
            const value = obj[key];

            // Look for href attributes
            if (key.includes("href") || key.includes("Href")) {
              analysis.linkReferences.push({
                file: fileName,
                path: `${path}.${key}`,
                value: value,
              });
              console.log(`🔗 Found href: ${path}.${key} = ${value}`);
            }

            // Look for image type names
            if (key.includes("ImageType") || key.includes("imageType")) {
              analysis.imageReferences.push({
                file: fileName,
                path: `${path}.${key}`,
                value: value,
              });
              console.log(`🖼️ Found image type: ${path}.${key} = ${value}`);
            }

            // Look for Links or Link references
            if (key === "Link" || key === "Links") {
              analysis.linkReferences.push({
                file: fileName,
                path: `${path}.${key}`,
                value: JSON.stringify(value).substring(0, 200),
              });
              console.log(`🔗 Found Link object at: ${path}.${key}`);
            }

            // Look for placed content - ENHANCED DETECTION
            if (
              key.includes("Image") ||
              key.includes("EPS") ||
              key.includes("PDF") ||
              key.includes("Placed") ||
              key.includes("placed")
            ) {
              // Check if this looks like an image element
              const isImageElement =
                value &&
                typeof value === "object" &&
                (value["@_type"] === "Image" ||
                  value["@_ImageTypeName"] ||
                  value["@_LinkResourceURI"] ||
                  value["Properties"] ||
                  value["@_href"]);

              if (isImageElement) {
                analysis.placedContentDetails.push({
                  file: fileName,
                  elementType: value["@_type"] || "Image",
                  path: `${path}.${key}`,
                  details: value,
                });
                console.log(`📷 Found image element: ${path}.${key}`, {
                  type: value["@_type"],
                  href: value["@_href"],
                  hasProperties: !!value["Properties"],
                  hasLink: !!value["Link"],
                });
              }
            }

            // Look for Properties with Contents (base64 data)
            if (key === "Properties" && value && typeof value === "object") {
              if (value["Contents"] || value["@_Contents"]) {
                const contents = value["Contents"] || value["@_Contents"];
                if (contents && contents.length > 100) {
                  // Likely base64 data
                  analysis.placedContentDetails.push({
                    file: fileName,
                    elementType: "Image",
                    path: `${path}.${key}`,
                    details: {
                      Properties: {
                        Contents: contents,
                      },
                    },
                  });
                  console.log(
                    `📷 Found Properties with Contents (${contents.length} chars) at: ${path}.${key}`
                  );
                }
              }
            }

            if (typeof value === "object") {
              findImageRefs(value, path ? `${path}.${key}` : key);
            }
          });
        }
      };

      findImageRefs(parsed);
    } catch (error) {
      console.error(`Error parsing XML in ${fileName}:`, error);
    }

    return analysis;
  }

  async extractEmbeddedImageFromSpread(idmlPath, uploadDir, xmlParser) {
    console.log("🖼️ Extracting embedded images from spread XML...");
    console.log("📁 Upload directory:", uploadDir);

    const embeddedImages = [];

    try {
      const spreadAnalysis = await this.analyzeSpreadForImageReferences(
        idmlPath,
        xmlParser
      );

      console.log(`📊 Spread analysis results:`);
      console.log(`  - Spreads analyzed: ${spreadAnalysis.spreadsAnalyzed}`);
      console.log(
        `  - Image references: ${spreadAnalysis.imageReferences.length}`
      );
      console.log(
        `  - Link references: ${spreadAnalysis.linkReferences.length}`
      );
      console.log(
        `  - Placed content details: ${spreadAnalysis.placedContentDetails.length}`
      );

      for (const placedContent of spreadAnalysis.placedContentDetails) {
        console.log(`🔍 Processing placed content:`, {
          elementType: placedContent.elementType,
          path: placedContent.path,
          hasProperties: !!placedContent.details?.Properties,
          hasContents: !!placedContent.details?.Properties?.Contents,
        });

        if (
          placedContent.elementType === "Image" &&
          placedContent.details &&
          placedContent.details.Properties &&
          placedContent.details.Properties.Contents
        ) {
          const base64Data = placedContent.details.Properties.Contents;
          console.log(
            `📷 Found Base64 image data: ${base64Data.length} characters`
          );

          const linkInfo = placedContent.details.Link || {};
          const imageName =
            IDMLUtils.extractImageNameFromLink(linkInfo["@_LinkResourceURI"]) ||
            `embedded_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const imageType = linkInfo["@_LinkResourceFormat"] || "$ID/JPEG";
          const extension = IDMLUtils.getImageExtensionFromFormat(imageType);

          // Create filename with timestamp to avoid conflicts
          const fileName = `${imageName}.${extension}`;
          const outputPath = path.join(uploadDir, "ExtractedImages", fileName);

          // Create directory
          const outputDir = path.dirname(outputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
            console.log(`📁 Created directory: ${outputDir}`);
          }

          try {
            const imageBuffer = Buffer.from(base64Data, "base64");
            fs.writeFileSync(outputPath, imageBuffer);

            embeddedImages.push({
              originalPath: placedContent.path,
              extractedPath: outputPath,
              fileName: fileName,
              size: imageBuffer.length,
              base64Length: base64Data.length,
              linkInfo: linkInfo,
              isExtracted: true,
            });

            console.log(
              `✅ Extracted image: ${fileName} (${imageBuffer.length} bytes) to ${outputPath}`
            );
          } catch (error) {
            console.error(`❌ Failed to convert Base64 to image:`, error);
          }
        } else {
          console.log(
            `⏭️ Skipping placed content - not an image with base64 data`
          );
        }
      }

      // FALLBACK: If no images found in spreads, try searching in other XML files
      if (embeddedImages.length === 0) {
        console.log("🔄 No images found in spreads, trying fallback search...");
        const fallbackImages = await this.searchForEmbeddedImagesInAllFiles(
          idmlPath,
          uploadDir,
          xmlParser
        );
        embeddedImages.push(...fallbackImages);
      }
    } catch (error) {
      console.error("❌ Error extracting embedded images from spread:", error);
    }

    console.log(
      `✅ Extracted ${embeddedImages.length} embedded images from spread`
    );
    return embeddedImages;
  }

  async searchForEmbeddedImagesInAllFiles(idmlPath, uploadDir, xmlParser) {
    console.log("🔍 Searching for embedded images in all IDML files...");

    const embeddedImages = [];

    try {
      const extractedData = await this.fileExtractor.extractIDMLContents(
        idmlPath
      );

      // Search through all XML files for embedded images
      for (const [fileName, content] of Object.entries(extractedData)) {
        if (fileName.endsWith(".xml")) {
          console.log(`🔍 Searching in ${fileName}...`);

          try {
            const parsed = xmlParser.parse(content);
            const foundImages = this.searchForBase64Images(parsed, fileName);

            for (const imageData of foundImages) {
              const fileName = `embedded_${Date.now()}_${Math.random()
                .toString(36)
                .substr(2, 9)}.jpg`;
              const outputPath = path.join(
                uploadDir,
                "ExtractedImages",
                fileName
              );

              // Create directory
              const outputDir = path.dirname(outputPath);
              if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
                console.log(`📁 Created directory: ${outputDir}`);
              }

              try {
                const imageBuffer = Buffer.from(imageData, "base64");
                fs.writeFileSync(outputPath, imageBuffer);

                embeddedImages.push({
                  originalPath: fileName,
                  extractedPath: outputPath,
                  fileName: fileName,
                  size: imageBuffer.length,
                  base64Length: imageData.length,
                  isExtracted: true,
                });

                console.log(
                  `✅ Extracted fallback image: ${fileName} (${imageBuffer.length} bytes)`
                );
              } catch (error) {
                console.error(`❌ Failed to extract fallback image:`, error);
              }
            }
          } catch (error) {
            console.error(`❌ Error parsing ${fileName}:`, error);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error in fallback search:", error);
    }

    return embeddedImages;
  }

  searchForBase64Images(obj, path = "") {
    const foundImages = [];

    if (typeof obj === "object" && obj !== null) {
      Object.keys(obj).forEach((key) => {
        const value = obj[key];

        // Look for base64 data
        if (
          typeof value === "string" &&
          value.length > 1000 &&
          /^[A-Za-z0-9+/=]+$/.test(value)
        ) {
          console.log(
            `📷 Found potential base64 data in ${path}.${key} (${value.length} chars)`
          );
          foundImages.push(value);
        }

        if (typeof value === "object") {
          foundImages.push(
            ...this.searchForBase64Images(value, path ? `${path}.${key}` : key)
          );
        }
      });
    }

    return foundImages;
  }
}

// ES6 exports
export default ImageProcessor;

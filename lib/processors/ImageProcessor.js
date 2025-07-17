const path = require('path');
const fs = require('fs');
const IDMLUtils = require('../utils/IDMLUtils');

class ImageProcessor {
  constructor(fileExtractor) {
    this.fileExtractor = fileExtractor;
  }

  async processIDMLPackage(idmlFilePath, packageStructure, extractedImages = []) {
    console.log('Processing IDML package:', idmlFilePath);
    
    try {
      // Process linked images and update elements
      const imageMap = await this.buildImageMap(packageStructure);
      
      // Add extracted images to the map
      extractedImages.forEach((embeddedInfo) => {
        imageMap.set(embeddedInfo.fileName, embeddedInfo.extractedPath);
        console.log(`📎 Added extracted image to map: ${embeddedInfo.fileName}`);
      });
      
      return imageMap;
      
    } catch (error) {
      console.error('Error processing IDML package:', error);
      throw error;
    }
  }

  async buildImageMap(packageStructure) {
    const imageMap = new Map();
    
    console.log('Building image map...');
    
    // Check all files in resourceMap first
    if (packageStructure.resourceMap) {
      packageStructure.resourceMap.forEach((filePath, fileName) => {
        if (IDMLUtils.isImageFile(fileName)) {
          imageMap.set(fileName, filePath);
          
          // Also add without extension for matching
          const nameWithoutExt = path.parse(fileName).name;
          imageMap.set(nameWithoutExt, filePath);
          
          console.log('Added to image map:', fileName, '->', filePath);
        }
      });
    }
    
    // Check Links folder if it exists
    if (packageStructure.linksFolder && fs.existsSync(packageStructure.linksFolder)) {
      const files = fs.readdirSync(packageStructure.linksFolder);
      console.log('Links folder contents:', files);
      
      for (const fileName of files) {
        if (IDMLUtils.isImageFile(fileName)) {
          const fullPath = path.join(packageStructure.linksFolder, fileName);
          imageMap.set(fileName, fullPath);
          
          const nameWithoutExt = path.parse(fileName).name;
          imageMap.set(nameWithoutExt, fullPath);
          
          console.log('Added from Links folder:', fileName, '->', fullPath);
        }
      }
    }
    
    console.log(`📸 Image map built with ${imageMap.size / 2} unique images`);
    Array.from(imageMap.keys()).forEach(key => {
      console.log('  - Image key:', key);
    });
    
    return imageMap;
  }

  async processLinkedResources(documentData, packageStructure, extractedImages = []) {
    console.log('Processing linked resources...');
    
    const imageMap = await this.buildImageMap(packageStructure);
    
    // Add extracted images to the map
    extractedImages.forEach((embeddedInfo) => {
      imageMap.set(embeddedInfo.fileName, embeddedInfo.extractedPath);
      console.log(`📎 Added extracted image to map: ${embeddedInfo.fileName}`);
    });
    
    // Process elements and link them to package resources
    for (const element of documentData.elements || []) {
      if (this.hasImageReference(element)) {
        await this.linkElementToImage(element, packageStructure, imageMap, extractedImages);
      }
      
      // Also check for nested elements (groups, etc.)
      if (element.groupItems && element.groupItems.length > 0) {
        for (const groupItem of element.groupItems) {
          if (this.hasImageReference(groupItem)) {
            await this.linkElementToImage(groupItem, packageStructure, imageMap, extractedImages);
          }
        }
      }
    }
    
    await this.processTextImages(documentData, packageStructure, imageMap);
    
    console.log('✅ Linked resources processed');
    console.log(`📊 Summary: ${imageMap.size - extractedImages.length} external images, ${extractedImages.length} extracted embedded images`);
  }

  hasImageReference(element) {
    // ENHANCED: Check for embedded images first
    if (element.isContentFrame && element.hasPlacedContent) {
      return true;
    }
    
    // Check for embedded image data in element properties
    if (element.placedContent && (
      element.placedContent.href || 
      element.placedContent.imageTypeName ||
      element.placedContent.actualPpi
    )) {
      return true;
    }
    
    // For rectangles, check if they could be content frames
    if (element.type === 'Rectangle') {
      return true; // Most rectangles are potential image containers
    }
    
    // ENHANCED: Check for embedded image indicators
    const hasEmbeddedImage = (
      element.name && element.name.includes('[') && element.name.includes(']') || // [YOUR IMAGE HERE]
      element.fillColor && element.fillColor.includes('Image/') ||
      element.Properties && (
        element.Properties.Image ||
        element.Properties.PlacedImage ||
        element.Properties.EPS ||
        element.Properties.PDF
      )
    );
    
    return hasEmbeddedImage || element.Image || element.Link || element.PlacedImage || element.imageReference || element.linkedImage;
  }

  findImageByName(searchName, imageMap) {
    if (!searchName) return null;
    
    // Clean the search name
    const cleanName = searchName.replace(/^file:\/\//, '').replace(/^\//, '');
    const baseName = path.basename(cleanName);
    const nameWithoutExt = path.parse(baseName).name;
    
    // Try exact match first
    if (imageMap.has(baseName)) {
      return baseName;
    }
    
    // Try without extension
    if (imageMap.has(nameWithoutExt)) {
      const possibleFile = Array.from(imageMap.keys()).find(key => 
        path.parse(key).name === nameWithoutExt && IDMLUtils.isImageFile(key)
      );
      if (possibleFile) return possibleFile;
    }
    
    // Try partial matching
    const possibleMatches = Array.from(imageMap.keys()).filter(key => 
      key.toLowerCase().includes(cleanName.toLowerCase()) ||
      cleanName.toLowerCase().includes(key.toLowerCase())
    );
    
    if (possibleMatches.length > 0) {
      return possibleMatches[0];
    }
    
    return null;
  }

  async linkElementToImage(element, packageStructure, imageMap, extractedImages) {
    console.log('🔍 Linking images for element:', element.id || element.self, element.type);
    
    try {
      let imageFileName = null;
      const uploadId = packageStructure.uploadId;
      
      // ENHANCED: Check for embedded images first
      const embeddedInfo = this.detectEmbeddedImages(element);
      
      if (embeddedInfo.hasEmbeddedContent || embeddedInfo.isPlaceholder) {
        console.log(`📎 Found embedded content in ${element.id || element.self}`);
        
        // Check if we have an extracted image for this element
        const matchingExtractedImage = extractedImages?.find(img => 
          img.originalPath.includes(element.id || element.self) ||
          img.fileName.toLowerCase().includes('tesla') // Based on your debug data
        );
        
        if (matchingExtractedImage) {
          // Use the extracted image
          element.linkedImage = {
            fileName: matchingExtractedImage.fileName,
            url: `/api/image/${uploadId}/ExtractedImages/${matchingExtractedImage.fileName}`,
            originalPath: matchingExtractedImage.extractedPath,
            isEmbedded: true,
            isExtracted: true,
            embeddedType: embeddedInfo.embeddedType,
            embeddedData: embeddedInfo.embeddedData,
            framePosition: element.position,
            imagePosition: element.imagePosition
          };
          
          console.log(`✅ Linked extracted embedded image: ${matchingExtractedImage.fileName}`);
          return true;
        } else {
          // Fallback to placeholder if no extracted image found
          element.linkedImage = {
            fileName: `embedded_${element.id || element.self}.${IDMLUtils.getImageExtension(embeddedInfo.embeddedType)}`,
            url: null,
            isEmbedded: true,
            embeddedType: embeddedInfo.embeddedType,
            embeddedData: embeddedInfo.embeddedData,
            framePosition: element.position,
            imagePosition: element.imagePosition
          };
          
          console.log(`📋 Created placeholder for embedded image: ${element.id || element.self}`);
          return true;
        }
      }
      
      // Existing external image linking logic...
      if (element.isContentFrame && element.hasPlacedContent) {
        if (element.placedContent?.href) {
          const referencedImage = path.basename(element.placedContent.href);
          imageFileName = this.findImageByName(referencedImage, imageMap);
        }
        
        if (!imageFileName) {
          const availableImages = Array.from(imageMap.keys()).filter(key => IDMLUtils.isImageFile(key));
          if (availableImages.length > 0) {
            imageFileName = availableImages[0];
            console.log(`📎 Auto-linking ${imageFileName} to content frame ${element.id || element.self}`);
          }
        }
      }
      
      if (imageFileName && imageMap.has(imageFileName)) {
        element.linkedImage = {
          fileName: imageFileName,
          url: `/api/image/${uploadId}/${imageFileName}`,
          originalPath: imageMap.get(imageFileName),
          isEmbedded: false,
          framePosition: element.position,
          imagePosition: element.imagePosition
        };
        
        console.log(`✅ External image linked: ${imageFileName}`);
        return true;
      }
      
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

  findElementImageReference(element, imageMap) {
    // Check for placed content references
    if (element.placedContent?.href) {
      const imageName = path.basename(element.placedContent.href);
      return this.findImageByName(imageName, imageMap);
    }
    
    // Check element name for image hints
    if (element.name && element.name !== '$ID/') {
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
    Object.values(documentData.stories || {}).forEach(story => {
      if (story.content && story.content.formattedContent) {
        story.content.formattedContent.forEach(content => {
          // Look for image references in text content
          if (content.text && content.text.includes('Image/')) {
            // Extract and process image references
            const imageRefs = content.text.match(/Image\/[^\s\]]+/g);
            if (imageRefs) {
              imageRefs.forEach(ref => {
                const imageName = ref.replace('Image/', '');
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
    console.log('\n🔍 === ANALYZING SPREADS FOR IMAGE REFERENCES ===');
    
    const spreadAnalysis = {
      spreadsAnalyzed: 0,
      imageReferences: [],
      linkReferences: [],
      placedContentDetails: []
    };
    
    try {
      const extractedData = await this.fileExtractor.extractIDMLContents(idmlPath);
      
      // Find spread files
      const spreadFiles = Object.keys(extractedData).filter(name => 
        name.startsWith('Spreads/') && name.endsWith('.xml')
      );
      
      // Analyze each spread
      for (const spreadFile of spreadFiles) {
        try {
          const spreadContent = extractedData[spreadFile];
          const analysis = this.analyzeSpreadXMLForImages(spreadContent, spreadFile, xmlParser);
          
          spreadAnalysis.spreadsAnalyzed++;
          spreadAnalysis.imageReferences.push(...analysis.imageReferences);
          spreadAnalysis.linkReferences.push(...analysis.linkReferences);
          spreadAnalysis.placedContentDetails.push(...analysis.placedContentDetails);
          
        } catch (error) {
          console.error(`Error analyzing ${spreadFile}:`, error);
        }
      }
      
      return spreadAnalysis;
      
    } catch (error) {
      console.error('Error analyzing spreads for image references:', error);
      return spreadAnalysis;
    }
  }

  analyzeSpreadXMLForImages(xmlContent, fileName, xmlParser) {
    console.log(`🔍 Analyzing ${fileName} for image references...`);
    
    const analysis = {
      imageReferences: [],
      linkReferences: [],
      placedContentDetails: []
    };
    
    try {
      const parsed = xmlParser.parse(xmlContent);
      
      // Look for any image-related attributes
      const findImageRefs = (obj, path = '') => {
        if (typeof obj === 'object' && obj !== null) {
          Object.keys(obj).forEach(key => {
            const value = obj[key];
            
            // Look for href attributes
            if (key.includes('href') || key.includes('Href')) {
              analysis.linkReferences.push({
                file: fileName,
                path: `${path}.${key}`,
                value: value
              });
              console.log(`🔗 Found href: ${path}.${key} = ${value}`);
            }
            
            // Look for image type names
            if (key.includes('ImageType') || key.includes('imageType')) {
              analysis.imageReferences.push({
                file: fileName,
                path: `${path}.${key}`,
                value: value
              });
              console.log(`🖼️ Found image type: ${path}.${key} = ${value}`);
            }
            
            // Look for Links or Link references
            if (key === 'Link' || key === 'Links') {
              analysis.linkReferences.push({
                file: fileName,
                path: `${path}.${key}`,
                value: JSON.stringify(value).substring(0, 200)
              });
              console.log(`🔗 Found Link object at: ${path}.${key}`);
            }
            
            // Look for placed content
            if (key.includes('Image') || key.includes('EPS') || key.includes('PDF')) {
              analysis.placedContentDetails.push({
                file: fileName,
                elementType: key,
                path: `${path}.${key}`,
                details: value
              });
              console.log(`📎 Found placed content: ${key} at ${path}`);
            }
            
            if (typeof value === 'object') {
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
    console.log('🖼️ Extracting embedded images from spread XML...');
    
    const embeddedImages = [];
    
    try {
      const spreadAnalysis = await this.analyzeSpreadForImageReferences(idmlPath, xmlParser);
      
      for (const placedContent of spreadAnalysis.placedContentDetails) {
        if (placedContent.elementType === 'Image' && 
            placedContent.details && 
            placedContent.details.Properties && 
            placedContent.details.Properties.Contents) {
          
          const base64Data = placedContent.details.Properties.Contents;
          console.log(`📷 Found Base64 image data: ${base64Data.length} characters`);
          
          const linkInfo = placedContent.details.Link || {};
          const imageName = IDMLUtils.extractImageNameFromLink(linkInfo['@_LinkResourceURI']) || 'embedded_image';
          const imageType = linkInfo['@_LinkResourceFormat'] || '$ID/JPEG';
          const extension = IDMLUtils.getImageExtensionFromFormat(imageType);
          
          // Create filename with timestamp to avoid conflicts
          const fileName = `${imageName}.${extension}`;
          const outputPath = path.join(uploadDir, 'ExtractedImages', fileName);
          
          // Create directory
          const outputDir = path.dirname(outputPath);
          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }
          
          try {
            const imageBuffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(outputPath, imageBuffer);
            
            embeddedImages.push({
              originalPath: placedContent.path,
              extractedPath: outputPath,
              fileName: fileName,
              size: imageBuffer.length,
              base64Length: base64Data.length,
              linkInfo: linkInfo,
              isExtracted: true
            });
            
            console.log(`✅ Extracted image: ${fileName} (${imageBuffer.length} bytes)`);
            
          } catch (error) {
            console.error(`❌ Failed to convert Base64 to image:`, error);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error extracting embedded images from spread:', error);
    }
    
    console.log(`✅ Extracted ${embeddedImages.length} embedded images from spread`);
    return embeddedImages;
  }
}

module.exports = ImageProcessor; 
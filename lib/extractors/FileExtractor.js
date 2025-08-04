import yauzl from "yauzl";
import path from "path";
import fs from "fs";
import IDMLUtils from "../utils/IDMLUtils.js";

class FileExtractor {
  constructor() {
    this.extractedFiles = new Map();
  }

  async extractIDMLContents(filePath) {
    return new Promise((resolve, reject) => {
      const extractedData = {};

      yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        const allEntries = [];

        zipfile.on("entry", (entry) => {
          allEntries.push(entry);

          if (entry.fileName.endsWith("/")) {
            zipfile.readEntry();
            return;
          }

          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              console.error(`Error reading ${entry.fileName}:`, err);
              zipfile.readEntry();
              return;
            }

            let content = "";
            readStream.on("data", (chunk) => {
              content += chunk.toString();
            });

            readStream.on("end", () => {
              extractedData[entry.fileName] = content;
              console.log(
                `✅ Extracted: ${entry.fileName} (${content.length} chars)`
              );

              // Always continue reading entries
              zipfile.readEntry();
            });
          });
        });

        zipfile.on("end", () => {
          console.log(
            `ZIP reading completed. Extracted ${
              Object.keys(extractedData).length
            } files`
          );

          // ADD THIS DEBUG:
          console.log("\n🔍 === FILES IN IDML ===");
          Object.keys(extractedData).forEach((fileName) => {
            console.log(`  📁 ${fileName}`);
          });

          // CHECK FOR STORIES SPECIFICALLY:
          const storyFiles = Object.keys(extractedData).filter((name) =>
            name.startsWith("Stories/")
          );
          console.log(
            `\n📝 Found ${storyFiles.length} story files:`,
            storyFiles
          );

          resolve(extractedData);
        });

        zipfile.readEntry();
      });
    });
  }

  async debugIDMLContents(idmlPath) {
    console.log("\n🔍 === DEBUGGING IDML CONTENTS ===");

    return new Promise((resolve, reject) => {
      yauzl.open(idmlPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        const contents = [];

        zipfile.on("entry", (entry) => {
          console.log(`📁 Found: ${entry.fileName}`);

          if (
            entry.fileName.startsWith("Links/") &&
            IDMLUtils.isImageFile(entry.fileName)
          ) {
            console.log(`📷 EMBEDDED IMAGE FOUND: ${entry.fileName}`);
          }

          contents.push(entry.fileName);
          zipfile.readEntry();
        });

        zipfile.on("end", () => {
          console.log(`\n📊 Total files in IDML: ${contents.length}`);
          console.log("📁 Folders found:", [
            ...new Set(contents.map((f) => f.split("/")[0])),
          ]);

          const imageFiles = contents.filter((f) => IDMLUtils.isImageFile(f));
          console.log(`📷 Image files in IDML: ${imageFiles.length}`);
          imageFiles.forEach((img) => console.log(`  - ${img}`));

          resolve(contents);
        });

        zipfile.readEntry();
      });
    });
  }

  async debugIDMLContentsDetailed(idmlPath) {
    console.log("\n🔍 === DETAILED IDML ANALYSIS ===");

    return new Promise((resolve, reject) => {
      yauzl.open(idmlPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        const detailedAnalysis = {
          totalFiles: 0,
          filesByType: {},
          allFiles: [],
          binaryFiles: [],
          xmlFiles: [],
          imageFiles: [],
          unknownFiles: [],
          fileDetails: {},
          suspiciousFiles: [],
          largeBinaryFiles: [],
        };

        zipfile.on("entry", (entry) => {
          detailedAnalysis.totalFiles++;
          detailedAnalysis.allFiles.push(entry.fileName);

          // Analyze file type and size
          const ext = path.extname(entry.fileName).toLowerCase();
          const size = entry.uncompressedSize || 0;
          const isDirectory = entry.fileName.endsWith("/");

          if (!detailedAnalysis.filesByType[ext]) {
            detailedAnalysis.filesByType[ext] = [];
          }
          detailedAnalysis.filesByType[ext].push(entry.fileName);

          // Store detailed file info
          detailedAnalysis.fileDetails[entry.fileName] = {
            compressedSize: entry.compressedSize,
            uncompressedSize: entry.uncompressedSize,
            compressionMethod: entry.compressionMethod,
            isDirectory: isDirectory,
            extension: ext,
          };

          if (!isDirectory) {
            // Check for images by extension
            if (IDMLUtils.isImageFile(entry.fileName)) {
              detailedAnalysis.imageFiles.push({
                fileName: entry.fileName,
                size: size,
                compressed: entry.compressedSize,
                ratio: entry.compressedSize / size,
              });
              console.log(
                `📷 IMAGE FILE FOUND: ${entry.fileName} (${size} bytes)`
              );
            }

            // Check for XML files
            else if (ext === ".xml") {
              detailedAnalysis.xmlFiles.push(entry.fileName);
            }

            // Check for files without extension (could be images)
            else if (ext === "" && size > 1000) {
              detailedAnalysis.suspiciousFiles.push({
                fileName: entry.fileName,
                size: size,
                reason: "No extension but large size",
              });
              console.log(
                `❓ SUSPICIOUS FILE: ${entry.fileName} (${size} bytes, no extension)`
              );
            }

            // Check for large binary files (could be embedded images)
            else if (size > 10000 && ext !== ".xml") {
              detailedAnalysis.largeBinaryFiles.push({
                fileName: entry.fileName,
                size: size,
                extension: ext,
              });
              console.log(
                `📦 LARGE BINARY: ${entry.fileName} (${size} bytes, ${ext})`
              );
            }

            // Files that might be encoded/hidden images
            else if (
              entry.fileName.includes("Link") ||
              entry.fileName.includes("Image") ||
              entry.fileName.includes("Graphic") ||
              size > 50000
            ) {
              detailedAnalysis.suspiciousFiles.push({
                fileName: entry.fileName,
                size: size,
                reason: "Contains image-related keywords or very large",
              });
              console.log(
                `🔍 POTENTIAL IMAGE: ${entry.fileName} (${size} bytes)`
              );
            }
          }

          zipfile.readEntry();
        });

        zipfile.on("end", () => {
          console.log(`\n📊 DETAILED ANALYSIS COMPLETE:`);
          console.log(`Total files: ${detailedAnalysis.totalFiles}`);
          console.log(
            `Image files found: ${detailedAnalysis.imageFiles.length}`
          );
          console.log(
            `Suspicious files: ${detailedAnalysis.suspiciousFiles.length}`
          );
          console.log(
            `Large binary files: ${detailedAnalysis.largeBinaryFiles.length}`
          );
          console.log(
            `File types: ${Object.keys(detailedAnalysis.filesByType).join(
              ", "
            )}`
          );

          resolve(detailedAnalysis);
        });

        zipfile.readEntry();
      });
    });
  }

  async extractSampleContent(idmlPath, fileName, maxBytes = 1000) {
    console.log(`📖 Extracting sample from: ${fileName}`);

    return new Promise((resolve, reject) => {
      yauzl.open(idmlPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        zipfile.on("entry", (entry) => {
          if (entry.fileName === fileName) {
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);

              let content = "";
              let bytesRead = 0;

              readStream.on("data", (chunk) => {
                if (bytesRead < maxBytes) {
                  const remainingBytes = maxBytes - bytesRead;
                  const chunkToAdd = chunk.slice(0, remainingBytes);
                  content += chunkToAdd.toString("hex"); // Get hex representation
                  bytesRead += chunkToAdd.length;
                }
              });

              readStream.on("end", () => {
                resolve({
                  fileName: fileName,
                  sampleHex: content,
                  sampleText: Buffer.from(content, "hex").toString(
                    "utf8",
                    0,
                    Math.min(500, content.length / 2)
                  ),
                  bytesRead: bytesRead,
                });
              });

              readStream.on("error", reject);
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.readEntry();
      });
    });
  }

  async extractFileContent(idmlPath, fileName) {
    return new Promise((resolve, reject) => {
      yauzl.open(idmlPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        zipfile.on("entry", (entry) => {
          if (entry.fileName === fileName) {
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);

              let content = "";
              readStream.on("data", (chunk) => {
                content += chunk.toString();
              });

              readStream.on("end", () => {
                resolve(content);
              });

              readStream.on("error", reject);
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.readEntry();
      });
    });
  }

  async extractAndSaveEmbeddedImages(idmlPath, uploadDir) {
    console.log("🖼️ Extracting and saving embedded images...");

    const embeddedImages = [];

    return new Promise((resolve, reject) => {
      yauzl.open(idmlPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        const imagesToExtract = [];

        zipfile.on("entry", (entry) => {
          if (
            entry.fileName.startsWith("Links/") &&
            IDMLUtils.isImageFile(entry.fileName)
          ) {
            console.log(`📷 Found embedded image: ${entry.fileName}`);
            imagesToExtract.push(entry);
          }
          zipfile.readEntry();
        });

        zipfile.on("end", async () => {
          console.log(
            `Found ${imagesToExtract.length} embedded images to extract`
          );

          // Create ExtractedImages folder in upload directory (not ExtractedLinks)
          const extractedImagesDir = path.join(uploadDir, "ExtractedImages");
          if (!fs.existsSync(extractedImagesDir)) {
            fs.mkdirSync(extractedImagesDir, { recursive: true });
          }

          // Extract each image
          for (const imageEntry of imagesToExtract) {
            try {
              await this.extractSingleImage(
                idmlPath,
                imageEntry,
                extractedImagesDir
              );

              const fileName = path.basename(imageEntry.fileName);
              const extractedPath = path.join(extractedImagesDir, fileName);

              embeddedImages.push({
                originalPath: imageEntry.fileName,
                extractedPath: extractedPath,
                fileName: fileName,
                size: imageEntry.uncompressedSize,
                isExtracted: fs.existsSync(extractedPath),
              });
            } catch (error) {
              console.error(
                `❌ Failed to extract ${imageEntry.fileName}:`,
                error
              );
            }
          }

          console.log(`✅ Extracted ${embeddedImages.length} embedded images`);
          resolve(embeddedImages);
        });

        zipfile.readEntry();
      });
    });
  }

  async extractSingleImage(idmlPath, imageEntry, outputDir) {
    return new Promise((resolve, reject) => {
      yauzl.open(idmlPath, { lazyEntries: true }, (err, zipfile) => {
        if (err) return reject(err);

        zipfile.on("entry", (entry) => {
          if (entry.fileName === imageEntry.fileName) {
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err) return reject(err);

              const fileName = path.basename(entry.fileName);
              const outputPath = path.join(outputDir, fileName);
              const writeStream = fs.createWriteStream(outputPath);

              readStream.pipe(writeStream);

              writeStream.on("finish", () => {
                console.log(`✅ Extracted: ${fileName}`);
                resolve(outputPath);
              });

              writeStream.on("error", reject);
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.readEntry();
      });
    });
  }

  async buildImageMap(packageStructure) {
    const imageMap = new Map();

    console.log("Building image map...");

    // Check all files in resourceMap first
    if (packageStructure.resourceMap) {
      packageStructure.resourceMap.forEach((filePath, fileName) => {
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
    if (fs.existsSync(packageStructure.linksFolder)) {
      const files = fs.readdirSync(packageStructure.linksFolder);
      console.log("Links folder contents:", files);

      for (const fileName of files) {
        if (IDMLUtils.isImageFile(fileName)) {
          const fullPath = path.join(packageStructure.linksFolder, fileName);
          imageMap.set(fileName, fullPath);

          const nameWithoutExt = path.parse(fileName).name;
          imageMap.set(nameWithoutExt, fullPath);

          console.log("Added from Links folder:", fileName, "->", fullPath);
        }
      }
    }

    console.log(`📸 Image map built with ${imageMap.size / 2} unique images`);
    Array.from(imageMap.keys()).forEach((key) => {
      console.log("  - Image key:", key);
    });

    return imageMap;
  }

  async extractEmbeddedImages(packageStructure) {
    const embeddedImages = new Map();

    console.log("🔍 Extracting embedded images from package...");

    // FIX: Use extractedPath instead of undefined property
    const extractedPath =
      packageStructure.extractedPath || packageStructure.uploadDir;

    // Check if there's a Links folder in the package
    const linksPath = path.join(extractedPath, "Links");

    if (fs.existsSync(linksPath)) {
      const linkFiles = fs.readdirSync(linksPath);
      console.log("Found link files:", linkFiles);

      for (const fileName of linkFiles) {
        if (IDMLUtils.isImageFile(fileName)) {
          const fullPath = path.join(linksPath, fileName);
          const stats = fs.statSync(fullPath);

          embeddedImages.set(fileName, {
            path: fullPath,
            size: stats.size,
            isEmbedded: true,
            originalName: fileName,
          });

          console.log(
            `📎 Found embedded image: ${fileName} (${stats.size} bytes)`
          );
        }
      }
    }

    // ALSO check the main package resourceMap for embedded images
    if (packageStructure.resourceMap) {
      packageStructure.resourceMap.forEach((filePath, fileName) => {
        if (IDMLUtils.isImageFile(fileName) && !embeddedImages.has(fileName)) {
          const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : null;

          embeddedImages.set(fileName, {
            path: filePath,
            size: stats ? stats.size : 0,
            isEmbedded: packageStructure.isPackageUpload || false,
            originalName: fileName,
          });

          console.log(`📎 Found package image: ${fileName}`);
        }
      });
    }

    console.log(`✅ Extracted ${embeddedImages.size} embedded/linked images`);
    return embeddedImages;
  }

  getExtractedFiles() {
    return this.extractedFiles;
  }

  clearExtractedFiles() {
    this.extractedFiles.clear();
  }
}

// ES6 exports
export default FileExtractor;

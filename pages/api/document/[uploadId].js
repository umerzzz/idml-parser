// pages/api/document/[uploadId].js
import { IDMLProcessor } from "../../../lib";
import path from "path";
import fs from "fs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uploadId } = req.query;

  if (!uploadId) {
    return res.status(400).json({ error: "Upload ID is required" });
  }

  try {
    console.log(`🔍 Processing document request for upload ID: ${uploadId}`);

    // Get the upload directory
    const uploadDir = path.join(process.cwd(), "uploads", uploadId);

    // ENHANCED: Check if the directory exists with better error handling
    if (!fs.existsSync(uploadDir)) {
      console.error(`❌ Upload directory not found: ${uploadDir}`);
      return res.status(404).json({
        error: "Upload not found",
        details: `Upload directory for ID ${uploadId} does not exist`,
        uploadId: uploadId,
        timestamp: new Date().toISOString(),
      });
    }

    // Define data file paths
    const processedDataFile = path.join(uploadDir, "processed_data.json");
    const rawDataFile = path.join(uploadDir, "raw_data.json");

    // Try to use existing processed data first
    let dataFile = processedDataFile;
    let usingProcessedData = true;

    if (!fs.existsSync(processedDataFile)) {
      console.log("Processed data not found, checking for raw data...");
      if (fs.existsSync(rawDataFile)) {
        console.log("Raw data found, using existing raw data");
        dataFile = rawDataFile;
        usingProcessedData = false;
      } else {
        console.log("No existing data found, processing IDML file...");
        // Need to process the IDML file
        await processIdmlFile(uploadDir, uploadId);

        // After processing, use the newly created processed data
        if (fs.existsSync(processedDataFile)) {
          dataFile = processedDataFile;
          usingProcessedData = true;
        } else {
          throw new Error("Failed to create processed data file");
        }
      }
    } else {
      console.log("Using existing processed data");
    }

    console.log("Loading data from:", dataFile);

    // Read and return the data
    const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));

    console.log(
      `Document loaded successfully for uploadId: ${uploadId} (using ${
        usingProcessedData ? "processed" : "raw"
      } data)`
    );

    // DEBUG: Check if pages field exists in the data
    console.log("🔍 DEBUG: Checking pages field in loaded data...");
    console.log("Data keys:", Object.keys(data));
    console.log("Pages field exists:", !!data.pages);
    console.log("Pages field type:", typeof data.pages);
    console.log("Pages field length:", data.pages?.length);
    if (data.pages && data.pages.length > 0) {
      console.log("First page:", data.pages[0]);
    }

    // Add metadata about the data source
    const responseData = {
      ...data,
      _metadata: {
        dataSource: usingProcessedData ? "processed" : "raw",
        loadedAt: new Date().toISOString(),
        uploadId: uploadId,
        freshlyProcessed: !fs.existsSync(processedDataFile), // NEW: Indicate if this was just processed
      },
    };

    res.json(responseData);
  } catch (error) {
    console.error("Error processing document request:", error);
    return res.status(500).json({
      error: "Error processing document",
      details: error.message,
    });
  }
}

// Helper function to process IDML file
async function processIdmlFile(uploadDir, uploadId) {
  console.log(`Processing IDML file for upload ID: ${uploadId}`);

  // Find the IDML file
  const files = fs.readdirSync(uploadDir);
  const idmlFile = files.find((file) => file.endsWith(".idml"));

  if (!idmlFile) {
    throw new Error("No IDML file found in upload");
  }

  const idmlPath = path.join(uploadDir, idmlFile);

  // Process the IDML file with enhanced configuration
  const processor = new IDMLProcessor({
    convertToPixels: true,
    dpi: 72,
    debug: true, // Enable debugging
    preserveOriginalUnits: true,
    enableNextFonts: true, // NEW: Enable Next.js font processing
    fontMapping: true, // NEW: Enable font mapping
  });

  console.log(`Processing IDML file: ${idmlPath}`);
  const documentData = await processor.processIDML(idmlPath);

  // DEBUG: Check if pages field exists before saving
  console.log("🔍 DEBUG: Checking pages field before saving to file:");
  console.log("Document data keys:", Object.keys(documentData));
  console.log("Pages field exists:", !!documentData.pages);
  console.log("Pages field type:", typeof documentData.pages);
  console.log("Pages field length:", documentData.pages?.length);

  // Save processed data to file
  const processedDataFile = path.join(uploadDir, "processed_data.json");
  fs.writeFileSync(
    processedDataFile,
    JSON.stringify(documentData, null, 2),
    "utf8"
  );
  console.log(`Processed data saved to: ${processedDataFile}`);

  // Log page debug information to a separate file
  const pageDebugPath = path.join(
    process.cwd(),
    `page-debug-api-${uploadId}.json`
  );

  const debugInfo = {
    timestamp: new Date().toISOString(),
    uploadId,
    pageCount: documentData.document?.pageCount || 0,
    pageIds: documentData.pages?.map((page) => page.self) || [],
    elementsByPageCount: Object.keys(documentData.elementsByPage || {}).map(
      (pageId) => ({
        pageId,
        elementCount: documentData.elementsByPage[pageId]?.length || 0,
      })
    ),
    totalElements: documentData.elements?.length || 0,
    spreadsCount: Object.keys(documentData.spreads || {}).length,
    storiesCount: Object.keys(documentData.stories || {}).length,
    // NEW: Add font information
    fontsCount: documentData.nextFonts?.totalFonts || 0,
    fontNames: documentData.nextFonts?.usedFontNames || [],
  };

  fs.writeFileSync(pageDebugPath, JSON.stringify(debugInfo, null, 2), "utf8");
  console.log(`Page debug information saved to ${pageDebugPath}`);

  // Also save raw data for backward compatibility (optional)
  const rawDataFile = path.join(uploadDir, "raw_data.json");
  if (!fs.existsSync(rawDataFile)) {
    fs.writeFileSync(
      rawDataFile,
      JSON.stringify(documentData, null, 2),
      "utf8"
    );
    console.log(`Raw data backup saved to: ${rawDataFile}`);
  }

  return documentData;
}

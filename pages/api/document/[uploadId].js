// pages/api/document/[uploadId].js
import { IDMLProcessor } from "../../../lib";
import path from "path";
import fs from "fs";
// ADDED: Import DataModularizer for modularized data access
const DataModularizer = require("../../../lib/utils/DataModularizer");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { uploadId } = req.query;

  if (!uploadId) {
    return res.status(400).json({ error: "Upload ID is required" });
  }

  try {
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

    // MODULARIZED ONLY: Define modularized data paths
    const modulesDir = path.join(uploadDir, "modules");
    const indexFile = path.join(modulesDir, "index.json");

    // MODULARIZED ONLY: Check for modularized data
    let modularizer = null;

    if (fs.existsSync(indexFile)) {
      modularizer = new DataModularizer(uploadDir);
    } else {
      // Need to process the IDML file
      await processIdmlFile(uploadDir, uploadId);

      // After processing, check for modularized data
      if (fs.existsSync(indexFile)) {
        modularizer = new DataModularizer(uploadDir);
      } else {
        throw new Error("Failed to create modularized data");
      }
    }

    // MODULARIZED ONLY: Load modularized data
    const data = modularizer.loadAllModules();

    // Add metadata about the data source
    const responseData = {
      ...data,
      _metadata: {
        dataSource: "modularized",
        loadedAt: new Date().toISOString(),
        uploadId: uploadId,
        modularized: true,
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

    preserveOriginalUnits: true,
    enableNextFonts: true, // NEW: Enable Next.js font processing
    fontMapping: true, // NEW: Enable font mapping
  });

  const documentData = await processor.processIDML(idmlPath);

  // Save processed data to file
  const processedDataFile = path.join(uploadDir, "processed_data.json");
  fs.writeFileSync(
    processedDataFile,
    JSON.stringify(documentData, null, 2),
    "utf8"
  );

  // Also save raw data for backward compatibility (optional)
  const rawDataFile = path.join(uploadDir, "raw_data.json");
  if (!fs.existsSync(rawDataFile)) {
    fs.writeFileSync(
      rawDataFile,
      JSON.stringify(documentData, null, 2),
      "utf8"
    );
  }

  return documentData;
}

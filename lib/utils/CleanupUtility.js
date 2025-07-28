const fs = require("fs");
const path = require("path");

class CleanupUtility {
  constructor() {
    this.uploadsDir = path.join(process.cwd(), "uploads");
  }

  /**
   * Clean up all legacy files (processed_data.json, debug_analysis.json, raw_data.json) from existing uploads
   * @returns {Object} - Cleanup results
   */
  cleanupLegacyFiles() {
    console.log("🧹 Starting cleanup of all legacy files...");

    const results = {
      totalUploads: 0,
      processedDataFilesFound: 0,
      processedDataFilesRemoved: 0,
      debugAnalysisFilesFound: 0,
      debugAnalysisFilesRemoved: 0,
      rawDataFilesFound: 0,
      rawDataFilesRemoved: 0,
      modularizedUploads: 0,
      errors: [],
      details: [],
    };

    if (!fs.existsSync(this.uploadsDir)) {
      console.log("📁 Uploads directory not found, nothing to clean up");
      return results;
    }

    const uploadDirs = fs
      .readdirSync(this.uploadsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    results.totalUploads = uploadDirs.length;
    console.log(`📁 Found ${uploadDirs.length} upload directories`);

    for (const uploadId of uploadDirs) {
      const uploadDir = path.join(this.uploadsDir, uploadId);
      const processedDataPath = path.join(uploadDir, "processed_data.json");
      const debugAnalysisPath = path.join(uploadDir, "debug_analysis.json");
      const rawDataPath = path.join(uploadDir, "raw_data.json");
      const modulesDir = path.join(uploadDir, "modules");
      const indexPath = path.join(modulesDir, "index.json");

      const detail = {
        uploadId,
        hasProcessedData: false,
        hasDebugAnalysis: false,
        hasRawData: false,
        hasModularizedData: false,
        processedDataRemoved: false,
        debugAnalysisRemoved: false,
        rawDataRemoved: false,
        error: null,
      };

      try {
        // Check if modularized data exists
        if (fs.existsSync(indexPath)) {
          detail.hasModularizedData = true;
          results.modularizedUploads++;
        }

        // Check if legacy files exist and remove them if modularized data exists
        if (fs.existsSync(processedDataPath)) {
          detail.hasProcessedData = true;
          results.processedDataFilesFound++;

          if (detail.hasModularizedData) {
            fs.unlinkSync(processedDataPath);
            detail.processedDataRemoved = true;
            results.processedDataFilesRemoved++;
            console.log(`🗑️ Removed processed_data.json from ${uploadId}`);
          }
        }

        if (fs.existsSync(debugAnalysisPath)) {
          detail.hasDebugAnalysis = true;
          results.debugAnalysisFilesFound++;

          if (detail.hasModularizedData) {
            fs.unlinkSync(debugAnalysisPath);
            detail.debugAnalysisRemoved = true;
            results.debugAnalysisFilesRemoved++;
            console.log(`🗑️ Removed debug_analysis.json from ${uploadId}`);
          }
        }

        if (fs.existsSync(rawDataPath)) {
          detail.hasRawData = true;
          results.rawDataFilesFound++;

          if (detail.hasModularizedData) {
            fs.unlinkSync(rawDataPath);
            detail.rawDataRemoved = true;
            results.rawDataFilesRemoved++;
            console.log(`🗑️ Removed raw_data.json from ${uploadId}`);
          }
        }

        if (!detail.hasModularizedData) {
          console.log(`⚠️ Skipped ${uploadId} - no modularized data found`);
        }

        results.details.push(detail);
      } catch (error) {
        detail.error = error.message;
        results.errors.push({
          uploadId,
          error: error.message,
        });
        console.error(`❌ Error processing ${uploadId}:`, error.message);
      }
    }

    console.log("✅ Cleanup completed!");
    console.log(`📊 Results:`);
    console.log(`  - Total uploads: ${results.totalUploads}`);
    console.log(`  - Modularized uploads: ${results.modularizedUploads}`);
    console.log(
      `  - processed_data.json found: ${results.processedDataFilesFound}, removed: ${results.processedDataFilesRemoved}`
    );
    console.log(
      `  - debug_analysis.json found: ${results.debugAnalysisFilesFound}, removed: ${results.debugAnalysisFilesRemoved}`
    );
    console.log(
      `  - raw_data.json found: ${results.rawDataFilesFound}, removed: ${results.rawDataFilesRemoved}`
    );
    console.log(`  - Errors: ${results.errors.length}`);

    return results;
  }

  /**
   * Get statistics about uploads and their data formats
   * @returns {Object} - Statistics
   */
  getUploadStatistics() {
    console.log("📊 Generating upload statistics...");

    const stats = {
      totalUploads: 0,
      modularizedUploads: 0,
      legacyOnlyUploads: 0,
      rawOnlyUploads: 0,
      uploadsWithErrors: 0,
      details: [],
    };

    if (!fs.existsSync(this.uploadsDir)) {
      return stats;
    }

    const uploadDirs = fs
      .readdirSync(this.uploadsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    stats.totalUploads = uploadDirs.length;

    for (const uploadId of uploadDirs) {
      const uploadDir = path.join(this.uploadsDir, uploadId);
      const processedDataPath = path.join(uploadDir, "processed_data.json");
      const rawDataPath = path.join(uploadDir, "raw_data.json");
      const modulesDir = path.join(uploadDir, "modules");
      const indexPath = path.join(modulesDir, "index.json");

      const detail = {
        uploadId,
        hasModularizedData: fs.existsSync(indexPath),
        hasProcessedData: fs.existsSync(processedDataPath),
        hasRawData: fs.existsSync(rawDataPath),
        dataType: "unknown",
      };

      if (detail.hasModularizedData) {
        detail.dataType = "modularized";
        stats.modularizedUploads++;
      } else if (detail.hasProcessedData) {
        detail.dataType = "legacy";
        stats.legacyOnlyUploads++;
      } else if (detail.hasRawData) {
        detail.dataType = "raw";
        stats.rawOnlyUploads++;
      } else {
        detail.dataType = "none";
        stats.uploadsWithErrors++;
      }

      stats.details.push(detail);
    }

    return stats;
  }

  /**
   * Convert legacy uploads to modularized format
   * @returns {Object} - Conversion results
   */
  convertLegacyToModularized() {
    console.log("🔄 Converting legacy uploads to modularized format...");

    const results = {
      totalProcessed: 0,
      successfulConversions: 0,
      failedConversions: 0,
      errors: [],
      details: [],
    };

    if (!fs.existsSync(this.uploadsDir)) {
      return results;
    }

    const uploadDirs = fs
      .readdirSync(this.uploadsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const uploadId of uploadDirs) {
      const uploadDir = path.join(this.uploadsDir, uploadId);
      const processedDataPath = path.join(uploadDir, "processed_data.json");
      const modulesDir = path.join(uploadDir, "modules");
      const indexPath = path.join(modulesDir, "index.json");

      const detail = {
        uploadId,
        converted: false,
        error: null,
      };

      try {
        // Only convert if legacy data exists and no modularized data
        if (fs.existsSync(processedDataPath) && !fs.existsSync(indexPath)) {
          console.log(`🔄 Converting ${uploadId} to modularized format...`);

          // Load legacy data
          const legacyData = JSON.parse(
            fs.readFileSync(processedDataPath, "utf8")
          );

          // Modularize it
          const DataModularizer = require("./DataModularizer");
          const modularizer = new DataModularizer(uploadDir);
          const modularizationIndex = modularizer.modularize(legacyData);

          // Remove legacy file
          fs.unlinkSync(processedDataPath);

          detail.converted = true;
          results.successfulConversions++;
          console.log(`✅ Successfully converted ${uploadId}`);
        } else {
          console.log(
            `⏭️ Skipping ${uploadId} - already modularized or no legacy data`
          );
        }

        results.details.push(detail);
      } catch (error) {
        detail.error = error.message;
        results.errors.push({
          uploadId,
          error: error.message,
        });
        results.failedConversions++;
        console.error(`❌ Error converting ${uploadId}:`, error.message);
      }
    }

    results.totalProcessed = uploadDirs.length;

    console.log("✅ Conversion completed!");
    console.log(`📊 Results:`);
    console.log(`  - Total processed: ${results.totalProcessed}`);
    console.log(`  - Successful conversions: ${results.successfulConversions}`);
    console.log(`  - Failed conversions: ${results.failedConversions}`);
    console.log(`  - Errors: ${results.errors.length}`);

    return results;
  }
}

module.exports = CleanupUtility;

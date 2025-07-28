import fs from "fs/promises";
import path from "path";

class PageDebugger {
  constructor(options = {}) {
    this.debugEnabled = options.debug !== false;
    this.logToFile = options.logToFile !== false;
    this.logToConsole = options.logToConsole !== false;
    this.debugFilePath =
      options.debugFilePath || path.join(process.cwd(), "page-debug.json");
    this.debugData = {
      timestamp: new Date().toISOString(),
      pageInfo: [],
      elementAssociations: [],
      errors: [],
      warnings: [],
    };
  }

  /**
   * Log page information
   * @param {Object} data - Page data to log
   */
  logPageInfo(data) {
    if (!this.debugEnabled) return;

    this.debugData.pageInfo.push({
      timestamp: new Date().toISOString(),
      ...data,
    });

    if (this.logToConsole) {
      console.log("📄 PAGE DEBUG:", data);
    }
  }

  /**
   * Log element-to-page associations
   * @param {Object} data - Association data to log
   */
  logElementAssociation(data) {
    if (!this.debugEnabled) return;

    this.debugData.elementAssociations.push({
      timestamp: new Date().toISOString(),
      ...data,
    });

    if (this.logToConsole) {
      console.log("🔗 ELEMENT-PAGE ASSOCIATION:", data);
    }
  }

  /**
   * Log an error
   * @param {String} message - Error message
   * @param {Object} details - Additional error details
   */
  logError(message, details = {}) {
    if (!this.debugEnabled) return;

    this.debugData.errors.push({
      timestamp: new Date().toISOString(),
      message,
      details,
    });

    if (this.logToConsole) {
      console.error("❌ PAGE ERROR:", message, details);
    }
  }

  /**
   * Log a warning
   * @param {String} message - Warning message
   * @param {Object} details - Additional warning details
   */
  logWarning(message, details = {}) {
    if (!this.debugEnabled) return;

    this.debugData.warnings.push({
      timestamp: new Date().toISOString(),
      message,
      details,
    });

    if (this.logToConsole) {
      console.warn("⚠️ PAGE WARNING:", message, details);
    }
  }

  /**
   * Create a summary of page and element information
   * @returns {Object} Summary data
   */
  createSummary() {
    const pageCount =
      this.debugData.pageInfo.length > 0
        ? this.debugData.pageInfo[this.debugData.pageInfo.length - 1]
            .totalPages || 0
        : 0;

    const elementsByPage = {};
    this.debugData.elementAssociations.forEach((assoc) => {
      if (assoc.pageId && assoc.elements) {
        elementsByPage[assoc.pageId] = assoc.elements;
      }
    });

    return {
      timestamp: new Date().toISOString(),
      pageCount,
      elementsByPage,
      errorCount: this.debugData.errors.length,
      warningCount: this.debugData.warnings.length,
    };
  }

  /**
   * Save debug data to file
   * @returns {Promise<void>}
   */
  async saveDebugData() {
    if (!this.debugEnabled || !this.logToFile) return;

    try {
      const summary = this.createSummary();
      const debugOutput = {
        summary,
        ...this.debugData,
      };

      await fs.writeFile(
        this.debugFilePath,
        JSON.stringify(debugOutput, null, 2),
        "utf8"
      );

      if (this.logToConsole) {
        console.log(`📝 Page debug data saved to ${this.debugFilePath}`);
      }
    } catch (error) {
      console.error("Failed to save debug data:", error);
    }
  }

  /**
   * Save debug data for a specific upload ID
   * @param {String} uploadId - The upload ID to use in the filename
   * @returns {Promise<void>}
   */
  async saveDebugDataForUpload(uploadId) {
    if (!this.debugEnabled || !this.logToFile) return;

    try {
      const summary = this.createSummary();
      const debugOutput = {
        summary,
        ...this.debugData,
      };

      const debugFilePath = path.join(
        process.cwd(),
        `page-debug-${uploadId}-${Date.now()}.json`
      );

      await fs.writeFile(
        debugFilePath,
        JSON.stringify(debugOutput, null, 2),
        "utf8"
      );

      if (this.logToConsole) {
        console.log(
          `📝 Page debug data for upload ${uploadId} saved to ${debugFilePath}`
        );
      }
    } catch (error) {
      console.error("Failed to save debug data for upload:", error);
    }
  }
}

// ES6 exports
export default PageDebugger;

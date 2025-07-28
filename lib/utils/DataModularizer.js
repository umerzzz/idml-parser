const fs = require("fs");
const path = require("path");

class DataModularizer {
  constructor(uploadDir) {
    this.uploadDir = uploadDir;
    this.modulesDir = path.join(uploadDir, "modules");
    this.ensureModulesDirectory();
  }

  ensureModulesDirectory() {
    if (!fs.existsSync(this.modulesDir)) {
      fs.mkdirSync(this.modulesDir, { recursive: true });
    }
  }

  /**
   * Modularize processed data into separate files
   * @param {Object} processedData - The complete processed data object
   * @returns {Object} - Index object with references to all modules
   */
  modularize(processedData) {
    console.log("🔧 Starting data modularization...");

    const modules = {};
    const index = {
      version: "1.0",
      modularizedAt: new Date().toISOString(),
      modules: {},
      metadata: {
        totalModules: 0,
        totalSize: 0,
      },
    };

    // 1. Document information
    if (processedData.document) {
      modules.document = this.saveModule(
        "document.json",
        processedData.document
      );
      index.modules.document = modules.document;
    }

    // 2. Page information
    if (processedData.pageInfo) {
      modules.pageInfo = this.saveModule(
        "pageInfo.json",
        processedData.pageInfo
      );
      index.modules.pageInfo = modules.pageInfo;
    }

    // 3. Elements (largest file)
    if (processedData.elements) {
      modules.elements = this.saveModule(
        "elements.json",
        processedData.elements
      );
      index.modules.elements = modules.elements;
    }

    // 4. Colors
    if (processedData.colors) {
      modules.colors = this.saveModule("colors.json", processedData.colors);
      index.modules.colors = modules.colors;
    }

    // 5. Gradients
    if (processedData.gradients) {
      modules.gradients = this.saveModule(
        "gradients.json",
        processedData.gradients
      );
      index.modules.gradients = modules.gradients;
    }

    // 6. Debug information
    if (processedData.debug22) {
      modules.debug = this.saveModule("debug.json", processedData.debug22);
      index.modules.debug = modules.debug;
    }

    // 7. Package information
    if (processedData.packageInfo) {
      modules.packageInfo = this.saveModule(
        "packageInfo.json",
        processedData.packageInfo
      );
      index.modules.packageInfo = modules.packageInfo;
    }

    // 8. Processing information
    if (processedData.processingInfo) {
      modules.processingInfo = this.saveModule(
        "processingInfo.json",
        processedData.processingInfo
      );
      index.modules.processingInfo = modules.processingInfo;
    }

    // 9. Next.js fonts
    if (processedData.nextFonts) {
      modules.nextFonts = this.saveModule(
        "nextFonts.json",
        processedData.nextFonts
      );
      index.modules.nextFonts = modules.nextFonts;
    }

    // 10. Stories (if they exist)
    if (processedData.stories) {
      modules.stories = this.saveModule("stories.json", processedData.stories);
      index.modules.stories = modules.stories;
    }

    // 11. Styles (if they exist)
    if (processedData.styles) {
      modules.styles = this.saveModule("styles.json", processedData.styles);
      index.modules.styles = modules.styles;
    }

    // 12. Pages (if they exist)
    if (processedData.pages) {
      modules.pages = this.saveModule("pages.json", processedData.pages);
      index.modules.pages = modules.pages;
    }

    // 13. Elements by page (if they exist)
    if (processedData.elementsByPage) {
      modules.elementsByPage = this.saveModule(
        "elementsByPage.json",
        processedData.elementsByPage
      );
      index.modules.elementsByPage = modules.elementsByPage;
    }

    // 14. Spreads (if they exist)
    if (processedData.spreads) {
      modules.spreads = this.saveModule("spreads.json", processedData.spreads);
      index.modules.spreads = modules.spreads;
    }

    // 15. Master spreads (if they exist)
    if (processedData.masterSpreads) {
      modules.masterSpreads = this.saveModule(
        "masterSpreads.json",
        processedData.masterSpreads
      );
      index.modules.masterSpreads = modules.masterSpreads;
    }

    // 16. Layers (if they exist)
    if (processedData.layers) {
      modules.layers = this.saveModule("layers.json", processedData.layers);
      index.modules.layers = modules.layers;
    }

    // 17. Resources (if they exist)
    if (processedData.resources) {
      modules.resources = this.saveModule(
        "resources.json",
        processedData.resources
      );
      index.modules.resources = modules.resources;
    }

    // Calculate metadata
    index.metadata.totalModules = Object.keys(index.modules).length;
    index.metadata.totalSize = Object.values(modules).reduce(
      (total, module) => total + module.size,
      0
    );

    // Save the index file
    const indexPath = path.join(this.modulesDir, "index.json");
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    console.log(
      `✅ Modularization complete! Created ${index.metadata.totalModules} modules`
    );
    console.log(`📁 Modules directory: ${this.modulesDir}`);
    console.log(`📄 Index file: ${indexPath}`);
    console.log(
      `📊 Total size: ${(index.metadata.totalSize / 1024 / 1024).toFixed(2)} MB`
    );

    return index;
  }

  /**
   * Save a module to a JSON file
   * @param {string} filename - The filename for the module
   * @param {Object} data - The data to save
   * @returns {Object} - Module metadata
   */
  saveModule(filename, data) {
    const filePath = path.join(this.modulesDir, filename);
    const jsonString = JSON.stringify(data, null, 2);

    fs.writeFileSync(filePath, jsonString, "utf8");

    const stats = fs.statSync(filePath);
    const moduleInfo = {
      filename,
      path: `modules/${filename}`,
      size: stats.size,
      sizeFormatted: this.formatFileSize(stats.size),
      createdAt: new Date().toISOString(),
      dataType: this.getDataType(data),
    };

    console.log(`📄 Created module: ${filename} (${moduleInfo.sizeFormatted})`);
    return moduleInfo;
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} - Formatted size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * Determine the data type for metadata
   * @param {*} data - The data to analyze
   * @returns {string} - Data type description
   */
  getDataType(data) {
    if (Array.isArray(data)) {
      return `Array (${data.length} items)`;
    } else if (typeof data === "object" && data !== null) {
      return `Object (${Object.keys(data).length} keys)`;
    } else {
      return typeof data;
    }
  }

  /**
   * Load a specific module
   * @param {string} moduleName - The module name to load
   * @returns {Object|null} - The loaded module data or null if not found
   */
  loadModule(moduleName) {
    const modulePath = path.join(this.modulesDir, `${moduleName}.json`);

    if (!fs.existsSync(modulePath)) {
      console.warn(`⚠️ Module not found: ${moduleName}`);
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(modulePath, "utf8"));
      console.log(`📖 Loaded module: ${moduleName}`);
      return data;
    } catch (error) {
      console.error(`❌ Error loading module ${moduleName}:`, error.message);
      return null;
    }
  }

  /**
   * Load the index file
   * @returns {Object|null} - The index data or null if not found
   */
  loadIndex() {
    const indexPath = path.join(this.modulesDir, "index.json");

    if (!fs.existsSync(indexPath)) {
      console.warn("⚠️ Index file not found");
      return null;
    }

    try {
      const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
      console.log("📖 Loaded index file");
      return index;
    } catch (error) {
      console.error("❌ Error loading index file:", error.message);
      return null;
    }
  }

  /**
   * Load all modules and reconstruct the original data structure
   * @returns {Object} - The complete reconstructed data
   */
  loadAllModules() {
    const index = this.loadIndex();
    if (!index) {
      throw new Error("Index file not found");
    }

    const reconstructedData = {};

    for (const [moduleName, moduleInfo] of Object.entries(index.modules)) {
      const data = this.loadModule(moduleName.replace(".json", ""));
      if (data !== null) {
        // Handle special cases where the module name differs from the data key
        const dataKey = this.getDataKeyFromModuleName(moduleName);
        reconstructedData[dataKey] = data;
      }
    }

    console.log("✅ All modules loaded and reconstructed");
    return reconstructedData;
  }

  /**
   * Get the data key from module name (handles special cases)
   * @param {string} moduleName - The module name
   * @returns {string} - The corresponding data key
   */
  getDataKeyFromModuleName(moduleName) {
    const mapping = {
      "debug.json": "debug22",
      "document.json": "document",
      "pageInfo.json": "pageInfo",
      "elements.json": "elements",
      "colors.json": "colors",
      "gradients.json": "gradients",
      "packageInfo.json": "packageInfo",
      "processingInfo.json": "processingInfo",
      "nextFonts.json": "nextFonts",
      "stories.json": "stories",
      "styles.json": "styles",
      "pages.json": "pages",
      "elementsByPage.json": "elementsByPage",
      "spreads.json": "spreads",
      "masterSpreads.json": "masterSpreads",
      "layers.json": "layers",
      "resources.json": "resources",
    };

    return mapping[moduleName] || moduleName.replace(".json", "");
  }

  /**
   * Clean up old processed_data.json file
   */
  cleanupOldFiles() {
    const oldProcessedDataPath = path.join(
      this.uploadDir,
      "processed_data.json"
    );

    if (fs.existsSync(oldProcessedDataPath)) {
      try {
        fs.unlinkSync(oldProcessedDataPath);
        console.log("🗑️ Removed old processed_data.json file");
      } catch (error) {
        console.error(
          "❌ Error removing old processed_data.json:",
          error.message
        );
      }
    }
  }
}

module.exports = DataModularizer;

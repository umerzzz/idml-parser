// pages/api/cleanup.js
import path from "path";
import fs from "fs";

// Import cleanup utility
const CleanupUtility = require("../../lib/utils/CleanupUtility");

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { action } = req.body;

  if (!action) {
    return res.status(400).json({
      error: "Action is required",
      availableActions: ["cleanup", "convert", "stats"],
    });
  }

  try {
    const cleanupUtility = new CleanupUtility();
    let result;

    switch (action) {
      case "cleanup":
        result = cleanupUtility.cleanupLegacyFiles();
        break;

      case "convert":
        result = cleanupUtility.convertLegacyToModularized();
        break;

      case "stats":
        result = cleanupUtility.getUploadStatistics();
        break;

      default:
        return res.status(400).json({
          error: "Invalid action",
          availableActions: ["cleanup", "convert", "stats"],
        });
    }

    res.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Cleanup error:", error);
    res.status(500).json({
      error: error.message,
      stack: error.stack,
      action,
    });
  }
}

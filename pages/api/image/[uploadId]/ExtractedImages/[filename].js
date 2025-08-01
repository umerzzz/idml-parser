import path from "path";
import fs from "fs";

export default function handler(req, res) {
  console.log(`🖼️ ExtractedImages API endpoint called!`);

  const { uploadId, filename } = req.query;

  console.log(`🖼️ ExtractedImages API request:`, {
    uploadId,
    filename,
    method: req.method,
  });

  try {
    // Try the filename as-is first
    let imagePath = path.join(
      process.cwd(),
      "uploads",
      uploadId,
      "ExtractedImages",
      filename
    );

    console.log(`🖼️ Checking image path:`, {
      imagePath,
      exists: fs.existsSync(imagePath),
      cwd: process.cwd(),
    });

    // If not found, try URL-encoded version
    if (!fs.existsSync(imagePath)) {
      const encodedFilename = encodeURIComponent(filename);
      imagePath = path.join(
        process.cwd(),
        "uploads",
        uploadId,
        "ExtractedImages",
        encodedFilename
      );

      console.log(`🖼️ Trying URL-encoded filename:`, {
        originalFilename: filename,
        encodedFilename,
        newImagePath: imagePath,
        exists: fs.existsSync(imagePath),
      });
    }

    if (!fs.existsSync(imagePath)) {
      console.log(`❌ Image not found: ${imagePath}`);
      return res.status(404).json({ error: "Image not found" });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(filename).toLowerCase();

    let contentType = "image/jpeg";
    if (ext === ".png") contentType = "image/png";
    else if (ext === ".gif") contentType = "image/gif";
    else if (ext === ".tiff" || ext === ".tif") contentType = "image/tiff";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(imageBuffer);
  } catch (error) {
    console.error("Error serving extracted image:", error);
    res.status(500).json({ error: "Error serving image" });
  }
}

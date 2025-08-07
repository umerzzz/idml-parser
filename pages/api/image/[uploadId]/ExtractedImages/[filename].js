import path from "path";
import fs from "fs";

export default function handler(req, res) {
  const { uploadId, filename } = req.query;

  try {
    // Try the filename as-is first
    let imagePath = path.join(
      process.cwd(),
      "uploads",
      uploadId,
      "ExtractedImages",
      filename
    );

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
    }

    if (!fs.existsSync(imagePath)) {
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

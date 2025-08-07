import path from "path";
import fs from "fs";

export default function handler(req, res) {
  const { uploadId, params = [] } = req.query;

  // params could be ['Links', 'car.jpg'] or ['ExtractedImages', 'panda.jpg']
  const filePath = path.join(process.cwd(), "uploads", uploadId, ...params);

  if (!fs.existsSync(filePath)) {
    res.status(404).send("Not found");
    return;
  }

  // Set content type based on file extension
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };

  res.setHeader("Content-Type", mimeTypes[ext] || "application/octet-stream");

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}

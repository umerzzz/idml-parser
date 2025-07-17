import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  const { uploadId, filename } = req.query;
  
  try {
    const imagePath = path.join(process.cwd(), 'uploads', uploadId, 'ExtractedImages', filename);
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(filename).toLowerCase();
    
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.tiff' || ext === '.tif') contentType = 'image/tiff';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Error serving extracted image:', error);
    res.status(500).json({ error: 'Error serving image' });
  }
}
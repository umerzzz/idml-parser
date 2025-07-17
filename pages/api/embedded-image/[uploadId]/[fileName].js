// pages/api/embedded-image/[uploadId]/[fileName].js
import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const { uploadId, fileName } = req.query;
  
  try {
    // Look for the embedded image in the uploads directory
    const uploadsDir = path.join(process.cwd(), 'uploads', uploadId);
    const linksDir = path.join(uploadsDir, 'Links');
    
    let imagePath = path.join(linksDir, fileName);
    
    // Fallback to main uploads directory
    if (!fs.existsSync(imagePath)) {
      imagePath = path.join(uploadsDir, fileName);
    }
    
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'Embedded image not found' });
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(fileName).toLowerCase();
    
    // Set appropriate content type
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.tif': 'image/tiff',
      '.tiff': 'image/tiff',
      '.bmp': 'image/bmp'
    };
    
    res.setHeader('Content-Type', contentTypes[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Error serving embedded image:', error);
    res.status(500).json({ error: 'Failed to serve embedded image' });
  }
}
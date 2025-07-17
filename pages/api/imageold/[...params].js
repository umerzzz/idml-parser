// pages/api/image/[...params].js
import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { params } = req.query;
  
  if (!params || params.length < 2) {
    return res.status(400).json({ error: 'Invalid image path' });
  }

  const [uploadId, ...filePathParts] = params;
  const fileName = filePathParts.join('/');
  
  // Try multiple possible paths
  const possiblePaths = [
    path.join(process.cwd(), 'uploads', uploadId, fileName),
    path.join(process.cwd(), 'uploads', uploadId, 'Links', fileName),
    path.join(process.cwd(), 'uploads', uploadId, 'images', fileName)
  ];
  
  let imagePath = null;
  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(possiblePath)) {
      imagePath = possiblePath;
      break;
    }
  }
  
  console.log('🖼️ Looking for image:', fileName);
  console.log('📍 Found at:', imagePath);
  
  if (!imagePath) {
    console.log('❌ Image not found in any of these paths:', possiblePaths);
    return res.status(404).json({ error: 'Image not found' });
  }

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(fileName).toLowerCase();
    
    // Set appropriate content type
    const contentType = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(imageBuffer);
    
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
}
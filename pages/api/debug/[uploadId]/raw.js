import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const { uploadId } = req.query;
  
  try {
    const debugPath = path.join(process.cwd(), 'uploads', uploadId, 'debug_analysis.json');
    
    if (!fs.existsSync(debugPath)) {
      return res.status(404).json({ error: 'Debug data not found' });
    }
    
    const debugData = fs.readFileSync(debugPath, 'utf8');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="debug_${uploadId}.json"`);
    res.send(debugData);
    
  } catch (error) {
    console.error('Error downloading debug data:', error);
    res.status(500).json({ error: 'Failed to download debug data' });
  }
}
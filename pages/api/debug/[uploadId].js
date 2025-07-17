// pages/api/debug/[uploadId].js
import path from 'path';
import fs from 'fs';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { uploadId } = req.query;
  
  if (!uploadId) {
    return res.status(400).json({ error: 'Upload ID is required' });
  }

  const debugFile = path.join(process.cwd(), 'uploads', uploadId, 'debug_data.json');
  
  console.log('Looking for debug file:', debugFile);
  
  if (!fs.existsSync(debugFile)) {
    console.log('Debug file not found:', debugFile);
    return res.status(404).json({ error: 'Debug data not found' });
  }

  try {
    const debugData = JSON.parse(fs.readFileSync(debugFile, 'utf8'));
    console.log('Debug data loaded successfully for uploadId:', uploadId);
    res.json(debugData);
  } catch (error) {
    console.error('Error reading debug file:', error);
    res.status(500).json({ error: 'Failed to read debug data' });
  }
}
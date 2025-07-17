// pages/api/document/[uploadId].js
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

  // USE COMPREHENSIVE PROCESSED DATA - it now has ALL the complete information without any filtering
  const processedDataFile = path.join(process.cwd(), 'uploads', uploadId, 'processed_data.json');
  const rawDataFile = path.join(process.cwd(), 'uploads', uploadId, 'raw_data.json');
  
  // Try processed data first, fallback to raw data for older uploads
  let dataFile = processedDataFile;
  if (!fs.existsSync(processedDataFile)) {
    console.log('Processed data not found, falling back to raw data');
    dataFile = rawDataFile;
  }
  
  console.log('Looking for file:', dataFile);
  
  if (!fs.existsSync(dataFile)) {
    console.log('No data file found for upload:', uploadId);
    return res.status(404).json({ error: 'Document not found' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const usingProcessedData = dataFile === processedDataFile;
    console.log(`Document loaded successfully for uploadId: ${uploadId} (using ${usingProcessedData ? 'processed' : 'raw'} data)`);
    
    // Add metadata about the data source
    const responseData = {
      ...data,
      _metadata: {
        dataSource: usingProcessedData ? 'processed' : 'raw',
        loadedAt: new Date().toISOString(),
        uploadId: uploadId
      }
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('Error reading document file:', error);
    res.status(500).json({ error: 'Failed to read document data' });
  }
}
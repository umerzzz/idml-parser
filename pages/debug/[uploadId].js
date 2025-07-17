import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DebugViewer() {
  const router = useRouter();
  const { uploadId } = router.query;
  const [debugData, setDebugData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (uploadId) {
      loadDebugData();
    }
  }, [uploadId]);

  const loadDebugData = async () => {
    try {
      const response = await fetch(`/api/debug/${uploadId}`);
      const data = await response.json();
      setDebugData(data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading debug data:', error);
      setLoading(false);
    }
  };

  if (loading) return <div>Loading debug data...</div>;
  if (!debugData) return <div>No debug data found</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>IDML Debug Analysis</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>📁 IDML File Contents</h2>
        <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          <p><strong>Total Files:</strong> {debugData.idmlContents.totalFiles}</p>
          <p><strong>Folders:</strong> {debugData.idmlContents.folders.join(', ')}</p>
          <p><strong>Has Links Folder:</strong> {debugData.idmlContents.hasLinksFolder ? '✅ YES' : '❌ NO'}</p>
          <p><strong>Image Files Found:</strong> {debugData.idmlContents.imageFiles.length}</p>
          
          {debugData.idmlContents.imageFiles.length > 0 && (
            <div>
              <strong>Images in IDML:</strong>
              <ul>
                {debugData.idmlContents.imageFiles.map((img, i) => (
                  <li key={i}>{img}</li>
                ))}
              </ul>
            </div>
          )}
          
          {debugData.idmlContents.linksFolderContents.length > 0 && (
            <div>
              <strong>Links Folder Contents:</strong>
              <ul>
                {debugData.idmlContents.linksFolderContents.map((file, i) => (
                  <li key={i}>{file}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>📦 Package Upload Analysis</h2>
        <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          <p><strong>Is Package Upload:</strong> {debugData.packageUpload.isPackageUpload ? '✅ YES' : '❌ NO'}</p>
          <p><strong>Files Uploaded:</strong> {debugData.packageUpload.totalUploadedFiles}</p>
          
          <strong>Uploaded Files:</strong>
          <ul>
            {debugData.packageUpload.uploadedFiles.map((file, i) => (
              <li key={i}>{file.name} ({file.size} bytes, {file.mimetype})</li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>🔍 Processing Results</h2>
        <div style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          <p><strong>Elements Found:</strong> {debugData.processingResults.elementsFound}</p>
          <p><strong>Stories Found:</strong> {debugData.processingResults.storiesFound}</p>
          <p><strong>Content Frames:</strong> {debugData.processingResults.contentFrames.length}</p>
          <p><strong>Embedded Images:</strong> {debugData.processingResults.embeddedImages.length}</p>
          <p><strong>Placeholders:</strong> {debugData.processingResults.placeholders.length}</p>
          
         {debugData.processingResults.embeddedImages.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <strong>🖼️ Embedded Images Analysis:</strong>
              <pre style={{ backgroundColor: 'white', padding: '10px', overflow: 'auto', maxHeight: '200px' }}>
                {JSON.stringify(debugData.processingResults.embeddedImages, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>📋 Raw Data</h2>
        <details>
          <summary>Click to see full debug data</summary>
          <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', overflow: 'auto', maxHeight: '400px', fontSize: '12px' }}>
            {JSON.stringify(debugData, null, 2)}
          </pre>
        </details>
      </div>
      
      <div style={{ marginTop: '30px' }}>
        <h2>🔗 Quick Actions</h2>
        <button 
          onClick={() => router.push(`/viewer/${uploadId}`)}
          style={{ marginRight: '10px', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          View Document
        </button>
        <button 
          onClick={() => window.open(`/api/debug/${uploadId}/raw`, '_blank')}
          style={{ padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Download Raw Debug JSON
        </button>
      </div>
    </div>
  );
}
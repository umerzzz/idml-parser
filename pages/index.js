import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleUpload = async (event) => {
    event.preventDefault();
    setUploading(true);
    setError('');

    const formData = new FormData();
    const files = event.target.files.files;
    
    if (!files || files.length === 0) {
      setError('Please select files');
      setUploading(false);
      return;
    }
    
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      
      if (result.success) {
        router.push(`/view/${result.uploadId}`);
      } else {
        setError('Upload failed: ' + result.error);
      }
    } catch (error) {
      setError('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>IDML Document Viewer</h1>
      
      {error && (
        <div style={{ 
          color: 'red', 
          backgroundColor: '#ffebee', 
          padding: '10px', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}
      
      <form onSubmit={handleUpload}>
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="files">Select IDML package files:</label>
          <input
            type="file"
            id="files"
            name="files"
            multiple
            webkitdirectory=""
            directory=""
            style={{ display: 'block', marginTop: '10px', padding: '8px' }}
          />
          <small style={{ color: '#666', marginTop: '5px', display: 'block' }}>
            Select the folder containing your IDML file and assets
          </small>
        </div>
        
        <button 
          type="submit" 
          disabled={uploading}
          style={{
            padding: '12px 24px',
            backgroundColor: uploading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          {uploading ? 'Processing...' : 'Upload and Process IDML'}
        </button>
      </form>
    </div>
  );
}

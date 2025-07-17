import { useState } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const handleUpload = async (event) => {
    event.preventDefault();
    setUploading(true);

    const formData = new FormData();
    const files = event.target.files.files;
    
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
        alert('Upload failed: ' + result.error);
      }
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>IDML Document Viewer</h1>
      
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
            style={{ display: 'block', marginTop: '10px' }}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={uploading}
          style={{
            padding: '10px 20px',
            backgroundColor: uploading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          {uploading ? 'Uploading...' : 'Upload and Process'}
        </button>
      </form>
    </div>
  );
}
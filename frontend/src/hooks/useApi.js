import { useState } from 'react';

 const API_URL = 'http://localhost:5000/api';
//const API_URL = 'https://lidar-backend.onrender.com/api';

/**
 * useApi
 * ------
 * Custom hook that encapsulates every call to the Flask backend.
 * Components only call the returned functions; they never touch fetch() directly.
 */
export function useApi() {
  const [loading,    setLoading]    = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error,      setError]      = useState('');

  const clearError = () => setError('');

  /** POST a file to /api/upload and return the parsed points + metadata. */
  async function uploadFile(file) {
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res  = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Upload failed');
      return data;
    } catch (err) {
      setError(err.message || 'Cannot reach backend. Make sure the Flask server is running on port 5000.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  /** POST points to /api/process and return extraction results. */
  async function processPoints(points) {
    setProcessing(true);
    setError('');
    try {
      const res  = await fetch(`${API_URL}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Processing failed');
      return data.results;
    } catch (err) {
      setError(err.message || 'Processing failed. Check server connection.');
      return null;
    } finally {
      setProcessing(false);
    }
  }

  /** POST a contour to /api/export and trigger a browser download. */
  async function exportContour(contour, format = 'txt') {
    setError('');
    try {
      const res  = await fetch(`${API_URL}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contour, format }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Export failed');

      const blob = new Blob([data.data], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      setError(err.message || 'Export failed');
      return false;
    }
  }

  return {
    loading,
    processing,
    error,
    clearError,
    uploadFile,
    processPoints,
    exportContour,
  };
}

/**
 * Custom hook for document loading functionality
 */

import { useCallback } from "react";

/**
 * Custom hook for document loading
 * @param {string} uploadId - The upload ID
 * @param {function} setDocumentData - Function to set document data
 * @param {function} setLoading - Function to set loading state
 * @returns {function} The loadDocument function
 */
export const useDocumentLoader = (uploadId, setDocumentData, setLoading) => {
  const loadDocument = useCallback(async () => {
    try {
      const response = await fetch(`/api/document/${uploadId}`);
      const data = await response.json();

      if (data && data.elements && data.elements.length > 0) {
        // Element positioning analysis completed
      } else {
        // No elements found
      }

      setDocumentData(data);
      setLoading(false);
    } catch (error) {
      console.error("Error loading document:", error);
      setLoading(false);
    }
  }, [uploadId, setDocumentData, setLoading]);

  return loadDocument;
};

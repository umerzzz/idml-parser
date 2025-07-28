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
      console.log("📄 Document data:", data);

      // DEBUG: Check element positioning data in detail
      console.log("🔍 DEBUG DATA STRUCTURE:");
      console.log("DATA EXISTS:", !!data);
      console.log("DATA.ELEMENTS EXISTS:", !!data?.elements);
      console.log("DATA.ELEMENTS LENGTH:", data?.elements?.length);
      console.log("DATA KEYS:", data ? Object.keys(data) : "no data");
      console.log("FULL DATA OBJECT:", data);

      if (data && data.elements && data.elements.length > 0) {
        console.log("🔍 ELEMENT POSITIONING ANALYSIS:");
        console.log("RAW ELEMENTS ARRAY:", data.elements);

        data.elements.forEach((element, index) => {
          console.log(`\n=== ELEMENT ${index} ===`);
          console.log("ELEMENT ID:", element.id);
          console.log("ELEMENT NAME:", element.name);
          console.log("ELEMENT TYPE:", element.type);
          console.log("ORIGINAL POSITION:", element.position);
          console.log("PIXEL POSITION:", element.pixelPosition);

          // Check for Y=0 issues
          if (element.position?.y === 0) {
            console.log("🚨 ORIGINAL POSITION Y IS ZERO!");
          }
          if (element.pixelPosition?.y === 0) {
            console.log("🚨 PIXEL POSITION Y IS ZERO!");
          }

          // Show what coordinates we're actually using for positioning
          const finalPosition = element.pixelPosition || element.position;
          console.log("FINAL POSITION FOR RENDERING:", finalPosition);

          // Show each coordinate explicitly
          console.log("FINAL X:", finalPosition?.x);
          console.log("FINAL Y:", finalPosition?.y);
          console.log("FINAL WIDTH:", finalPosition?.width);
          console.log("FINAL HEIGHT:", finalPosition?.height);
        });
      } else {
        console.log("🚨 NO ELEMENTS FOUND! This is the problem.");
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

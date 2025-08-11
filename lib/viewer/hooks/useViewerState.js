/**
 * Custom hook for managing viewer state
 */

import { useState, useCallback } from "react";

/**
 * Custom hook for managing viewer state
 * @returns {object} Viewer state and state setters
 */
export const useViewerState = () => {
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMargins, setShowMargins] = useState(true);

  // Multi-page state management
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pages, setPages] = useState([]);

  // Configuration options
  const [backgroundConfig, setBackgroundConfig] = useState({
    mode: "auto", // 'auto', 'white', 'custom', 'transparent'
    customColor: "#ffffff",
    allowColorAnalysis: true,
    preferPaperColor: true,
    fallbackToWhite: true,
  });

  return {
    // Document state
    documentData,
    setDocumentData,
    loading,
    setLoading,

    // UI state
    showMargins,
    setShowMargins,

    // Page state
    currentPageIndex,
    setCurrentPageIndex,
    pages,
    setPages,

    // Configuration
    backgroundConfig,
    setBackgroundConfig,
  };
};

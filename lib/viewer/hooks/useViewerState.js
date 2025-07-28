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
  const [selectedElement, setSelectedElement] = useState(null);
  const [showMargins, setShowMargins] = useState(true);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Multi-page state management
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [pages, setPages] = useState([]);
  const [elementsForCurrentPage, setElementsForCurrentPage] = useState([]);
  const [showPageDebugPanel, setShowPageDebugPanel] = useState(false);

  // Configuration options
  const [backgroundConfig, setBackgroundConfig] = useState({
    mode: "auto", // 'auto', 'white', 'custom', 'transparent'
    customColor: "#ffffff",
    allowColorAnalysis: true,
    preferPaperColor: true,
    fallbackToWhite: true,
  });

  // Text fitting strategy
  const [textFittingStrategy, setTextFittingStrategy] = useState("precise_fit");

  return {
    // Document state
    documentData,
    setDocumentData,
    loading,
    setLoading,

    // UI state
    selectedElement,
    setSelectedElement,
    showMargins,
    setShowMargins,
    showDebugInfo,
    setShowDebugInfo,

    // Page state
    currentPageIndex,
    setCurrentPageIndex,
    pages,
    setPages,
    elementsForCurrentPage,
    setElementsForCurrentPage,
    showPageDebugPanel,
    setShowPageDebugPanel,

    // Configuration
    backgroundConfig,
    setBackgroundConfig,
    textFittingStrategy,
    setTextFittingStrategy,
  };
};

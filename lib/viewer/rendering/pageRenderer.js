/**
 * Page rendering utilities for the IDML Viewer
 */

import React from "react";

/**
 * Gets pages array from document data
 * @param {object} documentData - The document data
 * @returns {Array} Array of pages
 */
export const getPagesArray = (documentData) => {
  if (!documentData || !documentData.pages) return [];
  if (Array.isArray(documentData.pages)) return documentData.pages;
  if (typeof documentData.pages === "object")
    return Object.values(documentData.pages);
  return [];
};

/**
 * Renders page tabs for navigation
 * @param {object} documentData - The document data
 * @param {number} currentPageIndex - The current page index
 * @param {function} setCurrentPageIndex - Function to set current page index
 * @param {function} setSelectedElement - Function to set selected element
 * @returns {React.ReactElement|null} The rendered page tabs or null
 */
export const renderPageTabs = (
  documentData,
  currentPageIndex,
  setCurrentPageIndex,
  setSelectedElement
) => {
  if (!documentData || !documentData.pages || documentData.pages.length <= 1) {
    console.log("Not rendering page tabs:", {
      hasDocumentData: !!documentData,
      pagesArray: documentData?.pages,
      pageCount: documentData?.pages?.length,
    });
    return null;
  }
  console.log("Rendering page tabs for", documentData.pages.length, "pages");

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        marginBottom: "20px",
        overflowX: "auto",
        padding: "10px 0",
      }}
    >
      {documentData.pages.map((page, index) => (
        <div
          key={page.self}
          onClick={() => {
            setCurrentPageIndex(index);
            setSelectedElement(null);
          }}
          style={{
            padding: "8px 16px",
            margin: "0 4px",
            backgroundColor: currentPageIndex === index ? "#007bff" : "#f0f0f0",
            color: currentPageIndex === index ? "white" : "black",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: currentPageIndex === index ? "bold" : "normal",
            minWidth: "60px",
            textAlign: "center",
            boxShadow:
              currentPageIndex === index ? "0 2px 4px rgba(0,0,0,0.2)" : "none",
          }}
        >
          Page {index + 1}
          {page.name && page.name !== "$ID/" && (
            <span
              style={{ display: "block", fontSize: "10px", marginTop: "3px" }}
            >
              {page.name}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

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
 * Renders a page preview thumbnail
 * @param {object} page - The page data
 * @param {object} documentData - The document data
 * @param {function} getElementsForPage - Function to get elements for a page
 * @param {object} utils - Utility functions
 * @param {object} backgroundConfig - Background configuration
 * @param {function} importedGetPageBackgroundColor - Function to get page background color
 * @param {function} importedGetDocumentBackgroundColor - Function to get document background color
 * @returns {React.ReactElement} The rendered page preview
 */
export const renderPagePreview = (
  page,
  documentData,
  getElementsForPage,
  utils,
  backgroundConfig,
  importedGetPageBackgroundColor,
  importedGetDocumentBackgroundColor
) => {
  try {
    console.log("🎨 Rendering preview for page:", page.self, page.name);

    const pageElements = getElementsForPage(page.self, documentData);
    console.log("🎨 Page elements for preview:", pageElements.length);

    // Calculate preview dimensions (smaller scale)
    const originalWidth =
      page.geometricBounds?.width ||
      documentData.pageInfo?.dimensions?.pixelDimensions?.width ||
      documentData.pageInfo?.dimensions?.width ||
      612;
    const originalHeight =
      page.geometricBounds?.height ||
      documentData.pageInfo?.dimensions?.pixelDimensions?.height ||
      documentData.pageInfo?.dimensions?.height ||
      792;

    // Scale down for preview (maintain aspect ratio)
    const maxPreviewWidth = 120;
    const maxPreviewHeight = 160;
    const scale = Math.min(
      maxPreviewWidth / originalWidth,
      maxPreviewHeight / originalHeight
    );
    const previewWidth = originalWidth * scale;
    const previewHeight = originalHeight * scale;

    // Robust scaling strategy - prioritize visibility over exact scale
    const baseScale = Math.max(scale * 2, 0.8); // Much higher minimum for visibility
    const contentScale = Math.min(baseScale, 1.2); // Cap at 120% to prevent overflow

    // Get background color safely
    let backgroundColor = "#ffffff"; // default
    try {
      backgroundColor = importedGetPageBackgroundColor(
        page,
        documentData,
        utils.convertColor,
        (docData) =>
          importedGetDocumentBackgroundColor(
            docData,
            backgroundConfig,
            utils.convertColor
          )
      );
    } catch (error) {
      console.warn("🎨 Error getting background color for preview:", error);
    }

    console.log("🎨 Preview dimensions:", {
      original: { width: originalWidth, height: originalHeight },
      preview: { width: previewWidth, height: previewHeight },
      scale,
    });

    // Check if we have too many elements or if scale is too small
    const hasTooManyElements = pageElements.length > 15; // Increased threshold
    const isScaleTooSmall = contentScale < 0.1; // Much smaller threshold

    return (
      <div
        style={{
          width: `${maxPreviewWidth}px`,
          height: `${maxPreviewHeight}px`,
          backgroundColor: backgroundColor,
          border: "1px solid #ccc",
          borderRadius: "4px",
          overflow: "hidden",
          position: "relative",
          margin: "0 auto",
        }}
      >
        {/* Visual thumbnail with scaled elements */}
        {/* Always render visual elements - disabled fallback for debugging */}
        {/* {hasTooManyElements || isScaleTooSmall ? (
          // Simplified preview for complex pages
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "8px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              fontSize: "10px",
              color: "#666",
            }}
          >
            <div style={{ marginBottom: "4px", fontWeight: "bold" }}>
              Page Preview
            </div>
            <div style={{ fontSize: "8px", textAlign: "center" }}>
              {pageElements.filter((el) => el.type === "TextFrame").length} text
              elements
              <br />
              {
                pageElements.filter(
                  (el) => el.isContentFrame || el.hasPlacedContent
                ).length
              }{" "}
              content frames
              <br />
              {
                pageElements.filter(
                  (el) =>
                    !el.isBackgroundElement &&
                    el.type !== "TextFrame" &&
                    !el.isContentFrame
                ).length
              }{" "}
              other elements
            </div>
          </div>
        ) : ( */}
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            transform: `scale(${contentScale})`,
            transformOrigin: "top left",
            overflow: "hidden", // Clip content to fit within bounds
          }}
        >
          {/* Force text content to be visible */}
          {pageElements
            .filter(
              (el) =>
                el.type === "TextFrame" &&
                el.parentStory &&
                documentData.stories &&
                documentData.stories[el.parentStory]
            )
            .map((element, index) => {
              const elementPosition = element.pixelPosition;
              if (!elementPosition) return null;

              // Scale element position to fit thumbnail with minimum visibility
              const scaledX = (elementPosition.x / originalWidth) * 100;
              const scaledY = (elementPosition.y / originalHeight) * 100;
              let scaledWidth = (elementPosition.width / originalWidth) * 100;
              let scaledHeight =
                (elementPosition.height / originalHeight) * 100;

              // Ensure minimum size for text visibility (at least 6% of thumbnail)
              const minTextSize = 6;
              if (scaledWidth < minTextSize) scaledWidth = minTextSize;
              if (scaledHeight < minTextSize) scaledHeight = minTextSize;

              return (
                <div
                  key={`text-${index}`}
                  style={{
                    position: "absolute",
                    left: scaledX + "%",
                    top: scaledY + "%",
                    width: scaledWidth + "%",
                    height: scaledHeight + "%",
                    padding: "6px",
                    fontSize: "12px", // Much larger for readability
                    lineHeight: "1.4",
                    color: "#000",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "flex-start",
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                    fontWeight: "bold",
                    backgroundColor: "transparent",
                    border: "2px solid #ff6b6b",
                    zIndex: 100,
                    transform: elementPosition.rotation
                      ? `rotate(${elementPosition.rotation}deg)`
                      : "none",
                    transformOrigin: "top left",
                    boxSizing: "border-box",
                  }}
                >
                  {documentData.stories[element.parentStory].text?.substring(
                    0,
                    50
                  ) || "No text"}
                </div>
              );
            })}
          {pageElements.map((element) => {
            if (!element.pixelPosition) return null;

            const elementPosition = element.pixelPosition;
            const isContentFrame =
              element.isContentFrame || element.hasPlacedContent;
            const hasPlacedContent = element.placedContent;
            const isTextFrame = element.type === "TextFrame";

            // Debug logging for each element
            console.log("🎨 Rendering element in preview:", {
              id: element.id,
              type: element.type,
              isTextFrame,
              hasParentStory: !!element.parentStory,
              hasStories: !!documentData.stories,
              hasStoryData: !!(
                documentData.stories &&
                element.parentStory &&
                documentData.stories[element.parentStory]
              ),
              position: elementPosition,
            });

            // Skip background elements in preview
            if (element.isBackgroundElement) return null;

            // Scale element position to fit thumbnail with minimum visibility
            const scaledX = (elementPosition.x / originalWidth) * 100;
            const scaledY = (elementPosition.y / originalHeight) * 100;
            let scaledWidth = (elementPosition.width / originalWidth) * 100;
            let scaledHeight = (elementPosition.height / originalHeight) * 100;

            // Ensure minimum size for shape visibility (at least 4% of thumbnail)
            const minShapeSize = 4;
            if (scaledWidth < minShapeSize) scaledWidth = minShapeSize;
            if (scaledHeight < minShapeSize) scaledHeight = minShapeSize;

            return (
              <div
                key={element.id}
                style={{
                  position: "absolute",
                  left: scaledX + "%",
                  top: scaledY + "%",
                  width: scaledWidth + "%",
                  height: scaledHeight + "%",
                  backgroundColor:
                    element.fill &&
                    element.fill !== "Color/None" &&
                    utils &&
                    utils.convertColor
                      ? utils.convertColor(element.fill)
                      : element.fill && element.fill !== "Color/None"
                      ? element.fill
                      : "rgba(200, 200, 200, 0.3)",
                  border: isContentFrame
                    ? "1px solid #00aaff"
                    : isTextFrame
                    ? "1px solid #ff6b6b"
                    : "1px dashed rgba(0,0,0,0.3)",
                  overflow: "hidden",
                  transform: elementPosition.rotation
                    ? `rotate(${elementPosition.rotation}deg)`
                    : "none",
                  transformOrigin: "top left",
                  boxSizing: "border-box",
                }}
              >
                {/* Actual content rendering */}
                {element.linkedImage && element.linkedImage.url && (
                  <img
                    src={element.linkedImage.url}
                    alt="Preview"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: "center",
                    }}
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                )}
                {/* Text content is now rendered separately above */}
                {/* Fallback for any element that might contain text */}
                {!isTextFrame &&
                  element.parentStory &&
                  documentData.stories &&
                  documentData.stories[element.parentStory] && (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        padding: "4px",
                        fontSize: "8px",
                        lineHeight: "1.3",
                        color: "#000",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "flex-start",
                        wordBreak: "break-word",
                        whiteSpace: "pre-wrap",
                        fontWeight: "bold",
                        backgroundColor: "transparent",
                        border: "1px solid #ff6b6b",
                      }}
                    >
                      📝{" "}
                      {documentData.stories[
                        element.parentStory
                      ].text?.substring(0, 30) || "Text content"}
                    </div>
                  )}
                {isContentFrame && !hasPlacedContent && (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: "rgba(0, 170, 255, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "8px",
                      color: "#0066cc",
                      fontWeight: "bold",
                      border: "1px solid #00aaff",
                    }}
                  >
                    Content Frame
                  </div>
                )}
                {!isTextFrame && !isContentFrame && !element.linkedImage && (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: "rgba(128, 128, 128, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "8px",
                      color: "#666",
                      fontWeight: "bold",
                      border: "1px solid #999",
                    }}
                  >
                    {element.type}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* )} */}
      </div>
    );
  } catch (error) {
    console.error("🎨 Error rendering page preview:", error);
    // Fallback preview
    return (
      <div
        style={{
          width: "120px",
          height: "160px",
          backgroundColor: "#f0f0f0",
          border: "1px solid #ccc",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          color: "#666",
        }}
      >
        Preview Error
      </div>
    );
  }
};

/**
 * Renders page tabs for navigation with previews
 * @param {object} documentData - The document data
 * @param {number} currentPageIndex - The current page index
 * @param {function} setCurrentPageIndex - Function to set current page index
 * @param {function} setSelectedElement - Function to set selected element
 * @param {function} getElementsForPage - Function to get elements for a page
 * @param {object} utils - Utility functions
 * @param {object} backgroundConfig - Background configuration
 * @param {function} importedGetPageBackgroundColor - Function to get page background color
 * @param {function} importedGetDocumentBackgroundColor - Function to get document background color
 * @returns {React.ReactElement|null} The rendered page tabs or null
 */
export const renderPageTabs = (
  documentData,
  currentPageIndex,
  setCurrentPageIndex,
  setSelectedElement,
  getElementsForPage = null,
  utils = null,
  backgroundConfig = null,
  importedGetPageBackgroundColor = null,
  importedGetDocumentBackgroundColor = null
) => {
  console.log("🎨 renderPageTabs called with:", {
    hasDocumentData: !!documentData,
    pagesArray: documentData?.pages,
    pageCount: documentData?.pages?.length,
    hasGetElementsForPage: !!getElementsForPage,
    hasUtils: !!utils,
    hasBackgroundConfig: !!backgroundConfig,
    hasImportedGetPageBackgroundColor: !!importedGetPageBackgroundColor,
    hasImportedGetDocumentBackgroundColor: !!importedGetDocumentBackgroundColor,
  });

  if (!documentData || !documentData.pages || documentData.pages.length <= 1) {
    console.log("Not rendering page tabs:", {
      hasDocumentData: !!documentData,
      pagesArray: documentData?.pages,
      pageCount: documentData?.pages?.length,
    });
    return null;
  }
  console.log("Rendering page tabs for", documentData.pages.length, "pages");

  // Determine layout based on page count
  const pageCount = documentData.pages.length;
  const maxPagesPerRow = 8; // Show max 8 pages per row
  const shouldUseGrid = pageCount > maxPagesPerRow;
  const rows = shouldUseGrid ? Math.ceil(pageCount / maxPagesPerRow) : 1;
  const currentRow = Math.floor(currentPageIndex / maxPagesPerRow);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "20px",
        gap: "10px",
      }}
    >
      {/* Page navigation controls for multi-page documents */}
      {shouldUseGrid && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          <button
            onClick={() => {
              const newRow = Math.max(0, currentRow - 1);
              const newPageIndex = newRow * maxPagesPerRow;
              setCurrentPageIndex(newPageIndex);
              setSelectedElement(null);
            }}
            disabled={currentRow === 0}
            style={{
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: currentRow === 0 ? "#f0f0f0" : "#fff",
              color: currentRow === 0 ? "#999" : "#333",
              cursor: currentRow === 0 ? "not-allowed" : "pointer",
              fontSize: "12px",
            }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: "12px", color: "#666" }}>
            Pages {currentRow * maxPagesPerRow + 1}-
            {Math.min((currentRow + 1) * maxPagesPerRow, pageCount)} of{" "}
            {pageCount}
          </span>
          <button
            onClick={() => {
              const newRow = Math.min(rows - 1, currentRow + 1);
              const newPageIndex = newRow * maxPagesPerRow;
              setCurrentPageIndex(newPageIndex);
              setSelectedElement(null);
            }}
            disabled={currentRow === rows - 1}
            style={{
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              backgroundColor: currentRow === rows - 1 ? "#f0f0f0" : "#fff",
              color: currentRow === rows - 1 ? "#999" : "#333",
              cursor: currentRow === rows - 1 ? "not-allowed" : "pointer",
              fontSize: "12px",
            }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Thumbnails container */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          overflowX: shouldUseGrid ? "hidden" : "auto",
          padding: "10px 0",
          gap: "8px",
          maxWidth: "100%",
        }}
      >
        {documentData.pages
          .slice(currentRow * maxPagesPerRow, (currentRow + 1) * maxPagesPerRow)
          .map((page, index) => {
            const actualIndex = currentRow * maxPagesPerRow + index;

            return (
              <div
                key={page.self}
                onClick={() => {
                  setCurrentPageIndex(actualIndex);
                  setSelectedElement(null);
                }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  padding: "8px",
                  margin: "0 4px",
                  backgroundColor:
                    currentPageIndex === actualIndex ? "#007bff" : "#f0f0f0",
                  color: currentPageIndex === actualIndex ? "white" : "black",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight:
                    currentPageIndex === actualIndex ? "bold" : "normal",
                  minWidth: "80px",
                  textAlign: "center",
                  boxShadow:
                    currentPageIndex === index
                      ? "0 2px 8px rgba(0,0,0,0.3)"
                      : "0 1px 3px rgba(0,0,0,0.1)",
                  transition: "all 0.2s ease",
                  border:
                    currentPageIndex === actualIndex
                      ? "2px solid #0056b3"
                      : "1px solid #ddd",
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = "translateY(-2px)";
                  e.target.style.boxShadow =
                    currentPageIndex === actualIndex
                      ? "0 4px 12px rgba(0,0,0,0.4)"
                      : "0 3px 8px rgba(0,0,0,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = "translateY(0)";
                  e.target.style.boxShadow =
                    currentPageIndex === actualIndex
                      ? "0 2px 8px rgba(0,0,0,0.3)"
                      : "0 1px 3px rgba(0,0,0,0.1)";
                }}
              >
                {/* Page Preview */}
                {getElementsForPage &&
                utils &&
                backgroundConfig &&
                importedGetPageBackgroundColor &&
                importedGetDocumentBackgroundColor ? (
                  <div style={{ marginBottom: "6px" }}>
                    {renderPagePreview(
                      page,
                      documentData,
                      getElementsForPage,
                      utils,
                      backgroundConfig,
                      importedGetPageBackgroundColor,
                      importedGetDocumentBackgroundColor
                    )}
                  </div>
                ) : (
                  <div
                    style={{
                      marginBottom: "6px",
                      width: "120px",
                      height: "160px",
                      backgroundColor: "#f0f0f0",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      color: "#666",
                    }}
                  >
                    No Preview
                  </div>
                )}

                {/* Page Number */}
                <div style={{ fontSize: "12px", fontWeight: "bold" }}>
                  Page {actualIndex + 1}
                </div>

                {/* Page Name */}
                {page.name && page.name !== "$ID/" && (
                  <div
                    style={{
                      fontSize: "10px",
                      marginTop: "2px",
                      opacity: 0.8,
                      maxWidth: "100px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {page.name}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

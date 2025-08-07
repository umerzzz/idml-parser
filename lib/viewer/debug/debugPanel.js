/**
 * Debug panel utilities for the IDML Viewer
 */

import React from "react";

/**
 * Page debug panel component
 * @param {object} props - Component props
 * @param {boolean} props.showPageDebugPanel - Whether to show the debug panel
 * @param {object} props.documentData - The document data
 * @param {string} props.uploadId - The upload ID
 * @param {number} props.currentPageIndex - The current page index
 * @param {Array} props.elementsForCurrentPage - Elements for the current page
 * @param {function} props.setShowPageDebugPanel - Function to set debug panel visibility
 * @returns {React.ReactElement|null} The debug panel component or null
 */
export const PageDebugPanel = ({
  showPageDebugPanel,
  documentData,
  uploadId,
  currentPageIndex,
  elementsForCurrentPage,
  setShowPageDebugPanel,
}) => {
  if (!showPageDebugPanel || !documentData) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        width: "400px",
        maxHeight: "80vh",
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        color: "#00ff00",
        padding: "15px",
        borderRadius: "8px",
        zIndex: 9999,
        fontFamily: "monospace",
        fontSize: "12px",
        overflow: "auto",
        boxShadow: "0 0 10px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
        }}
      >
        <h3 style={{ margin: 0, color: "#00ff00" }}>📄 Page Debug Panel</h3>
        <button
          onClick={() => setShowPageDebugPanel(false)}
          style={{
            background: "none",
            border: "none",
            color: "#ff0000",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <div
          style={{
            fontWeight: "bold",
            borderBottom: "1px solid #333",
            paddingBottom: "5px",
            marginBottom: "5px",
          }}
        >
          Document Info
        </div>
        <div>Upload ID: {uploadId}</div>
        <div>Page Count: {documentData.document?.pageCount || 0}</div>
        <div>Current Page: {currentPageIndex + 1}</div>
      </div>

      <div style={{ marginBottom: "15px" }}>
        <div
          style={{
            fontWeight: "bold",
            borderBottom: "1px solid #333",
            paddingBottom: "5px",
            marginBottom: "5px",
          }}
        >
          Pages ({documentData.pages?.length || 0})
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "3px",
                  borderBottom: "1px solid #333",
                }}
              >
                #
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "3px",
                  borderBottom: "1px solid #333",
                }}
              >
                ID
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "3px",
                  borderBottom: "1px solid #333",
                }}
              >
                Name
              </th>
              <th
                style={{
                  textAlign: "left",
                  padding: "3px",
                  borderBottom: "1px solid #333",
                }}
              >
                Elements
              </th>
            </tr>
          </thead>
          <tbody>
            {documentData.pages?.map((page, index) => (
              <tr
                key={page.self}
                style={{
                  backgroundColor:
                    currentPageIndex === index
                      ? "rgba(0, 123, 255, 0.2)"
                      : "transparent",
                }}
              >
                <td style={{ padding: "3px" }}>{index + 1}</td>
                <td style={{ padding: "3px" }}>
                  {page.self.substring(0, 8)}...
                </td>
                <td style={{ padding: "3px" }}>{page.name || "Unnamed"}</td>
                <td style={{ padding: "3px" }}>
                  {documentData.elementsByPage?.[page.self]?.length || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div
          style={{
            fontWeight: "bold",
            borderBottom: "1px solid #333",
            paddingBottom: "5px",
            marginBottom: "5px",
          }}
        >
          Element Distribution
        </div>
        <div>Total Elements: {documentData.elements?.length || 0}</div>
        <div>Elements on Current Page: {elementsForCurrentPage.length}</div>
        <div>
          Elements with Missing Page ID:{" "}
          {(documentData.elements || []).filter((el) => !el.pageId).length}
        </div>
      </div>

      <div style={{ marginTop: "15px" }}>
        <button
          onClick={() => {
            // Debug logging removed
          }}
          style={{
            backgroundColor: "#444",
            color: "white",
            border: "none",
            padding: "5px 10px",
            borderRadius: "4px",
            cursor: "pointer",
            marginRight: "10px",
          }}
        >
          Log Data to Console
        </button>
      </div>
    </div>
  );
};

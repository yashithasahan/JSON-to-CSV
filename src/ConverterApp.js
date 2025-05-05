import React, { useState, useCallback, useRef, useEffect } from "react"; // Import useEffect
import JSZip from "jszip";
import { saveAs } from "file-saver";
import "./ConverterApp.css";

function ConverterApp() {
  // State, Refs...
  const [filesData, setFilesData] = useState([]);
  const [globalError, setGlobalError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef(null);
  // *** New state to track the ID of the file to preview ***
  const [previewFileId, setPreviewFileId] = useState(null);

  // --- Reset Logic ---
  const resetState = () => {
    console.log("Resetting state for new conversion.");
    setFilesData([]);
    setGlobalError("");
    setIsLoading(false);
    setIsDraggingOver(false);
    setPreviewFileId(null); // *** Reset preview ID ***
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  // handleNewConversion calls resetState, so it's covered.
  const handleNewConversion = () => {
    resetState();
  };

  // (Utilities, Core File Processing, Event Handlers, CSV Formatting... remain the same)
  const generateUniqueId = () =>
    `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const processAndAddFiles = (fileList) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setGlobalError(""); // Clear global error on new uploads
    setPreviewFileId(null); // Reset preview on new file upload
    const newFilesToProcess = [];
    let currentFiles = []; // Keep track of files added in this batch

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const fileId = generateUniqueId();
      const fileEntry = {
        id: fileId,
        file: file,
        inputFileName: file.name.replace(/\.[^/.]+$/, ""),
        jsonData: null,
        csvData: null,
        csvHeaders: [],
        status: "pending", // 'pending', 'reading', 'parsing', 'parsed', 'converting', 'converted', 'error'
        error: null,
      };

      // Basic Type Validation
      if (
        file.type !== "application/json" &&
        !file.name.toLowerCase().endsWith(".json")
      ) {
        fileEntry.status = "error";
        fileEntry.error = "Invalid file type (must be .json)";
        console.warn(`Skipping non-JSON file: ${file.name}`);
        currentFiles.push(fileEntry); // Add even invalid ones to show error
        continue; // Skip reading this file
      }

      // Mark valid file for reading and add to processing list
      fileEntry.status = "reading";
      currentFiles.push(fileEntry);
      newFilesToProcess.push(fileEntry); // Add to list for async processing
    }

    // Add all files (valid placeholders and invalid ones) from this batch to state
    setFilesData((prev) => [...prev, ...currentFiles]);

    // Process reading asynchronously only for valid files
    newFilesToProcess.forEach((fileEntry) => {
      readFileContent(fileEntry.id, fileEntry.file);
    });
  };

  const readFileContent = (fileId, file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      setFilesData((prev) =>
        prev.map((item) =>
          item.id === fileId ? { ...item, status: "parsing" } : item
        )
      );
      try {
        const content = e.target.result;
        const parsedJson = JSON.parse(content);

        // Validation
        if (typeof parsedJson !== "object" || parsedJson === null) {
          throw new Error("Root must be an object or array.");
        }
        const dataToProcess = Array.isArray(parsedJson)
          ? parsedJson
          : [parsedJson];
        if (
          dataToProcess.length > 0 &&
          !dataToProcess.every(
            (item) =>
              typeof item === "object" && item !== null && !Array.isArray(item)
          )
        ) {
          throw new Error("If root is an array, it must contain only objects.");
        }

        setFilesData((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? {
                  ...item,
                  jsonData: dataToProcess,
                  status: "parsed",
                  error: null,
                }
              : item
          )
        );
        console.log(`JSON parsing successful for file ID: ${fileId}`);
      } catch (err) {
        console.error(`Error processing JSON for file ID ${fileId}:`, err);
        setFilesData((prev) =>
          prev.map((item) =>
            item.id === fileId
              ? {
                  ...item,
                  status: "error",
                  error: `JSON Error: ${err.message}`,
                  jsonData: null,
                }
              : item
          )
        );
      }
    };

    reader.onerror = (e) => {
      console.error(`Error reading file ID ${fileId}:`, e);
      setFilesData((prev) =>
        prev.map((item) =>
          item.id === fileId
            ? {
                ...item,
                status: "error",
                error: "Error reading file.",
                jsonData: null,
              }
            : item
        )
      );
    };

    reader.readAsText(file);
  };

  const handleFileChange = (event) => {
    processAndAddFiles(event.target.files);
    // Don't reset input value here immediately if using ref for reset
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    // Add a small delay or check relatedTarget to prevent flickering
    if (
      event.relatedTarget &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    setIsDraggingOver(false);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true); // Ensure it stays true while dragging over
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      processAndAddFiles(files);
      if (event.dataTransfer.items) {
        event.dataTransfer.items.clear();
      } else {
        event.dataTransfer.clearData();
      }
    }
  };

  const escapeCsvValue = (value) => {
    if (value == null) return "";
    const stringValue = String(value);
    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n")
    ) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // --- CSV Conversion ---
  const convertAllToCSV = useCallback(() => {
    console.log("Attempting conversion for all parsed files...");
    setGlobalError("");
    const filesReadyForConversion = filesData.filter(
      (f) => f.status === "parsed" && f.jsonData
    );
    if (filesReadyForConversion.length === 0) {
      console.warn("No files found with status 'parsed'. Cannot convert.");
      setGlobalError(
        "No files ready for conversion (ensure they are parsed successfully)."
      );
      return;
    }
    console.log(
      `${filesReadyForConversion.length} file(s) are ready for conversion.`
    );
    setFilesData((prevFilesData) =>
      prevFilesData.map((fileData) => {
        if (fileData.status === "parsed" && fileData.jsonData) {
          // ... (conversion logic remains the same)
          console.log(`Converting file ID: ${fileData.id}`);
          try {
            // Set status to 'converting' immediately within the map
            const updatedFileData = {
              ...fileData,
              status: "converting",
              error: null,
            };

            // Perform conversion
            const allKeys = new Set();
            // Ensure jsonData exists and is an array before iterating
            if (Array.isArray(updatedFileData.jsonData)) {
              updatedFileData.jsonData.forEach((obj) => {
                if (typeof obj === "object" && obj !== null)
                  Object.keys(obj).forEach((key) => allKeys.add(key));
              });
            }
            const headers = Array.from(allKeys);

            const csvRows = [];
            if (headers.length > 0) {
              csvRows.push(headers.map(escapeCsvValue).join(","));
            }

            // Ensure jsonData exists and is an array before iterating
            if (Array.isArray(updatedFileData.jsonData)) {
              updatedFileData.jsonData.forEach((rowObject) => {
                if (typeof rowObject === "object" && rowObject !== null) {
                  const values = headers.map((header) =>
                    escapeCsvValue(
                      rowObject.hasOwnProperty(header) ? rowObject[header] : ""
                    )
                  );
                  csvRows.push(values.join(","));
                }
              });
            }

            updatedFileData.csvData = csvRows.join("\n");
            updatedFileData.csvHeaders = headers;
            updatedFileData.status = "converted"; // Final status on success
            console.log(
              `CSV conversion successful for file ID: ${fileData.id}`
            );
            return updatedFileData;
          } catch (err) {
            console.error(
              `Error converting file ID ${fileData.id} to CSV:`,
              err
            );
            // Update status and error on failure
            return {
              ...fileData,
              status: "error",
              error: `CSV Conversion Error: ${err.message}`,
              csvData: null,
              csvHeaders: [],
            };
          }
        }
        return fileData;
      })
    );
  }, [filesData]); // Dependency array is correct

  // --- Effect to set initial preview after conversion ---
  useEffect(() => {
    // Only run if no preview is selected yet
    if (previewFileId === null) {
      // Find the first converted file in the current state
      const firstConverted = filesData.find((f) => f.status === "converted");
      if (firstConverted) {
        console.log(`Setting initial preview to file ID: ${firstConverted.id}`);
        setPreviewFileId(firstConverted.id);
      }
    }
    // Run this effect whenever filesData changes, specifically after conversions update status
  }, [filesData, previewFileId]); // Depend on filesData and previewFileId

  // --- CSV Download Logic --- (Keep as is)
  const downloadAllCSVsAsZip = async () => {
    const filesToZip = filesData.filter(
      (f) => f.status === "converted" && f.csvData !== null
    );

    if (filesToZip.length === 0) {
      setGlobalError(
        "No successfully converted CSV files available to download."
      );
      return;
    }
    if (isLoading) return; // Prevent multiple clicks

    console.log(`Preparing ZIP for ${filesToZip.length} file(s)...`);
    setIsLoading(true);
    setGlobalError("");

    try {
      const zip = new JSZip();
      filesToZip.forEach((fileData) => {
        const filename = `${fileData.inputFileName || "converted_data"}.csv`;
        zip.file(filename, fileData.csvData);
        console.log(`Added ${filename} to ZIP.`);
      });

      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
          level: 6, // Adjust compression level (1-9) as needed
        },
      });

      saveAs(zipBlob, "converted_json_files.zip"); // Use file-saver
      console.log("ZIP download triggered.");
    } catch (err) {
      console.error("Error creating or downloading ZIP file:", err);
      setGlobalError(`Failed to create ZIP: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Logic ---
  const hasParsedFiles = filesData.some((f) => f.status === "parsed");
  const hasConvertedFiles = filesData.some((f) => f.status === "converted");
  const isProcessing = filesData.some((f) =>
    ["reading", "parsing", "converting"].includes(f.status)
  );

  // *** Find the file to preview based on the selected ID ***
  const fileToPreview = filesData.find(
    (f) => f.id === previewFileId && f.status === "converted"
  );

  return (
    <div className="converter-container">
      <h1>JSON to CSV Converter </h1>

      {/* Loading, Global Error, Upload UI ... (Keep as is) */}
      {(isLoading || isProcessing) && (
        <div className="loading-indicator">
          {isLoading
            ? "Preparing ZIP..."
            : isProcessing
            ? "Processing files..."
            : ""}{" "}
          Please wait.
        </div>
      )}

      {!isLoading && globalError && (
        <p className="error-message">{globalError}</p>
      )}

      {!hasConvertedFiles && !isProcessing && (
        <div
          className={`drop-zone ${isDraggingOver ? "dragging" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <p>Drag & Drop your JSON file(s) here</p>
          <p>or</p>
          <label htmlFor="jsonFiles" className="action-button file-label">
            Click to Select Files
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id="jsonFiles"
            accept=".json,application/json"
            onChange={handleFileChange}
            style={{ display: "none" }}
            multiple
            disabled={isLoading || isProcessing}
          />
        </div>
      )}

      {/* --- Files List / Status (Modified) --- */}
      {filesData.length > 0 && (
        <div className="file-list-container">
          <h3>Uploaded Files Status:</h3>
          <ul className="file-list">
            {filesData.map((f) => (
              <li
                key={f.id}
                className={`file-item status-${f.status} ${
                  f.id === previewFileId ? "previewing" : ""
                }`}
              >
                <span className="file-name">{f.file.name}</span>
                <span className="file-status">[{f.status.toUpperCase()}]</span>
                {f.error && (
                  <span className="file-error">Error: {f.error}</span>
                )}
                {/* *** Add Preview Button for converted files *** */}
                {f.status === "converted" && !isProcessing && !isLoading && (
                  <button
                    className={`preview-button ${
                      f.id === previewFileId ? "active" : ""
                    }`}
                    onClick={() => setPreviewFileId(f.id)}
                    title={`Preview ${f.file.name}`}
                  >
                    {f.id === previewFileId ? "Previewing" : "Preview"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons ... (Keep as is) */}
      <div className="action-buttons-container">
        {hasParsedFiles && !isProcessing && !isLoading && (
          <button
            onClick={convertAllToCSV}
            className="action-button convert-button"
            disabled={!hasParsedFiles || isProcessing || isLoading}
          >
            Convert All to CSV
          </button>
        )}

        {hasConvertedFiles && !isLoading && !isProcessing && (
          <button
            onClick={downloadAllCSVsAsZip}
            className="action-button download-button"
            disabled={isLoading || isProcessing}
          >
            Download All as ZIP
          </button>
        )}

        {filesData.length > 0 && !isLoading && (
          <button
            onClick={handleNewConversion}
            className={`action-button new-button ${
              hasConvertedFiles ? "" : "secondary"
            }`}
            disabled={isLoading}
          >
            {hasConvertedFiles ? "+ New Conversion" : "Clear / Start Over"}
          </button>
        )}
      </div>

      {/* --- Table Preview Section (Using fileToPreview based on ID) --- */}
      {/* Renders only if a valid file is selected for preview */}
      {!isLoading && !isProcessing && fileToPreview && (
        <div className="table-preview-container">
          <h3>
            Table Preview for:{" "}
            <span className="preview-filename">{fileToPreview.file.name}</span>{" "}
            (First 5 Data Rows)
          </h3>
          {fileToPreview.csvHeaders &&
          fileToPreview.csvHeaders.length > 0 &&
          fileToPreview.jsonData &&
          fileToPreview.jsonData.length > 0 ? (
            <div className="table-wrapper">
              <table className="csv-preview-table">
                <thead>
                  <tr>
                    {fileToPreview.csvHeaders.map((header, index) => (
                      <th key={`header-${fileToPreview.id}-${index}`}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fileToPreview.jsonData
                    .slice(0, 5)
                    .map((rowObject, rowIndex) => (
                      <tr key={`row-${fileToPreview.id}-${rowIndex}`}>
                        {fileToPreview.csvHeaders.map((header, colIndex) => (
                          <td
                            key={`cell-${fileToPreview.id}-${rowIndex}-${colIndex}`}
                          >
                            {typeof rowObject === "object" &&
                            rowObject !== null &&
                            rowObject.hasOwnProperty(header)
                              ? String(rowObject[header])
                              : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No data or headers found to preview for this file.</p>
          )}
          {fileToPreview.jsonData && fileToPreview.jsonData.length > 5 && (
            <p className="preview-notice">
              (Showing first 5 of {fileToPreview.jsonData.length} data rows)
            </p>
          )}
          {fileToPreview.jsonData && fileToPreview.jsonData.length === 0 && (
            <p className="preview-notice">
              (The JSON file contained an empty array or no data objects).
            </p>
          )}
        </div>
      )}
      {/* Message if converted files exist but none selected */}
      {hasConvertedFiles && !fileToPreview && !isLoading && !isProcessing && (
        <div className="table-preview-container minimal-preview">
          <p>Select a converted file from the list above to see its preview.</p>
        </div>
      )}
    </div>
  );
}

export default ConverterApp;

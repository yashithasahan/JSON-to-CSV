import React, { useState, useCallback, useRef, useEffect } from "react";
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
  const [previewFileId, setPreviewFileId] = useState(null);

  // --- Reset Logic ---
  const resetState = () => {
    console.log("Resetting state for new conversion.");
    setFilesData([]);
    setGlobalError("");
    setIsLoading(false);
    setIsDraggingOver(false);
    setPreviewFileId(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const handleNewConversion = () => {
    resetState();
  };

  // (Utilities, Core File Processing... remain the same)
  const generateUniqueId = () =>
    `file_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const processAndAddFiles = (fileList) => {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setGlobalError("");
    setPreviewFileId(null);
    const newFilesToProcess = [];
    let currentFiles = [];

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
        status: "pending",
        error: null,
      };

      if (
        file.type !== "application/json" &&
        !file.name.toLowerCase().endsWith(".json")
      ) {
        fileEntry.status = "error";
        fileEntry.error = "Invalid file type (must be .json)";
        currentFiles.push(fileEntry);
        continue;
      }

      fileEntry.status = "reading";
      currentFiles.push(fileEntry);
      newFilesToProcess.push(fileEntry);
    }

    setFilesData((prev) => [...prev, ...currentFiles]);

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
      } catch (err) {
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
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
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
    setIsDraggingOver(true);
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

  const convertAllToCSV = useCallback(() => {
    setGlobalError("");
    const filesReadyForConversion = filesData.filter(
      (f) => f.status === "parsed" && f.jsonData
    );
    if (filesReadyForConversion.length === 0) {
      setGlobalError(
        "No files ready for conversion (ensure they are parsed successfully)."
      );
      return;
    }
    setFilesData((prevFilesData) =>
      prevFilesData.map((fileData) => {
        if (fileData.status === "parsed" && fileData.jsonData) {
          try {
            const updatedFileData = {
              ...fileData,
              status: "converting",
              error: null,
            };

            const allKeys = new Set();
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
            updatedFileData.status = "converted";
            return updatedFileData;
          } catch (err) {
            return {
              ...fileData,
              status: "error",
              error: `CSV Conversion Error: ${err.message}`,
            };
          }
        }
        return fileData;
      })
    );
  }, [filesData]);

  useEffect(() => {
    if (previewFileId === null) {
      const firstConverted = filesData.find((f) => f.status === "converted");
      if (firstConverted) {
        setPreviewFileId(firstConverted.id);
      }
    }
  }, [filesData, previewFileId]);

  // --- MODIFICATION ---
  // New function to download a single CSV file.
  const downloadSingleCSV = useCallback(() => {
    const fileToDownload = filesData.find(
      (f) => f.status === "converted" && f.csvData !== null
    );

    if (fileToDownload) {
      console.log(
        `Downloading single file: ${fileToDownload.inputFileName}.csv`
      );
      const blob = new Blob([fileToDownload.csvData], {
        type: "text/csv;charset=utf-8",
      });
      const filename = `${
        fileToDownload.inputFileName || "converted_data"
      }.csv`;
      saveAs(blob, filename);
    } else {
      setGlobalError("Could not find the converted file to download.");
    }
  }, [filesData]); // Depends on filesData to find the file

  // --- MODIFICATION ---
  // Keep the original ZIP function, but we'll call it conditionally.
  const downloadAllCSVsAsZip = async () => {
    const filesToZip = filesData.filter(
      (f) => f.status === "converted" && f.csvData !== null
    );

    if (filesToZip.length === 0) {
      setGlobalError("No converted files available to download.");
      return;
    }
    if (isLoading) return;

    setIsLoading(true);
    setGlobalError("");

    try {
      const zip = new JSZip();
      filesToZip.forEach((fileData) => {
        const filename = `${fileData.inputFileName || "converted_data"}.csv`;
        zip.file(filename, fileData.csvData);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, "converted_json_files.zip");
    } catch (err) {
      setGlobalError(`Failed to create ZIP: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Render Logic ---
  const hasParsedFiles = filesData.some((f) => f.status === "parsed");
  const isProcessing = filesData.some((f) =>
    ["reading", "parsing", "converting"].includes(f.status)
  );

  // --- MODIFICATION ---
  // Instead of a boolean, we get the actual converted files and their count.
  const convertedFiles = filesData.filter((f) => f.status === "converted");
  const convertedFilesCount = convertedFiles.length;

  const fileToPreview = filesData.find(
    (f) => f.id === previewFileId && f.status === "converted"
  );

  return (
    <div className="converter-container">
      <h1>JSON to CSV Converter</h1>

      {(isLoading || isProcessing) && (
        <div className="loading-indicator">
          {isLoading ? "Preparing Download..." : "Processing files..."} Please
          wait.
        </div>
      )}

      {!isLoading && globalError && (
        <p className="error-message">{globalError}</p>
      )}

      {/* --- MODIFICATION --- Changed condition to use count */}
      {convertedFilesCount === 0 && !isProcessing && (
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

      <div className="action-buttons-container">
        {hasParsedFiles && !isProcessing && !isLoading && (
          <button
            onClick={convertAllToCSV}
            className="action-button convert-button"
            disabled={!hasParsedFiles || isProcessing || isLoading}
          >
            Convert to CSV
          </button>
        )}

        {/* --- MODIFICATION START --- */}
        {/* Render buttons conditionally based on the number of converted files. */}

        {/* Show this button ONLY if there is exactly ONE converted file. */}
        {convertedFilesCount === 1 && !isLoading && !isProcessing && (
          <button
            onClick={downloadSingleCSV}
            className="action-button download-button"
            disabled={isLoading || isProcessing}
          >
            Download CSV
          </button>
        )}

        {/* Show this button ONLY if there are MORE THAN ONE converted files. */}
        {convertedFilesCount > 1 && !isLoading && !isProcessing && (
          <button
            onClick={downloadAllCSVsAsZip}
            className="action-button download-button"
            disabled={isLoading || isProcessing}
          >
            Download All as ZIP ({convertedFilesCount} files)
          </button>
        )}
        {/* --- MODIFICATION END --- */}

        {filesData.length > 0 && !isLoading && (
          <button
            onClick={handleNewConversion}
            // --- MODIFICATION --- Changed condition to use count
            className={`action-button new-button ${
              convertedFilesCount > 0 ? "" : "secondary"
            }`}
            disabled={isLoading}
          >
            {/* --- MODIFICATION --- Changed condition to use count */}
            {convertedFilesCount > 0
              ? "+ New Conversion"
              : "Clear / Start Over"}
          </button>
        )}
      </div>

      {!isLoading && !isProcessing && fileToPreview && (
        <div className="table-preview-container">
          <h3>
            Table Preview for:{" "}
            <span className="preview-filename">{fileToPreview.file.name}</span>{" "}
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
            <p>No data found to preview for this file.</p>
          )}
          {fileToPreview.jsonData && fileToPreview.jsonData.length > 5 && (
            <p className="preview-notice">
              (Showing first 5 of {fileToPreview.jsonData.length} total rows)
            </p>
          )}
          {fileToPreview.jsonData && fileToPreview.jsonData.length === 0 && (
            <p className="preview-notice">
              (The JSON file was empty or contained no data objects).
            </p>
          )}
        </div>
      )}

      {/* --- MODIFICATION --- Changed condition to use count */}
      {convertedFilesCount > 0 &&
        !fileToPreview &&
        !isLoading &&
        !isProcessing && (
          <div className="table-preview-container minimal-preview">
            <p>
              Select a converted file from the list above to see its preview.
            </p>
          </div>
        )}
    </div>
  );
}

export default ConverterApp;

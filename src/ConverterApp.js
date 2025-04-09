import React, { useState, useCallback } from "react";

function ConverterApp() {
  const [jsonData, setJsonData] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [error, setError] = useState("");
  const [inputFileName, setInputFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const resetState = () => {
    setJsonData(null);
    setCsvData(null);
    setCsvHeaders([]);
    setError("");
    setInputFileName("");
    setIsLoading(false);
  };

  const handleNewConversion = () => {
    console.log("Setting up for new conversion.");
    resetState();
  };

  // --- Core File Processing ---
  const processFile = (file) => {
    if (!file) {
      return;
    }

    if (
      file.type !== "application/json" &&
      !file.name.toLowerCase().endsWith(".json")
    ) {
      setError(
        "Invalid file type. Please upload a file with a .json extension."
      );
      resetState();
      return;
    }

    setInputFileName(file.name.replace(/\.[^/.]+$/, ""));
    setError("");
    setCsvData(null);
    setJsonData(null);
    setCsvHeaders([]);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        const parsedJson = JSON.parse(content);

        // Validation
        if (typeof parsedJson !== "object" || parsedJson === null) {
          throw new Error(
            "Invalid JSON format: Root must be an object or array."
          );
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
          throw new Error(
            "Invalid JSON format: If root is an array, it must contain only objects."
          );
        }

        setJsonData(dataToProcess);
        setError("");
        console.log("JSON parsing successful.");
      } catch (err) {
        console.error("Error processing JSON:", err);
        setError(`Error processing JSON file: ${err.message}`);
        setJsonData(null);
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = (e) => {
      console.error("Error reading file:", e);
      setError("Error reading the selected file.");
      resetState();
    };
    reader.readAsText(file);
  };

  // --- Event Handlers ---
  const handleFileChange = (event) => {
    processFile(event.target.files[0]);
    event.target.value = null;
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
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
      processFile(files[0]);
      if (event.dataTransfer.items) {
        event.dataTransfer.items.clear();
      } else {
        event.dataTransfer.clearData();
      }
    }
  };

  // --- CSV Formatting  ---
  const escapeCsvValue = (value) => {
    if (value == null) {
      return "";
    }
    const stringValue = String(value);
    if (
      stringValue.includes(",") ||
      stringValue.includes('"') ||
      stringValue.includes("\n")
    ) {
      const escapedValue = stringValue.replace(/"/g, '""');
      return `"${escapedValue}"`;
    }
    return stringValue;
  };

  // --- CSV Conversion  ---
  const convertToCSV = useCallback(() => {
    if (!jsonData) {
      setError("No valid JSON data available to convert.");
      setCsvData(null);
      setCsvHeaders([]);
      return;
    }
    if (jsonData.length === 0) {
      console.warn("JSON array is empty, proceeding with conversion.");
    }

    setIsLoading(true);
    setError("");
    setCsvData(null);
    setCsvHeaders([]);

    setTimeout(() => {
      try {
        const allKeys = new Set();
        jsonData.forEach((obj) => {
          if (typeof obj === "object" && obj !== null)
            Object.keys(obj).forEach((key) => allKeys.add(key));
        });
        const headers = Array.from(allKeys);
        setCsvHeaders(headers);

        const csvRows = [];
        if (headers.length > 0) {
          csvRows.push(headers.map(escapeCsvValue).join(","));
        }

        jsonData.forEach((rowObject) => {
          if (typeof rowObject === "object" && rowObject !== null) {
            const values = headers.map((header) => {
              const value = rowObject.hasOwnProperty(header)
                ? rowObject[header]
                : "";
              return escapeCsvValue(value);
            });
            csvRows.push(values.join(","));
          }
        });

        setCsvData(csvRows.join("\n"));
        console.log("CSV conversion successful.");
      } catch (err) {
        console.error("Error converting to CSV:", err);
        setError(`Error converting to CSV: ${err.message}`);
        setCsvData(null);
        setCsvHeaders([]);
      } finally {
        setIsLoading(false);
      }
    }, 50);
  }, [jsonData]);

  // --- CSV Download  ---
  const downloadCSV = () => {
    if (!csvData && csvData !== "") {
      setError("No CSV data generated to download.");
      return;
    }
    if (isLoading) return;

    try {
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });

      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);

      const downloadFileName = inputFileName
        ? `${inputFileName}.csv`
        : "converted_data.csv";
      link.setAttribute("download", downloadFileName);
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log("CSV download triggered.");
    } catch (err) {
      console.error("Error during CSV download:", err);
      setError(`Failed to initiate download: ${err.message}`);
    }
  };

  return (
    <div className="converter-container">
      <h1>JSON to CSV Converter</h1>

      {/* Loading Indicator */}
      {isLoading && (
        <div className="loading-indicator">Processing... Please wait.</div>
      )}

      {!isLoading && error && <p className="error-message">{error}</p>}

      {/* Upload UI */}
      {!isLoading && csvData === null && (
        <div
          className={`drop-zone ${isDraggingOver ? "dragging" : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <p>Drag & Drop your JSON file here</p>
          <p>or</p>
          <label htmlFor="jsonFile" className="action-button file-label">
            Click to Select File
          </label>
          <input
            type="file"
            id="jsonFile"
            accept=".json,application/json"
            onChange={handleFileChange}
            style={{ display: "none" }}
            disabled={isLoading}
          />
          {inputFileName && (
            <p className="file-name-display">Selected: {inputFileName}.json</p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-buttons-container">
        {!isLoading && jsonData && csvData === null && (
          <button
            onClick={convertToCSV}
            className="action-button convert-button"
            disabled={isLoading}
          >
            Convert to CSV
          </button>
        )}

        {/* Download & New Buttons*/}
        {!isLoading && csvData !== null && (
          <>
            <button
              onClick={downloadCSV}
              className="action-button download-button"
              disabled={isLoading}
            >
              Download CSV
            </button>
            <button
              onClick={handleNewConversion}
              className="action-button new-button"
              disabled={isLoading}
            >
              + New Conversion
            </button>
          </>
        )}
      </div>

      {/* Table Preview*/}
      {!isLoading && csvData !== null && csvHeaders.length > 0 && jsonData && (
        <div className="table-preview-container">
          <h3>Table Preview (First 5 Data Rows)</h3>
          <div className="table-wrapper">
            <table className="csv-preview-table">
              <thead>
                <tr>
                  {csvHeaders.map((header, index) => (
                    <th key={`header-${index}`}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jsonData.slice(0, 5).map((rowObject, rowIndex) => (
                  <tr key={`row-${rowIndex}`}>
                    {csvHeaders.map((header, colIndex) => (
                      <td key={`cell-${rowIndex}-${colIndex}`}>
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
          {jsonData.length > 5 && (
            <p className="preview-notice">
              (Showing first 5 of {jsonData.length} data rows)
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default ConverterApp;

"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  FileIcon,
  UploadIcon,
  XIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  FileTextIcon,
  DownloadIcon,
  RefreshCwIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Constants
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ACCEPTED_FILE_TYPES = [
  ".pdf",
  ".xlsx",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]
const UPLOAD_ENDPOINT = "https://n8n-lab.web-magic.space/webhook-test/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"

// File upload states
type UploadState = "idle" | "selected" | "uploading" | "processing" | "success" | "error"

type FileUploadProcessorProps = {}

export default function FileUploadProcessor({}: FileUploadProcessorProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [progress, setProgress] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")
  const [processingTime, setProcessingTime] = useState(0)
  const [uploadSpeed, setUploadSpeed] = useState("")
  const [downloadUrl, setDownloadUrl] = useState("")
  const [responseDetails, setResponseDetails] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(true)

  // Check if we're in preview mode
  useEffect(() => {
    // In a real app, you would check the environment
    // For now, we'll assume we're in preview mode
    setIsPreviewMode(true)
  }, [])

  // Reset the form to initial state
  const resetForm = () => {
    setFile(null)
    setUploadState("idle")
    setProgress(0)
    setErrorMessage("")
    setProcessingTime(0)
    setUploadSpeed("")
    setDownloadUrl("")
    setResponseDetails("")
  }

  // Handle file selection
  const handleFileSelect = (selectedFile: File | null) => {
    setErrorMessage("")
    setResponseDetails("")

    if (!selectedFile) {
      return
    }

    // Validate file size
    if (selectedFile.size > MAX_FILE_SIZE) {
      setErrorMessage(
        `File size exceeds the 10MB limit. Your file is ${(selectedFile.size / (1024 * 1024)).toFixed(2)}MB.`,
      )
      return
    }

    // Validate file type
    const fileExtension = selectedFile.name.split(".").pop()?.toLowerCase()
    if (
      !fileExtension ||
      (!ACCEPTED_FILE_TYPES.includes(`.${fileExtension}`) && !ACCEPTED_FILE_TYPES.includes(selectedFile.type))
    ) {
      setErrorMessage("Invalid file type. Only PDF and Excel (XLSX) files are accepted.")
      return
    }

    setFile(selectedFile)
    setUploadState("selected")
  }

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files ? e.target.files[0] : null
    handleFileSelect(selectedFile)
  }

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Simulate the upload process for preview mode
  const simulateUpload = async () => {
    if (!file) return

    try {
      setUploadState("uploading")
      setProgress(0)
      setResponseDetails("")

      const startTime = Date.now()

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(progressInterval)
            return 95
          }
          return prev + 5
        })

        // Calculate upload speed
        const elapsedTime = (Date.now() - startTime) / 1000 // seconds
        const uploadedMB = (file.size * (progress / 100)) / (1024 * 1024)
        const speedMBps = uploadedMB / elapsedTime || 0.01
        setUploadSpeed(`${speedMBps.toFixed(2)} MB/s`)
      }, 200)

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000))

      clearInterval(progressInterval)
      setProgress(100)

      // Simulate successful response
      const mockResponse = {
        success: true,
        message: "File received successfully (simulation)",
        filename: file.name,
        size: file.size,
        type: file.type,
      }

      setResponseDetails(JSON.stringify(mockResponse, null, 2))
      setUploadState("processing")

      // Simulate processing time
      const processingTimer = setInterval(() => {
        setProcessingTime((prev) => {
          if (prev >= 100) {
            clearInterval(processingTimer)
            setUploadState("success")

            // Simulate download URL
            setDownloadUrl(`#simulated-download-${file.name}`)
            return 100
          }
          return prev + 10
        })
      }, 300)
    } catch (error) {
      console.error("Simulation error:", error)
      setErrorMessage(`Error during simulation: ${error instanceof Error ? error.message : String(error)}`)
      setUploadState("error")
    }
  }

  // Upload the file - this function decides whether to use real upload or simulation
  const uploadFile = async () => {
    if (!file) return

    // In preview mode, use simulation instead of real upload
    if (isPreviewMode) {
      await simulateUpload()
      return
    }

    // Real upload logic (for production environment)
    try {
      setUploadState("uploading")
      setProgress(0)
      setResponseDetails("")

      const startTime = Date.now()
      const formData = new FormData()
      formData.append("file", file) // IMPORTANT: Use 'file' as the field name for n8n
      formData.append("filename", file.name)

      // Track upload progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 5
        })

        // Calculate upload speed
        const elapsedTime = (Date.now() - startTime) / 1000 // seconds
        const uploadedMB = (file.size * (progress / 100)) / (1024 * 1024)
        const speedMBps = uploadedMB / elapsedTime || 0.01
        setUploadSpeed(`${speedMBps.toFixed(2)} MB/s`)
      }, 200)

      try {
        // Use XMLHttpRequest with proper error handling
        const xhr = new XMLHttpRequest()

        // Create a promise to handle the XHR request
        const uploadPromise = new Promise((resolve, reject) => {
          xhr.open("POST", UPLOAD_ENDPOINT, true)

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.responseText)
            } else {
              reject(new Error(`Server returned ${xhr.status}: ${xhr.statusText}`))
            }
          }

          xhr.onerror = () => {
            reject(
              new Error(
                "Network error occurred. This could be due to CORS restrictions or the server being unavailable.",
              ),
            )
          }

          xhr.ontimeout = () => {
            reject(new Error("Request timed out. The server took too long to respond."))
          }

          xhr.send(formData)
        })

        // Wait for upload to complete
        const responseText = await uploadPromise

        clearInterval(progressInterval)
        setProgress(100)
        setResponseDetails(responseText)

        setUploadState("processing")

        // Simulate processing time
        const processingTimer = setInterval(() => {
          setProcessingTime((prev) => {
            if (prev >= 100) {
              clearInterval(processingTimer)
              setUploadState("success")
              setDownloadUrl(`${UPLOAD_ENDPOINT}?download=${file.name}`)
              return 100
            }
            return prev + 10
          })
        }, 300)
      } catch (error) {
        clearInterval(progressInterval)
        console.error("Upload error:", error)
        setErrorMessage(`${error instanceof Error ? error.message : String(error)}`)
        setUploadState("error")
      }
    } catch (error) {
      console.error("Setup error:", error)
      setErrorMessage(`An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`)
      setUploadState("error")
    }
  }

  // Handle keyboard navigation for the drop zone
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (dropZoneRef.current === document.activeElement) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          fileInputRef.current?.click()
        }
      }
    }

    const dropZone = dropZoneRef.current
    if (dropZone) {
      dropZone.addEventListener("keydown", handleKeyDown)
    }

    return () => {
      if (dropZone) {
        dropZone.removeEventListener("keydown", handleKeyDown)
      }
    }
  }, [])

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {isPreviewMode && (
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <AlertCircleIcon className="h-4 w-4 text-blue-500 mr-2" />
          <AlertDescription className="text-blue-700">
            Running in preview mode. File uploads are simulated and no actual network requests will be made.
          </AlertDescription>
        </Alert>
      )}

      {/* Upload Section */}
      {(uploadState === "idle" || uploadState === "selected") && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload File</h2>

          {/* Drag and drop zone */}
          <div
            ref={dropZoneRef}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${file ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-blue-400 hover:bg-blue-50"}
              focus:outline-none focus:ring-2 focus:ring-blue-500`}
            tabIndex={0}
            aria-label="Drop zone. Press Enter to browse files."
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileInputChange}
              className="hidden"
              accept=".pdf,.xlsx"
              aria-label="File input"
            />

            {file ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center mb-2">
                  <FileIcon className="h-8 w-8 text-green-500 mr-2" />
                  <span className="font-medium text-gray-800">{file.name}</span>
                </div>
                <span className="text-sm text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                <div className="mt-4 flex space-x-3">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      uploadFile()
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Upload File
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                    }}
                    className="text-red-500 border-red-300 hover:bg-red-50"
                  >
                    <XIcon className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <UploadIcon className="h-12 w-12 text-gray-400 mb-3" />
                <p className="text-lg font-medium text-gray-700 mb-1">Drag and drop your file here</p>
                <p className="text-sm text-gray-500 mb-4">
                  or <span className="text-blue-500 font-medium">browse</span> to choose a file
                </p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Accepted formats: PDF, XLSX</p>
                  <p>Maximum file size: 10MB</p>
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {errorMessage && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircleIcon className="h-4 w-4 mr-2" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Processing Section */}
      {(uploadState === "uploading" || uploadState === "processing") && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            {uploadState === "uploading" ? "Uploading File" : "Processing File"}
          </h2>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <div className="flex items-center mb-4">
              <FileIcon className="h-6 w-6 text-blue-500 mr-2" />
              <span className="font-medium text-gray-800">{file?.name}</span>
            </div>

            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">
                  {uploadState === "uploading" ? "Uploading..." : "Processing..."}
                </span>
                <span className="text-sm text-gray-500">
                  {uploadState === "uploading" ? `${progress}%` : `${processingTime}%`}
                </span>
              </div>
              <Progress value={uploadState === "uploading" ? progress : processingTime} className="h-2" />
            </div>

            <div className="text-sm text-gray-600">
              {uploadState === "uploading" ? (
                <p>Upload speed: {uploadSpeed || "Calculating..."}</p>
              ) : (
                <p>Estimated time remaining: {Math.ceil((100 - processingTime) / 10) * 0.5} seconds</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Download Section */}
      {uploadState === "success" && (
        <div className="mb-8">
          <div className="bg-green-50 rounded-lg p-6 border border-green-200 mb-6">
            <div className="flex items-center mb-4">
              <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
              <h2 className="text-xl font-semibold text-green-800">Processing Complete</h2>
            </div>

            <p className="text-green-700 mb-4">
              Your file has been successfully {isPreviewMode ? "processed (simulated)" : "uploaded and processed"}.
              {!isPreviewMode && " It's now ready for download."}
            </p>

            <div className="bg-white rounded-md p-4 border border-gray-200 mb-4">
              <div className="flex items-center mb-2">
                <FileTextIcon className="h-5 w-5 text-blue-500 mr-2" />
                <span className="font-medium text-gray-800">Processed file</span>
              </div>
              <div className="text-sm text-gray-500 mb-3">Excel format (.xlsx) • Ready for download</div>
              {!isPreviewMode ? (
                <Button onClick={() => window.open(downloadUrl, "_blank")} className="w-full sm:w-auto">
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download File
                </Button>
              ) : (
                <Button disabled className="w-full sm:w-auto opacity-70">
                  <DownloadIcon className="h-4 w-4 mr-2" />
                  Download (Simulated)
                </Button>
              )}
            </div>

            <div className="text-sm text-gray-600 space-y-1">
              <p>Upload speed: {uploadSpeed}</p>
              <p>Processing time: {(processingTime * 0.05).toFixed(1)} seconds</p>
              {responseDetails && (
                <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                  <p className="font-medium text-sm">Server response:</p>
                  <pre className="text-xs overflow-auto max-h-24 mt-1">{responseDetails}</pre>
                </div>
              )}
            </div>
          </div>

          <Button variant="outline" onClick={resetForm} className="w-full sm:w-auto">
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Process Another File
          </Button>
        </div>
      )}

      {/* Error State */}
      {uploadState === "error" && (
        <div className="mb-8">
          <Alert variant="destructive" className="mb-4">
            <AlertCircleIcon className="h-5 w-5 mr-2" />
            <div>
              <AlertDescription className="font-medium">{errorMessage}</AlertDescription>
            </div>
          </Alert>

          {responseDetails && (
            <div className="mb-4 p-3 bg-red-50 rounded border border-red-200 overflow-auto max-h-40">
              <p className="font-medium text-sm text-red-800 mb-1">Server response details:</p>
              <pre className="text-xs text-red-700 whitespace-pre-wrap">{responseDetails}</pre>
            </div>
          )}

          <div className="bg-red-50 rounded-lg p-6 border border-red-200 mb-6">
            <h3 className="font-medium text-red-800 mb-2">Troubleshooting Tips:</h3>
            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
              <li>Check your internet connection and try again</li>
              <li>Ensure your file is a valid PDF or Excel (XLSX) format</li>
              <li>Verify the file size is under 10MB</li>
              {isPreviewMode && (
                <li>
                  <strong>Note:</strong> In preview mode, actual network requests are simulated. This error is likely
                  due to the preview environment limitations.
                </li>
              )}
              {!isPreviewMode && (
                <>
                  <li>The server might be experiencing issues or be temporarily unavailable</li>
                  <li>There might be CORS restrictions preventing the request</li>
                </>
              )}
            </ul>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={() => {
                if (file) {
                  uploadFile()
                } else {
                  resetForm()
                }
              }}
            >
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              {file ? "Retry Upload" : "Start Over"}
            </Button>

            <Button variant="outline" onClick={resetForm}>
              Select Different File
            </Button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="border-t border-gray-200 pt-6 mt-6">
        <h3 className="font-medium text-gray-800 mb-2">Instructions</h3>
        <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
          <li>Select a PDF or Excel (XLSX) file using the upload area above</li>
          <li>Ensure your file is under 10MB in size</li>
          <li>Click the "Upload File" button to begin processing</li>
          <li>Wait for the processing to complete</li>
          <li>Download your processed file when ready</li>
          {isPreviewMode && (
            <li className="text-blue-600 font-medium">
              Note: In preview mode, file uploads are simulated for demonstration purposes
            </li>
          )}
        </ol>
      </div>
    </div>
  )
}

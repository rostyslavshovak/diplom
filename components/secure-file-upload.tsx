"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  FileIcon,
  UploadIcon,
  XIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  ShieldIcon,
  AlertTriangleIcon,
  ClockIcon,
  FileTypeIcon,
  FileLockIcon,
  NetworkIcon,
  DownloadIcon,
  SettingsIcon,
  InfoIcon,
  Loader2Icon,
  FileTextIcon,
  FileSpreadsheetIcon,
  SendIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

// Constants
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
]

const ALLOWED_FILE_EXTENSIONS = [".pdf", ".xlsx"]
const PROCESSING_TIME_SECONDS = 90 // 1 minute 30 seconds processing time

// Types
type UploadState = "idle" | "selected" | "sending" | "processing" | "success" | "error" | "cancelled"
type ErrorType = "network" | "server" | "timeout" | "size" | "type" | "unknown" | "cancelled" | null
type UploadMethod = "binary-with-metadata" | "pure-binary" | "form-data"

interface SecureFileUploadProps {
  endpoint: string
  maxFileSize?: number
  timeout?: number
  csrfToken?: string
  authToken?: string
  forcePreviewMode?: boolean
  uploadMethod?: UploadMethod
}

interface ErrorDetails {
  type: ErrorType
  message: string
  statusCode?: number
  technical?: string
}

interface FileMetadata {
  fileName?: string
  fileType?: string
  fileSize?: number | string
  fileExtension?: string
  description?: string
  category?: string
  tags?: string[]
  source?: string
  [key: string]: any
}

interface ResponseData {
  success?: boolean
  message?: string
  downloadUrl?: string
  binaryResponse?: boolean
  contentType?: string
  filename?: string
  fileMetadata?: FileMetadata
  uploadInfo?: {
    fileName: string
    fileSize: number
    fileType: string
    uploadMethod: string
    timestamp: string
  }
}

export default function SecureFileUpload({
  endpoint,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  timeout = 180000, // 3 minutes default (increased to accommodate processing time)
  csrfToken: initialCsrfToken,
  authToken: initialAuthToken,
  forcePreviewMode = false,
  uploadMethod = "pure-binary", // Default to pure-binary
}: SecureFileUploadProps) {
  // State
  const [file, setFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const [processingProgress, setProcessingProgress] = useState(0)
  const [processingStage, setProcessingStage] = useState("")
  const [processingTimeRemaining, setProcessingTimeRemaining] = useState("")
  const [error, setError] = useState<ErrorDetails | null>(null)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [responseData, setResponseData] = useState<ResponseData | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [uploadAbortController, setUploadAbortController] = useState<AbortController | null>(null)
  const [csrfToken, setCsrfToken] = useState<string | undefined>(initialCsrfToken)
  const [authToken, setAuthToken] = useState<string | undefined>(initialAuthToken)
  const [selectedUploadMethod, setSelectedUploadMethod] = useState<UploadMethod>(uploadMethod)
  const [fileMetadata, setFileMetadata] = useState<FileMetadata>({})
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Check if we're in preview mode
  useEffect(() => {
    if (forcePreviewMode) {
      setIsPreviewMode(true)
      return
    }

    const isPreview =
      process.env.NODE_ENV === "development" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.includes("v0.dev") ||
      window.location.hostname.includes("preview.app.github.dev")

    setIsPreviewMode(isPreview)
  }, [forcePreviewMode])

  // Reset the form to initial state
  const resetForm = () => {
    setFile(null)
    setUploadState("idle")
    setProcessingProgress(0)
    setProcessingStage("")
    setProcessingTimeRemaining("")
    setError(null)
    setResponseData(null)
    setDownloadUrl(null)
    setFileMetadata({})
    setProcessingStartTime(null)
    setJobId(null)

    // Cancel any ongoing upload
    if (uploadAbortController) {
      uploadAbortController.abort()
      setUploadAbortController(null)
    }

    // Clear any intervals
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current)
      processingIntervalRef.current = null
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  // Validate file type and extension
  const validateFileType = (file: File): boolean => {
    const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`
    const fileType = file.type.toLowerCase()

    const isValidType = ALLOWED_FILE_TYPES.includes(fileType)
    const isValidExtension = ALLOWED_FILE_EXTENSIONS.includes(fileExtension)

    return isValidType && isValidExtension
  }

  // Handle file selection
  const handleFileSelect = (selectedFile: File | null) => {
    setError(null)

    if (!selectedFile) {
      return
    }

    // Validate file size
    if (selectedFile.size > maxFileSize) {
      setError({
        type: "size",
        message: `File size exceeds the limit of ${(maxFileSize / (1024 * 1024)).toFixed(0)}MB. Your file is ${(selectedFile.size / (1024 * 1024)).toFixed(2)}MB.`,
        technical: `File size: ${selectedFile.size} bytes, Max allowed: ${maxFileSize} bytes`,
      })
      return
    }

    // Validate file type
    if (!validateFileType(selectedFile)) {
      setError({
        type: "type",
        message: "Invalid file type. Please select a file with an allowed format.",
        technical: `File type: ${selectedFile.type}, Extension: .${selectedFile.name.split(".").pop()}`,
      })
      return
    }

    setFile(selectedFile)
    setUploadState("selected")

    // Auto-populate some metadata
    setFileMetadata({
      category: selectedFile.type.includes("pdf") ? "document" : "spreadsheet",
      source: "user-upload",
      uploadTimestamp: new Date().toISOString(),
    })
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

  // Update processing time remaining
  const updateProcessingTimeRemaining = useCallback(() => {
    if (!processingStartTime) return

    const currentTime = Date.now()
    const elapsedSeconds = (currentTime - processingStartTime) / 1000
    const remainingSeconds = Math.max(0, PROCESSING_TIME_SECONDS - elapsedSeconds)

    // Calculate progress percentage
    const progressPercentage = Math.min(100, (elapsedSeconds / PROCESSING_TIME_SECONDS) * 100)
    setProcessingProgress(Math.floor(progressPercentage))

    if (remainingSeconds <= 0) {
      setProcessingTimeRemaining("Completing...")
      return
    }

    if (remainingSeconds < 60) {
      setProcessingTimeRemaining(`${Math.ceil(remainingSeconds)} seconds remaining`)
    } else {
      setProcessingTimeRemaining(`${Math.ceil(remainingSeconds / 60)} minutes remaining`)
    }
  }, [processingStartTime])

  // Simulate processing for preview mode
  const simulateProcessing = useCallback(() => {
    if (!file) return

    setUploadState("processing")
    setProcessingStartTime(Date.now())
    setProcessingProgress(0)
    setProcessingStage("Initializing processing")

    // Simulate processing with dynamic progress
    const processingInterval = setInterval(() => {
      updateProcessingTimeRemaining()

      // Check if processing is complete
      const elapsedSeconds = (Date.now() - (processingStartTime || Date.now())) / 1000
      if (elapsedSeconds >= PROCESSING_TIME_SECONDS) {
        clearInterval(processingInterval)

        // Simulate file metadata
        let simulatedFileMetadata: FileMetadata = {}

        if (file.name.toLowerCase().endsWith(".xlsx")) {
          simulatedFileMetadata = {
            fileName: file.name,
            fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileSize: file.size,
            fileExtension: ".xlsx",
          }
        } else if (file.name.toLowerCase().endsWith(".pdf")) {
          simulatedFileMetadata = {
            fileName: file.name,
            fileType: "application/pdf",
            fileSize: file.size,
            fileExtension: ".pdf",
          }
        }

        // Create a blob URL for download simulation
        const simulatedFileContent = `Processed file: ${file.name}\nProcessed at: ${new Date().toISOString()}\nOriginal size: ${file.size} bytes`

        // Create realistic binary content
        let blob
        if (file.name.toLowerCase().endsWith(".xlsx")) {
          const header = new Uint8Array([0x50, 0x4b, 0x03, 0x04]) // XLSX file signature
          const content = new TextEncoder().encode(simulatedFileContent)
          const combined = new Uint8Array(header.length + content.length)
          combined.set(header)
          combined.set(content, header.length)
          blob = new Blob([combined], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
        } else if (file.name.toLowerCase().endsWith(".pdf")) {
          const pdfHeader = `%PDF-1.4
1 0 obj
<</Type /Catalog /Pages 2 0 R>>
endobj
2 0 obj
<</Type /Pages /Kids [3 0 R] /Count 1>>
endobj
3 0 obj
<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R>>
endobj
4 0 obj
<</Length 100>>
stream
BT
/F1 12 Tf
100 700 Td
(Processed File: ${file.name}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000102 00000 n
0000000169 00000 n
trailer
<</Size 5 /Root 1 0 R>>
startxref
269
%%EOF`
          blob = new Blob([pdfHeader], { type: "application/pdf" })
        } else {
          blob = new Blob([simulatedFileContent], { type: "text/plain" })
        }

        const downloadUrl = URL.createObjectURL(blob)

        // Simulate success after processing
        setResponseData({
          success: true,
          message: "File processed successfully (simulation)",
          downloadUrl: downloadUrl,
          binaryResponse: true,
          contentType: file.name.toLowerCase().endsWith(".xlsx")
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : file.name.toLowerCase().endsWith(".pdf")
              ? "application/pdf"
              : "text/plain",
          filename: file.name,
          fileMetadata: simulatedFileMetadata,
          uploadInfo: {
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            uploadMethod: selectedUploadMethod,
            timestamp: new Date().toISOString(),
          },
        })
        setDownloadUrl(downloadUrl)
        setUploadState("success")
      }
    }, 1000)

    processingIntervalRef.current = processingInterval
  }, [file, selectedUploadMethod, updateProcessingTimeRemaining, processingStartTime])

  // Cancel the upload/processing
  const cancelUpload = useCallback(() => {
    if (uploadAbortController) {
      uploadAbortController.abort()
      setUploadAbortController(null)
    }

    setUploadState("cancelled")
    setError({
      type: "cancelled",
      message: "Process cancelled by user.",
      technical: "User initiated abort of upload/processing request",
    })

    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current)
      processingIntervalRef.current = null
    }

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [uploadAbortController])

  // Enhanced direct binary download function
  const handleDirectBinaryDownload = useCallback(
    async (url: string, filename: string, contentType: string) => {
      try {
        console.log("Starting direct binary download:", { url, filename, contentType })

        // Set download state to loading
        setError(null)

        // Fetch the binary data with appropriate headers
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "*/*", // Accept any content type
            "X-Request-Type": "processed-file-download",
            "X-Original-Filename": filename,
            "X-Job-ID": jobId || "",
            "X-Binary-Transfer": "true", // Signal that we expect binary data
            "X-Input-Field-Name": "file", // Match the n8n input field name
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
        }

        // Log all response headers for debugging
        console.log("Download response headers:", Object.fromEntries(response.headers.entries()))

        // Check content type from response
        const actualContentType = response.headers.get("Content-Type") || contentType

        // Check for Content-Disposition header which might contain the filename
        const contentDisposition = response.headers.get("Content-Disposition") || ""
        let actualFilename = filename

        // Try to extract filename from Content-Disposition header
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          actualFilename = filenameMatch[1].replace(/['"]/g, "")
        }

        // Get the binary data as an ArrayBuffer
        const arrayBuffer = await response.arrayBuffer()

        if (arrayBuffer.byteLength === 0) {
          throw new Error("Received empty binary data")
        }

        console.log(`Received binary data: ${arrayBuffer.byteLength} bytes`)

        // Create a blob with the correct content type
        const blob = new Blob([arrayBuffer], { type: actualContentType })

        // Create a blob URL
        const blobUrl = URL.createObjectURL(blob)

        // Create a download link
        const a = document.createElement("a")
        a.href = blobUrl
        a.download = actualFilename
        a.style.display = "none"

        // Add to document, click, and remove
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Clean up the blob URL
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl)
        }, 100)

        return true
      } catch (error) {
        console.error("Error downloading binary file:", error)
        setError({
          type: "network",
          message: "Failed to download the processed file. Please try again.",
          technical: error instanceof Error ? error.message : String(error),
        })
        return false
      }
    },
    [jobId],
  )

  // Update the handleDownload function to handle binary downloads better
  const handleDownload = useCallback(async () => {
    if (!downloadUrl) {
      console.warn("No download URL available.")
      return
    }

    if (responseData?.binaryResponse && responseData?.filename && responseData?.contentType) {
      // Attempt direct binary download
      const success = await handleDirectBinaryDownload(downloadUrl, responseData.filename, responseData.contentType)
      if (success) return
    }

    // Fallback to opening the URL in a new tab
    window.open(downloadUrl, "_blank")
  }, [downloadUrl, responseData, handleDirectBinaryDownload])

  // Poll for processing status
  const pollProcessingStatus = useCallback(
    async (currentJobId: string): Promise<void> => {
      if (!currentJobId) return

      try {
        const response = await fetch(`/api/processing-status?jobId=${currentJobId}`)
        if (!response.ok) {
          throw new Error(`Failed to get processing status: ${response.status}`)
        }

        const data = await response.json()

        // Update processing stage and progress
        if (data.processingStage) {
          setProcessingStage(data.processingStage)
        }

        if (data.progress !== undefined) {
          setProcessingProgress(data.progress)
        }

        if (data.remainingTime !== undefined) {
          const remaining = data.remainingTime
          if (remaining <= 0) {
            setProcessingTimeRemaining("Completing...")
          } else if (remaining < 60) {
            setProcessingTimeRemaining(`${Math.ceil(remaining)} seconds remaining`)
          } else {
            setProcessingTimeRemaining(`${Math.ceil(remaining / 60)} minutes remaining`)
          }
        }

        if (data.status === "completed") {
          // Processing is complete
          clearInterval(pollIntervalRef.current as NodeJS.Timeout)
          pollIntervalRef.current = null

          // Store file metadata if available
          if (data.fileMetadata) {
            setFileMetadata(data.fileMetadata)
          }

          // Set download URL if available
          if (data.downloadUrl) {
            setDownloadUrl(data.downloadUrl)

            // Prepare response data
            setResponseData({
              success: true,
              message: "File processed successfully",
              downloadUrl: data.downloadUrl,
              binaryResponse: true,
              contentType: data.fileMetadata?.fileType || "application/octet-stream",
              filename: data.fileMetadata?.fileName || (file ? file.name : "processed-file"),
              fileMetadata: data.fileMetadata,
              uploadInfo: {
                fileName: file?.name || "unknown",
                fileSize: file?.size || 0,
                fileType: file?.type || "unknown",
                uploadMethod: selectedUploadMethod,
                timestamp: new Date().toISOString(),
              },
            })

            setUploadState("success")
          } else {
            // No download URL provided
            setError({
              type: "server",
              message: "Processing completed but no download URL was provided.",
              technical: "Missing downloadUrl in processing status response",
            })
            setUploadState("error")
          }
        } else if (data.status === "failed") {
          clearInterval(pollIntervalRef.current as NodeJS.Timeout)
          pollIntervalRef.current = null

          setError({
            type: "server",
            message: "Processing failed. Please try again.",
            technical: data.error || "Unknown processing error",
          })
          setUploadState("error")
        }
      } catch (error) {
        console.error("Error polling for processing status:", error)
        // Don't stop polling on temporary errors
      }
    },
    [file, selectedUploadMethod],
  )

  // Send file for processing (no upload delay)
  const sendFileForProcessing = useCallback(async (): Promise<void> => {
    if (!file) throw new Error("No file selected")

    console.log(`Sending file for immediate processing with method: ${selectedUploadMethod}`)

    // Create FormData with the file
    const formData = new FormData()
    formData.append("file", file)
    formData.append("filename", file.name)
    formData.append("filesize", file.size.toString())
    formData.append("filetype", file.type)

    // Add metadata if available
    if (Object.keys(fileMetadata).length > 0) {
      formData.append("metadata", JSON.stringify(fileMetadata))
    }

    // Create a new AbortController for this request
    const controller = new AbortController()
    setUploadAbortController(controller)

    // Set up timeout for the entire process
    const totalTimeout = timeout + PROCESSING_TIME_SECONDS * 1000
    const timeoutId = setTimeout(() => {
      console.log(`Total process timed out after ${totalTimeout}ms`)
      controller.abort()
    }, totalTimeout)

    timeoutIdRef.current = timeoutId

    try {
      // Set state to sending (very brief)
      setUploadState("sending")
      setError(null)
      setResponseData(null)
      setDownloadUrl(null)

      // Determine the API endpoint based on upload method
      let apiEndpoint = "/api/upload-native"
      if (selectedUploadMethod === "binary-with-metadata") {
        apiEndpoint = "/api/upload-binary-with-metadata"
      } else if (selectedUploadMethod === "pure-binary") {
        apiEndpoint = "/api/upload-pure-binary"
      }

      console.log("Sending file to:", apiEndpoint)
      console.log("File details:", {
        name: file.name,
        type: file.type,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        method: selectedUploadMethod,
      })

      // Send the file immediately for processing
      const response = await fetch(apiEndpoint, {
        method: "POST",
        body: formData,
        signal: controller.signal,
        headers: {
          "X-CSRF-Token": csrfToken || "",
          Authorization: `Bearer ${authToken || ""}`,
          "X-Upload-Method": selectedUploadMethod,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
        throw new Error(`Server responded with status: ${response.status} - ${errorData.error || response.statusText}`)
      }

      // Get the response data
      const responseData = await response.json()

      // File sent successfully, now processing
      if (responseData.jobId) {
        setJobId(responseData.jobId)
        setUploadState("processing")
        setProcessingStartTime(Date.now())
        setProcessingProgress(0)
        setProcessingStage("Processing started")

        console.log("File sent for processing, job ID:", responseData.jobId)

        // Start polling for processing status immediately
        const pollInterval = setInterval(() => {
          pollProcessingStatus(responseData.jobId)
        }, 2000) // Poll every 2 seconds

        pollIntervalRef.current = pollInterval

        // Also start local progress tracking
        const processingInterval = setInterval(() => {
          updateProcessingTimeRemaining()
        }, 1000)

        processingIntervalRef.current = processingInterval
      } else {
        // No processing needed, handle direct response
        if (responseData.downloadUrl) {
          setDownloadUrl(responseData.downloadUrl)
          setResponseData(responseData)
          setUploadState("success")
        } else {
          throw new Error("No job ID or download URL provided in the response")
        }
      }
    } catch (error: any) {
      // Clear intervals
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current)
        processingIntervalRef.current = null
      }

      console.error("Send file failed:", error)

      // Handle different error types
      if (error.name === "AbortError") {
        if (Date.now() - (processingStartTime || Date.now()) >= totalTimeout) {
          setError({
            type: "timeout",
            message: `Process timed out after ${totalTimeout / 1000} seconds.`,
            technical: `Timeout exceeded: ${totalTimeout}ms`,
          })
          setUploadState("error")
        } else {
          setError({
            type: "cancelled",
            message: "Process cancelled by user.",
            technical: "User initiated abort of request",
          })
          setUploadState("cancelled")
        }
      } else if (error.message && error.message.includes("status: 500")) {
        setError({
          type: "server",
          message: "The server encountered an internal error. Please check the logs and try again.",
          technical: `Server error: ${error.message}`,
          statusCode: 500,
        })
        setUploadState("error")
      } else {
        setError({
          type: "network",
          message: "Network error occurred. Please check your connection and try again.",
          technical: `Request error: ${error.message}`,
        })
        setUploadState("error")
      }
    } finally {
      // Clear the timeout
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
        timeoutIdRef.current = null
      }

      // Clear the abort controller
      setUploadAbortController(null)
    }
  }, [
    file,
    timeout,
    csrfToken,
    authToken,
    selectedUploadMethod,
    fileMetadata,
    pollProcessingStatus,
    updateProcessingTimeRemaining,
    processingStartTime,
  ])

  // Process the file
  const processFile = useCallback(async () => {
    if (!file) return

    if (isPreviewMode) {
      simulateProcessing()
      return
    }

    try {
      await sendFileForProcessing()
    } catch (error: any) {
      console.error("Process error:", error)
      setError({
        type: "unknown",
        message: "An unexpected error occurred. Please try again.",
        technical: error.message || String(error),
      })
      setUploadState("error")
    }
  }, [file, isPreviewMode, simulateProcessing, sendFileForProcessing])

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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (uploadAbortController) {
        uploadAbortController.abort()
      }

      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current)
      }

      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }

      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current)
      }

      if (downloadUrl && downloadUrl.startsWith("blob:")) {
        URL.revokeObjectURL(downloadUrl)
      }
    }
  }, [downloadUrl, uploadAbortController])

  // Get error icon based on error type
  const getErrorIcon = (type: ErrorType) => {
    switch (type) {
      case "network":
        return <NetworkIcon className="h-5 w-5 text-red-500" />
      case "server":
        return <AlertCircleIcon className="h-5 w-5 text-red-500" />
      case "timeout":
        return <ClockIcon className="h-5 w-5 text-red-500" />
      case "size":
        return <FileIcon className="h-5 w-5 text-red-500" />
      case "type":
        return <FileTypeIcon className="h-5 w-5 text-red-500" />
      case "cancelled":
        return <XIcon className="h-5 w-5 text-amber-500" />
      default:
        return <AlertTriangleIcon className="h-5 w-5 text-red-500" />
    }
  }

  // Get file icon based on file type
  const getFileIcon = (filename: string, contentType?: string) => {
    if (filename.toLowerCase().endsWith(".xlsx") || contentType?.includes("spreadsheet")) {
      return <FileSpreadsheetIcon className="h-5 w-5 text-green-600" />
    } else if (filename.toLowerCase().endsWith(".pdf") || contentType?.includes("pdf")) {
      return <FileTextIcon className="h-5 w-5 text-red-500" />
    } else {
      return <FileIcon className="h-5 w-5 text-blue-500" />
    }
  }

  // Format file size for display
  const formatFileSize = (size: number | string | undefined): string => {
    if (size === undefined) return "Unknown size"

    const numSize = typeof size === "string" ? Number.parseInt(size, 10) : size

    if (isNaN(numSize)) return size as string

    if (numSize < 1024) return `${numSize} B`
    if (numSize < 1024 * 1024) return `${(numSize / 1024).toFixed(1)} KB`
    return `${(numSize / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {isPreviewMode && (
        <Alert className="mb-4 bg-blue-50 border-blue-200">
          <AlertCircleIcon className="h-4 w-4 text-blue-500 mr-2" />
          <AlertDescription className="text-blue-700">
            Running in preview mode. File processing is simulated and no actual network requests will be made.
          </AlertDescription>
        </Alert>
      )}

      {/* Security Info */}
      <div className="mb-6 flex items-start space-x-3 bg-gray-50 p-4 rounded-md border border-gray-200">
        <ShieldIcon className="h-5 w-5 text-green-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-medium text-gray-800 mb-1">Secure Processing</h3>
          <p className="text-sm text-gray-600 mb-2">
            Your files are securely transmitted and processed with the following protections:
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="outline" className="bg-gray-100 text-gray-700">
              CSRF Protection
            </Badge>
            <Badge variant="outline" className="bg-gray-100 text-gray-700">
              Authentication
            </Badge>
            <Badge variant="outline" className="bg-gray-100 text-gray-700">
              File Validation
            </Badge>
            <Badge variant="outline" className="bg-gray-100 text-gray-700">
              Binary Integrity
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)} className="text-xs">
              <SettingsIcon className="h-3 w-3 mr-1" />
              {showSettings ? "Hide Settings" : "Processing Settings"}
            </Button>
          </div>
        </div>
      </div>

      {/* Processing Settings */}
      {showSettings && (
        <div className="mb-6 bg-gray-50 p-4 rounded-md border border-gray-200">
          <h3 className="font-medium text-gray-800 mb-3 flex items-center">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Processing Configuration
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Processing Method</label>
              <select
                value={selectedUploadMethod}
                onChange={(e) => setSelectedUploadMethod(e.target.value as UploadMethod)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="form-data">Form Data (Standard)</option>
                <option value="binary-with-metadata">Binary with Metadata</option>
                <option value="pure-binary">Pure Binary</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">File Description</label>
              <input
                type="text"
                value={fileMetadata.description || ""}
                onChange={(e) => setFileMetadata({ ...fileMetadata, description: e.target.value })}
                placeholder="Optional file description"
                className="w-full p-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-600">
            <div className="flex items-start space-x-2">
              <InfoIcon className="h-3 w-3 mt-0.5 text-blue-500" />
              <div>
                <p>
                  <strong>Pure Binary:</strong> Raw binary data transmission (recommended for processing)
                </p>
                <p>
                  <strong>Binary with Metadata:</strong> Sends file as base64 with JSON metadata
                </p>
                <p>
                  <strong>Form Data:</strong> Standard multipart upload
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Selection Section */}
      {(uploadState === "idle" || uploadState === "selected") && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Select File for Processing</h2>

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
              accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="File input"
            />

            {file ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center mb-2">
                  {file.name.toLowerCase().endsWith(".xlsx") ? (
                    <FileSpreadsheetIcon className="h-8 w-8 text-green-500 mr-2" />
                  ) : file.name.toLowerCase().endsWith(".pdf") ? (
                    <FileTextIcon className="h-8 w-8 text-red-500 mr-2" />
                  ) : (
                    <FileIcon className="h-8 w-8 text-blue-500 mr-2" />
                  )}
                  <span className="font-medium text-gray-800">{file.name}</span>
                </div>
                <span className="text-sm text-gray-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                <div className="mt-2 text-xs text-gray-600">
                  <Badge variant="outline" className="mr-2">
                    {selectedUploadMethod.replace("-", " ").toUpperCase()}
                  </Badge>
                  {fileMetadata.description && <span className="text-gray-500">"{fileMetadata.description}"</span>}
                </div>
                <div className="mt-4 flex space-x-3">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation()
                      processFile()
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <SendIcon className="h-4 w-4 mr-2" />
                    Process File
                  </Button>
                  <Button
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                      setFileMetadata({})
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
                  <p>Maximum file size: {(maxFileSize / (1024 * 1024)).toFixed(0)}MB</p>
                  <p>Allowed file types: PDF, XLSX</p>
                  <p>Processing method: {selectedUploadMethod.replace("-", " ")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <div className="flex items-start">
                {getErrorIcon(error.type)}
                <AlertDescription className="ml-2">{error.message}</AlertDescription>
              </div>
            </Alert>
          )}
        </div>
      )}

      {/* Sending Section (Very Brief) */}
      {uploadState === "sending" && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Sending File for Processing</h2>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <div className="flex items-center mb-4">
              {file && file.name.toLowerCase().endsWith(".xlsx") ? (
                <FileSpreadsheetIcon className="h-6 w-6 text-green-500 mr-2" />
              ) : file && file.name.toLowerCase().endsWith(".pdf") ? (
                <FileTextIcon className="h-6 w-6 text-red-500 mr-2" />
              ) : (
                <FileIcon className="h-6 w-6 text-blue-500 mr-2" />
              )}
              <div className="flex-1">
                <span className="font-medium text-gray-800">{file?.name}</span>
                <div className="text-xs text-gray-500 mt-1">
                  <Badge variant="outline" className="mr-2">
                    {selectedUploadMethod.replace("-", " ").toUpperCase()}
                  </Badge>
                  {(file?.size && (file.size / (1024 * 1024)).toFixed(2)) || "0"} MB
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center text-sm text-gray-600 mb-4">
              <div className="flex items-center">
                <Loader2Icon className="h-4 w-4 mr-2 animate-spin text-blue-500" />
                <p>Sending file to processing endpoint...</p>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-blue-700">
              <p className="flex items-center">
                <InfoIcon className="h-4 w-4 mr-2" />
                File is being sent for immediate processing. This should only take a moment.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Processing Section */}
      {uploadState === "processing" && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Processing File</h2>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <div className="flex items-center mb-4">
              {file && file.name.toLowerCase().endsWith(".xlsx") ? (
                <FileSpreadsheetIcon className="h-6 w-6 text-green-500 mr-2" />
              ) : file && file.name.toLowerCase().endsWith(".pdf") ? (
                <FileTextIcon className="h-6 w-6 text-red-500 mr-2" />
              ) : (
                <FileTextIcon className="h-6 w-6 text-blue-500 mr-2" />
              )}
              <div className="flex-1">
                <span className="font-medium text-gray-800">{file?.name}</span>
                <div className="text-xs text-gray-500 mt-1">
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 mr-2">
                    PROCESSING
                  </Badge>
                  {(file?.size && (file.size / (1024 * 1024)).toFixed(2)) || "0"} MB
                  {jobId && <span className="ml-2">Job: {jobId.split("_")[1]}</span>}
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{processingStage || "Processing..."}</span>
                <span className="text-sm text-gray-500">{processingProgress}%</span>
              </div>
              <Progress value={processingProgress} className="h-2" />
            </div>

            <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
              <div className="flex items-center">
                <Loader2Icon className="h-4 w-4 mr-2 animate-spin text-blue-500" />
                <p>Your file is being processed at the webhook endpoint</p>
              </div>
              <p>{processingTimeRemaining}</p>
            </div>

            <div className="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-blue-700 mb-4">
              <p className="flex items-center">
                <InfoIcon className="h-4 w-4 mr-2" />
                Processing typically takes about 1 minute 30 seconds. The processed file will be available for download
                immediately upon completion.
              </p>
            </div>

            <div className="flex space-x-3">
              <Button variant="outline" className="text-red-500 border-red-200 hover:bg-red-50" onClick={cancelUpload}>
                <XIcon className="h-4 w-4 mr-1" />
                Cancel Processing
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Section */}
      {uploadState === "success" && (
        <div className="mb-8">
          <div className="bg-green-50 rounded-lg p-6 border border-green-200 mb-4">
            <div className="flex items-center mb-4">
              <CheckCircleIcon className="h-6 w-6 text-green-500 mr-2" />
              <h2 className="text-xl font-semibold text-green-800">Processing Complete</h2>
            </div>

            <p className="text-green-700 mb-4">
              Your file has been successfully{" "}
              {isPreviewMode ? "processed (simulated)" : "processed and is ready for download"}.
            </p>

            <div className="bg-white rounded-md p-4 border border-gray-200 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  {getFileIcon(
                    responseData?.filename || "",
                    responseData?.contentType || responseData?.fileMetadata?.fileType,
                  )}
                  <div className="ml-3">
                    <span className="font-medium text-gray-800">
                      {responseData?.filename ||
                        responseData?.fileMetadata?.fileName ||
                        (file ? `processed-${file.name}` : "processed-file")}
                    </span>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(responseData?.fileMetadata?.fileSize) ||
                        (file && (file.size / (1024 * 1024)).toFixed(2) + " MB")}{" "}
                      • Processing complete
                    </p>
                    <div className="text-xs text-gray-500 mt-1">
                      <Badge variant="outline" className="bg-green-100 text-green-700 mr-2">
                        PROCESSED
                      </Badge>
                      {responseData?.uploadInfo?.timestamp && (
                        <span>Completed: {new Date(responseData.uploadInfo.timestamp).toLocaleTimeString()}</span>
                      )}
                      {jobId && <span className="ml-2">Job: {jobId.split("_")[1]}</span>}
                    </div>
                  </div>
                </div>

                {downloadUrl && (
                  <Button onClick={handleDownload} size="sm" className="bg-green-600 hover:bg-green-700">
                    <DownloadIcon className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>

            {responseData?.fileMetadata && (
              <div className="bg-gray-50 p-3 rounded border border-gray-200 mb-4 text-xs text-gray-700">
                <p className="font-medium text-sm text-gray-800 mb-1">File Information:</p>
                <ul className="space-y-1">
                  <li>
                    <strong>File Name:</strong> {responseData.fileMetadata.fileName || "Not specified"}
                  </li>
                  <li>
                    <strong>File Type:</strong> {responseData.fileMetadata.fileType || "Not specified"}
                  </li>
                  <li>
                    <strong>File Size:</strong> {formatFileSize(responseData.fileMetadata.fileSize)}
                  </li>
                  {responseData.fileMetadata.fileExtension && (
                    <li>
                      <strong>File Extension:</strong> {responseData.fileMetadata.fileExtension}
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="text-sm text-gray-600 space-y-1">
              <p>Processing time: ~{PROCESSING_TIME_SECONDS / 60} minutes</p>
              {responseData?.message && <p>Server message: {responseData.message}</p>}
              {responseData?.binaryResponse && <p>Response type: Binary data ({responseData.contentType})</p>}
            </div>
          </div>

          <Button variant="outline" onClick={resetForm} className="w-full sm:w-auto">
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Process Another File
          </Button>
        </div>
      )}

      {/* Error State */}
      {(uploadState === "error" || uploadState === "cancelled") && (
        <div className="mb-8">
          <Alert
            variant={error?.type === "cancelled" ? "default" : "destructive"}
            className={error?.type === "cancelled" ? "mb-4 bg-amber-50 border-amber-200" : "mb-4"}
          >
            <div className="flex items-start">
              {error && getErrorIcon(error.type)}
              <AlertDescription className="ml-2 font-medium">
                {error?.message || "An error occurred during processing."}
              </AlertDescription>
            </div>
          </Alert>

          {error?.technical && (
            <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200 overflow-auto max-h-40">
              <p className="font-medium text-sm text-gray-800 mb-1">Technical details:</p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">{error.technical}</pre>
              {error.statusCode && <p className="text-xs text-gray-700 mt-1">Status code: {error.statusCode}</p>}
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-4">
            <h3 className="font-medium text-gray-800 mb-2">Troubleshooting Tips:</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {error?.type === "network" && (
                <>
                  <li>Check your internet connection</li>
                  <li>Ensure you're not behind a restrictive firewall</li>
                  <li>Try again in a few moments</li>
                </>
              )}
              {error?.type === "server" && (
                <>
                  <li>The server encountered an error processing your request</li>
                  <li>Check the server logs for more details</li>
                  <li>Verify that the N8N_WEBHOOK_URL environment variable is correctly set</li>
                </>
              )}
              {error?.type === "timeout" && (
                <>
                  <li>The server took too long to respond</li>
                  <li>Try uploading a smaller file</li>
                  <li>Check your network connection speed</li>
                </>
              )}
              {error?.type === "size" && (
                <>
                  <li>Your file exceeds the maximum allowed size</li>
                  <li>Try compressing the file or splitting it into smaller parts</li>
                </>
              )}
              {error?.type === "type" && (
                <>
                  <li>The file type you're trying to upload is not allowed</li>
                  <li>Convert your file to one of the supported formats</li>
                </>
              )}
              {error?.type === "cancelled" && (
                <>
                  <li>Processing was cancelled by user</li>
                  <li>You can restart the process when ready</li>
                </>
              )}
              {(error?.type === "unknown" || !error?.type) && (
                <>
                  <li>An unexpected error occurred</li>
                  <li>Try refreshing the page and processing again</li>
                  <li>If the problem persists, contact support</li>
                </>
              )}
              {isPreviewMode && (
                <li className="text-blue-600">
                  <strong>Note:</strong> In preview mode, actual processing is simulated.
                </li>
              )}
            </ul>
          </div>

          <div className="flex space-x-3">
            <Button
              onClick={() => {
                if (file) {
                  processFile()
                } else {
                  resetForm()
                }
              }}
            >
              <RefreshCwIcon className="h-4 w-4 mr-2" />
              {file ? "Retry Processing" : "Start Over"}
            </Button>

            <Button variant="outline" onClick={resetForm}>
              {file ? "Select Different File" : "Reset"}
            </Button>
          </div>
        </div>
      )}

      {/* File Requirements */}
      <div className="border-t border-gray-200 pt-6 mt-6">
        <h3 className="font-medium text-gray-800 mb-3 flex items-center">
          <FileLockIcon className="h-4 w-4 mr-2 text-gray-600" />
          File Processing Requirements & Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Allowed File Types</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• PDF Documents (.pdf)</li>
              <li>• Excel Spreadsheets (.xlsx)</li>
            </ul>
          </div>
          <div className="bg-gray-50 p-3 rounded border border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Processing Information</h4>
            <ul className="text-xs text-gray-600 space-y-1">
              <li>• Maximum file size: {(maxFileSize / (1024 * 1024)).toFixed(0)}MB</li>
              <li>• Processing time: ~1 minute 30 seconds</li>
              <li>• Binary data preservation guaranteed</li>
              <li>• Download available immediately after processing</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-500">
          <p className="flex items-center">
            <InfoIcon className="h-3 w-3 mr-1" />
            Current processing method: <strong className="ml-1">{selectedUploadMethod.replace("-", " ")}</strong>
            {isPreviewMode && " (Preview Mode - Simulated)"}
          </p>
        </div>
      </div>
    </div>
  )
}

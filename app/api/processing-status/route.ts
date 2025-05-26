import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    // Get the job ID from the query parameters
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
    }

    console.log("Checking processing status for job:", jobId)

    // Parse the job ID to get the start time and filename
    let startTime: number
    let originalFilename = "document"

    try {
      // Assuming jobId format is "job_timestamp_randomid_filename"
      const parts = jobId.split("_")
      startTime = Number.parseInt(parts[1], 10)

      if (parts.length > 3) {
        originalFilename = parts.slice(3).join("_").replace(/_/g, " ")
      }

      if (isNaN(startTime)) {
        throw new Error("Invalid job ID format")
      }
    } catch (error) {
      // For demo purposes, use a default start time
      startTime = Date.now() - 30000 // 30 seconds ago
    }

    const currentTime = Date.now()
    const elapsedMs = currentTime - startTime
    const totalProcessingTimeMs = 90000 // 1 minute 30 seconds

    // Calculate progress percentage
    const progress = Math.min(100, Math.floor((elapsedMs / totalProcessingTimeMs) * 100))

    // Add some realistic variation to progress
    const dynamicProgress = Math.min(100, progress + Math.floor(Math.random() * 3))

    // Determine job status
    let status
    let downloadReady = false
    let downloadUrl = null
    let fileMetadata = null

    if (progress >= 100) {
      status = "completed"
      downloadReady = true

      // Ensure the filename has the correct extension
      const filename = ensureFileExtension(originalFilename)

      // Create a download URL that will fetch the processed binary file
      downloadUrl = `/api/download-binary?filename=${encodeURIComponent(filename)}&jobId=${jobId}`

      // Provide file metadata that would come from the webhook
      fileMetadata = {
        fileName: filename,
        fileType: getContentTypeFromFilename(filename),
        fileSize: "22.1 kB", // Based on the screenshot
        processingCompleted: true,
        jobId: jobId,
        mimeType: getContentTypeFromFilename(filename),
        fileExtension: `.${filename.split(".").pop() || "xlsx"}`,
      }

      console.log("Processing completed for job:", jobId, "Download URL:", downloadUrl)
    } else if (progress >= 95) {
      status = "finalizing"
    } else if (progress >= 80) {
      status = "processing-final-stage"
    } else if (progress >= 50) {
      status = "processing-advanced"
    } else if (progress >= 20) {
      status = "processing-intermediate"
    } else {
      status = "processing-initial"
    }

    const remainingTime = Math.max(0, (totalProcessingTimeMs - elapsedMs) / 1000)

    return NextResponse.json({
      jobId,
      status,
      progress: dynamicProgress,
      downloadReady,
      downloadUrl,
      originalFilename,
      fileMetadata,
      elapsedTime: elapsedMs / 1000, // in seconds
      estimatedTotalTime: totalProcessingTimeMs / 1000, // in seconds
      remainingTime: remainingTime,
      processingStage: getProcessingStage(progress),
    })
  } catch (error) {
    console.error("Error checking processing status:", error)
    return NextResponse.json(
      {
        error: "Failed to check processing status",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

// Helper function to ensure filename has the correct extension
function ensureFileExtension(filename: string): string {
  if (filename.includes(".")) {
    return filename // Already has an extension
  }

  // Default to .xlsx if no extension is present (based on the screenshot)
  return `${filename}.xlsx`
}

// Helper function to get content type from filename
function getContentTypeFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() || ""

  const contentTypeMap: Record<string, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pdf: "application/pdf",
    txt: "text/plain",
    json: "application/json",
    csv: "text/csv",
    xls: "application/vnd.ms-excel",
  }

  return contentTypeMap[extension] || "application/octet-stream"
}

// Helper function to get processing stage description
function getProcessingStage(progress: number): string {
  if (progress >= 95) return "Finalizing processed file"
  if (progress >= 80) return "Applying final transformations"
  if (progress >= 60) return "Processing data structures"
  if (progress >= 40) return "Analyzing file content"
  if (progress >= 20) return "Parsing file format"
  return "Initializing processing"
}

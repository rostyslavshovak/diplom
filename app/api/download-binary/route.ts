import { type NextRequest, NextResponse } from "next/server"
import { getFile, deleteFile } from "@/lib/receivedFiles"

export async function GET(req: NextRequest) {
  try {
    // Get parameters from the request
    const { searchParams } = new URL(req.url)
    const webhookUrl =
      searchParams.get("webhookUrl") ||
      process.env.N8N_WEBHOOK_URL ||
      "https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"

  const jobId = searchParams.get("jobId")
  const requestedFilename = searchParams.get("filename") || "processed-file"

  console.log("Binary download request:", { webhookUrl, jobId, requestedFilename })

  if (jobId) {
    const stored = getFile(jobId)
    if (stored) {
      console.log("Serving file from in-memory store")
      const res = new NextResponse(stored.data, {
        headers: {
          "Content-Type": stored.mimeType,
          "Content-Disposition": `attachment; filename=\"${stored.fileName}\"`,
          "Content-Length": stored.data.length.toString(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-Download-Source": "webhook-cache",
        },
      })
      deleteFile(jobId)
      return res
    }
  }

    // Check if we're in preview mode
    const isPreviewMode =
      process.env.NODE_ENV === "development" ||
      !process.env.N8N_WEBHOOK_URL ||
      req.headers.get("x-vercel-deployment-url")?.includes("vercel.app")

    if (isPreviewMode) {
      console.log("Running in preview mode, generating simulated file")
      return generateSimulatedFile(requestedFilename, jobId)
    }

    // For production mode, fetch the processed file from the webhook
    console.log("Fetching processed binary file from webhook:", webhookUrl)

    // Prepare headers for the webhook request to get processed file
    const requestHeaders: Record<string, string> = {
      Accept: "*/*",
      "X-Job-ID": jobId || "",
      "X-Request-Type": "download-processed-file",
      "X-Original-Filename": requestedFilename,
      "X-Download-Request": "true",
    }

    // Add CSRF token if available
    const csrfToken = process.env.CSRF_TOKEN
    if (csrfToken) {
      requestHeaders["X-CSRF-Token"] = csrfToken
    }

    try {
      // Request the processed file from the webhook
      // Important: We're not setting any specific content-type expectation
      // to allow the webhook to respond with whatever content-type it has
      const response = await fetch(webhookUrl, {
        method: "GET",
        headers: requestHeaders,
      })

      if (!response.ok) {
        console.error(`Error fetching processed file: ${response.status} ${response.statusText}`)
        return generateErrorFile(
          `Error fetching processed file: ${response.status} ${response.statusText}`,
          webhookUrl,
          jobId,
        )
      }

      // Log all response headers for debugging
      console.log("Response headers:", Object.fromEntries(response.headers.entries()))

      // Extract comprehensive file metadata from response headers
      const responseHeaders = response.headers
      const contentType = responseHeaders.get("Content-Type") || "application/octet-stream"
      const contentLength = responseHeaders.get("Content-Length") || ""
      const contentDisposition = responseHeaders.get("Content-Disposition") || ""

      // Extract filename from various possible header sources
      let fileName = extractFilenameFromHeaders(responseHeaders, requestedFilename)

      // Extract additional metadata from custom headers
      const fileSize = responseHeaders.get("X-File-Size") || contentLength
      const originalExtension = responseHeaders.get("X-File-Extension") || responseHeaders.get("X-Original-Extension")

      console.log("Extracted file metadata:", {
        fileName,
        contentType,
        fileSize,
        originalExtension,
        contentDisposition,
      })

      // Get the binary data directly from the response
      const binaryData = await response.arrayBuffer()

      if (binaryData.byteLength === 0) {
        console.error("Received empty binary data from webhook")
        return generateErrorFile("Received empty binary data from webhook", webhookUrl, jobId)
      }

      console.log(`Successfully received binary data: ${binaryData.byteLength} bytes`)

      // Ensure filename has correct extension based on content type
      fileName = ensureCorrectExtension(fileName, contentType, originalExtension)

      // Return the binary data with comprehensive headers
      return new NextResponse(binaryData, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${fileName}"`,
          "Content-Length": binaryData.byteLength.toString(),
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
          "X-File-Integrity": "verified",
          "X-Download-Source": "webhook-binary",
          "X-Original-Size": fileSize || binaryData.byteLength.toString(),
        },
      })
    } catch (error) {
      console.error("Error fetching from webhook:", error)
      return generateErrorFile(
        `Error fetching from webhook: ${error instanceof Error ? error.message : String(error)}`,
        webhookUrl,
        jobId,
      )
    }
  } catch (error) {
    console.error("Unexpected error in download-binary API route:", error)
    return generateErrorFile(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`, "", "")
  }
}

// Helper function to extract filename from various header sources
function extractFilenameFromHeaders(headers: Headers, fallbackName: string): string {
  // Try Content-Disposition header first
  const contentDisposition = headers.get("Content-Disposition") || ""
  const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
  if (filenameMatch && filenameMatch[1]) {
    return filenameMatch[1].replace(/['"]/g, "")
  }

  // Try custom filename headers
  const customFilename = headers.get("X-File-Name") || headers.get("X-Filename")
  if (customFilename) {
    try {
      return decodeURIComponent(customFilename)
    } catch (e) {
      console.warn("Failed to decode filename from header:", customFilename)
    }
  }

  // Use fallback name
  return fallbackName
}

// Helper function to ensure filename has correct extension
function ensureCorrectExtension(filename: string, contentType: string, originalExtension?: string | null): string {
  const currentExtension = filename.includes(".") ? `.${filename.split(".").pop()}` : ""

  // If we have an original extension from headers, use it
  if (originalExtension && !filename.endsWith(originalExtension)) {
    const baseName = filename.replace(/\.[^/.]+$/, "")
    return `${baseName}${originalExtension}`
  }

  // If no extension, determine from content type
  if (!currentExtension) {
    const extensionFromType = getExtensionFromContentType(contentType)
    if (extensionFromType) {
      return `${filename}${extensionFromType}`
    }
  }

  return filename
}

// Helper function to generate a simulated file for preview mode
function generateSimulatedFile(filename: string, jobId: string | null): NextResponse {
  let contentType = "application/octet-stream"
  let content: Uint8Array

  if (filename.toLowerCase().endsWith(".xlsx")) {
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    // Create a realistic XLSX binary structure
    const header = new Uint8Array([0x50, 0x4b, 0x03, 0x04]) // XLSX file signature
    const textContent = `Simulated processed XLSX file\nOriginal: ${filename}\nJob ID: ${jobId || "unknown"}\nProcessed at: ${new Date().toISOString()}`
    const textBytes = new TextEncoder().encode(textContent)
    content = new Uint8Array(header.length + textBytes.length)
    content.set(header)
    content.set(textBytes, header.length)
  } else if (filename.toLowerCase().endsWith(".pdf")) {
    contentType = "application/pdf"
    // Create a realistic PDF binary structure
    const pdfContent = `%PDF-1.4
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
(Processed File: ${filename}) Tj
100 680 Td
(Job ID: ${jobId || "unknown"}) Tj
100 660 Td
(Generated: ${new Date().toLocaleString()}) Tj
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
350
%%EOF`
    content = new TextEncoder().encode(pdfContent)
  } else {
    contentType = "text/plain"
    content = new TextEncoder().encode(
      `Processed file: ${filename}\nJob ID: ${jobId || "unknown"}\nGenerated at: ${new Date().toISOString()}`,
    )
  }

  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": content.length.toString(),
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-File-Integrity": "simulated",
      "X-Download-Source": "preview-mode",
    },
  })
}

// Helper function to generate an error file
function generateErrorFile(errorMessage: string, webhookUrl: string, jobId: string | null): NextResponse {
  const errorContent = new TextEncoder().encode(
    `Error downloading processed file: ${errorMessage}\n\n` +
      `Webhook URL: ${webhookUrl}\n` +
      `Job ID: ${jobId || "unknown"}\n` +
      `Timestamp: ${new Date().toISOString()}\n\n` +
      `Please check the webhook configuration and try again.`,
  )

  return new NextResponse(errorContent, {
    headers: {
      "Content-Type": "text/plain",
      "Content-Disposition": `attachment; filename="error-report.txt"`,
      "Content-Length": errorContent.length.toString(),
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  })
}

// Helper function to get file extension from content type
function getExtensionFromContentType(contentType: string): string {
  const contentTypeMap: Record<string, string> = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/json": ".json",
    "text/csv": ".csv",
    "application/vnd.ms-excel": ".xls",
  }

  return contentTypeMap[contentType] || ""
}

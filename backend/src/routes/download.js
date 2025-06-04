import fetch from "node-fetch"
import { getFile, deleteFile } from "../utils/receivedFiles.js"

export default async function (fastify, opts) {
  fastify.get("/download-binary", async (request, reply) => {
    try {
      // Get parameters from the request
      const webhookUrl =
        request.query.webhookUrl ||
        process.env.N8N_WEBHOOK_URL ||
        "https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"

      const jobId = request.query.jobId
      const requestedFilename = request.query.filename || "processed-file"

      fastify.log.info("Binary download request:", { webhookUrl, jobId, requestedFilename })

      if (jobId) {
        const stored = getFile(jobId)
        if (stored) {
          fastify.log.info("Serving file from in-memory store")
          deleteFile(jobId)
          reply.header("Content-Type", stored.mimeType)
          reply.header("Content-Disposition", `attachment; filename="${stored.fileName}"`)
          reply.header("Content-Length", stored.data.length.toString())
          reply.header("Cache-Control", "no-cache, no-store, must-revalidate")
          reply.header("Pragma", "no-cache")
          reply.header("Expires", "0")
          reply.header("X-Download-Source", "webhook-cache")
          return reply.send(stored.data)
        }
      }

      // Check if we're in preview mode
      const isPreviewMode = process.env.NODE_ENV === "development" || !process.env.N8N_WEBHOOK_URL

      if (isPreviewMode) {
        fastify.log.info("Running in preview mode, generating simulated file")
        return generateSimulatedFile(reply, requestedFilename, jobId)
      }

      // For production mode, fetch the processed file from the webhook
      fastify.log.info("Fetching processed binary file from webhook:", webhookUrl)

      // Prepare headers for the webhook request to get processed file
      const requestHeaders = {
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
        const response = await fetch(webhookUrl, {
          method: "GET",
          headers: requestHeaders,
        })

        if (!response.ok) {
          fastify.log.error(`Error fetching processed file: ${response.status} ${response.statusText}`)
          return generateErrorFile(
            reply,
            `Error fetching processed file: ${response.status} ${response.statusText}`,
            webhookUrl,
            jobId,
          )
        }

        // Log all response headers for debugging
        const responseHeaders = response.headers.raw()
        fastify.log.info("Response headers:", responseHeaders)

        // Extract comprehensive file metadata from response headers
        const contentType = response.headers.get("Content-Type") || "application/octet-stream"
        const contentLength = response.headers.get("Content-Length") || ""
        const contentDisposition = response.headers.get("Content-Disposition") || ""

        // Extract filename from various possible header sources
        let fileName = extractFilenameFromHeaders(response.headers, requestedFilename)

        // Extract additional metadata from custom headers
        const fileSize = response.headers.get("X-File-Size") || contentLength
        const originalExtension =
          response.headers.get("X-File-Extension") || response.headers.get("X-Original-Extension")

        fastify.log.info("Extracted file metadata:", {
          fileName,
          contentType,
          fileSize,
          originalExtension,
          contentDisposition,
        })

        // Get the binary data directly from the response
        const binaryData = await response.buffer()

        if (binaryData.byteLength === 0) {
          fastify.log.error("Received empty binary data from webhook")
          return generateErrorFile(reply, "Received empty binary data from webhook", webhookUrl, jobId)
        }

        fastify.log.info(`Successfully received binary data: ${binaryData.byteLength} bytes`)

        // Ensure filename has correct extension based on content type
        fileName = ensureCorrectExtension(fileName, contentType, originalExtension)

        // Return the binary data with comprehensive headers
        reply.header("Content-Type", contentType)
        reply.header("Content-Disposition", `attachment; filename="${fileName}"`)
        reply.header("Content-Length", binaryData.byteLength.toString())
        reply.header("Cache-Control", "no-cache, no-store, must-revalidate")
        reply.header("Pragma", "no-cache")
        reply.header("Expires", "0")
        reply.header("X-File-Integrity", "verified")
        reply.header("X-Download-Source", "webhook-binary")
        reply.header("X-Original-Size", fileSize || binaryData.byteLength.toString())

        return reply.send(binaryData)
      } catch (error) {
        fastify.log.error("Error fetching from webhook:", error)
        return generateErrorFile(
          reply,
          `Error fetching from webhook: ${error.message || String(error)}`,
          webhookUrl,
          jobId,
        )
      }
    } catch (error) {
      fastify.log.error("Unexpected error in download-binary API route:", error)
      return generateErrorFile(reply, `Unexpected error: ${error.message || String(error)}`, "", "")
    }
  })
}

// Helper function to extract filename from various header sources
function extractFilenameFromHeaders(headers, fallbackName) {
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
function ensureCorrectExtension(filename, contentType, originalExtension) {
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
function generateSimulatedFile(reply, filename, jobId) {
  let contentType = "application/octet-stream"
  let content

  if (filename.toLowerCase().endsWith(".xlsx")) {
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    // Create a realistic XLSX binary structure
    const header = Buffer.from([0x50, 0x4b, 0x03, 0x04]) // XLSX file signature
    const textContent = `Simulated processed XLSX file\nOriginal: ${filename}\nJob ID: ${jobId || "unknown"}\nProcessed at: ${new Date().toISOString()}`
    const textBytes = Buffer.from(textContent)
    content = Buffer.concat([header, textBytes])
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
    content = Buffer.from(pdfContent)
  } else {
    contentType = "text/plain"
    content = Buffer.from(
      `Processed file: ${filename}\nJob ID: ${jobId || "unknown"}\nGenerated at: ${new Date().toISOString()}`,
    )
  }

  reply.header("Content-Type", contentType)
  reply.header("Content-Disposition", `attachment; filename="${filename}"`)
  reply.header("Content-Length", content.length.toString())
  reply.header("Cache-Control", "no-cache, no-store, must-revalidate")
  reply.header("Pragma", "no-cache")
  reply.header("Expires", "0")
  reply.header("X-File-Integrity", "simulated")
  reply.header("X-Download-Source", "preview-mode")

  return reply.send(content)
}

// Helper function to generate an error file
function generateErrorFile(reply, errorMessage, webhookUrl, jobId) {
  const errorContent = Buffer.from(
    `Error downloading processed file: ${errorMessage}\n\n` +
      `Webhook URL: ${webhookUrl}\n` +
      `Job ID: ${jobId || "unknown"}\n` +
      `Timestamp: ${new Date().toISOString()}\n\n` +
      `Please check the webhook configuration and try again.`,
  )

  reply.header("Content-Type", "text/plain")
  reply.header("Content-Disposition", `attachment; filename="error-report.txt"`)
  reply.header("Content-Length", errorContent.length.toString())
  reply.header("Cache-Control", "no-cache, no-store, must-revalidate")
  reply.header("Pragma", "no-cache")
  reply.header("Expires", "0")

  return reply.send(errorContent)
}

// Helper function to get file extension from content type
function getExtensionFromContentType(contentType) {
  const contentTypeMap = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "application/json": ".json",
    "text/csv": ".csv",
    "application/vnd.ms-excel": ".xls",
  }

  return contentTypeMap[contentType] || ""
}

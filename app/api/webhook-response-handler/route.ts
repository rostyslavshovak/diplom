import { type NextRequest, NextResponse } from "next/server"
import { storeFile } from "@/lib/receivedFiles"
import { randomUUID } from "crypto"

export async function POST(req: NextRequest) {
  try {
    console.log("=== Webhook Response Handler Started ===")

    const jobId = req.headers.get("x-job-id") || randomUUID()
    const fileNameHeader = req.headers.get("x-file-name")
    const mimeType = req.headers.get("content-type") || "application/octet-stream"

    // Read the binary body
    const arrayBuffer = await req.arrayBuffer()

    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      console.error("Received empty body from webhook")
      return NextResponse.json({ error: "Empty body received" }, { status: 400 })
    }

    const buffer = Buffer.from(arrayBuffer)

    // Extract file metadata from headers if available
    const dataString = Buffer.from(arrayBuffer.slice(0, 200)).toString()

    // Extract file information using regex
    const fileNameMatch = dataString.match(/File Name: ([^\n]+)/)
    const fileExtMatch = dataString.match(/File Extension: ([^\n]+)/)
    const headerFileName = fileNameHeader ? decodeURIComponent(fileNameHeader) : null

    const fileName = headerFileName || (fileNameMatch ? fileNameMatch[1].trim() : `file-${jobId}`)
    const fileExt = fileExtMatch ? fileExtMatch[1].trim() : fileName.split(".").pop() || ""
    const fileSize = buffer.byteLength.toString()

    console.log("Extracted file metadata:", {
      fileName,
      fileExt,
      mimeType,
      fileSize,
    })

    // Store the binary file for later download
    storeFile(jobId, buffer, fileName, mimeType)

    const processedFileInfo = {
      fileName,
      fileExt,
      mimeType,
      fileSize,
      jobId,
      timestamp: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      message: "Webhook response processed successfully",
      fileInfo: processedFileInfo,
    })
  } catch (error) {
    console.error("=== Webhook Response Handler Error ===")
    console.error("Error details:", error)

    return NextResponse.json(
      {
        error: "Failed to process webhook response",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

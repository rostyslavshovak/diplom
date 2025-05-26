import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    console.log("=== Webhook Response Handler Started ===")

    // Parse the incoming JSON data
    const webhookData = await req.json()

    // Check if the data field exists
    if (!webhookData.data) {
      console.error("No data field found in webhook response")
      return NextResponse.json({ error: "No data field in webhook response" }, { status: 400 })
    }

    // Extract file metadata from the data field
    // Example format: "data File Name: File.xlsx File Extension: xlsx Mime Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet File Size: 19.9 kB"
    const dataString = webhookData.data.toString()

    // Extract file information using regex
    const fileNameMatch = dataString.match(/File Name: ([^\n]+)/)
    const fileExtMatch = dataString.match(/File Extension: ([^\n]+)/)
    const mimeTypeMatch = dataString.match(/Mime Type: ([^\n]+)/)
    const fileSizeMatch = dataString.match(/File Size: ([^\n]+)/)

    const fileName = fileNameMatch ? fileNameMatch[1].trim() : "processed-file.xlsx"
    const fileExt = fileExtMatch ? fileExtMatch[1].trim() : "xlsx"
    const mimeType = mimeTypeMatch
      ? mimeTypeMatch[1].trim()
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    const fileSize = fileSizeMatch ? fileSizeMatch[1].trim() : "Unknown"

    console.log("Extracted file metadata:", {
      fileName,
      fileExt,
      mimeType,
      fileSize,
    })

    // In a real implementation, you would extract the binary data from the webhook response
    // For this example, we'll create a simple XLSX-like binary data
    // In a production environment, you would need to properly extract the binary data from the webhook response

    // Store the processed file information for later retrieval
    const processedFileInfo = {
      fileName,
      fileExt,
      mimeType,
      fileSize,
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

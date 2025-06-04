import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    console.log("=== Webhook Response Handler Started ===")

    const contentType = req.headers.get("content-type") || ""
    let dataString = ""

    // If the webhook sent JSON we can parse it directly
    if (contentType.includes("application/json")) {
      const webhookData = await req.json()

      if (!webhookData.data) {
        console.error("No data field found in webhook response")
        return NextResponse.json({ error: "No data field in webhook response" }, { status: 400 })
      }

      dataString = webhookData.data.toString()
    } else {
      // Otherwise assume raw text/binary and convert to string for metadata extraction
      const buffer = Buffer.from(await req.arrayBuffer())
      dataString = buffer.toString()
      console.log(`Received ${buffer.length} bytes of data from webhook`)
    }

    // Extract file metadata from the data string
    // Example format: "File Name: File.xlsx File Extension: xlsx Mime Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet File Size: 19.9 kB"

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

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
      "Access-Control-Max-Age": "86400",
    },
  })
}

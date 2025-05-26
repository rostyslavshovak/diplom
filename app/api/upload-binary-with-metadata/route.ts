import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    console.log("=== Binary Upload with Metadata API Route Started ===")

    // Get the webhook URL from environment variables with fallback
    const webhookUrl =
      process.env.N8N_WEBHOOK_URL || "https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"
    if (!webhookUrl) {
      console.error("No webhook URL available")
      return NextResponse.json({ error: "Webhook URL not configured" }, { status: 500 })
    }

    console.log("Using webhook URL:", webhookUrl)

    // Parse the incoming form data
    const formData = await req.formData()
    const file = formData.get("file") as File
    const metadata = formData.get("metadata") as string

    if (!file) {
      console.error("No file found in form data")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Parse metadata if provided
    let parsedMetadata = {}
    if (metadata) {
      try {
        parsedMetadata = JSON.parse(metadata)
      } catch (e) {
        console.warn("Failed to parse metadata:", e)
      }
    }

    console.log("File details:", {
      name: file.name,
      type: file.type,
      size: file.size,
      metadata: parsedMetadata,
    })

    // Convert file to binary data
    const arrayBuffer = await file.arrayBuffer()
    const binaryData = new Uint8Array(arrayBuffer)

    // Create the payload structure
    const payload = {
      // File metadata
      file: {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: file.lastModified,
        ...parsedMetadata,
      },
      // Binary data encoded as base64 for JSON transmission
      binaryData: Buffer.from(binaryData).toString("base64"),
      // Request metadata
      request: {
        timestamp: new Date().toISOString(),
        userAgent: req.headers.get("user-agent") || "",
        contentLength: file.size,
        uploadMethod: "binary-with-metadata",
      },
      // Additional headers that might be useful
      headers: {
        "content-type": file.type || "application/octet-stream",
        "content-length": file.size.toString(),
        "x-upload-timestamp": new Date().toISOString(),
        "x-file-name": encodeURIComponent(file.name),
        "x-file-type": file.type || "application/octet-stream",
      },
    }

    console.log("Sending structured payload to webhook:", webhookUrl)
    console.log("Payload structure:", {
      fileInfo: payload.file,
      binaryDataSize: payload.binaryData.length,
      requestInfo: payload.request,
    })

    // Send the structured payload to the webhook
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Upload-Method": "binary-with-metadata",
        "X-File-Name": encodeURIComponent(file.name),
        "X-File-Type": file.type || "application/octet-stream",
        "X-File-Size": file.size.toString(),
        "X-Timestamp": new Date().toISOString(),
      },
      body: JSON.stringify(payload),
    })

    console.log("Webhook response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Webhook error response:", errorText)
      return NextResponse.json(
        {
          error: `Webhook responded with ${response.status}`,
          details: errorText.slice(0, 200),
        },
        { status: response.status },
      )
    }

    const responseText = await response.text()
    console.log("Webhook success response:", responseText.slice(0, 200))

    return NextResponse.json({
      ok: true,
      message: "File uploaded successfully with metadata",
      webhookResponse: responseText.slice(0, 200),
      uploadInfo: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadMethod: "binary-with-metadata",
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("=== Binary Upload with Metadata API Route Error ===")
    console.error("Error details:", error)

    return NextResponse.json(
      {
        error: "Internal server error",
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
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-CSRF-Token, X-Upload-Method, X-File-Name, X-File-Type, X-File-Size, X-Timestamp",
      "Access-Control-Max-Age": "86400",
    },
  })
}

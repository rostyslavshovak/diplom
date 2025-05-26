import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    console.log("=== Pure Binary Upload API Route Started ===")

    // Get the webhook URL from environment variables with fallback
    const webhookUrl =
      process.env.N8N_WEBHOOK_URL || "https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"
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

    // Get the raw binary data
    const arrayBuffer = await file.arrayBuffer()
    const binaryData = new Uint8Array(arrayBuffer)

    // Create a unique job ID for tracking
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${file.name.replace(/[^a-zA-Z0-9]/g, "_")}`

    // Prepare headers with file metadata and job tracking
    const headers: Record<string, string> = {
      "Content-Type": file.type || "application/octet-stream",
      "X-File-Name": encodeURIComponent(file.name),
      "X-File-Size": file.size.toString(),
      "X-File-Type": file.type || "application/octet-stream",
      "X-Original-Extension": `.${file.name.split(".").pop() || ""}`,
      "X-Job-ID": jobId,
      "X-Processing-Request": "true",
      "X-Upload-Timestamp": new Date().toISOString(),
      // Add these headers to help n8n identify the binary file
      "X-Binary-Transfer": "true",
      "X-Input-Field-Name": "file", // This matches the n8n input field name
    }

    // Add CSRF token if available
    if (process.env.CSRF_TOKEN) {
      headers["X-CSRF-Token"] = process.env.CSRF_TOKEN
    }

    console.log("Sending file for immediate processing to webhook:", webhookUrl)
    console.log("Job ID:", jobId)
    console.log("Request headers:", Object.keys(headers))

    // Send the file immediately to the webhook for processing
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: headers,
        body: binaryData,
      })

      console.log("Webhook response status:", response.status)
      console.log("Webhook response headers:", Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Webhook error response:", errorText)
        return NextResponse.json(
          {
            error: `Webhook processing failed with status ${response.status}`,
            details: errorText.slice(0, 200),
          },
          { status: response.status },
        )
      }

      // File sent successfully, now it's being processed
      console.log("File sent successfully for processing")

      // Return immediate response indicating processing has started
      return NextResponse.json({
        success: true,
        message: "File sent for processing successfully",
        jobId: jobId,
        filename: file.name,
        processingStarted: true,
        processingTimeEstimate: 90, // 1 minute 30 seconds
        uploadInfo: {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadMethod: "pure-binary",
          timestamp: new Date().toISOString(),
          jobId: jobId,
        },
      })
    } catch (error) {
      console.error("Error sending file to webhook:", error)
      return NextResponse.json(
        {
          error: "Failed to send file for processing",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("=== Pure Binary Upload API Route Error ===")
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
        "Content-Type, Authorization, X-CSRF-Token, X-File-Name, X-File-Size, X-File-Type, X-Original-Extension, X-Job-ID, X-Processing-Request, X-Upload-Timestamp, X-Binary-Transfer, X-Input-Field-Name",
      "Access-Control-Max-Age": "86400",
    },
  })
}

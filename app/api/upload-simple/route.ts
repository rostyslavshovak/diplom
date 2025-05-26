import { type NextRequest, NextResponse } from "next/server"
import FormData from "form-data"
import fs from "fs"
import path from "path"
import { tmpdir } from "os"

export async function POST(req: NextRequest) {
  try {
    console.log("Received simple upload request")

    // Update the webhook URL handling to use the correct URL format
    const webhookUrl =
      process.env.N8N_WEBHOOK_URL || "https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"
    if (!webhookUrl) {
      return NextResponse.json({ error: "Webhook URL not configured" }, { status: 500 })
    }

    console.log("Using webhook URL:", webhookUrl)

    // Create a temporary file path
    const tempFilePath = path.join(tmpdir(), `upload-${Date.now()}.tmp`)

    // Get the file data from the request
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file found in the request" }, { status: 400 })
    }

    // Convert the file to a buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, buffer)

    console.log("File details:", {
      name: file.name,
      type: file.type,
      size: file.size,
    })

    // Create a new FormData for the n8n request
    const fd = new FormData()
    fd.append("file", fs.createReadStream(tempFilePath), {
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    })

    console.log("Forwarding to n8n webhook:", webhookUrl)

    // Send the request to n8n
    const response = await fetch(webhookUrl, {
      method: "POST",
      body: fd,
      headers: fd.getHeaders(), // Important for setting the correct Content-Type with boundary
    })

    // Clean up the temporary file
    try {
      fs.unlinkSync(tempFilePath)
    } catch (err) {
      console.error("Error deleting temporary file:", err)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Error from n8n: ${response.status} ${response.statusText}`, errorText)
      return NextResponse.json(
        { error: `n8n webhook returned ${response.status}: ${errorText.slice(0, 200)}` },
        { status: 502 },
      )
    }

    const responseText = await response.text()
    return NextResponse.json({ ok: true, message: "File uploaded successfully", response: responseText.slice(0, 200) })
  } catch (error) {
    console.error("Error in simple upload API route:", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 })
  }
}

export async function OPTIONS(req: NextRequest) {
  // Handle CORS preflight request
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

import { type NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { tmpdir } from "os"
import FormData from "form-data"

export async function POST(req: NextRequest) {
  try {
    console.log("Received direct upload request")

    // Check if the request has the correct content type
    const contentType = req.headers.get("content-type") || ""
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Content-Type must be multipart/form-data" }, { status: 400 })
    }

    // Create a temporary file to store the request body
    const tempFilePath = path.join(tmpdir(), `upload-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`)
    const fileStream = fs.createWriteStream(tempFilePath)

    // Read the request body and write it to the temporary file
    const reader = req.body?.getReader()
    if (!reader) {
      return NextResponse.json({ error: "Request body is empty" }, { status: 400 })
    }

    const writePromise = new Promise<void>((resolve, reject) => {
      const processChunk = async () => {
        try {
          const { done, value } = await reader.read()
          if (done) {
            fileStream.end()
            resolve()
            return
          }

          fileStream.write(value)
          processChunk()
        } catch (err) {
          reject(err)
        }
      }

      processChunk()
    })

    await writePromise

    // Get the webhook URL from environment variables with fallback
    const webhookUrl =
      process.env.N8N_WEBHOOK_URL || "https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"
    if (!webhookUrl) {
      // Clean up the temporary file
      fs.unlinkSync(tempFilePath)
      return NextResponse.json({ error: "Webhook URL not configured" }, { status: 500 })
    }

    console.log("Using webhook URL:", webhookUrl)

    console.log("Forwarding to n8n webhook:", webhookUrl)

    // Create a new FormData for the n8n request
    const fd = new FormData()

    // Add the file with field name 'file' for n8n
    fd.append("file", fs.createReadStream(tempFilePath), {
      filename: "file.pdf", // Default filename
      contentType: "application/octet-stream",
    })

    // Send the request to n8n
    const response = await fetch(webhookUrl, {
      method: "POST",
      body: fd,
      headers: fd.getHeaders(), // Important for setting the correct Content-Type with boundary
    })

    // Clean up the temporary file
    fs.unlinkSync(tempFilePath)

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
    console.error("Error in direct upload API route:", error)
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

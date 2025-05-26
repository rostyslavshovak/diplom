import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    console.log("=== Native Upload API Route Started ===")

    // Update the webhook URL handling to use the correct URL format
    const webhookUrl =
      process.env.N8N_WEBHOOK_URL || "https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"

    // Replace the error check with this
    if (!webhookUrl) {
      console.error("No webhook URL available")
      return NextResponse.json({ error: "Webhook URL not configured" }, { status: 500 })
    }

    console.log("Using webhook URL:", webhookUrl)

    // Parse the form data using the native FormData API
    const formData = await req.formData()
    const file = formData.get("file") as File

    if (!file) {
      console.error("No file found in form data")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log("File details:", {
      name: file.name,
      type: file.type,
      size: file.size,
    })

    // Create a new FormData object for the webhook
    const webhookFormData = new FormData()
    webhookFormData.append("file", file)

    // Add any additional form fields
    for (const [key, value] of formData.entries()) {
      if (key !== "file" && typeof value === "string") {
        webhookFormData.append(key, value)
      }
    }

    console.log("Sending to webhook...")

    // Send to the webhook
    const response = await fetch(webhookUrl, {
      method: "POST",
      body: webhookFormData,
      // Don't set Content-Type header - let the browser set it with the boundary
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
      message: "File uploaded successfully",
      webhookResponse: responseText.slice(0, 200),
    })
  } catch (error) {
    console.error("=== Native Upload API Route Error ===")
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
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token",
      "Access-Control-Max-Age": "86400",
    },
  })
}

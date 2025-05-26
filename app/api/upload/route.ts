import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    console.log("=== Upload API Route Started ===")

    // Update the webhook URL handling to use the correct URL format
    const webhookUrl =
      process.env.N8N_WEBHOOK_URL || "https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"

    // Replace the error check with this
    if (!webhookUrl) {
      console.error("No webhook URL available")
      return NextResponse.json({ error: "Webhook URL not configured" }, { status: 500 })
    }

    console.log("Using webhook URL:", webhookUrl)
    console.log("Request Content-Type:", req.headers.get("content-type"))

    // Get the raw body from the request
    const body = await req.blob()
    console.log("Request body size:", body.size)

    // Forward the request directly to n8n with the same headers
    const forwardHeaders: Record<string, string> = {}

    // Copy important headers
    const contentType = req.headers.get("content-type")
    if (contentType) {
      forwardHeaders["content-type"] = contentType
    }

    // Add authentication headers if available
    const csrfToken = req.headers.get("x-csrf-token")
    const authHeader = req.headers.get("authorization")

    if (csrfToken) {
      forwardHeaders["x-csrf-token"] = csrfToken
    }

    if (authHeader) {
      forwardHeaders["authorization"] = authHeader
    }

    console.log("Forwarding headers:", Object.keys(forwardHeaders))

    // Forward the request to n8n
    const response = await fetch(webhookUrl, {
      method: "POST",
      body: body,
      headers: forwardHeaders,
    })

    console.log("n8n response status:", response.status)
    console.log("n8n response headers:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error("n8n error response:", errorText)
      return NextResponse.json(
        {
          error: `Webhook responded with ${response.status}`,
          details: errorText.slice(0, 200),
        },
        { status: response.status },
      )
    }

    // Get the response from n8n
    const responseText = await response.text()
    console.log("n8n success response:", responseText.slice(0, 200))

    return NextResponse.json({
      ok: true,
      message: "File uploaded successfully",
      webhookResponse: responseText.slice(0, 200),
    })
  } catch (error) {
    console.error("=== Upload API Route Error ===")
    console.error("Error details:", error)
    console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace")

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

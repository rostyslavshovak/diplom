import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Return a simple JSON response with a CSRF token
    return NextResponse.json(
      { csrfToken: process.env.CSRF_TOKEN || "fallback-csrf-token" },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Content-Type": "application/json",
        },
      },
    )
  } catch (error) {
    console.error("Error in CSRF API route:", error)
    return NextResponse.json(
      { error: "Failed to generate CSRF token" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      },
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  // Handle CORS preflight request
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  })
}

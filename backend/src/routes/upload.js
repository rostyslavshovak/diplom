import fetch from "node-fetch"

export default async function (fastify, opts) {
  // Pure binary upload route
  fastify.post("/upload-pure-binary", async (request, reply) => {
    try {
      fastify.log.info("=== Pure Binary Upload API Route Started ===")

      // Get the webhook URL from environment variables with fallback
      const webhookUrl =
        process.env.N8N_WEBHOOK_URL || "https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"
      fastify.log.info("Using webhook URL:", webhookUrl)

      // Parse the incoming form data
      const data = await request.file()

      if (!data) {
        fastify.log.error("No file found in form data")
        return reply.code(400).send({ error: "No file provided" })
      }

      const file = data.file
      const filename = data.filename
      const metadata = data.fields.metadata ? data.fields.metadata.value : null

      // Parse metadata if provided
      let parsedMetadata = {}
      if (metadata) {
        try {
          parsedMetadata = JSON.parse(metadata)
        } catch (e) {
          fastify.log.warn("Failed to parse metadata:", e)
        }
      }

      fastify.log.info("File details:", {
        name: filename,
        type: data.mimetype,
        size: data.file.length,
        metadata: parsedMetadata,
      })

      // Get the raw binary data
      const binaryData = await data.toBuffer()

      // Create a unique job ID for tracking
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${filename.replace(/[^a-zA-Z0-9]/g, "_")}`

      // Prepare headers with file metadata and job tracking
      const headers = {
        "Content-Type": data.mimetype || "application/octet-stream",
        "X-File-Name": encodeURIComponent(filename),
        "X-File-Size": data.file.length.toString(),
        "X-File-Type": data.mimetype || "application/octet-stream",
        "X-Original-Extension": `.${filename.split(".").pop() || ""}`,
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

      fastify.log.info("Sending file for immediate processing to webhook:", webhookUrl)
      fastify.log.info("Job ID:", jobId)
      fastify.log.info("Request headers:", Object.keys(headers))

      // Send the file immediately to the webhook for processing
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: headers,
          body: binaryData,
        })

        fastify.log.info("Webhook response status:", response.status)

        if (!response.ok) {
          const errorText = await response.text()
          fastify.log.error("Webhook error response:", errorText)
          return reply.code(response.status).send({
            error: `Webhook processing failed with status ${response.status}`,
            details: errorText.slice(0, 200),
          })
        }

        // File sent successfully, now it's being processed
        fastify.log.info("File sent successfully for processing")

        // Return immediate response indicating processing has started
        return {
          success: true,
          message: "File sent for processing successfully",
          jobId: jobId,
          filename: filename,
          processingStarted: true,
          processingTimeEstimate: 90, // 1 minute 30 seconds
          uploadInfo: {
            fileName: filename,
            fileSize: data.file.length,
            fileType: data.mimetype,
            uploadMethod: "pure-binary",
            timestamp: new Date().toISOString(),
            jobId: jobId,
          },
        }
      } catch (error) {
        fastify.log.error("Error sending file to webhook:", error)
        return reply.code(500).send({
          error: "Failed to send file for processing",
          details: error.message || String(error),
        })
      }
    } catch (error) {
      fastify.log.error("=== Pure Binary Upload API Route Error ===")
      fastify.log.error("Error details:", error)

      return reply.code(500).send({
        error: "Internal server error",
        details: error.message || String(error),
      })
    }
  })

  // Handle CORS preflight requests
  fastify.options("/upload-pure-binary", async (request, reply) => {
    return reply.code(204).send()
  })
}

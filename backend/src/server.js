import Fastify from "fastify"
import cors from "@fastify/cors"
import multipart from "@fastify/multipart"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Create Fastify instance
const fastify = Fastify({
  logger: true,
  bodyLimit: 30 * 1024 * 1024, // 30MB limit for file uploads
})

// Register plugins
fastify.register(cors, {
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-CSRF-Token",
    "X-File-Name",
    "X-File-Size",
    "X-File-Type",
    "X-Original-Extension",
    "X-Job-ID",
    "X-Processing-Request",
    "X-Upload-Timestamp",
    "X-Binary-Transfer",
    "X-Input-Field-Name",
  ],
})

fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
})

// Import routes
import uploadRoutes from "./routes/upload.js"
import downloadRoutes from "./routes/download.js"
import processingRoutes from "./routes/processing.js"
import csrfRoutes from "./routes/csrf.js"

// Register routes
fastify.register(uploadRoutes, { prefix: "/api" })
fastify.register(downloadRoutes, { prefix: "/api" })
fastify.register(processingRoutes, { prefix: "/api" })
fastify.register(csrfRoutes, { prefix: "/api" })

// Health check route
fastify.get("/health", async () => {
  return { status: "ok", timestamp: new Date().toISOString() }
})

// Start the server
const start = async () => {
  try {
    const port = process.env.PORT || 3001
    await fastify.listen({ port, host: "0.0.0.0" })
    console.log(`Server is running on port ${port}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()

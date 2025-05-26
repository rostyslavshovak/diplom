export default async function (fastify, opts) {
  fastify.get("/csrf", async (request, reply) => {
    try {
      // Return a simple JSON response with a CSRF token
      return {
        csrfToken: process.env.CSRF_TOKEN || "fallback-csrf-token",
      }
    } catch (error) {
      fastify.log.error("Error in CSRF API route:", error)
      return reply.code(500).send({
        error: "Failed to generate CSRF token",
      })
    }
  })

  fastify.options("/csrf", async (request, reply) => {
    // Handle CORS preflight request
    return reply.code(204).send()
  })
}

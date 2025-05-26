import SecureFileUpload from "@/components/secure-file-upload"

// Update the webhook URL definition to use the correct URL format
const WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL || "https://n8n-lab.web-magic.space/webhook/549264d6-e71f-4bf3-b459-1fbc91c3e2d0"

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Secure File Upload System</h1>
        <p className="text-gray-600 mb-8">Upload files for processing (1 min 30 sec) and download the results</p>

        <SecureFileUpload
          endpoint="/api/upload-pure-binary" // Use the pure binary API route
          maxFileSize={10 * 1024 * 1024} // 10MB
          timeout={150000} // 2.5 minutes (to accommodate processing time + buffer)
          csrfToken="fallback-csrf-token" // Provide a fallback token
          authToken="fallback-auth-token" // Provide a fallback token
          forcePreviewMode={false} // Set to false since we have environment variables
          uploadMethod="pure-binary" // Use pure binary upload by default
        />
      </div>
    </main>
  )
}

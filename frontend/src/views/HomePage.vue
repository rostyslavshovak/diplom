<template>
  <main class="min-h-screen p-4 md:p-8 bg-gray-50">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-2xl md:text-3xl font-bold text-gray-800 mb-2">Secure File Upload System</h1>
      <p class="text-gray-600 mb-8">Upload files for processing (1 min 30 sec) and download the results</p>

      <SecureFileUpload
        endpoint="/api/upload-pure-binary"
        :maxFileSize="10 * 1024 * 1024"
        :timeout="150000"
        csrfToken="fallback-csrf-token"
        authToken="fallback-auth-token"
        :forcePreviewMode="false"
        uploadMethod="pure-binary"
      />
    </div>
  </main>
</template>

<script>
import SecureFileUpload from '@/components/SecureFileUpload.vue'

export default {
  name: 'HomePage',
  components: {
    SecureFileUpload
  }
}
</script>

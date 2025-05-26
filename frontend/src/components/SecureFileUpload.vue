<template>
  <div class="bg-white rounded-lg shadow-md p-6">
    <Alert v-if="isPreviewMode" class="mb-4 bg-blue-50 border-blue-200">
      <AlertCircleIcon class="h-4 w-4 text-blue-500 mr-2" />
      <AlertDescription class="text-blue-700">
        Running in preview mode. File processing is simulated and no actual network requests will be made.
      </AlertDescription>
    </Alert>

    <!-- Security Info -->
    <div class="mb-6 flex items-start space-x-3 bg-gray-50 p-4 rounded-md border border-gray-200">
      <ShieldIcon class="h-5 w-5 text-green-600 mt-0.5" />
      <div class="flex-1">
        <h3 class="font-medium text-gray-800 mb-1">Secure Processing</h3>
        <p class="text-sm text-gray-600 mb-2">
          Your files are securely transmitted and processed with the following protections:
        </p>
        <div class="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline" class="bg-gray-100 text-gray-700">
            CSRF Protection
          </Badge>
          <Badge variant="outline" class="bg-gray-100 text-gray-700">
            Authentication
          </Badge>
          <Badge variant="outline" class="bg-gray-100 text-gray-700">
            File Validation
          </Badge>
          <Badge variant="outline" class="bg-gray-100 text-gray-700">
            Binary Integrity
          </Badge>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" @click="toggleSettings" class="text-xs">
            <SettingsIcon class="h-3 w-3 mr-1" />
            {{ showSettings ? "Hide Settings" : "Processing Settings" }}
          </Button>
        </div>
      </div>
    </div>

    <!-- Processing Settings -->
    <div v-if="showSettings" class="mb-6 bg-gray-50 p-4 rounded-md border border-gray-200">
      <h3 class="font-medium text-gray-800 mb-3 flex items-center">
        <SettingsIcon class="h-4 w-4 mr-2" />
        Processing Configuration
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Processing Method</label>
          <select
            v-model="selectedUploadMethod"
            class="w-full p-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="form-data">Form Data (Standard)</option>
            <option value="binary-with-metadata">Binary with Metadata</option>
            <option value="pure-binary">Pure Binary</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">File Description</label>
          <input
            type="text"
            v-model="fileMetadata.description"
            placeholder="Optional file description"
            class="w-full p-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>
      <div class="mt-3 text-xs text-gray-600">
        <div class="flex items-start space-x-2">
          <InfoIcon class="h-3 w-3 mt-0.5 text-blue-500" />
          <div>
            <p>
              <strong>Pure Binary:</strong> Raw binary data transmission (recommended for processing)
            </p>
            <p>
              <strong>Binary with Metadata:</strong> Sends file as base64 with JSON metadata
            </p>
            <p>
              <strong>Form Data:</strong> Standard multipart upload
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- File Selection Section -->
    <div v-if="uploadState === 'idle' || uploadState === 'selected'" class="mb-8">
      <h2 class="text-xl font-semibold mb-4">Select File for Processing</h2>

      <!-- Drag and drop zone -->
      <div
        ref="dropZoneRef"
        @drop="handleDrop"
        @dragover="handleDragOver"
        @click="openFileInput"
        :class="[
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
          file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50',
          'focus:outline-none focus:ring-2 focus:ring-blue-500'
        ]"
        tabindex="0"
        aria-label="Drop zone. Press Enter to browse files."
      >
        <input
          type="file"
          ref="fileInputRef"
          @change="handleFileInputChange"
          class="hidden"
          accept=".pdf,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          aria-label="File input"
        />

        <div v-if="file" class="flex flex-col items-center">
          <div class="flex items-center mb-2">
            <component 
              :is="getFileIconComponent(file.name)" 
              class="h-8 w-8 mr-2" 
              :class="getFileIconColor(file.name)" 
            />
            <span class="font-medium text-gray-800">{{ file.name }}</span>
          </div>
          <span class="text-sm text-gray-500">{{ (file.size / (1024 * 1024)).toFixed(2) }} MB</span>
          <div class="mt-2 text-xs text-gray-600">
            <Badge variant="outline" class="mr-2">
              {{ selectedUploadMethod.replace("-", " ").toUpperCase() }}
            </Badge>
            <span v-if="fileMetadata.description" class="text-gray-500">"{{ fileMetadata.description }}"</span>
          </div>
          <div class="mt-4 flex space-x-3">
            <Button
              @click.stop="processFile"
              class="bg-blue-600 hover:bg-blue-700"
            >
              <SendIcon class="h-4 w-4 mr-2" />
              Process File
            </Button>
            <Button
              variant="outline"
              @click.stop="removeFile"
              class="text-red-500 border-red-300 hover:bg-red-50"
            >
              <XIcon class="h-4 w-4 mr-1" />
              Remove
            </Button>
          </div>
        </div>
        <div v-else class="flex flex-col items-center">
          <UploadIcon class="h-12 w-12 text-gray-400 mb-3" />
          <p class="text-lg font-medium text-gray-700 mb-1">Drag and drop your file here</p>
          <p class="text-sm text-gray-500 mb-4">
            or <span class="text-blue-500 font-medium">browse</span> to choose a file
          </p>
          <div class="text-xs text-gray-500 space-y-1">
            <p>Maximum file size: {{ (maxFileSize / (1024 * 1024)).toFixed(0) }}MB</p>
            <p>Allowed file types: PDF, XLSX</p>
            <p>Processing method: {{ selectedUploadMethod.replace("-", " ") }}</p>
          </div>
        </div>
      </div>

      <!-- Error message -->
      <Alert v-if="error" variant="destructive" class="mt-4">
        <div class="flex items-start">
          <component :is="getErrorIconComponent(error.type)" class="h-5 w-5 mr-2" />
          <AlertDescription>{{ error.message }}</AlertDescription>
        </div>
      </Alert>
    </div>

    <!-- Sending Section (Very Brief) -->
    <div v-if="uploadState === 'sending'" class="mb-8">
      <h2 class="text-xl font-semibold mb-4">Sending File for Processing</h2>

      <div class="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <div class="flex items-center mb-4">
          <component 
            v-if="file" 
            :is="getFileIconComponent(file.name)" 
            class="h-6 w-6 mr-2" 
            :class="getFileIconColor(file.name)" 
          />
          <FileIcon v-else class="h-6 w-6 text-blue-500 mr-2" />
          <div class="flex-1">
            <span class="font-medium text-gray-800">{{ file?.name }}</span>
            <div class="text-xs text-gray-500 mt-1">
              <Badge variant="outline" class="mr-2">
                {{ selectedUploadMethod.replace("-", " ").toUpperCase() }}
              </Badge>
              {{ file ? (file.size / (1024 * 1024)).toFixed(2) : "0" }} MB
            </div>
          </div>
        </div>

        <div class="flex items-center justify-center text-sm text-gray-600 mb-4">
          <div class="flex items-center">
            <Loader2Icon class="h-4 w-4 mr-2 animate-spin text-blue-500" />
            <p>Sending file to processing endpoint...</p>
          </div>
        </div>

        <div class="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-blue-700">
          <p class="flex items-center">
            <InfoIcon class="h-4 w-4 mr-2" />
            File is being sent for immediate processing. This should only take a moment.
          </p>
        </div>
      </div>
    </div>

    <!-- Processing Section -->
    <div v-if="uploadState === 'processing'" class="mb-8">
      <h2 class="text-xl font-semibold mb-4">Processing File</h2>

      <div class="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <div class="flex items-center mb-4">
          <component 
            v-if="file" 
            :is="getFileIconComponent(file.name)" 
            class="h-6 w-6 mr-2" 
            :class="getFileIconColor(file.name)" 
          />
          <FileTextIcon v-else class="h-6 w-6 text-blue-500 mr-2" />
          <div class="flex-1">
            <span class="font-medium text-gray-800">{{ file?.name }}</span>
            <div class="text-xs text-gray-500 mt-1">
              <Badge variant="outline" class="bg-blue-100 text-blue-700 mr-2">
                PROCESSING
              </Badge>
              {{ file ? (file.size / (1024 * 1024)).toFixed(2) : "0" }} MB
              <span v-if="jobId" class="ml-2">Job: {{ jobId.split("_")[1] }}</span>
            </div>
          </div>
        </div>

        <div class="mb-4">
          <div class="flex justify-between mb-1">
            <span class="text-sm font-medium text-gray-700">{{ processingStage || "Processing..." }}</span>
            <span class="text-sm text-gray-500">{{ processingProgress }}%</span>
          </div>
          <Progress :value="processingProgress" class="h-2" />
        </div>

        <div class="flex items-center justify-between text-sm text-gray-600 mb-4">
          <div class="flex items-center">
            <Loader2Icon class="h-4 w-4 mr-2 animate-spin text-blue-500" />
            <p>Your file is being processed at the webhook endpoint</p>
          </div>
          <p>{{ processingTimeRemaining }}</p>
        </div>

        <div class="bg-blue-50 p-3 rounded border border-blue-200 text-sm text-blue-700 mb-4">
          <p class="flex items-center">
            <InfoIcon class="h-4 w-4 mr-2" />
            Processing typically takes about 1 minute 30 seconds. The processed file will be available for download
            immediately upon completion.
          </p>
        </div>

        <div class="flex space-x-3">
          <Button 
            variant="outline" 
            class="text-red-500 border-red-200 hover:bg-red-50" 
            @click="cancelUpload"
          >
            <XIcon class="h-4 w-4 mr-1" />
            Cancel Processing
          </Button>
        </div>
      </div>
    </div>

    <!-- Success Section -->
    <div v-if="uploadState === 'success'" class="mb-8">
      <div class="bg-green-50 rounded-lg p-6 border border-green-200 mb-4">
        <div class="flex items-center mb-4">
          <CheckCircleIcon class="h-6 w-6 text-green-500 mr-2" />
          <h2 class="text-xl font-semibold text-green-800">Processing Complete</h2>
        </div>

        <p class="text-green-700 mb-4">
          Your file has been successfully
          {{ isPreviewMode ? "processed (simulated)" : "processed and is ready for download" }}.
        </p>

        <div class="bg-white rounded-md p-4 border border-gray-200 mb-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center">
              <component 
                :is="getFileIconComponent(responseData?.filename || '')" 
                class="h-5 w-5 mr-3" 
                :class="getFileIconColor(responseData?.filename || '')" 
              />
              <div>
                <span class="font-medium text-gray-800">
                  {{ responseData?.filename || 
                     responseData?.fileMetadata?.fileName || 
                     (file ? `processed-${file.name}` : "processed-file") }}
                </span>
                <p class="text-sm text-gray-500">
                  {{ formatFileSize(responseData?.fileMetadata?.fileSize) ||
                     (file && (file.size / (1024 * 1024)).toFixed(2) + " MB") }}
                  • Processing complete
                </p>
                <div class="text-xs text-gray-500 mt-1">
                  <Badge variant="outline" class="bg-green-100 text-green-700 mr-2">
                    PROCESSED
                  </Badge>
                  <span v-if="responseData?.uploadInfo?.timestamp">
                    Completed: {{ new Date(responseData.uploadInfo.timestamp).toLocaleTimeString() }}
                  </span>
                  <span v-if="jobId" class="ml-2">Job: {{ jobId.split("_")[1] }}</span>
                </div>
              </div>
            </div>

            <Button 
              v-if="downloadUrl" 
              @click="handleDownload" 
              size="sm" 
              class="bg-green-600 hover:bg-green-700"
            >
              <DownloadIcon class="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        <div v-if="responseData?.fileMetadata" class="bg-gray-50 p-3 rounded border border-gray-200 mb-4 text-xs text-gray-700">
          <p class="font-medium text-sm text-gray-800 mb-1">File Information:</p>
          <ul class="space-y-1">
            <li>
              <strong>File Name:</strong> {{ responseData.fileMetadata.fileName || "Not specified" }}
            </li>
            <li>
              <strong>File Type:</strong> {{ responseData.fileMetadata.fileType || "Not specified" }}
            </li>
            <li>
              <strong>File Size:</strong> {{ formatFileSize(responseData.fileMetadata.fileSize) }}
            </li>
            <li v-if="responseData.fileMetadata.fileExtension">
              <strong>File Extension:</strong> {{ responseData.fileMetadata.fileExtension }}
            </li>
          </ul>
        </div>

        <div class="text-sm text-gray-600 space-y-1">
          <p>Processing time: ~{{ PROCESSING_TIME_SECONDS / 60 }} minutes</p>
          <p v-if="responseData?.message">Server message: {{ responseData.message }}</p>
          <p v-if="responseData?.binaryResponse">Response type: Binary data ({{ responseData.contentType }})</p>
        </div>
      </div>

      <Button variant="outline" @click="resetForm" class="w-full sm:w-auto">
        <RefreshCwIcon class="h-4 w-4 mr-2" />
        Process Another File
      </Button>
    </div>

    <!-- Error State -->
    <div v-if="uploadState === 'error' || uploadState === 'cancelled'" class="mb-8">
      <Alert
        :variant="error?.type === 'cancelled' ? 'default' : 'destructive'"
        :class="error?.type === 'cancelled' ? 'mb-4 bg-amber-50 border-amber-200' : 'mb-4'"
      >
        <div class="flex items-start">
          <component v-if="error" :is="getErrorIconComponent(error.type)" class="h-5 w-5 mr-2" />
          <AlertDescription class="ml-2 font-medium">
            {{ error?.message || "An error occurred during processing." }}
          </AlertDescription>
        </div>
      </Alert>

      <div v-if="error?.technical" class="mb-4 p-3 bg-gray-50 rounded border border-gray-200 overflow-auto max-h-40">
        <p class="font-medium text-sm text-gray-800 mb-1">Technical details:</p>
        <pre class="text-xs text-gray-700 whitespace-pre-wrap">{{ error.technical }}</pre>
        <p v-if="error.statusCode" class="text-xs text-gray-700 mt-1">Status code: {{ error.statusCode }}</p>
      </div>

      <div class="bg-gray-50 rounded-lg p-6 border border-gray-200 mb-4">
        <h3 class="font-medium text-gray-800 mb-2">Troubleshooting Tips:</h3>
        <ul class="list-disc list-inside text-sm text-gray-700 space-y-1">
          <template v-if="error?.type === 'network'">
            <li>Check your internet connection</li>
            <li>Ensure you're not behind a restrictive firewall</li>
            <li>Try again in a few moments</li>
          </template>
          <template v-else-if="error?.type === 'server'">
            <li>The server encountered an error processing your request</li>
            <li>Check the server logs for more details</li>
            <li>Verify that the N8N_WEBHOOK_URL environment variable is correctly set</li>
          </template>
          <template v-else-if="error?.type === 'timeout'">
            <li>The server took too long to respond</li>
            <li>Try uploading a smaller file</li>
            <li>Check your network connection speed</li>
          </template>
          <template v-else-if="error?.type === 'size'">
            <li>Your file exceeds the maximum allowed size</li>
            <li>Try compressing the file or splitting it into smaller parts</li>
          </template>
          <template v-else-if="error?.type === 'type'">
            <li>The file type you're trying to upload is not allowed</li>
            <li>Convert your file to one of the supported formats</li>
          </template>
          <template v-else-if="error?.type === 'cancelled'">
            <li>Processing was cancelled by user</li>
            <li>You can restart the process when ready</li>
          </template>
          <template v-else>
            <li>An unexpected error occurred</li>
            <li>Try refreshing the page and processing again</li>
            <li>If the problem persists, contact support</li>
          </template>
          <li v-if="isPreviewMode" class="text-blue-600">
            <strong>Note:</strong> In preview mode, actual processing is simulated.
          </li>
        </ul>
      </div>

      <div class="flex space-x-3">
        <Button
          @click="file ? processFile() : resetForm()"
        >
          <RefreshCwIcon class="h-4 w-4 mr-2" />
          {{ file ? "Retry Processing" : "Start Over" }}
        </Button>

        <Button variant="outline" @click="resetForm">
          {{ file ? "Select Different File" : "Reset" }}
        </Button>
      </div>
    </div>

    <!-- File Requirements -->
    <div class="border-t border-gray-200 pt-6 mt-6">
      <h3 class="font-medium text-gray-800 mb-3 flex items-center">
        <FileLockIcon class="h-4 w-4 mr-2 text-gray-600" />
        File Processing Requirements & Information
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-gray-50 p-3 rounded border border-gray-200">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Allowed File Types</h4>
          <ul class="text-xs text-gray-600 space-y-1">
            <li>• PDF Documents (.pdf)</li>
            <li>• Excel Spreadsheets (.xlsx)</li>
          </ul>
        </div>
        <div class="bg-gray-50 p-3 rounded border border-gray-200">
          <h4 class="text-sm font-medium text-gray-700 mb-2">Processing Information</h4>
          <ul class="text-xs text-gray-600 space-y-1">
            <li>• Maximum file size: {{ (maxFileSize / (1024 * 1024)).toFixed(0) }}MB</li>
            <li>• Processing time: ~1 minute 30 seconds</li>
            <li>• Binary data preservation guaranteed</li>
            <li>• Download available immediately after processing</li>
          </ul>
        </div>
      </div>
      <div class="mt-4 text-xs text-gray-500">
        <p class="flex items-center">
          <InfoIcon class="h-3 w-3 mr-1" />
          Current processing method: <strong class="ml-1">{{ selectedUploadMethod.replace("-", " ") }}</strong>
          {{ isPreviewMode ? " (Preview Mode - Simulated)" : "" }}
        </p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import {
  FileIcon, UploadIcon, XIcon, AlertCircleIcon, CheckCircleIcon, RefreshCwIcon,
  ShieldIcon, AlertTriangleIcon, ClockIcon, FileTypeIcon, FileLockIcon, NetworkIcon,
  DownloadIcon, SettingsIcon, InfoIcon, Loader2Icon, FileTextIcon, FileSpreadsheetIcon,
  SendIcon
} from 'lucide-vue-next'
import Alert from './ui/Alert.vue'
import AlertDescription from './ui/AlertDescription.vue'
import Badge from './ui/Badge.vue'
import Button from './ui/Button.vue'
import Progress from './ui/Progress.vue'

// Constants
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
]

const ALLOWED_FILE_EXTENSIONS = [".pdf", ".xlsx"]
const PROCESSING_TIME_SECONDS = 90 // 1 minute 30 seconds processing time

export default {
  name: 'SecureFileUpload',
  components: {
    Alert,
    AlertDescription,
    Badge,
    Button,
    Progress,
    FileIcon,
    UploadIcon,
    XIcon,
    AlertCircleIcon,
    CheckCircleIcon,
    RefreshCwIcon,
    ShieldIcon,
    AlertTriangleIcon,
    ClockIcon,
    FileTypeIcon,
    FileLockIcon,
    NetworkIcon,
    DownloadIcon,
    SettingsIcon,
    InfoIcon,
    Loader2Icon,
    FileTextIcon,
    FileSpreadsheetIcon,
    SendIcon
  },
  props: {
    endpoint: {
      type: String,
      required: true
    },
    maxFileSize: {
      type: Number,
      default: 10 * 1024 * 1024 // 10MB default
    },
    timeout: {
      type: Number,
      default: 180000 // 3 minutes default
    },
    csrfToken: {
      type: String,
      default: undefined
    },
    authToken: {
      type: String,
      default: undefined
    },
    forcePreviewMode: {
      type: Boolean,
      default: false
    },
    uploadMethod: {
      type: String,
      default: 'pure-binary',
      validator: (value) => ['binary-with-metadata', 'pure-binary', 'form-data'].includes(value)
    }
  },
  setup(props) {
    // State
    const file = ref(null)
    const uploadState = ref('idle')
    const processingProgress = ref(0)
    const processingStage = ref('')
    const processingTimeRemaining = ref('')
    const error = ref(null)
    const isPreviewMode = ref(false)
    const responseData = ref(null)
    const downloadUrl = ref(null)
    const showSettings = ref(false)
    const uploadAbortController = ref(null)
    const csrfToken = ref(props.csrfToken)
    const authToken = ref(props.authToken)
    const selectedUploadMethod = ref(props.uploadMethod)
    const fileMetadata = ref({})
    const processingStartTime = ref(null)
    const jobId = ref(null)

    // Refs
    const fileInputRef = ref(null)
    const dropZoneRef = ref(null)
    const processingIntervalRef = ref(null)
    const timeoutIdRef = ref(null)
    const pollIntervalRef = ref(null)

    // Check if we're in preview mode
    onMounted(() => {
      if (props.forcePreviewMode) {
        isPreviewMode.value = true
        return
      }

      const isPreview =
        process.env.NODE_ENV === "development" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.includes("v0.dev") ||
        window.location.hostname.includes("preview.app.github.dev")

      isPreviewMode.value = isPreview

      // Handle keyboard navigation for the drop zone
      const handleKeyDown = (e) => {
        if (dropZoneRef.value === document.activeElement) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            fileInputRef.value?.click()
          }
        }
      }

      if (dropZoneRef.value) {
        dropZoneRef.value.addEventListener("keydown", handleKeyDown)
      }
    })

    // Clean up on unmount
    onBeforeUnmount(() => {
      if (uploadAbortController.value) {
        uploadAbortController.value.abort()
      }

      if (processingIntervalRef.value) {
        clearInterval(processingIntervalRef.value)
      }

      if (pollIntervalRef.value) {
        clearInterval(pollIntervalRef.value)
      }

      if (timeoutIdRef.value) {
        clearTimeout(timeoutIdRef.value)
      }

      if (downloadUrl.value && downloadUrl.value.startsWith("blob:")) {
        URL.revokeObjectURL(downloadUrl.value)
      }

      // Remove event listeners
      if (dropZoneRef.value) {
        const handleKeyDown = (e) => {
          if (dropZoneRef.value === document.activeElement) {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              fileInputRef.value?.click()
            }
          }
        }
        dropZoneRef.value.removeEventListener("keydown", handleKeyDown)
      }
    })

    // Reset the form to initial state
    const resetForm = () => {
      file.value = null
      uploadState.value = 'idle'
      processingProgress.value = 0
      processingStage.value = ''
      processingTimeRemaining.value = ''
      error.value = null
      responseData.value = null
      downloadUrl.value = null
      fileMetadata.value = {}
      processingStartTime.value = null
      jobId.value = null

      // Cancel any ongoing upload
      if (uploadAbortController.value) {
        uploadAbortController.value.abort()
        uploadAbortController.value = null
      }

      // Clear any intervals
      if (processingIntervalRef.value) {
        clearInterval(processingIntervalRef.value)
        processingIntervalRef.value = null
      }

      if (pollIntervalRef.value) {
        clearInterval(pollIntervalRef.value)
        pollIntervalRef.value = null
      }
    }

    // Validate file type and extension
    const validateFileType = (file) => {
      const fileExtension = `.${file.name.split(".").pop()?.toLowerCase()}`
      const fileType = file.type.toLowerCase()

      const isValidType = ALLOWED_FILE_TYPES.includes(fileType)
      const isValidExtension = ALLOWED_FILE_EXTENSIONS.includes(fileExtension)

      return isValidType && isValidExtension
    }

    // Handle file selection
    const handleFileSelect = (selectedFile) => {
      error.value = null

      if (!selectedFile) {
        return
      }

      // Validate file size
      if (selectedFile.size > props.maxFileSize) {
        error.value = {
          type: "size",
          message: `File size exceeds the limit of ${(props.maxFileSize / (1024 * 1024)).toFixed(0)}MB. Your file is ${(selectedFile.size / (1024 * 1024)).toFixed(2)}MB.`,
          technical: `File size: ${selectedFile.size} bytes, Max allowed: ${props.maxFileSize} bytes`,
        }
        return
      }

      // Validate file type
      if (!validateFileType(selectedFile)) {
        error.value = {
          type: "type",
          message: "Invalid file type. Please select a file with an allowed format.",
          technical: `File type: ${selectedFile.type}, Extension: .${selectedFile.name.split(".").pop()}`,
        }
        return
      }

      file.value = selectedFile
      uploadState.value = 'selected'

      // Auto-populate some metadata
      fileMetadata.value = {
        category: selectedFile.type.includes("pdf") ? "document" : "spreadsheet",
        source: "user-upload",
        uploadTimestamp: new Date().toISOString(),
      }
    }

    // Handle file input change
    const handleFileInputChange = (e) => {
      const selectedFile = e.target.files ? e.target.files[0] : null
      handleFileSelect(selectedFile)
    }

    // Open file input
    const openFileInput = () => {
      fileInputRef.value?.click()
    }

    // Handle drag and drop
    const handleDrop = (e) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0])
      }
    }

    const handleDragOver = (e) => {
      e.preventDefault()
      e.stopPropagation()
    }

    // Remove file
    const removeFile = (e) => {
      e.stopPropagation()
      file.value = null
      fileMetadata.value = {}
    }

    // Toggle settings
    const toggleSettings = () => {
      showSettings.value = !showSettings.value
    }

    // Update processing time remaining
    const updateProcessingTimeRemaining = () => {
      if (!processingStartTime.value) return

      const currentTime = Date.now()
      const elapsedSeconds = (currentTime - processingStartTime.value) / 1000
      const remainingSeconds = Math.max(0, PROCESSING_TIME_SECONDS - elapsedSeconds)

      // Calculate progress percentage
      const progressPercentage = Math.min(100, (elapsedSeconds / PROCESSING_TIME_SECONDS) * 100)
      processingProgress.value = Math.floor(progressPercentage)

      if (remainingSeconds <= 0) {
        processingTimeRemaining.value = "Completing..."
        return
      }

      if (remainingSeconds < 60) {
        processingTimeRemaining.value = `${Math.ceil(remainingSeconds)} seconds remaining`
      } else {
        processingTimeRemaining.value = `${Math.ceil(remainingSeconds / 60)} minutes remaining`
      }
    }

    // Simulate processing for preview mode
    const simulateProcessing = () => {
      if (!file.value) return

      uploadState.value = 'processing'
      processingStartTime.value = Date.now()
      processingProgress.value = 0
      processingStage.value = "Initializing processing"

      // Simulate processing with dynamic progress
      const processingInterval = setInterval(() => {
        updateProcessingTimeRemaining()

        // Check if processing is complete
        const elapsedSeconds = (Date.now() - (processingStartTime.value || Date.now())) / 1000
        if (elapsedSeconds >= PROCESSING_TIME_SECONDS) {
          clearInterval(processingInterval)

          // Simulate file metadata
          let simulatedFileMetadata = {}

          if (file.value.name.toLowerCase().endsWith(".xlsx")) {
            simulatedFileMetadata = {
              fileName: file.value.name,
              fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              fileSize: file.value.size,
              fileExtension: ".xlsx",
            }
          } else if (file.value.name.toLowerCase().endsWith(".pdf")) {
            simulatedFileMetadata = {
              fileName: file.value.name,
              fileType: "application/pdf",
              fileSize: file.value.size,
              fileExtension: ".pdf",
            }
          }

          // Create a blob URL for download simulation
          const simulatedFileContent = `Processed file: ${file.value.name}\nProcessed at: ${new Date().toISOString()}\nOriginal size: ${file.value.size} bytes`

          // Create realistic binary content
          let blob
          if (file.value.name.toLowerCase().endsWith(".xlsx")) {
            const header = new Uint8Array([0x50, 0x4b, 0x03, 0x04]) // XLSX file signature
            const content = new TextEncoder().encode(simulatedFileContent)
            const combined = new Uint8Array(header.length + content.length)
            combined.set(header)
            combined.set(content, header.length)
            blob = new Blob([combined], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
          } else if (file.value.name.toLowerCase().endsWith(".pdf")) {
            const pdfHeader = `%PDF-1.4
1 0 obj
<</Type /Catalog /Pages 2 0 R>>
endobj
2 0 obj
<</Type /Pages /Kids [3 0 R] /Count 1>>
endobj
3 0 obj
<</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R>>
endobj
4 0 obj
<</Length 100>>
stream
BT
/F1 12 Tf
100 700 Td
(Processed File: ${file.value.name}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000102 00000 n
0000000169 00000 n
trailer
<</Size 5 /Root 1 0 R>>
startxref
269
%%EOF`
            blob = new Blob([pdfHeader], { type: "application/pdf" })
          } else {
            blob = new Blob([simulatedFileContent], { type: "text/plain" })
          }

          const blobUrl = URL.createObjectURL(blob)

          // Simulate success after processing
          responseData.value = {
            success: true,
            message: "File processed successfully (simulation)",
            downloadUrl: blobUrl,
            binaryResponse: true,
            contentType: file.value.name.toLowerCase().endsWith(".xlsx")
              ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              : file.value.name.toLowerCase().endsWith(".pdf")
                ? "application/pdf"
                : "text/plain",
            filename: file.value.name,
            fileMetadata: simulatedFileMetadata,
            uploadInfo: {
              fileName: file.value.name,
              fileSize: file.value.size,
              fileType: file.value.type,
              uploadMethod: selectedUploadMethod.value,
              timestamp: new Date().toISOString(),
            },
          }
          downloadUrl.value = blobUrl
          uploadState.value = 'success'
        }
      }, 1000)

      processingIntervalRef.value = processingInterval
    }

    // Cancel the upload/processing
    const cancelUpload = () => {
      if (uploadAbortController.value) {
        uploadAbortController.value.abort()
        uploadAbortController.value = null
      }

      uploadState.value = 'cancelled'
      error.value = {
        type: "cancelled",
        message: "Process cancelled by user.",
        technical: "User initiated abort of upload/processing request",
      }

      if (processingIntervalRef.value) {
        clearInterval(processingIntervalRef.value)
        processingIntervalRef.value = null
      }

      if (pollIntervalRef.value) {
        clearInterval(pollIntervalRef.value)
        pollIntervalRef.value = null
      }
    }

    // Enhanced direct binary download function
    const handleDirectBinaryDownload = async (url, filename, contentType) => {
      try {
        console.log("Starting direct binary download:", { url, filename, contentType })

        // Set download state to loading
        error.value = null

        // Fetch the binary data with appropriate headers
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "*/*", // Accept any content type
            "X-Request-Type": "processed-file-download",
            "X-Original-Filename": filename,
            "X-Job-ID": jobId.value || "",
            "X-Binary-Transfer": "true", // Signal that we expect binary data
            "X-Input-Field-Name": "file", // Match the n8n input field name
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
        }

        // Log all response headers for debugging
        console.log("Download response headers:", Object.fromEntries(response.headers.entries()))

        // Check content type from response
        const actualContentType = response.headers.get("Content-Type") || contentType

        // Check for Content-Disposition header which might contain the filename
        const contentDisposition = response.headers.get("Content-Disposition") || ""
        let actualFilename = filename

        // Try to extract filename from Content-Disposition header
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
        if (filenameMatch && filenameMatch[1]) {
          actualFilename = filenameMatch[1].replace(/['"]/g, "")
        }

        // Get the binary data as an ArrayBuffer
        const arrayBuffer = await response.arrayBuffer()

        if (arrayBuffer.byteLength === 0) {
          throw new Error("Received empty binary data")
        }

        console.log(`Received binary data: ${arrayBuffer.byteLength} bytes`)

        // Create a blob with the correct content type
        const blob = new Blob([arrayBuffer], { type: actualContentType })

        // Create a blob URL
        const blobUrl = URL.createObjectURL(blob)

        // Create a download link
        const a = document.createElement("a")
        a.href = blobUrl
        a.download = actualFilename
        a.style.display = "none"

        // Add to document, click, and remove
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)

        // Clean up the blob URL
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl)
        }, 100)

        return true
      } catch (error) {
        console.error("Error downloading binary file:", error)
        error.value = {
          type: "network",
          message: "Failed to download the processed file. Please try again.",
          technical: error.message || String(error),
        }
        return false
      }
    }

    // Update the handleDownload function to handle binary downloads better
    const handleDownload = async () => {
      if (!downloadUrl.value) {
        console.warn("No download URL available.")
        return
      }

      if (responseData.value?.binaryResponse && responseData.value?.filename && responseData.value?.contentType) {
        // Attempt direct binary download
        const success = await handleDirectBinaryDownload(
          downloadUrl.value, 
          responseData.value.filename, 
          responseData.value.contentType
        )
        if (success) return
      }

      // Fallback to opening the URL in a new tab
      window.open(downloadUrl.value, "_blank")
    }

    // Poll for processing status
    const pollProcessingStatus = async (currentJobId) => {
      if (!currentJobId) return

      try {
        const response = await fetch(`/api/processing-status?jobId=${currentJobId}`)
        if (!response.ok) {
          throw new Error(`Failed to get processing status: ${response.status}`)
        }

        const data = await response.json()

        // Update processing stage and progress
        if (data.processingStage) {
          processingStage.value = data.processingStage
        }

        if (data.progress !== undefined) {
          processingProgress.value = data.progress
        }

        if (data.remainingTime !== undefined) {
          const remaining = data.remainingTime
          if (remaining <= 0) {
            processingTimeRemaining.value = "Completing..."
          } else if (remaining < 60) {
            processingTimeRemaining.value = `${Math.ceil(remaining)} seconds remaining`
          } else {
            processingTimeRemaining.value = `${Math.ceil(remaining / 60)} minutes remaining`
          }
        }

        if (data.status === "completed") {
          // Processing is complete
          clearInterval(pollIntervalRef.value)
          pollIntervalRef.value = null

          // Store file metadata if available
          if (data.fileMetadata) {
            fileMetadata.value = data.fileMetadata
          }

          // Set download URL if available
          if (data.downloadUrl) {
            downloadUrl.value = data.downloadUrl

            // Prepare response data
            responseData.value = {
              success: true,
              message: "File processed successfully",
              downloadUrl: data.downloadUrl,
              binaryResponse: true,
              contentType: data.fileMetadata?.fileType || "application/octet-stream",
              filename: data.fileMetadata?.fileName || (file.value ? file.value.name : "processed-file"),
              fileMetadata: data.fileMetadata,
              uploadInfo: {
                fileName: file.value?.name || "unknown",
                fileSize: file.value?.size || 0,
                fileType: file.value?.type || "unknown",
                uploadMethod: selectedUploadMethod.value,
                timestamp: new Date().toISOString(),
              },
            }

            uploadState.value = 'success'
          } else {
            // No download URL provided
            error.value = {
              type: "server",
              message: "Processing completed but no download URL was provided.",
              technical: "Missing downloadUrl in processing status response",
            }
            uploadState.value = 'error'
          }
        } else if (data.status === "failed") {
          clearInterval(pollIntervalRef.value)
          pollIntervalRef.value = null

          error.value = {
            type: "server",
            message: "Processing failed. Please try again.",
            technical: data.error || "Unknown processing error",
          }
          uploadState.value = 'error'
        }
      } catch (error) {
        console.error("Error polling for processing status:", error)
        // Don't stop polling on temporary errors
      }
    }

    // Send file for processing (no upload delay)
    const sendFileForProcessing = async () => {
      if (!file.value) throw new Error("No file selected")

      console.log(`Sending file for immediate processing with method: ${selectedUploadMethod.value}`)

      // Create FormData with the file
      const formData = new FormData()
      formData.append("file", file.value)
      formData.append("filename", file.value.name)
      formData.append("filesize", file.value.size.toString())
      formData.append("filetype", file.value.type)

      // Add metadata if available
      if (Object.keys(fileMetadata.value).length > 0) {
        formData.append("metadata", JSON.stringify(fileMetadata.value))
      }

      // Create a new AbortController for this request
      const controller = new AbortController()
      uploadAbortController.value = controller

      // Set up timeout for the entire process
      const totalTimeout = props.timeout + PROCESSING_TIME_SECONDS * 1000
      const timeoutId = setTimeout(() => {
        console.log(`Total process timed out after ${totalTimeout}ms`)
        controller.abort()
      }, totalTimeout)

      timeoutIdRef.value = timeoutId

      try {
        // Set state to sending (very brief)
        uploadState.value = 'sending'
        error.value = null
        responseData.value = null
        downloadUrl.value = null

        // Determine the API endpoint based on upload method
        let apiEndpoint = "/api/upload-native"
        if (selectedUploadMethod.value === "binary-with-metadata") {
          apiEndpoint = "/api/upload-binary-with-metadata"
        } else if (selectedUploadMethod.value === "pure-binary") {
          apiEndpoint = "/api/upload-pure-binary"
        }

        console.log("Sending file to:", apiEndpoint)
        console.log("File details:", {
          name: file.value.name,
          type: file.value.type,
          size: `${(file.value.size / (1024 * 1024)).toFixed(2)} MB`,
          method: selectedUploadMethod.value,
        })

        // Send the file immediately for processing
        const response = await fetch(apiEndpoint, {
          method: "POST",
          body: formData,
          signal: controller.signal,
          headers: {
            "X-CSRF-Token": csrfToken.value || "",
            Authorization: `Bearer ${authToken.value || ""}`,
            "X-Upload-Method": selectedUploadMethod.value,
          },
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
          throw new Error(`Server responded with status: ${response.status} - ${errorData.error || response.statusText}`)
        }

        // Get the response data
        const responseDataJson = await response.json()

        // File sent successfully, now processing
        if (responseDataJson.jobId) {
          jobId.value = responseDataJson.jobId
          uploadState.value = 'processing'
          processingStartTime.value = Date.now()
          processingProgress.value = 0
          processingStage.value = "Processing started"

          console.log("File sent for processing, job ID:", responseDataJson.jobId)

          // Start polling for processing status immediately
          const pollInterval = setInterval(() => {
            pollProcessingStatus(responseDataJson.jobId)
          }, 2000) // Poll every 2 seconds

          pollIntervalRef.value = pollInterval

          // Also start local progress tracking
          const processingInterval = setInterval(() => {
            updateProcessingTimeRemaining()
          }, 1000)

          processingIntervalRef.value = processingInterval
        } else {
          // No processing needed, handle direct response
          if (responseDataJson.downloadUrl) {
            downloadUrl.value = responseDataJson.downloadUrl
            responseData.value = responseDataJson
            uploadState.value = 'success'
          } else {
            throw new Error("No job ID or download URL provided in the response")
          }
        }
      } catch (error) {
        // Clear intervals
        if (processingIntervalRef.value) {
          clearInterval(processingIntervalRef.value)
          processingIntervalRef.value = null
        }

        console.error("Send file failed:", error)

        // Handle different error types
        if (error.name === "AbortError") {
          if (Date.now() - (processingStartTime.value || Date.now()) >= totalTimeout) {
            error.value = {
              type: "timeout",
              message: `Process timed out after ${totalTimeout / 1000} seconds.`,
              technical: `Timeout exceeded: ${totalTimeout}ms`,
            }
            uploadState.value = 'error'
          } else {
            error.value = {
              type: "cancelled",
              message: "Process cancelled by user.",
              technical: "User initiated abort of request",
            }
            uploadState.value = 'cancelled'
          }
        } else if (error.message && error.message.includes("status: 500")) {
          error.value = {
            type: "server",
            message: "The server encountered an internal error. Please check the logs and try again.",
            technical: `Server error: ${error.message}`,
            statusCode: 500,
          }
          uploadState.value = 'error'
        } else {
          error.value = {
            type: "network",
            message: "Network error occurred. Please check your connection and try again.",
            technical: `Request error: ${error.message}`,
          }
          uploadState.value = 'error'
        }
      } finally {
        // Clear the timeout
        if (timeoutIdRef.value) {
          clearTimeout(timeoutIdRef.value)
          timeoutIdRef.value = null
        }

        // Clear the abort controller
        uploadAbortController.value = null
      }
    }

    // Process the file
    const processFile = async () => {
      if (!file.value) return

      if (isPreviewMode.value) {
        simulateProcessing()
        return
      }

      try {
        await sendFileForProcessing()
      } catch (error) {
        console.error("Process error:", error)
        error.value = {
          type: "unknown",
          message: "An unexpected error occurred. Please try again.",
          technical: error.message || String(error),
        }
        uploadState.value = 'error'
      }
    }

    // Format file size for display
    const formatFileSize = (size) => {
      if (size === undefined) return "Unknown size"

      const numSize = typeof size === "string" ? Number.parseInt(size, 10) : size

      if (isNaN(numSize)) return size

      if (numSize < 1024) return `${numSize} B`
      if (numSize < 1024 * 1024) return `${(numSize / 1024).toFixed(1)} KB`
      return `${(numSize / (1024 * 1024)).toFixed(2)} MB`
    }

    // Get file icon component based on file type
    const getFileIconComponent = (filename) => {
      if (filename.toLowerCase().endsWith(".xlsx")) {
        return FileSpreadsheetIcon
      } else if (filename.toLowerCase().endsWith(".pdf")) {
        return FileTextIcon
      } else {
        return FileIcon
      }
    }

    // Get file icon color based on file type
    const getFileIconColor = (filename) => {
      if (filename.toLowerCase().endsWith(".xlsx")) {
        return "text-green-500"
      } else if (filename.toLowerCase().endsWith(".pdf")) {
        return "text-red-500"
      } else {
        return "text-blue-500"
      }
    }

    // Get error icon based on error type
    const getErrorIconComponent = (type) => {
      switch (type) {
        case "network":
          return NetworkIcon
        case "server":
          return AlertCircleIcon
        case "timeout":
          return ClockIcon
        case "size":
          return FileIcon
        case "type":
          return FileTypeIcon
        case "cancelled":
          return XIcon
        default:
          return AlertTriangleIcon
      }
    }

    return {
      // State
      file,
      uploadState,
      processingProgress,
      processingStage,
      processingTimeRemaining,
      error,
      isPreviewMode,
      responseData,
      downloadUrl,
      showSettings,
      selectedUploadMethod,
      fileMetadata,
      jobId,
      PROCESSING_TIME_SECONDS,

      // Refs
      fileInputRef,
      dropZoneRef,

      // Methods
      resetForm,
      handleFileSelect,
      handleFileInputChange,
      openFileInput,
      handleDrop,
      handleDragOver,
      removeFile,
      toggleSettings,
      processFile,
      cancelUpload,
      handleDownload,
      formatFileSize,
      getFileIconComponent,
      getFileIconColor,
      getErrorIconComponent
    }
  }
}
</script>

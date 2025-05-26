"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircleIcon, AlertCircleIcon, RefreshCwIcon, NetworkIcon } from "lucide-react"

interface WebhookTesterProps {
  webhookUrl: string
  timeout?: number
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}

type RequestStatus = "idle" | "loading" | "success" | "error"

export default function WebhookTester({ webhookUrl, timeout = 10000, onSuccess, onError }: WebhookTesterProps) {
  const [status, setStatus] = useState<RequestStatus>("idle")
  const [responseData, setResponseData] = useState<any>(null)
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [statusCode, setStatusCode] = useState<number | null>(null)
  const [responseTime, setResponseTime] = useState<number | null>(null)

  const testWebhook = useCallback(async () => {
    setStatus("loading")
    setResponseData(null)
    setErrorMessage("")
    setStatusCode(null)
    setResponseTime(null)

    const startTime = Date.now()

    try {
      // Create AbortController for timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      console.log("Testing webhook connection to:", webhookUrl)

      // Make the GET request
      const response = await fetch(webhookUrl, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "X-Requested-With": "XMLHttpRequest",
          "Cache-Control": "no-cache",
        },
        signal: controller.signal,
      })

      // Clear the timeout
      clearTimeout(timeoutId)

      // Calculate response time
      const endTime = Date.now()
      setResponseTime(endTime - startTime)

      // Set status code
      setStatusCode(response.status)

      // Check if response is ok (status in the range 200-299)
      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status} ${response.statusText}`)
      }

      // Try to parse response based on content type
      let data
      const contentType = response.headers.get("content-type") || ""

      // Get the response text first
      const responseText = await response.text()

      // Check if the response is empty
      if (!responseText || responseText.trim() === "") {
        data = { message: "Empty response received from server" }
      }
      // Try to parse as JSON if the content type suggests JSON or if it looks like JSON
      else if (
        contentType.includes("application/json") ||
        responseText.trim().startsWith("{") ||
        responseText.trim().startsWith("[")
      ) {
        try {
          data = JSON.parse(responseText)
        } catch (e) {
          // If JSON parsing fails, use the raw text
          console.warn("Failed to parse response as JSON:", e)
          data = {
            rawResponse: responseText,
            parseError: "Response could not be parsed as JSON despite content type",
          }
        }
      } else {
        // For non-JSON responses, just use the text
        data = { rawResponse: responseText }
      }

      // Set response data
      setResponseData(data)
      setStatus("success")

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess(data)
      }
    } catch (error: any) {
      // Calculate response time even for errors
      const endTime = Date.now()
      setResponseTime(endTime - startTime)

      // Handle different error types
      if (error.name === "AbortError") {
        setErrorMessage(`Request timed out after ${timeout / 1000} seconds`)
      } else if (error.name === "TypeError" && error.message.includes("Failed to fetch")) {
        setErrorMessage("Network error: Unable to connect to the server. The server might be down or unreachable.")
      } else if (error.message.includes("JSON.parse")) {
        setErrorMessage(`Invalid JSON response: ${error.message}`)
      } else if (error.message.includes("404")) {
        setErrorMessage("The webhook endpoint was not found (404). Please verify the webhook URL is correct.")
      } else {
        setErrorMessage(error.message || "An unknown error occurred")
      }

      setStatus("error")

      // Call onError callback if provided
      if (onError) {
        onError(error)
      }
    }
  }, [webhookUrl, timeout, onSuccess, onError])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Webhook Connection Test</h3>
        <Button
          onClick={testWebhook}
          disabled={status === "loading"}
          variant={status === "success" ? "outline" : "default"}
          className={status === "success" ? "border-green-500 text-green-600" : ""}
        >
          {status === "loading" ? (
            <>
              <RefreshCwIcon className="h-4 w-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : status === "success" ? (
            <>
              <CheckCircleIcon className="h-4 w-4 mr-2" />
              Test Again
            </>
          ) : (
            <>
              <NetworkIcon className="h-4 w-4 mr-2" />
              Test Connection
            </>
          )}
        </Button>
      </div>

      {status === "success" && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
          <AlertDescription className="text-green-700">
            Connection successful! Response received in {responseTime}ms with status code {statusCode}.
          </AlertDescription>
        </Alert>
      )}

      {status === "error" && (
        <Alert variant="destructive">
          <AlertCircleIcon className="h-4 w-4 mr-2" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {(status === "success" || status === "error") && responseData && (
        <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200 overflow-auto max-h-60">
          <p className="font-medium text-sm text-gray-800 mb-1">Response Details:</p>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap">
            {typeof responseData === "string" ? responseData : JSON.stringify(responseData, null, 2)}
          </pre>
          {statusCode && <p className="text-xs text-gray-700 mt-2">Status code: {statusCode}</p>}
          {responseTime && <p className="text-xs text-gray-700">Response time: {responseTime}ms</p>}
        </div>
      )}
    </div>
  )
}

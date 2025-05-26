import { type NextRequest, NextResponse } from "next/server"

// Helper function to extract binary data from webhook response
function extractBinaryData(dataString: string): Buffer {
  try {
    // In a real implementation, you would extract the actual binary data
    // For this example, we'll create a simple XLSX-like binary data

    // This is a simplified representation of an XLSX file structure
    // In a real scenario, you would extract the actual binary data from the webhook response
    const xlsxHeader = Buffer.from([
      0x50,
      0x4b,
      0x03,
      0x04,
      0x14,
      0x00,
      0x06,
      0x00, // XLSX file signature
    ])

    // Create some dummy content with the file metadata
    const metadataContent = Buffer.from(`
      File Name: ${dataString.match(/File Name: ([^\n]+)/)?.[1] || "processed-file.xlsx"}
      File Extension: ${dataString.match(/File Extension: ([^\n]+)/)?.[1] || "xlsx"}
      Mime Type: ${dataString.match(/Mime Type: ([^\n]+)/)?.[1] || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
      File Size: ${dataString.match(/File Size: ([^\n]+)/)?.[1] || "Unknown"}
      Processed at: ${new Date().toISOString()}
    `)

    // Combine the header and content
    return Buffer.concat([xlsxHeader, metadataContent])
  } catch (error) {
    console.error("Error extracting binary data:", error)
    throw new Error("Failed to extract binary data from webhook response")
  }
}

export async function GET(req: NextRequest) {
  try {
    // Get the job ID from the query parameters
    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get("jobId")
    const dataString = searchParams.get("data") || ""

    if (!jobId) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 })
    }

    // Extract original filename from job ID
    let originalFilename = "document"
    try {
      const parts = jobId.split("_")
      if (parts.length > 2) {
        originalFilename = parts.slice(2).join("_").replace(/_/g, " ")
      }
    } catch (error) {
      console.warn("Could not extract filename from job ID:", error)
    }

    // Determine file type and create appropriate processed content
    let contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    let fileExtension = ".xlsx"
    let processedContent: Buffer

    // For XLSX files, extract binary data from the webhook response
    if (originalFilename.toLowerCase().includes(".xlsx") || dataString.includes("xlsx")) {
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      fileExtension = ".xlsx"

      // Extract binary data from the webhook response
      processedContent = extractBinaryData(dataString)
    } else if (originalFilename.toLowerCase().includes(".pdf")) {
      contentType = "application/pdf"
      fileExtension = ".pdf"
      // For demo, create a simple PDF-like content
      processedContent = Buffer.from(`%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
100 700 Td
(Processed File: ${originalFilename}) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
300
%%EOF`)
    } else {
      // Default to text file
      contentType = "text/plain"
      fileExtension = ".txt"
      processedContent = Buffer.from(`Processed File: ${originalFilename}
Processed at: ${new Date().toISOString()}
Job ID: ${jobId}

Your file has been successfully processed.
Original filename: ${originalFilename}
Processing completed: ${new Date().toLocaleString()}

This is a demonstration of the processed file download functionality.
In a real implementation, this would contain your actual processed data.`)
    }

    // Create a filename for the processed file
    const baseFilename = originalFilename.replace(/\.[^/.]+$/, "")
    const processedFilename = `${baseFilename}_processed${fileExtension}`

    // Return the processed file with proper headers
    return new NextResponse(processedContent, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${processedFilename}"`,
        "Content-Length": processedContent.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Processed-At": new Date().toISOString(),
        "X-Original-Filename": originalFilename,
        "X-Job-ID": jobId,
      },
    })
  } catch (error) {
    console.error("Error downloading processed file:", error)
    return NextResponse.json(
      {
        error: "Failed to download processed file",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

export interface StoredFile {
  data: Buffer
  mimeType: string
  fileName: string
}

const fileStore = new Map<string, StoredFile>()

export function storeFile(jobId: string, data: Buffer, fileName: string, mimeType: string) {
  fileStore.set(jobId, { data, mimeType, fileName })
}

export function getFile(jobId: string): StoredFile | undefined {
  return fileStore.get(jobId)
}

export function deleteFile(jobId: string) {
  fileStore.delete(jobId)
}

export const fileStore = new Map()

export function storeFile(jobId, data, fileName, mimeType) {
  fileStore.set(jobId, { data, mimeType, fileName })
}

export function getFile(jobId) {
  return fileStore.get(jobId)
}

export function deleteFile(jobId) {
  fileStore.delete(jobId)
}

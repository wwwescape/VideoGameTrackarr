// Axios upload-progress config for a multipart upload: calls onProgress with 0..1 as the
// file goes up (ROMs, guides).
export function progressHandler(onProgress?: (fraction: number) => void) {
  return {
    onUploadProgress: (event: { loaded: number; total?: number }) => {
      if (onProgress && event.total) {
        onProgress(event.loaded / event.total);
      }
    },
  };
}

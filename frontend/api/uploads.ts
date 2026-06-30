import { apiClient } from "./client";

export interface UploadResult {
  url: string;
}

export async function uploadCover(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<UploadResult>("/api/uploads/covers", formData);
  return response.data;
}

export async function uploadAccessoryImage(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await apiClient.post<UploadResult>("/api/uploads/accessory-images", formData);
  return response.data;
}

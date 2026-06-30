import { useMutation } from "@tanstack/react-query";
import { uploadAccessoryImage, uploadCover } from "../api/uploads";

export function useUploadCover() {
  return useMutation({ mutationFn: uploadCover });
}

export function useUploadAccessoryImage() {
  return useMutation({ mutationFn: uploadAccessoryImage });
}

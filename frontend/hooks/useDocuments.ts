import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDocumentFile,
  createDocumentLink,
  deleteDocument,
  getDocumentUploadOptions,
  listDocuments,
  replaceDocumentFile,
  updateDocument,
  type DocumentFields,
  type DocumentOwner,
} from "../api/documents";
import type { DocumentChanges } from "../api/types";

// A game's list keeps its Guides & Cheats key, so anything already invalidating it still does.
export function documentsQueryKey(owner: DocumentOwner): unknown[] {
  return owner.type === "game"
    ? ["games", owner.id, "guides"]
    : ["documents", owner.type, owner.id];
}

export function useDocuments(owner: DocumentOwner) {
  return useQuery({
    queryKey: documentsQueryKey(owner),
    queryFn: () => listDocuments(owner),
    enabled: Number.isFinite(owner.id),
  });
}

// The upload limit and accepted types only change with a server restart.
export function useDocumentUploadOptions() {
  return useQuery({
    queryKey: ["guides", "upload-options"],
    queryFn: getDocumentUploadOptions,
    staleTime: Infinity,
  });
}

function useInvalidateDocuments(owner: DocumentOwner) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: documentsQueryKey(owner) });
}

interface UploadArgs {
  file: File;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export function useCreateDocumentFile(owner: DocumentOwner) {
  const invalidate = useInvalidateDocuments(owner);
  return useMutation({
    mutationFn: ({ file, fields, onProgress, signal }: UploadArgs & { fields: DocumentFields }) =>
      createDocumentFile(owner, file, fields, onProgress, signal),
    // A File can't survive the offline persister's JSON serialization, so an upload runs (or
    // fails) now rather than being queued for when the network returns.
    networkMode: "always",
    onSuccess: invalidate,
  });
}

export function useCreateDocumentLink(owner: DocumentOwner) {
  const invalidate = useInvalidateDocuments(owner);
  return useMutation({
    mutationFn: ({ url, fields }: { url: string; fields: DocumentFields }) =>
      createDocumentLink(owner, url, fields),
    onSuccess: invalidate,
  });
}

export function useUpdateDocument(owner: DocumentOwner) {
  const invalidate = useInvalidateDocuments(owner);
  return useMutation({
    mutationFn: ({ documentId, changes }: { documentId: number; changes: DocumentChanges }) =>
      updateDocument(owner, documentId, changes),
    onSuccess: invalidate,
  });
}

export function useReplaceDocumentFile(owner: DocumentOwner) {
  const invalidate = useInvalidateDocuments(owner);
  return useMutation({
    mutationFn: ({ documentId, file, onProgress, signal }: UploadArgs & { documentId: number }) =>
      replaceDocumentFile(owner, documentId, file, onProgress, signal),
    networkMode: "always",
    onSuccess: invalidate,
  });
}

export function useDeleteDocument(owner: DocumentOwner) {
  const invalidate = useInvalidateDocuments(owner);
  return useMutation({
    mutationFn: (documentId: number) => deleteDocument(owner, documentId),
    onSuccess: invalidate,
  });
}

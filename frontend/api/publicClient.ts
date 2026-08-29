import axios from "axios";
import { API_BASE_URL } from "./client";

// Deliberately separate from apiClient (client.ts) — that client's response interceptor
// redirects an anonymous visitor to /login on certain errors, which is wrong for the
// public share-link pages (there's no login to redirect to for a visitor with no account).
// No interceptors here at all — just the base URL.
export const publicClient = axios.create({ baseURL: API_BASE_URL });

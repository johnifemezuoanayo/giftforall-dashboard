export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const SITE_URL = import.meta.env.VITE_SITE_URL || "http://localhost:3000";

const TOKEN_KEY = "dashboard-token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// Sends a request to the backend admin API and returns the JSON answer.
export async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${API_URL}/api/admin${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    clearToken();
    window.location.href = "/login";
  }
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }
  return data;
}

export async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/api/admin/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Upload failed");
  return data.url;
}

export async function downloadFile(path, fileName) {
  const response = await fetch(`${API_URL}/api/admin${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!response.ok) throw new Error("Download failed");

  const blob = await response.blob();
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// Unsplash can send a small version of the photo, which loads much faster in tables.
export function sizedImageUrl(src, width) {
  if (!src || !src.startsWith("https://images.unsplash.com/")) return src;
  return `${src}${src.includes("?") ? "&" : "?"}w=${width}&q=70&auto=format&fit=crop`;
}

export function thumbUrl(src) {
  return sizedImageUrl(src, 120);
}

// Pages send this event when something that the side menu counts has changed.
export const BADGES_CHANGED = "dashboard:badges-changed";

export function refreshBadges() {
  window.dispatchEvent(new Event(BADGES_CHANGED));
}

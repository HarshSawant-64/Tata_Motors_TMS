import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// withCredentials ensures the browser sends/accepts the httpOnly session
// cookie set by the server on login. The auth token itself is never
// touched by client-side JavaScript (and therefore isn't reachable by an
// XSS bug) — only the non-sensitive user profile is kept in localStorage
// purely for immediate UI display.
export const api = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('tmtp_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export function uploadFileUrl(storedName: string) {
  return `${API_BASE_URL}/uploads/file/${storedName}`;
}

// Types the browser can render inline (image previews, PDF viewer, video player).
// Everything else (doc/docx/ppt/pptx/zip, etc.) is downloaded instead.
function isBrowserViewable(mimeType: string): boolean {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    mimeType.startsWith('video/')
  );
}

// Fetches an uploaded file through the authenticated API (so the server's
// requireAuth check succeeds) and either opens it in a new tab for preview
// or triggers a download, depending on file type. A blank tab is opened
// synchronously first so browser popup blockers don't block the flow while
// the authenticated request is in flight.
export async function openUploadedFile(storedName: string, originalName: string) {
  const previewWindow = window.open('', '_blank');

  try {
    const res = await api.get(`/uploads/file/${storedName}`, { responseType: 'blob' });
    const blob = res.data as Blob;
    const mimeType = blob.type || 'application/octet-stream';
    const objectUrl = window.URL.createObjectURL(blob);

    if (isBrowserViewable(mimeType) && previewWindow) {
      previewWindow.location.href = objectUrl;
    } else {
      if (previewWindow) previewWindow.close();
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = originalName || storedName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }

    setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
  } catch (err) {
    if (previewWindow) previewWindow.close();
    alert('Unable to open this file. Please try again.');
  }
}

// Downloads a generated PDF report (weekly / monthly / six-month) through the
// authenticated API and saves it to disk, following the same blob-download
// approach used for uploaded files above.
export async function downloadReport(reportPath: 'weekly' | 'monthly' | 'six-month', filename: string) {
  const res = await api.get(`/reports/${reportPath}`, { responseType: 'blob' });
  const blob = res.data as Blob;
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
}

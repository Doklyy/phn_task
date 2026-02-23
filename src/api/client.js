/**
 * API client – kết nối Front-end với Back-end.
 * Base URL: VITE_API_URL (ví dụ http://localhost:8080 hoặc http://localhost:8080/api)
 * Nếu chỉ có host:port thì tự thêm /api để tránh lỗi 404.
 */
const rawBase = import.meta.env.VITE_API_URL || '';
const BASE = rawBase
  ? rawBase.replace(/\/$/, '').replace(/\/(api)?$/, '') + '/api'
  : '';

const TOKEN_KEY = 'phn_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function buildUrl(path) {
  if (!BASE) return '';
  return `${BASE.replace(/\/$/, '')}/${(path || '').replace(/^\//, '')}`;
}

export async function request(path, options = {}) {
  const url = buildUrl(path);
  if (!url) throw new Error('VITE_API_URL chưa cấu hình');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    setToken(null);
    throw new Error('Phiên đăng nhập hết hạn');
  }

  if (!res.ok) {
    const text = await res.text();
    let message = `Lỗi ${res.status}`;
    try {
      const json = JSON.parse(text);
      if (json.message) message = json.message;
    } catch (_) {
      if (text) message = text.slice(0, 200);
    }
    if (res.status === 404) {
      const triedUrl = buildUrl(path);
      message = `Lỗi 404: Không tìm thấy API. Kiểm tra (1) Backend đã chạy chưa (port 8080), (2) file .env có VITE_API_URL=http://localhost:8080/api. Thử mở trong trình duyệt: ${triedUrl}`;
    }
    if (res.status === 500 && message === `Lỗi ${res.status}`) {
      message = 'Lỗi 500: Máy chủ xử lý bị lỗi. Xem nội dung bên dưới hoặc kiểm tra log backend.';
    }
    throw new Error(message);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) return res.json();
  return res.text();
}

export function isApiConfigured() {
  return Boolean(BASE);
}

/**
 * Upload file (multipart/form-data). Trả về { path } để gửi kèm báo cáo.
 */
export async function uploadFile(file) {
  const url = BASE ? `${BASE.replace(/\/$/, '')}/upload` : '';
  if (!url) throw new Error('VITE_API_URL chưa cấu hình');
  const formData = new FormData();
  formData.append('file', file);
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (res.status === 401) {
    setToken(null);
    throw new Error('Phiên đăng nhập hết hạn');
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Lỗi ${res.status}`);
  }
  const data = await res.json();
  return data.path || data.filePath || '';
}

/**
 * URL để mở/tải file đính kèm (báo cáo).
 * Dùng query param path: GET /api/upload/file?path=... để tránh lỗi 400 khi path chứa /
 */
export function getUploadedFileUrl(path) {
  if (!path) return '';
  const s = String(path).trim();
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (!BASE) return '';
  const p = s.replace(/^\//, '');
  const baseUrl = BASE.replace(/\/$/, '');
  return `${baseUrl}/upload/file?path=${encodeURIComponent(p)}`;
}

/**
 * Tải file đính kèm xuống máy (fetch + blob, có gửi token).
 * Gọi khi bấm "Tải file đính kèm" để chắc chắn file được tải xuống thay vì mở trong tab.
 */
export async function downloadAttachment(path) {
  if (!path) return;
  const url = getUploadedFileUrl(path);
  if (!url) return;
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method: 'GET', headers });
  if (!res.ok) throw new Error(res.status === 401 ? 'Phiên đăng nhập hết hạn' : `Lỗi ${res.status}`);
  const blob = await res.blob();
  const name = String(path).replace(/^.*[/\\]/, '') || 'attachment';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

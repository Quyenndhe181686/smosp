import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL: API_BASE ? `${API_BASE}/api` : "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/* Đường dẫn màn đổi mật khẩu — khai báo một chỗ vì cả interceptor lẫn guard
   chống lặp bên dưới đều phải dùng đúng cùng một giá trị. */
export const CHANGE_PASSWORD_PATH = "/settings/password";

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    /* Tài khoản do Admin cấp bị bắt đổi mật khẩu trước khi dùng: JwtAuthFilter
       chặn MỌI endpoint trừ /api/auth/password/change, /api/auth/logout và
       /api/me, trả 403 kèm mã FORCE_CHANGE_PASSWORD_REQUIRED. Không bắt ở đây
       thì người dùng rơi vào dashboard hỏng — mọi widget báo lỗi mà không có
       chỗ nào nói phải làm gì.

       Bắt buộc phải chừa màn đổi mật khẩu ra: Layout của chính màn đó gọi
       getNotifications() và cũng ăn 403 y hệt, redirect vô điều kiện sẽ thành
       vòng lặp tải lại trang không dứt. */
    if (
      error.response &&
      error.response.status === 403 &&
      error.response.data?.error === "FORCE_CHANGE_PASSWORD_REQUIRED" &&
      !window.location.pathname.startsWith(CHANGE_PASSWORD_PATH)
    ) {
      localStorage.setItem("forceChangePassword", "true");
      window.location.href = CHANGE_PASSWORD_PATH;
      return Promise.reject(error);
    }

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url &&
      !originalRequest.url.includes("/auth/login") &&
      !originalRequest.url.includes("/auth/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const storedRefreshToken = localStorage.getItem("refreshToken");
      if (!storedRefreshToken) {
        isRefreshing = false;
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_BASE ? API_BASE : ""}/api/auth/refresh`, {
          refreshToken: storedRefreshToken,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        localStorage.setItem("accessToken", accessToken);
        if (newRefreshToken) {
          localStorage.setItem("refreshToken", newRefreshToken);
        }

        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
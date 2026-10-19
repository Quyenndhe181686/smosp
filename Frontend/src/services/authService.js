import api from "./api";
import { clearProfileFlowCache } from "../components/student/profileFlow";

export const login = async (identifier, password) => {
  const response = await api.post(
    "/auth/login",
    {
      identifier,
      password,
    }
  );

  return response.data;
};

export const register = async (fullName, email, password) => {
  const response = await api.post(
    "/auth/register",
    {
      fullName,
      email,
      password,
    }
  );

  return response.data;
};

export const googleLogin = async (idToken) => {
  const response = await api.post(
    "/auth/google",
    {
      idToken,
    }
  );

  return response.data;
};

export const logout = async () => {
  const refreshToken = localStorage.getItem("refreshToken");
  if (refreshToken) {
    try {
      await api.post("/auth/logout", { refreshToken });
    } catch (err) {
      console.error("Logout error:", err);
    }
  }
  localStorage.clear();
  clearProfileFlowCache();
};

export const forgotPassword = async (email) => {
  const response = await api.post("/auth/password/forgot", { email });
  return response.data;
};

export const resetPassword = async (token, newPassword) => {
  const response = await api.post("/auth/password/reset", { token, newPassword });
  return response.data;
};

export const verifyEmail = async (token) => {
  const response = await api.post("/auth/verify-email", { token });
  return response.data;
};

export const resendVerifyEmail = async (email) => {
  const response = await api.post("/auth/verify-email/resend", { email });
  return response.data;
};

export const getProfile = async () => {
  const response = await api.get("/me");
  return response.data;
};

export const updateProfilePreferences = async (displayName, notifEnabled) => {
  const response = await api.put("/me/preferences", { displayName, notifEnabled });
  return response.data;
};

export const changePassword = async (oldPassword, newPassword) => {
  const response = await api.put("/auth/password/change", { oldPassword, newPassword });
  return response.data;
};

export const refreshToken = async (refreshToken) => {
  const response = await api.post("/auth/refresh", { refreshToken });
  return response.data;
};

export const saveFcmToken = async (token) => {
  const response = await api.post("/me/fcm-token", { token });
  return response.data;
};

export const getNotifications = async () => {
  const response = await api.get("/notifications");
  return response.data;
};

export const markNotificationAsRead = async (id) => {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data;
};

export const markAllNotificationsAsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data;
};
package com.sep490_g47.smosp.auth.service;

import com.sep490_g47.smosp.auth.dto.request.*;
import com.sep490_g47.smosp.auth.dto.response.AuthResponse;
import com.sep490_g47.smosp.auth.dto.response.MessageResponse;

import java.util.UUID;

public interface AuthService {
    MessageResponse register(RegisterRequest request);
    MessageResponse verifyEmail(VerifyEmailRequest request);
    MessageResponse resendVerifyEmail(ResendVerifyEmailRequest request);
    AuthResponse login(LoginRequest request);
    AuthResponse googleLogin(GoogleLoginRequest request);
    MessageResponse logout(LogoutRequest request);
    AuthResponse refreshToken(RefreshTokenRequest request);
    MessageResponse forgotPassword(PasswordResetRequest request);
    MessageResponse resetPassword(NewPasswordRequest request);
    MessageResponse changePassword(ChangePasswordRequest request, UUID userId);
}
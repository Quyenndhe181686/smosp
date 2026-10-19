package com.sep490_g47.smosp.auth.service;

import com.sep490_g47.smosp.account.enums.UserAccountStatus;
import com.sep490_g47.smosp.auth.dto.request.*;
import com.sep490_g47.smosp.auth.dto.response.AuthResponse;
import com.sep490_g47.smosp.auth.dto.response.MessageResponse;
import com.sep490_g47.smosp.auth.entity.*;
import com.sep490_g47.smosp.auth.exception.AccountLockedException;
import com.sep490_g47.smosp.auth.exception.AuthBusinessException;
import com.sep490_g47.smosp.auth.exception.TokenExpiredException;
import com.sep490_g47.smosp.auth.repository.*;
import com.sep490_g47.smosp.auth.utils.HashUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseToken;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final UserAccountRepository userAccountRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailService emailService;
    private final AuthPersistence authPersistence;

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_TIME_DURATION_MINUTES = 30;

    @Value("${spring.security.oauth2.client.registration.google.client-id:YOUR_GOOGLE_CLIENT_ID}")
    private String googleClientId;

    /**
     * CỐ Ý không có @Transactional: mailSender.send() là SMTP I/O, handshake + gửi mail
     * qua Gmail có thể mất vài giây. Bọc transaction quanh đây đồng nghĩa giữ 1 DB
     * connection suốt thời gian đó, trên một endpoint public ai cũng gọi được.
     *
     * Thứ tự: ghi DB trước (transaction ngắn, đã commit) rồi mới gửi mail. Mail lỗi thì
     * user + token vẫn còn nguyên trong DB, user dùng resendVerifyEmail() để nhận lại.
     */
    @Override
    public MessageResponse register(RegisterRequest request) {
        String token = authPersistence.createPendingUserWithVerificationToken(request);
        if (token != null) {
            sendVerificationEmailQuietly(request.getEmail(), token);
        }

        // BR-02: Prevent revealing if email exists
        return new MessageResponse("If your email is valid, a verification link has been sent.", true);
    }

    @Override
    @Transactional
    public MessageResponse verifyEmail(VerifyEmailRequest request) {
        String tokenHash = HashUtil.sha256(request.getToken());
        EmailVerificationToken verificationToken = emailVerificationTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new AuthBusinessException("Invalid token"));

        if (verificationToken.getUsed()) {
            throw new AuthBusinessException("Token already used");
        }
        if (verificationToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new TokenExpiredException("Token expired");
        }

        UserAccount user = verificationToken.getUser();
        user.setStatus(UserAccountStatus.ACTIVE.name());
        userAccountRepository.save(user);

        verificationToken.setUsed(true);
        emailVerificationTokenRepository.save(verificationToken);

        return new MessageResponse("Account activated successfully. You can now log in.", true);
    }

    /** Không @Transactional — xem giải thích ở {@link #register}. */
    @Override
    public MessageResponse resendVerifyEmail(ResendVerifyEmailRequest request) {
        String token = authPersistence.createResendVerificationToken(request.getEmail());
        if (token != null) {
            sendVerificationEmailQuietly(request.getEmail(), token);
        }
        return new MessageResponse("If your email is valid, a verification link has been sent.", true);
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        UserAccount user = userAccountRepository.findByEmail(request.getIdentifier())
                .filter(u -> {
                    String roleName = u.getRole().getName();
                    return !("ROLE_ADMIN".equals(roleName) || "ROLE_SUPER_ADMIN".equals(roleName) || "ROLE_CONTENT_MANAGER".equals(roleName));
                })
                .or(() -> userAccountRepository.findByUsername(request.getIdentifier()))
                .orElseThrow(() -> new AuthBusinessException("Invalid credentials"));

        // BR-19: Check lock time
        if (user.getLockTime() != null) {
            LocalDateTime unlockTime = user.getLockTime().plusMinutes(LOCK_TIME_DURATION_MINUTES);
            if (unlockTime.isAfter(LocalDateTime.now())) {
                long minutesLeft = java.time.Duration.between(LocalDateTime.now(), unlockTime).toMinutes();
                if (minutesLeft <= 0) minutesLeft = 1;
                throw new AccountLockedException("Account is locked. Please try again in " + minutesLeft + " minutes.");
            } else {
                user.setLockTime(null);
                user.setFailedLoginAttempts(0);
                userAccountRepository.save(user);
            }
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            int attempts = user.getFailedLoginAttempts() + 1;
            user.setFailedLoginAttempts(attempts);
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                user.setLockTime(LocalDateTime.now());
                userAccountRepository.save(user);
                throw new AccountLockedException("Account is locked for " + LOCK_TIME_DURATION_MINUTES + " minutes due to too many failed login attempts.");
            }
            userAccountRepository.save(user);
            throw new AuthBusinessException("Invalid credentials");
        }

        // PENDING_VERIFICATION (chưa xác thực email qua register()) và INACTIVE (bị
        // Admin deactivate qua AdminUserServiceImpl.updateStatus) là 2 trạng thái
        // khác nhau — không được gộp chung 1 thông báo, user chưa verify không nên
        // bị hiểu nhầm là bị khoá bởi Admin và ngược lại.
        if (UserAccountStatus.PENDING_VERIFICATION.name().equals(user.getStatus())) {
            throw new AuthBusinessException("Account not activated. Please check your email.");
        }
        if (UserAccountStatus.INACTIVE.name().equals(user.getStatus())) {
            throw new AuthBusinessException("Account has been deactivated. Please contact support.");
        }

        // BR-45 (Forced Password Change on First Login) được enforce ở tầng
        // JwtAuthFilter (chặn mọi request trừ /api/auth/password/change,
        // /api/auth/logout, /api/me khi forceChangePassword=true) — không phải ở
        // login(). login() chỉ cần trả đúng cờ forceChangePassword để FE biết mà
        // điều hướng ngay sau khi đăng nhập, xem AuthResponse bên dưới.
        user.setFailedLoginAttempts(0);
        user.setLockTime(null);
        userAccountRepository.save(user);

        Set<String> roles = Set.of(user.getRole().getName());
        Map<String, Object> claims = new HashMap<>();
        claims.put("roles", roles);
        claims.put("tokenVersion", user.getTokenVersion());

        String identifier = user.getEmail() != null ? user.getEmail() : user.getUsername();
        String accessToken = jwtService.generateAccessToken(identifier, claims);
        String refreshTokenString = jwtService.generateRefreshToken(identifier);

        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(HashUtil.sha256(refreshTokenString))
                .expiresAt(LocalDateTime.now().plusDays(7)) // Example: 7 days expiry
                .build();
        refreshTokenRepository.save(refreshToken);

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(refreshTokenString)
                .tokenType("Bearer")
                .userId(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .roles(roles)
                .forceChangePassword(user.isForceChangePassword())
                .build();
    }

    /**
     * CỐ Ý không có @Transactional: FirebaseAuth.verifyIdToken() gọi ra Google để lấy
     * public key và xác thực token — network I/O, và nó là lệnh ĐẦU TIÊN của luồng.
     * Trước đây transaction mở ra trước cả lời gọi đó, nên mỗi request login (endpoint
     * public, tần suất cao) chiếm 1 DB connection ngay từ lúc chưa biết token có hợp lệ
     * hay không. Token sai vẫn tốn nguyên 1 connection trong suốt thời gian chờ Google.
     *
     * Thứ tự: verify trước, sai thì throw luôn và không chạm DB; verify xong mới vào
     * transaction ngắn duy nhất của {@link AuthPersistence#completeGoogleLogin}.
     */
    @Override
    public AuthResponse googleLogin(GoogleLoginRequest request) {
        FirebaseToken decodedToken;
        try {
            decodedToken = FirebaseAuth.getInstance().verifyIdToken(request.getIdToken());
        } catch (FirebaseAuthException e) {
            throw new AuthBusinessException("Invalid Firebase ID token: " + e.getMessage());
        }

        String userEmail = decodedToken.getEmail();
        String providerUid = decodedToken.getUid();
        String displayName = decodedToken.getName();

        try {
            return authPersistence.completeGoogleLogin(userEmail, displayName, providerUid);
        } catch (DataIntegrityViolationException e) {
            // 2 request song song cùng lần đầu login của 1 user: cả hai đều thấy
            // findByEmail rỗng và cùng insert. Unique constraint trên user_account.email
            // (và trên oauth_identity(provider, provider_uid)) khiến 1 trong 2 vỡ ở lúc
            // commit — transaction đó rollback sạch, không để lại bản ghi dở dang.
            // Gọi lại đúng 1 lần là đủ: lúc này row chắc chắn đã tồn tại nên nhánh
            // orElseGet không chạy nữa, không thể vỡ lần hai vì cùng lý do.
            log.warn("Google login đụng unique constraint (login song song lần đầu) cho {}, thử lại", userEmail, e);
            return authPersistence.completeGoogleLogin(userEmail, displayName, providerUid);
        }
    }

    @Override
    @Transactional
    public MessageResponse logout(LogoutRequest request) {
        String tokenHash = HashUtil.sha256(request.getRefreshToken());
        Optional<RefreshToken> tokenOpt = refreshTokenRepository.findByToken(tokenHash);
        tokenOpt.ifPresent(token -> {
            UserAccount user = token.getUser();
            user.setTokenVersion(user.getTokenVersion() + 1);
            userAccountRepository.save(user);
            refreshTokenRepository.delete(token);
        });
        return new MessageResponse("Logged out successfully", true);
    }

    @Override
    @Transactional
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        String tokenHash = HashUtil.sha256(request.getRefreshToken());
        RefreshToken oldToken = refreshTokenRepository.findByToken(tokenHash)
                .orElseThrow(() -> new AuthBusinessException("Invalid refresh token"));

        if (oldToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            refreshTokenRepository.delete(oldToken);
            throw new TokenExpiredException("Refresh token expired");
        }

        UserAccount user = oldToken.getUser();
        refreshTokenRepository.delete(oldToken); // Rotate token

        Set<String> roles = Set.of(user.getRole().getName());
        Map<String, Object> claims = new HashMap<>();
        claims.put("roles", roles);
        claims.put("tokenVersion", user.getTokenVersion());

        String identifier = user.getEmail() != null ? user.getEmail() : user.getUsername();
        String newAccessToken = jwtService.generateAccessToken(identifier, claims);
        String newRefreshTokenString = jwtService.generateRefreshToken(identifier);

        RefreshToken newRefreshToken = RefreshToken.builder()
                .user(user)
                .token(HashUtil.sha256(newRefreshTokenString))
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build();
        refreshTokenRepository.save(newRefreshToken);

        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(newRefreshTokenString)
                .tokenType("Bearer")
                .userId(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .roles(roles)
                .forceChangePassword(user.isForceChangePassword())
                .build();
    }

    /** Không @Transactional — xem giải thích ở {@link #register}. */
    @Override
    public MessageResponse forgotPassword(PasswordResetRequest request) {
        String token = authPersistence.createPasswordResetToken(request.getEmail());
        if (token != null) {
            try {
                emailService.sendPasswordResetEmail(request.getEmail(), token);
            } catch (Exception e) {
                // Nuốt lỗi có chủ đích, xem giải thích ở sendVerificationEmailQuietly.
                log.error("Không gửi được email reset password tới {}", request.getEmail(), e);
            }
        }

        return new MessageResponse("Nếu email của bạn tồn tại trên hệ thống, liên kết đặt lại mật khẩu đã được gửi.", true);
    }

    /**
     * Nuốt lỗi SMTP có chủ đích, chỉ log.
     *
     * Nếu để exception bay lên thì response sẽ khác nhau giữa email tồn tại (gửi mail →
     * có thể 500) và email không tồn tại (không gửi → luôn 200) — đúng thứ mà BR-02
     * muốn giấu. Token đã commit trong DB nên user vẫn lấy lại được qua resend-verify /
     * forgot-password, không mất dữ liệu nghiệp vụ.
     */
    private void sendVerificationEmailQuietly(String email, String token) {
        try {
            emailService.sendVerificationEmail(email, token);
        } catch (Exception e) {
            log.error("Không gửi được email xác minh tới {}", email, e);
        }
    }

    @Override
    @Transactional
    public MessageResponse resetPassword(NewPasswordRequest request) {
        String tokenHash = HashUtil.sha256(request.getToken());
        PasswordResetToken resetToken = passwordResetTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new AuthBusinessException("Invalid token"));

        if (resetToken.getUsed()) {
            throw new AuthBusinessException("Token already used");
        }
        if (resetToken.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new TokenExpiredException("Token expired");
        }

        UserAccount user = resetToken.getUser();

        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new AuthBusinessException("New password must be different from the old password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setTokenVersion(user.getTokenVersion() + 1);
        userAccountRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        // Đổi password xong phải vô hiệu hoá mọi session cũ — nếu tài khoản bị lộ
        // dẫn tới phải reset password, refresh token cũ vẫn còn sống thì kẻ tấn công
        // vẫn tiếp tục lấy được access token mới sau khi user đã đổi password.
        refreshTokenRepository.deleteAllByUserId(user.getId());

        return new MessageResponse("Password reset successfully.", true);
    }

    @Override
    @Transactional
    public MessageResponse changePassword(ChangePasswordRequest request, UUID userId) {
        UserAccount user = userAccountRepository.findById(userId)
                .orElseThrow(() -> new AuthBusinessException("User not found"));

        if (user.getPasswordHash() == null) {
            throw new AuthBusinessException("Google-linked accounts cannot change password here. Please manage your password through Google.");
        }

        if (!passwordEncoder.matches(request.getOldPassword(), user.getPasswordHash())) {
            throw new AuthBusinessException("Incorrect old password");
        }

        if (passwordEncoder.matches(request.getNewPassword(), user.getPasswordHash())) {
            throw new AuthBusinessException("New password must be different from the old password");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setForceChangePassword(false);
        user.setTokenVersion(user.getTokenVersion() + 1);
        userAccountRepository.save(user);

        refreshTokenRepository.deleteAllByUserId(userId);

        return new MessageResponse("Password changed successfully", true);
    }
}

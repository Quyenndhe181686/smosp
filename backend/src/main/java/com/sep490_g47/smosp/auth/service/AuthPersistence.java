package com.sep490_g47.smosp.auth.service;

import com.sep490_g47.smosp.account.enums.UserAccountStatus;
import com.sep490_g47.smosp.auth.dto.request.RegisterRequest;
import com.sep490_g47.smosp.auth.dto.response.AuthResponse;
import com.sep490_g47.smosp.auth.entity.EmailVerificationToken;
import com.sep490_g47.smosp.auth.entity.OauthIdentity;
import com.sep490_g47.smosp.auth.entity.PasswordResetToken;
import com.sep490_g47.smosp.auth.entity.RefreshToken;
import com.sep490_g47.smosp.auth.entity.Role;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.exception.AuthBusinessException;
import com.sep490_g47.smosp.auth.repository.EmailVerificationTokenRepository;
import com.sep490_g47.smosp.auth.repository.OauthIdentityRepository;
import com.sep490_g47.smosp.auth.repository.PasswordResetTokenRepository;
import com.sep490_g47.smosp.auth.repository.RefreshTokenRepository;
import com.sep490_g47.smosp.auth.repository.RoleRepository;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.auth.utils.HashUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Phần ghi DB của các luồng auth, tách khỏi {@link AuthServiceImpl} để transaction
 * chỉ bọc thao tác DB — không bọc SMTP (gửi email) và không bọc lời gọi Firebase.
 *
 * Bắt buộc là bean riêng: nếu để chung class với method orchestration thì
 * self-invocation không đi qua Spring proxy và @Transactional bị bỏ qua hoàn toàn.
 */
@Component
@RequiredArgsConstructor
public class AuthPersistence {

    private final UserAccountRepository userAccountRepository;
    private final RoleRepository roleRepository;
    private final EmailVerificationTokenRepository emailVerificationTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final OauthIdentityRepository oauthIdentityRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    /**
     * Tạo user PENDING_VERIFICATION + token xác minh.
     *
     * @return token thô để gửi email, hoặc {@code null} nếu email đã tồn tại —
     *         caller không được gửi email và cũng không được để lộ khác biệt này
     *         ra response (BR-02).
     */
    @Transactional
    public String createPendingUserWithVerificationToken(RegisterRequest request) {
        if (userAccountRepository.existsByEmail(request.getEmail())) {
            return null;
        }

        Role studentRole = roleRepository.findByName("ROLE_STUDENT")
                .orElseThrow(() -> new AuthBusinessException("Role ROLE_STUDENT not initialized"));

        UserAccount user = UserAccount.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .displayName(request.getFullName())
                .status(UserAccountStatus.PENDING_VERIFICATION.name())
                .role(studentRole)
                .failedLoginAttempts(0)
                .build();
        userAccountRepository.save(user);

        return createVerificationToken(user);
    }

    /**
     * @return token thô, hoặc {@code null} nếu email không tồn tại / user không ở
     *         trạng thái PENDING_VERIFICATION.
     */
    @Transactional
    public String createResendVerificationToken(String email) {
        return userAccountRepository.findByEmail(email)
                .filter(user -> UserAccountStatus.PENDING_VERIFICATION.name().equals(user.getStatus()))
                .map(this::createVerificationToken)
                .orElse(null);
    }

    /** @return token thô, hoặc {@code null} nếu email không tồn tại (BR-02). */
    @Transactional
    public String createPasswordResetToken(String email) {
        Optional<UserAccount> userOpt = userAccountRepository.findByEmail(email)
                .filter(u -> {
                    String roleName = u.getRole().getName();
                    return !("ROLE_ADMIN".equals(roleName) || "ROLE_SUPER_ADMIN".equals(roleName) || "ROLE_CONTENT_MANAGER".equals(roleName));
                });
        if (userOpt.isEmpty()) {
            return null;
        }

        UserAccount user = userOpt.get();
        passwordResetTokenRepository.invalidateAllTokensForUser(user.getId());

        String token = UUID.randomUUID().toString();
        passwordResetTokenRepository.save(PasswordResetToken.builder()
                .user(user)
                .tokenHash(HashUtil.sha256(token))
                .expiresAt(LocalDateTime.now().plusMinutes(60)) // BV-04
                .used(false)
                .build());
        return token;
    }

    /**
     * Toàn bộ phần chạm DB của Google login trong 1 transaction: find-or-create user,
     * link oauth identity, phát refresh token. Gộp chung 1 transaction để nếu insert
     * bị đụng unique constraint (2 request song song cùng lần đầu login) thì rollback
     * sạch, caller chỉ việc gọi lại — xem AuthServiceImpl#googleLogin.
     */
    @Transactional
    public AuthResponse completeGoogleLogin(String email, String displayName, String providerUid) {
        UserAccount user = userAccountRepository.findByEmail(email)
                .orElseGet(() -> {
                    Role studentRole = roleRepository.findByName("ROLE_STUDENT")
                            .orElseThrow(() -> new AuthBusinessException("ROLE_STUDENT not initialized"));
                    String name = (displayName == null || displayName.trim().isEmpty()) ? "Student" : displayName;
                    return userAccountRepository.save(UserAccount.builder()
                            .email(email)
                            .displayName(name)
                            .status(UserAccountStatus.ACTIVE.name())
                            .role(studentRole)
                            .failedLoginAttempts(0)
                            .build());
                });

        if (!"ROLE_STUDENT".equals(user.getRole().getName())) {
            throw new AuthBusinessException("Google Sign-In chỉ áp dụng cho tài khoản sinh viên (UCS_AUDIT_DEF_01)");
        }
        if (!UserAccountStatus.ACTIVE.name().equals(user.getStatus())) {
            throw new AuthBusinessException("Tài khoản đang bị khóa hoặc chưa được kích hoạt");
        }

        if (oauthIdentityRepository.findByProviderAndProviderUid("google", providerUid).isEmpty()) {
            oauthIdentityRepository.save(OauthIdentity.builder()
                    .user(user)
                    .provider("google")
                    .providerUid(providerUid)
                    .build());
        }

        Set<String> roles = Set.of(user.getRole().getName());
        Map<String, Object> claims = new HashMap<>();
        claims.put("roles", roles);
        claims.put("tokenVersion", user.getTokenVersion());

        String accessToken = jwtService.generateAccessToken(user.getEmail(), claims);
        String refreshTokenString = jwtService.generateRefreshToken(user.getEmail());

        refreshTokenRepository.save(RefreshToken.builder()
                .user(user)
                .token(HashUtil.sha256(refreshTokenString))
                .expiresAt(LocalDateTime.now().plusDays(7))
                .build());

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

    private String createVerificationToken(UserAccount user) {
        emailVerificationTokenRepository.invalidateAllTokensForUser(user.getId());

        String token = UUID.randomUUID().toString();
        emailVerificationTokenRepository.save(EmailVerificationToken.builder()
                .user(user)
                .tokenHash(HashUtil.sha256(token)) // BR-01
                .expiresAt(LocalDateTime.now().plusHours(24)) // BV-03
                .used(false)
                .build());
        return token;
    }
}

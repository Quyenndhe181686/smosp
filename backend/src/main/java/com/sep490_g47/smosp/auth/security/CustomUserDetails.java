package com.sep490_g47.smosp.auth.security;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Collections;
import java.util.UUID;

public class CustomUserDetails implements UserDetails {

    private static final int LOCK_TIME_DURATION_MINUTES = 30;

    @Getter
    private final UUID userId;
    private final String identifier; // email or username
    private final String password;
    private final Collection<? extends GrantedAuthority> authorities;
    private final boolean isActive;
    @Getter
    private final boolean forceChangePassword;
    @Getter
    private final Integer tokenVersion;

    public CustomUserDetails(UserAccount userAccount) {
        this.userId = userAccount.getId();
        this.identifier = userAccount.getEmail() != null ? userAccount.getEmail() : userAccount.getUsername();
        this.password = userAccount.getPasswordHash();
        if ("ROLE_SUPER_ADMIN".equals(userAccount.getRole().getName())) {
            this.authorities = java.util.Arrays.asList(
                    new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"),
                    new SimpleGrantedAuthority("ROLE_ADMIN")
            );
        } else {
            this.authorities = Collections.singletonList(new SimpleGrantedAuthority(userAccount.getRole().getName()));
        }
        // BR-19: tài khoản tự động mở khóa sau 30 phút, không cần Admin can thiệp —
        // đồng bộ với AuthServiceImpl.login(), vì isEnabled() được JwtAuthFilter gọi
        // trên mỗi request (kể cả khi user không đăng nhập lại để login() xóa lockTime).
        boolean isLocked = userAccount.getLockTime() != null
                && userAccount.getLockTime().plusMinutes(LOCK_TIME_DURATION_MINUTES).isAfter(LocalDateTime.now());
        this.isActive = "ACTIVE".equals(userAccount.getStatus()) && !isLocked;
        this.forceChangePassword = userAccount.isForceChangePassword();
        this.tokenVersion = userAccount.getTokenVersion();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return identifier;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return isActive;
    }
}

package com.sep490_g47.smosp.account.service;

import com.sep490_g47.smosp.account.dto.response.MeResponse;
import com.sep490_g47.smosp.account.dto.request.UpdatePreferencesRequest;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.ZoneId;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AccountServiceImpl implements AccountService {

    private final UserAccountRepository userAccountRepository;

    @Override
    public MeResponse getMe(UUID userId) {
        UserAccount user = userAccountRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        return mapToMeResponse(user);
    }

    @Override
    @Transactional
    public MeResponse updatePreferences(UUID userId, UpdatePreferencesRequest request) {
        UserAccount user = userAccountRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        if (request.getDisplayName() == null || request.getDisplayName().trim().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tên hiển thị không được để trống");
        }

        user.setDisplayName(request.getDisplayName());
        user.setNotifEnabled(request.getNotifEnabled());
        userAccountRepository.save(user);

        return mapToMeResponse(user);
    }

    @Override
    @Transactional
    public void saveFcmToken(UUID userId, String token) {
        UserAccount user = userAccountRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        user.setFcmToken(token);
        userAccountRepository.save(user);
    }

    private MeResponse mapToMeResponse(UserAccount user) {
        String roleStr = user.getRole().getName();
        if (roleStr.startsWith("ROLE_")) {
            roleStr = roleStr.substring(5);
        }

        String identifier = "STUDENT".equals(roleStr) ? user.getEmail() : user.getUsername();

        return MeResponse.builder()
                .id(user.getId())
                .role(roleStr)
                .identifier(identifier)
                .displayName(user.getDisplayName())
                .notifEnabled(user.getNotifEnabled() != null ? user.getNotifEnabled() : true)
                .hasPassword(user.getPasswordHash() != null && !user.getPasswordHash().isEmpty())
                .status(user.getStatus())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}

package com.sep490_g47.smosp.account.controller;

import com.sep490_g47.smosp.account.service.AccountService;
import com.sep490_g47.smosp.account.dto.response.MeResponse;
import com.sep490_g47.smosp.account.dto.request.UpdatePreferencesRequest;
import com.sep490_g47.smosp.auth.security.CustomUserDetails;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/me")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    @GetMapping
    public ResponseEntity<MeResponse> getMe(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(accountService.getMe(userDetails.getUserId()));
    }

    @PutMapping("/preferences")
    public ResponseEntity<MeResponse> updatePreferences(
            @Valid @RequestBody UpdatePreferencesRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(accountService.updatePreferences(userDetails.getUserId(), request));
    }

    @PostMapping("/fcm-token")
    public ResponseEntity<Void> saveFcmToken(
            @Valid @RequestBody com.sep490_g47.smosp.account.dto.request.FcmTokenRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        accountService.saveFcmToken(userDetails.getUserId(), request.getToken());
        return ResponseEntity.ok().build();
    }
}

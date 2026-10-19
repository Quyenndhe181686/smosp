package com.sep490_g47.smosp.admin.controller;

import com.sep490_g47.smosp.admin.dto.request.SystemConfigUpdateRequest;
import com.sep490_g47.smosp.admin.dto.response.AiUsageStatsResponse;
import com.sep490_g47.smosp.admin.dto.response.SystemConfigResponse;
import com.sep490_g47.smosp.admin.dto.response.SystemStatsResponse;
import com.sep490_g47.smosp.admin.service.AdminSystemConfigService;
import com.sep490_g47.smosp.auth.dto.response.MessageResponse;
import com.sep490_g47.smosp.gemini.dto.AiConnectionTestResult;
import com.sep490_g47.smosp.gemini.service.GeminiService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminSystemConfigController {

    private final AdminSystemConfigService adminSystemConfigService;
    private final GeminiService geminiService;

    @GetMapping("/system-config")
    public ResponseEntity<List<SystemConfigResponse>> getAllConfigs() {
        return ResponseEntity.ok(adminSystemConfigService.getAllConfigs());
    }

    @PutMapping("/system-config")
    public ResponseEntity<MessageResponse> updateConfigs(@Valid @RequestBody SystemConfigUpdateRequest request) {
        adminSystemConfigService.updateConfigs(request);
        return ResponseEntity.ok(new MessageResponse("System configs updated successfully", true));
    }

    /**
     * AC-56-03 — Admin bấm "Kiểm tra kết nối" sau khi lưu cấu hình AI.
     *
     * POST chứ không GET dù chỉ đọc: mỗi lần gọi phát sinh một request thật ra nhà
     * cung cấp AI (tốn một lượng token nhỏ), nên không được để trình duyệt/proxy
     * cache hay tự prefetch.
     */
    @PostMapping("/ai-config/test-connection")
    public ResponseEntity<AiConnectionTestResult> testAiConnection() {
        return ResponseEntity.ok(geminiService.testConnection());
    }

    @GetMapping("/ai-usage")
    public ResponseEntity<AiUsageStatsResponse> getAiUsageStats() {
        return ResponseEntity.ok(adminSystemConfigService.getAiUsageStats());
    }

    @GetMapping("/system-status")
    public ResponseEntity<SystemStatsResponse> getSystemStats() {
        return ResponseEntity.ok(adminSystemConfigService.getSystemStats());
    }
}

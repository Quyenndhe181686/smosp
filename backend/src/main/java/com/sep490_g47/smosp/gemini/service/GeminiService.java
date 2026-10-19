package com.sep490_g47.smosp.gemini.service;

import com.sep490_g47.smosp.gemini.dto.AiConnectionTestResult;
import com.sep490_g47.smosp.gemini.dto.GeminiResponse;
import java.util.UUID;

public interface GeminiService {
    GeminiResponse generateContent(String prompt, String purpose, UUID referenceId);

    /**
     * AC-56-03 — gọi thử tới endpoint/model đang cấu hình để Admin biết cấu hình
     * vừa lưu có dùng được thật không, thay vì phải chờ một request nghiệp vụ hỏng
     * mới phát hiện.
     */
    AiConnectionTestResult testConnection();
}

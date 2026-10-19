package com.sep490_g47.smosp.recommendation.service;

import com.sep490_g47.smosp.crawler.repository.JobNormalizedRepository;
import com.sep490_g47.smosp.gemini.dto.GeminiResponse;
import com.sep490_g47.smosp.gemini.service.GeminiService;
import com.sep490_g47.smosp.recommendation.dto.response.ConsultationResponse;
import com.sep490_g47.smosp.recommendation.dto.response.RecommendationDetailResponse;
import com.sep490_g47.smosp.recommendation.entity.RecommendationItem;
import com.sep490_g47.smosp.recommendation.repository.RecommendationItemRepository;
import com.sep490_g47.smosp.recommendation.service.impl.ConsultationServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConsultationServiceTest {

    @Mock
    private RecommendationService recommendationService;

    @Mock
    private GeminiService geminiService;

    @Mock
    private JobNormalizedRepository jobNormalizedRepository;

    @Mock
    private RecommendationItemRepository recommendationItemRepository;

    @InjectMocks
    private ConsultationServiceImpl consultationService;

    private RecommendationDetailResponse mockDetail;
    private UUID nsId;
    private UUID resultId;

    @BeforeEach
    void setUp() {
        nsId = UUID.randomUUID();
        resultId = UUID.randomUUID();

        // Giả lập điểm số: skill là thế mạnh rõ ràng nhất
        mockDetail = RecommendationDetailResponse.builder()
                .id(UUID.randomUUID())
                .narrowSpecId(nsId)
                .narrowSpecName("Kiểm thử phần mềm")
                .profileScore(new BigDecimal("80.50"))
                .finalScore(new BigDecimal("80.50"))
                .gpaScore(new BigDecimal("70.0"))
                .wGpaSnapshot(new BigDecimal("0.3"))
                .skillScore(new BigDecimal("95.0"))
                .wSkillSnapshot(new BigDecimal("0.4"))
                .interestScore(new BigDecimal("60.0"))
                .wIntSnapshot(new BigDecimal("0.3"))
                .trendingWeightSnapshot(new BigDecimal("60.0"))
                .build();

        lenient().when(jobNormalizedRepository.findTop5ByNarrowSpec_IdOrderByPostedDateDesc(any())).thenReturn(Collections.emptyList());
    }

    @Test
    void testGetConsultation_SuccessAndGrounding() {
        when(recommendationService.getRecommendationItemDetail(nsId)).thenReturn(mockDetail);
        when(jobNormalizedRepository.findTop5ByNarrowSpec_IdOrderByPostedDateDesc(nsId)).thenReturn(Collections.emptyList());
        
        GeminiResponse geminiResponse = GeminiResponse.builder()
                .text("Kỹ năng của bạn đang rất phù hợp.")
                .tokenCount(10)
                .build();
        when(geminiService.generateContent(anyString(), eq("consultation"), eq(nsId)))
                .thenReturn(geminiResponse);

        ConsultationResponse result = consultationService.getConsultationForLatest(nsId);

        assertEquals("Kỹ năng của bạn đang rất phù hợp.", result.getText());

        // Verify grounding trong prompt
        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(geminiService).generateContent(promptCaptor.capture(), eq("consultation"), eq(nsId));
        String prompt = promptCaptor.getValue();

        assertTrue(prompt.contains("Kiểm thử phần mềm"));
        assertTrue(prompt.contains("95")); // skill score
        assertTrue(prompt.contains("70")); // gpa score
    }

    @Test
    void testGetConsultation_Fallback() {
        when(recommendationService.getRecommendationItemDetailByResult(resultId, nsId)).thenReturn(mockDetail);
        
        GeminiResponse failedResponse = GeminiResponse.builder()
                .text("[AI service unavailable]")
                .tokenCount(0)
                .build();
        when(geminiService.generateContent(anyString(), anyString(), any())).thenReturn(failedResponse);

        ConsultationResponse result = consultationService.getConsultationByResult(resultId, nsId);

        // Kỹ năng là điểm cao nhất (95 * 0.4 = 38 > 70 * 0.3 = 21)
        assertTrue(result.getText().contains("kỹ năng chuyên môn"));
        assertTrue(result.getText().contains("Kiểm thử phần mềm"));
    }

    @Test
    void testGetConsultation_CacheWorks() {
        when(recommendationService.getRecommendationItemDetail(nsId)).thenReturn(mockDetail);
        RecommendationItem item = RecommendationItem.builder()
                .id(mockDetail.getId())
                .build();
        when(recommendationItemRepository.findById(mockDetail.getId())).thenReturn(java.util.Optional.of(item));
        
        GeminiResponse geminiResponse = GeminiResponse.builder()
                .text("Cached Text")
                .tokenCount(10)
                .build();
        when(geminiService.generateContent(anyString(), anyString(), any())).thenReturn(geminiResponse);

        // Lần 1: gọi API
        ConsultationResponse res1 = consultationService.getConsultationForLatest(nsId);
        assertEquals("Cached Text", res1.getText());

        // Lần 2: lấy từ cache (không gọi thêm geminiService)
        ConsultationResponse res2 = consultationService.getConsultationForLatest(nsId);
        assertEquals("Cached Text", res2.getText());

        verify(geminiService, times(1)).generateContent(anyString(), anyString(), any());
    }
}

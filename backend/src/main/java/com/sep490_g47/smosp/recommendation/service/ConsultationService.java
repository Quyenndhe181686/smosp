package com.sep490_g47.smosp.recommendation.service;

import com.sep490_g47.smosp.recommendation.dto.response.ConsultationResponse;
import java.util.UUID;

public interface ConsultationService {
    ConsultationResponse getConsultationForLatest(UUID nsId);
    ConsultationResponse getConsultationByResult(UUID resultId, UUID nsId);
}

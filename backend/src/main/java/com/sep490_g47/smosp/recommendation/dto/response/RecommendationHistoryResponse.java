package com.sep490_g47.smosp.recommendation.dto.response;

import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecommendationHistoryResponse {
    private UUID id;
    private LocalDateTime calculatedAt;
}

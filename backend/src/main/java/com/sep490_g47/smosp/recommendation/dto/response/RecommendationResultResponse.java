package com.sep490_g47.smosp.recommendation.dto.response;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecommendationResultResponse {
    private UUID id;
    private LocalDateTime calculatedAt;
    private List<RecommendationItemResponse> items;
}

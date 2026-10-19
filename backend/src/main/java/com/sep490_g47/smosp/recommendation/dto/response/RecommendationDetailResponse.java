package com.sep490_g47.smosp.recommendation.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RecommendationDetailResponse {
    private UUID id;
    private UUID narrowSpecId;
    private String narrowSpecCode;
    private String narrowSpecName;
    
    private BigDecimal gpaScore;
    private BigDecimal skillScore;
    private BigDecimal interestScore;
    
    @JsonIgnore
    private BigDecimal wGpaSnapshot;
    @JsonIgnore
    private BigDecimal wSkillSnapshot;
    @JsonIgnore
    private BigDecimal wIntSnapshot;
    
    private BigDecimal profileScore;
    private BigDecimal trendingWeightSnapshot;
    private BigDecimal alphaActual;
    
    private BigDecimal svol;
    private BigDecimal sacc;
    private BigDecimal juniorRatio;
    
    private BigDecimal finalScore;
    private Integer rank;
    private Boolean fallbackApplied;
    
    private List<SkillGapResponse> skillGap;
    private List<InterestGapResponse> interestGap;
    private List<CourseSuggestionResponse> suggestedCourses;
}

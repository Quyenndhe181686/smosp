package com.sep490_g47.smosp.recommendation.dto.response;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseSuggestionResponse {
    private String code;
    private String name;
    private Integer credits;
    private String supplementsSkill;
}

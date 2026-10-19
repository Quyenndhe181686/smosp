package com.sep490_g47.smosp.roadmap.dto.response;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TermGroup {
    private Integer termOrder;
    private List<RoadmapItemResponse> courses;
}

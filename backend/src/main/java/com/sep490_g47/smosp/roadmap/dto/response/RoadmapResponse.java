package com.sep490_g47.smosp.roadmap.dto.response;

import lombok.*;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoadmapResponse {
    private UUID narrowSpecId;
    private String narrowSpecName;
    private List<TermGroup> terms;
}

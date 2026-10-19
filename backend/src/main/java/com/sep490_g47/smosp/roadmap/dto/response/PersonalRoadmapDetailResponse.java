package com.sep490_g47.smosp.roadmap.dto.response;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
@Data @Builder public class PersonalRoadmapDetailResponse {
    private UUID id;
    private UUID narrowSpecId;
    private String narrowSpecName;
    private String name;
    private LocalDateTime clonedAt;
    private LocalDateTime updatedAt;
    private List<PersonalTermGroup> terms;
}
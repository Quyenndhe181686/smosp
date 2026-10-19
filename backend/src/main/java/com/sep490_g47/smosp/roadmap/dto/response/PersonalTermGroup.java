package com.sep490_g47.smosp.roadmap.dto.response;
import lombok.*;
import java.util.List;
@Data @Builder public class PersonalTermGroup {
    private Integer termOrder;
    private List<PersonalRoadmapItemDetailResponse> courses;
}
package com.sep490_g47.smosp.roadmap.dto.response;
import lombok.*;
import java.util.List;
import java.util.UUID;
@Data @Builder public class PersonalRoadmapItemDetailResponse {
    private UUID courseId;
    private String code;
    private String name;
    private String description;
    private Integer credits;
    private String courseType;
    private List<List<UUID>> prerequisiteGroups;
    
    private String progressStatus;
    private Boolean isRemovedFromStandard;
    private Boolean manuallyEdited;
    
    private Integer originalTermNo;
    private Integer personalTermNo;
    private Boolean isAdvancedRegistration;
    
    private Boolean bookmarked;
    private String note;
    private Boolean countsTowardGpa;
    private java.math.BigDecimal grade;
    @Builder.Default
    private List<PersonalRoadmapResourceResponse> resources = new java.util.ArrayList<>();
}
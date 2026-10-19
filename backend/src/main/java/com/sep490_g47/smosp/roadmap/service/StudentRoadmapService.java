package com.sep490_g47.smosp.roadmap.service;

import com.sep490_g47.smosp.roadmap.dto.request.*;
import com.sep490_g47.smosp.roadmap.dto.response.PersonalRoadmapDetailResponse;
import com.sep490_g47.smosp.roadmap.dto.response.PersonalRoadmapSummaryResponse;

import com.sep490_g47.smosp.roadmap.dto.response.PersonalRoadmapResourceResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

public interface StudentRoadmapService {
    List<PersonalRoadmapSummaryResponse> getMyRoadmaps(UUID userId);
    PersonalRoadmapSummaryResponse cloneRoadmap(UUID userId, CloneRoadmapRequest request);
    PersonalRoadmapDetailResponse getRoadmapDetail(UUID userId, UUID roadmapId);
    PersonalRoadmapSummaryResponse renameRoadmap(UUID userId, UUID roadmapId, RenameRoadmapRequest request);
    void deleteRoadmap(UUID userId, UUID roadmapId);
    
    void syncTranscript(UUID userId, UUID roadmapId);
    void updateProgress(UUID userId, UUID roadmapId, UUID courseId, UpdateProgressRequest request);
    void updateGrade(UUID userId, UUID roadmapId, UUID courseId, UpdateGradeRequest request);
    
    void addBookmark(UUID userId, UUID roadmapId, UUID courseId);
    void removeBookmark(UUID userId, UUID roadmapId, UUID courseId);
    
    void updateNote(UUID userId, UUID roadmapId, UUID courseId, UpdateNoteRequest request);
    void removeNote(UUID userId, UUID roadmapId, UUID courseId);
    void reorderTermItems(UUID userId, UUID roadmapId, ReorderRoadmapItemsRequest request);
    void batchReorderTermItems(UUID userId, UUID roadmapId, BatchReorderRequest request);

    PersonalRoadmapResourceResponse uploadPersonalResourceFile(UUID userId, UUID roadmapId, UUID courseId, String title, String resourceType, MultipartFile file);
    PersonalRoadmapResourceResponse addPersonalResourceLink(UUID userId, UUID roadmapId, UUID courseId, AddPersonalResourceLinkRequest request);
    void deletePersonalResource(UUID userId, UUID roadmapId, UUID resourceId);
}

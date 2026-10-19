package com.sep490_g47.smosp.narrowspec.service;

import com.sep490_g47.smosp.narrowspec.dto.request.NarrowSpecRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.NarrowSpecResponse;
import com.sep490_g47.smosp.narrowspec.dto.request.NsCourseRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.NsCourseResponse;
import com.sep490_g47.smosp.narrowspec.dto.request.PublishRequest;

import java.util.List;
import java.util.UUID;

public interface NarrowSpecService {
    NarrowSpecResponse createNarrowSpec(NarrowSpecRequest request);
    NarrowSpecResponse updateNarrowSpec(UUID id, NarrowSpecRequest request);

    com.sep490_g47.smosp.roadmap.dto.response.RoadmapResponse getStandardRoadmap(UUID id);
    NarrowSpecResponse publishNarrowSpec(UUID id, PublishRequest request);
    
    List<NsCourseResponse> getNarrowSpecCourses(UUID narrowSpecId);
    List<NsCourseResponse> updateNarrowSpecCourses(UUID narrowSpecId, List<NsCourseRequest> requests);
    
    List<com.sep490_g47.smosp.narrowspec.dto.response.NsExcludedCourseResponse> getExcludedCourses(UUID narrowSpecId);
    List<com.sep490_g47.smosp.narrowspec.dto.response.NsExcludedCourseResponse> updateExcludedCourses(UUID narrowSpecId, List<com.sep490_g47.smosp.narrowspec.dto.request.NsExcludedCourseRequest> requests);
}

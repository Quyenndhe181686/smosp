package com.sep490_g47.smosp.roadmap.repository;

import com.sep490_g47.smosp.roadmap.entity.PersonalRoadmapResource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PersonalRoadmapResourceRepository extends JpaRepository<PersonalRoadmapResource, UUID> {

    List<PersonalRoadmapResource> findByPersonalRoadmapIdAndCourseIdOrderByCreatedAtAsc(UUID roadmapId, UUID courseId);

    List<PersonalRoadmapResource> findByPersonalRoadmapId(UUID roadmapId);

    long countByPersonalRoadmapIdAndCourseIdAndPublicIdIsNotNull(UUID roadmapId, UUID courseId);

    void deleteByPersonalRoadmapIdAndCourseId(UUID roadmapId, UUID courseId);
}

package com.sep490_g47.smosp.course.repository;

import com.sep490_g47.smosp.course.entity.LearningResource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LearningResourceRepository extends JpaRepository<LearningResource, UUID> {
    List<LearningResource> findByCourseId(UUID courseId);
    long countByCourseId(UUID courseId);
}

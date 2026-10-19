package com.sep490_g47.smosp.specialization.repository;

import com.sep490_g47.smosp.specialization.entity.SpecCourse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SpecCourseRepository extends JpaRepository<SpecCourse, UUID> {
    List<SpecCourse> findBySpecializationId(UUID specializationId);
    void deleteBySpecializationId(UUID specializationId);
    List<SpecCourse> findBySpecializationIdAndCourseIdIn(UUID specializationId, List<UUID> courseIds);
    List<SpecCourse> findByCourseId(UUID courseId);
}

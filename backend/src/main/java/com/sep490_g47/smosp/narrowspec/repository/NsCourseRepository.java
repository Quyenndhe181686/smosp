package com.sep490_g47.smosp.narrowspec.repository;

import com.sep490_g47.smosp.narrowspec.entity.NsCourse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface NsCourseRepository extends JpaRepository<NsCourse, UUID> {
    List<NsCourse> findByNarrowSpecId(UUID narrowSpecId);
    void deleteByNarrowSpecId(UUID narrowSpecId);
    List<NsCourse> findByNarrowSpecIdInAndCourseIdIn(List<UUID> narrowSpecIds, List<UUID> courseIds);
    List<NsCourse> findByCourseId(UUID courseId);
    List<NsCourse> findByCourseIdIn(Collection<UUID> courseIds);
}

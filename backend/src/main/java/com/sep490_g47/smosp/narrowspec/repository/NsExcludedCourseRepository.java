package com.sep490_g47.smosp.narrowspec.repository;

import com.sep490_g47.smosp.narrowspec.entity.NsExcludedCourse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NsExcludedCourseRepository extends JpaRepository<NsExcludedCourse, UUID> {
    List<NsExcludedCourse> findByNarrowSpecId(UUID narrowSpecId);
    
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true)
    @org.springframework.data.jpa.repository.Query("DELETE FROM NsExcludedCourse e WHERE e.narrowSpec.id = :narrowSpecId")
    void deleteByNarrowSpecId(@org.springframework.data.repository.query.Param("narrowSpecId") UUID narrowSpecId);
}

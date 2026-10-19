package com.sep490_g47.smosp.student.repository;

import com.sep490_g47.smosp.student.entity.StudentSkill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StudentSkillRepository extends JpaRepository<StudentSkill, UUID> {
    
    List<StudentSkill> findByStudentProfileId(UUID studentProfileId);

    List<StudentSkill> findBySkill_Id(UUID skillId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM StudentSkill s WHERE s.studentProfile.id = :studentProfileId")
    void deleteByStudentProfileId(@org.springframework.data.repository.query.Param("studentProfileId") UUID studentProfileId);
}

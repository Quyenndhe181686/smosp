package com.sep490_g47.smosp.student.repository;

import com.sep490_g47.smosp.student.entity.StudentInterest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StudentInterestRepository extends JpaRepository<StudentInterest, UUID> {
    
    List<StudentInterest> findByStudentProfileId(UUID studentProfileId);

    List<StudentInterest> findByInterestOption_Id(UUID interestOptionId);

    @Modifying(clearAutomatically = true)
    @Query("DELETE FROM StudentInterest i WHERE i.studentProfile.id = :studentProfileId")
    void deleteByStudentProfileId(@org.springframework.data.repository.query.Param("studentProfileId") UUID studentProfileId);
}

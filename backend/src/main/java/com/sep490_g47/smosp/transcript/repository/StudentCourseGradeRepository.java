package com.sep490_g47.smosp.transcript.repository;

import com.sep490_g47.smosp.transcript.entity.StudentCourseGrade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.UUID;

@Repository
public interface StudentCourseGradeRepository extends JpaRepository<StudentCourseGrade, UUID> {

    @Query("SELECT g.course.id FROM StudentCourseGrade g WHERE g.transcript.studentProfile.userAccount.id = :userId AND (g.status = 'PASSED' OR (g.grade IS NOT NULL AND g.grade >= 5.0 AND (g.status IS NULL OR g.status != 'FAILED'))) AND g.course IS NOT NULL")
    List<UUID> findPassedCourseIdsByUserId(UUID userId);

    List<StudentCourseGrade> findByTranscriptStudentProfileIdAndCourseIdOrderByUpdatedAtDesc(UUID studentProfileId, UUID courseId);

    List<StudentCourseGrade> findByTranscriptStudentProfileIdOrderByUpdatedAtDesc(UUID studentProfileId);
}

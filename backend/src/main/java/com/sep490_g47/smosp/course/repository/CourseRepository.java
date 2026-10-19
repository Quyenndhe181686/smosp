package com.sep490_g47.smosp.course.repository;

import com.sep490_g47.smosp.course.entity.Course;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface CourseRepository extends JpaRepository<Course, UUID> {
    boolean existsByCode(String code);
    boolean existsByCodeAndIdNot(String code, UUID id);
    Optional<Course> findByCode(String code);

    @EntityGraph(attributePaths = {"learningResources", "prerequisites"})
    Optional<Course> findDetailById(UUID id);

    @EntityGraph(attributePaths = {"prerequisites"})
    @Query("SELECT c FROM Course c WHERE " +
           "(:code IS NULL OR LOWER(c.code) LIKE LOWER(CONCAT('%', CAST(:code AS string), '%'))) AND " +
           "(:name IS NULL OR LOWER(c.name) LIKE LOWER(CONCAT('%', CAST(:name AS string), '%'))) AND " +
           "(:isActive IS NULL OR c.isActive = :isActive) AND " +
           "(:countsTowardGpa IS NULL OR c.countsTowardGpa = :countsTowardGpa)")
    Page<Course> findCoursesWithFilters(
            @Param("code") String code, 
            @Param("name") String name, 
            @Param("isActive") Boolean isActive, 
            @Param("countsTowardGpa") Boolean countsTowardGpa, 
            Pageable pageable);

    @Query(value = "SELECT COUNT(*) FROM ns_course WHERE course_id = :courseId", nativeQuery = true)
    long countUsagesInNarrowSpec(@Param("courseId") UUID courseId);

    @Query(value = "SELECT COUNT(*) FROM course_prerequisite WHERE prerequisite_id = :courseId", nativeQuery = true)
    long countUsagesAsPrerequisite(@Param("courseId") UUID courseId);

    @Query(value = "SELECT COUNT(*) FROM spec_course WHERE course_id = :courseId", nativeQuery = true)
    long countUsagesInSpecCourse(@Param("courseId") UUID courseId);

    @Query(value = "SELECT COUNT(*) FROM personal_roadmap_item WHERE course_id = :courseId", nativeQuery = true)
    long countUsagesInPersonalRoadmap(@Param("courseId") UUID courseId);

    @Query(value = "SELECT COUNT(*) FROM roadmap_bookmark WHERE course_id = :courseId", nativeQuery = true)
    long countUsagesInRoadmapBookmark(@Param("courseId") UUID courseId);

    @Query(value = "SELECT COUNT(*) FROM roadmap_note WHERE course_id = :courseId", nativeQuery = true)
    long countUsagesInRoadmapNote(@Param("courseId") UUID courseId);

    @Query(value = "SELECT COUNT(*) FROM student_course_grade WHERE course_id = :courseId", nativeQuery = true)
    long countUsagesInStudentGrade(@Param("courseId") UUID courseId);

    @Query(value = "SELECT COUNT(*) FROM course_skill_map WHERE course_id = :courseId", nativeQuery = true)
    long countUsagesInSkillMap(@Param("courseId") UUID courseId);

    /**
     * Môn học chưa được gán kỹ năng nào — [id, code, name].
     *
     * Bỏ qua môn có "COM" trong mã hoặc tên: đó là các môn kỹ năng mềm/đại cương
     * không nằm trong ma trận kỹ năng chuyên môn, luôn xuất hiện như nhiễu.
     */
    @Query("SELECT c.id, c.code, c.name FROM Course c "
            + "WHERE NOT EXISTS (SELECT csm.id FROM com.sep490_g47.smosp.skill.entity.CourseSkillMap csm WHERE csm.courseId = c.id) "
            + "AND UPPER(c.code) NOT LIKE '%COM%' AND UPPER(c.name) NOT LIKE '%COM%' "
            + "ORDER BY c.code")
    java.util.List<Object[]> findCoursesWithoutSkill();

    /**
     * Tìm môn học theo mã HOẶC tên, trả [id, code, name] — dùng cho ô tìm kiếm của
     * người dùng cuối (màn báo lỗi nội dung).
     *
     * Khác {@link #findCoursesWithFilters}: hàm kia AND hai điều kiện code và name
     * nên gõ "JPD" vào một ô tìm kiếm chung sẽ không khớp gì. Chỉ trả môn đang
     * hoạt động — sinh viên không báo lỗi được cho môn đã ẩn khỏi chương trình.
     */
    @Query("SELECT c.id, c.code, c.name FROM Course c "
            + "WHERE c.isActive = true "
            + "AND (LOWER(c.code) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%')) "
            + "  OR LOWER(c.name) LIKE LOWER(CONCAT('%', CAST(:q AS string), '%'))) "
            + "ORDER BY c.code")
    java.util.List<Object[]> searchActiveCourseOptions(@Param("q") String q, Pageable pageable);
}

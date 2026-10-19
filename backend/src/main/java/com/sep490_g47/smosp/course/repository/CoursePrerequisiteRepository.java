package com.sep490_g47.smosp.course.repository;

import com.sep490_g47.smosp.course.entity.CoursePrerequisite;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface CoursePrerequisiteRepository extends JpaRepository<CoursePrerequisite, UUID> {

    /** Các cạnh tiên quyết ĐI RA từ những môn này (môn -> tiên quyết của nó). */
    List<CoursePrerequisite> findByCourse_IdIn(Collection<UUID> courseIds);

    /** Các cạnh tiên quyết ĐI VÀO những môn này (môn nào đang lấy chúng làm tiên quyết). */
    List<CoursePrerequisite> findByPrerequisiteCourse_IdIn(Collection<UUID> prerequisiteIds);
}

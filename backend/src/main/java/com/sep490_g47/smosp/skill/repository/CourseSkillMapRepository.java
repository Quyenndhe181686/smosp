package com.sep490_g47.smosp.skill.repository;

import com.sep490_g47.smosp.skill.entity.CourseSkillMap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CourseSkillMapRepository extends JpaRepository<CourseSkillMap, UUID> {
    
    List<CourseSkillMap> findBySkillId(UUID skillId);
    
    List<CourseSkillMap> findByCourseIdIn(List<UUID> courseIds);
    
    void deleteBySkillId(UUID skillId);
    
}

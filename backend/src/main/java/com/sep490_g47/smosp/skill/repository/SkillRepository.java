package com.sep490_g47.smosp.skill.repository;

import com.sep490_g47.smosp.skill.entity.Skill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SkillRepository extends JpaRepository<Skill, UUID> {
    
    boolean existsBySpecializationIdAndName(UUID specializationId, String name);

    List<Skill> findBySpecializationId(UUID specializationId);

    List<Skill> findBySpecializationIdAndIsActiveTrue(UUID specializationId);

}

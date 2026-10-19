package com.sep490_g47.smosp.curriculum.repository;

import com.sep490_g47.smosp.curriculum.entity.Curriculum;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CurriculumRepository extends JpaRepository<Curriculum, UUID>, JpaSpecificationExecutor<Curriculum> {
    boolean existsByCurriculumCode(String curriculumCode);
    boolean existsByCurriculumCodeAndIdNot(String curriculumCode, UUID id);
    Optional<Curriculum> findByCurriculumCode(String curriculumCode);
    List<Curriculum> findBySpecialization_IdOrderByCurriculumCodeAsc(UUID specializationId);
}

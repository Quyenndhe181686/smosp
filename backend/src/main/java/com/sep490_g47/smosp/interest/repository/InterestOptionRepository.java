package com.sep490_g47.smosp.interest.repository;

import com.sep490_g47.smosp.interest.entity.InterestOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface InterestOptionRepository extends JpaRepository<InterestOption, UUID> {
    
    boolean existsBySpecializationIdAndLabel(UUID specializationId, String label);

    List<InterestOption> findBySpecializationId(UUID specializationId);

    List<InterestOption> findBySpecializationIdAndIsActiveTrue(UUID specializationId);

}

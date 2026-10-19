package com.sep490_g47.smosp.narrowspec.repository;

import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecWeightConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface NarrowSpecWeightConfigRepository extends JpaRepository<NarrowSpecWeightConfig, UUID> {
    Optional<NarrowSpecWeightConfig> findByNarrowSpecId(UUID narrowSpecId);
}

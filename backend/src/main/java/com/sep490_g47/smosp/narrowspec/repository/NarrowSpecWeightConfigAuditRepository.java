package com.sep490_g47.smosp.narrowspec.repository;

import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecWeightConfigAudit;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface NarrowSpecWeightConfigAuditRepository extends JpaRepository<NarrowSpecWeightConfigAudit, UUID> {
    Page<NarrowSpecWeightConfigAudit> findByNarrowSpecIdOrderByChangedAtDesc(UUID narrowSpecId, Pageable pageable);
}

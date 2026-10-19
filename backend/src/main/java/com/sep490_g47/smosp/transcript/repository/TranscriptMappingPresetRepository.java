package com.sep490_g47.smosp.transcript.repository;

import com.sep490_g47.smosp.transcript.entity.TranscriptMappingPreset;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TranscriptMappingPresetRepository extends JpaRepository<TranscriptMappingPreset, UUID> {
    Optional<TranscriptMappingPreset> findByIsActiveTrue();
    List<TranscriptMappingPreset> findByIsDefaultTrue();

    // Soft-delete: cac truy van nghiep vu phai loai preset da bi xoa mem, khong
    // dung findAll()/count() tho nua.
    List<TranscriptMappingPreset> findByIsDeletedFalse();
    long countByIsDeletedFalse();
}


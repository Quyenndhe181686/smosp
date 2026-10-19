package com.sep490_g47.smosp.transcript.repository;

import com.sep490_g47.smosp.transcript.entity.Transcript;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TranscriptRepository extends JpaRepository<Transcript, UUID> {
    List<Transcript> findByStudentProfileIdOrderByUploadTimeDesc(UUID studentProfileId);
    List<Transcript> findAllByStudentProfileId(UUID studentProfileId);
    Optional<Transcript> findFirstByStudentProfileIdOrderByUploadTimeDesc(UUID studentProfileId);
    long countByStudentProfileIdAndUploadTimeAfter(UUID studentProfileId, LocalDateTime time);
}

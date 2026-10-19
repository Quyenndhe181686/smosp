package com.sep490_g47.smosp.narrowspec.repository;

import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface NarrowSpecRepository extends JpaRepository<NarrowSpecialization, UUID> {
    boolean existsBySpecializationIdAndIsPublishedTrue(UUID specializationId);
    boolean existsBySpecialization_Major_IdAndIsPublishedTrue(UUID majorId);
    long countBySpecializationId(UUID specializationId);
    boolean existsByCode(String code);
    boolean existsByNameIgnoreCaseAndSpecializationId(String name, UUID specializationId);
    java.util.Optional<NarrowSpecialization> findByCode(String code);
    boolean existsByCodeAndIdNot(String code, UUID id);
    java.util.List<NarrowSpecialization> findBySpecializationId(UUID specializationId);
    java.util.List<NarrowSpecialization> findBySpecializationIdAndIsPublishedTrue(UUID specializationId);

    @org.springframework.data.jpa.repository.Query("SELECT n FROM NarrowSpecialization n WHERE LOWER(n.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(n.code) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    java.util.List<NarrowSpecialization> searchByKeyword(@org.springframework.data.repository.query.Param("keyword") String keyword);

    @org.springframework.data.jpa.repository.Query("SELECT n FROM NarrowSpecialization n WHERE n.isPublished = true AND (LOWER(n.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(n.code) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    java.util.List<NarrowSpecialization> searchByKeywordAndIsPublishedTrue(@org.springframework.data.repository.query.Param("keyword") String keyword);

    long countByIsPublishedTrue();

    java.util.List<NarrowSpecialization> findAllByIsPublishedTrue();

    @org.springframework.data.jpa.repository.Query("SELECT ns FROM NarrowSpecialization ns WHERE ns.isPublished = true " +
            "AND ns.specialization.vietnamworksCategoryIds IS NOT NULL " +
            "AND ns.specialization.vietnamworksCategoryIds <> ''")
    java.util.List<NarrowSpecialization> findCrawlableForTrendingWeight();

    /**
     * Độ phủ Tag Map của TẤT CẢ narrow spec trong đúng một query — thay cho việc
     * dashboard gọi GET /narrow-specs/{id}/tag-map cho từng CNH.
     *
     * Trả về: [nsId, nsCode, nsName, specId, specName, majorId, majorName,
     *          soTagKyNang, soTagSoThich]. LEFT JOIN nên CNH không có tag nào vẫn
     * xuất hiện với hai số đếm bằng 0.
     */
    @org.springframework.data.jpa.repository.Query("SELECT ns.id, ns.code, ns.name, s.id, s.name, m.id, m.name, "
            + "SUM(CASE WHEN t.sourceType = 'SKILL' THEN 1 ELSE 0 END), "
            + "SUM(CASE WHEN t.sourceType = 'INTEREST' THEN 1 ELSE 0 END) "
            + "FROM NarrowSpecialization ns "
            + "JOIN ns.specialization s "
            + "JOIN s.major m "
            + "LEFT JOIN com.sep490_g47.smosp.tagmap.entity.TagMap t ON t.narrowSpecId = ns.id "
            + "GROUP BY ns.id, ns.code, ns.name, s.id, s.name, m.id, m.name "
            + "ORDER BY m.name, s.name, ns.code")
    java.util.List<Object[]> findTagMapCoverage();

    /** [nsId, nsCode, nsName, specId, specName, majorId, majorName] cho mọi CNH. */
    @org.springframework.data.jpa.repository.Query("SELECT ns.id, ns.code, ns.name, s.id, s.name, m.id, m.name "
            + "FROM NarrowSpecialization ns "
            + "JOIN ns.specialization s "
            + "JOIN s.major m "
            + "ORDER BY m.name, s.name, ns.code")
    java.util.List<Object[]> findAllWithHierarchy();
}

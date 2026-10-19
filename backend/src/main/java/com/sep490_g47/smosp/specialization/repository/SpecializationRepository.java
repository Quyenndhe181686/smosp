package com.sep490_g47.smosp.specialization.repository;

import com.sep490_g47.smosp.specialization.entity.Specialization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SpecializationRepository extends JpaRepository<Specialization, UUID> {
    boolean existsByCode(String code);
    boolean existsByNameIgnoreCaseAndMajorId(String name, UUID majorId);
    long countByMajorId(UUID majorId);
    Optional<Specialization> findByCode(String code);

    java.util.List<Specialization> findByMajorId(UUID majorId);
    java.util.List<Specialization> findByMajorIdAndIsActiveTrue(UUID majorId);
    boolean existsByMajorIdAndIsActiveTrue(UUID majorId);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Specialization s WHERE LOWER(s.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(s.code) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    java.util.List<Specialization> searchByKeyword(@org.springframework.data.repository.query.Param("keyword") String keyword);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Specialization s WHERE s.isActive = true AND (LOWER(s.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR LOWER(s.code) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    java.util.List<Specialization> searchByKeywordAndIsActiveTrue(@org.springframework.data.repository.query.Param("keyword") String keyword);

    long countByIsActiveTrue();

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Specialization s WHERE s.vietnamworksCategoryIds IS NOT NULL AND s.vietnamworksCategoryIds <> ''")
    java.util.List<Specialization> findAllWithVietnamworksCategoryConfigured();

    /**
     * Như trên nhưng CHỈ lấy Chuyên ngành đang hoạt động — dùng cho /run-all.
     *
     * Bản không lọc {@code isActive} ở trên khiến Chuyên ngành đã bị CM tắt vẫn bị
     * cào: vẫn tốn lượt gọi VietnamWorks, vẫn sinh dữ liệu thô và vẫn được đưa vào
     * tính Trending Weight. Giữ lại bản cũ vì vẫn còn nơi khác dùng, nhưng luồng
     * cào hàng loạt phải đi qua hàm này.
     */
    @org.springframework.data.jpa.repository.Query("SELECT s FROM Specialization s WHERE s.isActive = true "
            + "AND s.vietnamworksCategoryIds IS NOT NULL AND s.vietnamworksCategoryIds <> ''")
    java.util.List<Specialization> findActiveWithVietnamworksCategoryConfigured();
}

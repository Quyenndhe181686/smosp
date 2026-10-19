package com.sep490_g47.smosp.crawler.repository;

import com.sep490_g47.smosp.crawler.entity.CrawlerKeywordMap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface CrawlerKeywordMapRepository extends JpaRepository<CrawlerKeywordMap, UUID> {

    List<CrawlerKeywordMap> findByNarrowSpecId(UUID narrowSpecId);

    boolean existsByNarrowSpecIdAndKeywordIgnoreCase(UUID narrowSpecId, String keyword);

    boolean existsByNarrowSpecIdAndKeywordIgnoreCaseAndIdNot(UUID narrowSpecId, String keyword, UUID excludeId);

    // Dùng cho NormalizeService sau này (Giai đoạn 4) — lấy toàn bộ keyword
    // active theo Specialization.
    // JOIN FETCH narrowSpec là BẮT BUỘC: list này được load ở normalizeBySpecialization
    // (không transaction) rồi truyền xuống processOne để đọc ns.getId()/getCode().
    // Trước đây lazy proxy vẫn nạp được nhờ open-in-view giữ session theo request;
    // từ khi normalize chạy trên crawlExecutor thì không còn request scope nào, thiếu
    // fetch join sẽ ném LazyInitializationException.
    @Query("SELECT k FROM CrawlerKeywordMap k JOIN FETCH k.narrowSpec "
         + "WHERE k.narrowSpec.specialization.id = :specId AND k.active = true")
    List<CrawlerKeywordMap> findActiveBySpecializationId(@Param("specId") UUID specId);
}

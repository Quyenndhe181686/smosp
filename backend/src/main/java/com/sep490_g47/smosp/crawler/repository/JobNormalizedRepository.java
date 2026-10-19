package com.sep490_g47.smosp.crawler.repository;

import com.sep490_g47.smosp.crawler.entity.JobNormalized;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;
import java.time.LocalDate;

@Repository
public interface JobNormalizedRepository extends JpaRepository<JobNormalized, UUID> {
    List<JobNormalized> findByRawJob_Batch_Id(UUID batchId);

    // Số job đã gán vào 1 NS — con số duy nhất có thật ở mức narrow_spec cho phần
    // breakdown của normalize-status (job_normalize_tracking chỉ có specialization_id).
    long countByNarrowSpec_Id(UUID narrowSpecId);

    Integer countByNarrowSpec_IdAndPostedDateBetween(UUID narrowSpecId, LocalDate start, LocalDate end);

    Integer countByNarrowSpec_IdAndJuniorTrueAndPostedDateBetween(UUID narrowSpecId, LocalDate start, LocalDate end);

    // Số NGÀY riêng biệt có tin trong khoảng — không phải số tin. Dùng để biết một
    // cửa sổ có được phủ dữ liệu thật hay chỉ là vài ngày lẻ: VietnamWorks không
    // trả tin cũ hơn ~45 ngày, nên cửa sổ trước dễ bị cụt và làm mẫu số của Sacc
    // teo lại, sinh ra "tăng trưởng" giả. Đếm ở mức toàn hệ thống chứ không theo
    // từng NS — theo NS thì quá thưa để nói lên điều gì.
    // Native cho đồng bộ với 2 query còn lại của file, và vì JPQL bị Hibernate
    // validate lúc bootstrap — câu sai làm app không khởi động được.
    @Query(value = """
        SELECT count(DISTINCT posted_date) FROM job_normalized
        WHERE narrow_spec_id IS NOT NULL AND posted_date BETWEEN :start AND :end
        """, nativeQuery = true)
    long countDaysWithDataBetween(@Param("start") LocalDate start, @Param("end") LocalDate end);

    // Upsert native, thay cho saveAll() — saveAll() chỉ queue INSERT vào persistence
    // context, không đảm bảo chạy xuống DB trước 1 delete/select khác trong cùng
    // transaction (đã gây duplicate key thật trên "uk6q7qxppi1am0nx7dpsor38kuo").
    // Native query chạy thẳng SQL, không đi qua flush queue của Hibernate.
    @Modifying
    @Query(value = """
        INSERT INTO job_normalized (id, raw_id, narrow_spec_id, title, job_level, salary_range, is_junior, posted_date, created_at, updated_at)
        VALUES (gen_random_uuid(), :rawId, :narrowSpecId, :title, :jobLevel, :salaryRange, :isJunior, :postedDate, now(), now())
        ON CONFLICT (raw_id, narrow_spec_id) DO UPDATE SET
            title = EXCLUDED.title,
            job_level = EXCLUDED.job_level,
            salary_range = EXCLUDED.salary_range,
            is_junior = EXCLUDED.is_junior,
            posted_date = EXCLUDED.posted_date,
            updated_at = now()
        """, nativeQuery = true)
    void upsertJobNormalized(@Param("rawId") UUID rawId, @Param("narrowSpecId") UUID narrowSpecId,
            @Param("title") String title, @Param("jobLevel") String jobLevel,
            @Param("salaryRange") String salaryRange, @Param("isJunior") boolean isJunior,
            @Param("postedDate") LocalDate postedDate);

    // Dọn match cũ của raw_job này thuộc NS nằm trong Specialization đang xét, trừ
    // các narrow_spec_id trong keepIds (kết quả match mới nhất). keepIdsEmpty=true
    // dùng khi job giờ unmatched hoàn toàn (xoá sạch) — Postgres/Spring Data JPA
    // native query không cho bind list rỗng vào NOT IN, nên luôn truyền keepIds
    // không rỗng (placeholder khi cần) và dùng keepIdsEmpty để short-circuit.
    @Modifying
    @Query(value = """
        DELETE FROM job_normalized
        WHERE raw_id = :rawId
          AND narrow_spec_id IN (SELECT id FROM narrow_spec WHERE specialization_id = :specializationId)
          AND (:keepIdsEmpty = true OR narrow_spec_id NOT IN (:keepIds))
        """, nativeQuery = true)
    void deleteStaleMatches(@Param("rawId") UUID rawId, @Param("specializationId") UUID specializationId,
            @Param("keepIds") List<UUID> keepIds, @Param("keepIdsEmpty") boolean keepIdsEmpty);

    // Top 5 job gần nhất đã match vào narrow_spec này — dùng cho khối "Cơ hội
    // nghề nghiệp liên quan" và đưa vào prompt Gemini. Không cần join thêm gì vì
    // title đã lưu sẵn trên chính JobNormalized lúc normalize.
    List<JobNormalized> findTop5ByNarrowSpec_IdOrderByPostedDateDesc(UUID narrowSpecId);
}

package com.sep490_g47.smosp.crawler.repository;

import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface TrendingWeightProposalRepository extends JpaRepository<TrendingWeightProposal, UUID> {
    Integer countByNarrowSpec_Id(UUID narrowSpecId);

    java.util.List<TrendingWeightProposal> findByStatus(com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus status);

    // UC-95/AC-49-04/BR-37: de xuat PENDING qua 7 ngay khong ai duyet phai tu
    // dong chuyen sang AUTO_REJECTED — xem TrendingWeightProposalExpiryJob.
    java.util.List<TrendingWeightProposal> findByStatusAndCreatedAtBefore(
            com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus status,
            java.time.LocalDateTime before);
    
    /**
     * Các đề xuất còn PENDING của một nhóm CNH — dùng để đánh SUPERSEDED cho bản cũ
     * ngay trước khi đợt tính mới ghi bản thay thế, giữ bất biến "mỗi CNH nhiều nhất
     * một đề xuất đang chờ duyệt".
     */
    java.util.List<TrendingWeightProposal> findByStatusAndNarrowSpec_IdIn(
            com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus status,
            java.util.Collection<UUID> narrowSpecIds);

    java.util.List<TrendingWeightProposal> findAllByOrderByCreatedAtDesc();
    
    java.util.List<TrendingWeightProposal> findByNarrowSpecIdOrderByVersionDesc(UUID narrowSpecId);
    
    java.util.Optional<TrendingWeightProposal> findByNarrowSpecIdAndVersionAndStatus(UUID narrowSpecId, Integer version, com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus status);
    
    @org.springframework.data.jpa.repository.Query("SELECT p FROM TrendingWeightProposal p " +
            "LEFT JOIN FETCH p.narrowSpec ns " +
            "LEFT JOIN FETCH ns.specialization s " +
            "LEFT JOIN FETCH s.major m " +
            "LEFT JOIN FETCH p.reviewedBy rb " +
            "LEFT JOIN FETCH p.crawlBatch cb " +
            "LEFT JOIN FETCH cb.scopeSpecialization cbs " +
            "LEFT JOIN FETCH cb.triggeredBy cbt " +
            "WHERE p.status = :status " +
            "ORDER BY p.createdAt DESC")
    java.util.List<TrendingWeightProposal> findByStatusWithDetails(@org.springframework.data.repository.query.Param("status") com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus status);

    @org.springframework.data.jpa.repository.Query("SELECT p FROM TrendingWeightProposal p " +
            "LEFT JOIN FETCH p.narrowSpec ns " +
            "LEFT JOIN FETCH ns.specialization s " +
            "LEFT JOIN FETCH s.major m " +
            "LEFT JOIN FETCH p.reviewedBy rb " +
            "LEFT JOIN FETCH p.crawlBatch cb " +
            "LEFT JOIN FETCH cb.scopeSpecialization cbs " +
            "LEFT JOIN FETCH cb.triggeredBy cbt " +
            "ORDER BY p.createdAt DESC")
    java.util.List<TrendingWeightProposal> findAllWithDetails();
    
    @org.springframework.data.jpa.repository.Query("SELECT COALESCE(MAX(p.version), 0) FROM TrendingWeightProposal p WHERE p.narrowSpec.id = :narrowSpecId")
    Integer findMaxVersionByNarrowSpecId(@org.springframework.data.repository.query.Param("narrowSpecId") UUID narrowSpecId);

    // trending_weight_proposal không có FK tới crawl_batch, nên "đã tính TW cho batch
    // này chưa" được suy ra bằng: có proposal nào của NS thuộc Specialization đó được
    // tạo sau thời điểm batch kết thúc hay không.
    long countByNarrowSpec_Specialization_IdAndCreatedAtAfter(UUID specializationId, java.time.LocalDateTime after);

    /**
     * Proposal theo trạng thái, kèm sẵn tên CNH / chuyên ngành / ngành — dashboard
     * cần hiển thị cả cây phân cấp mà không phải tải riêng danh mục để tra ngược.
     *
     * Trả về: [proposalId, nsId, nsCode, nsName, specId, specName, majorId,
     *          majorName, twOld, twNew, isFallback, createdAt, reviewedAt].
     */
    @org.springframework.data.jpa.repository.Query("SELECT p.id, ns.id, ns.code, ns.name, s.id, s.name, m.id, m.name, "
            + "p.twOld, p.twNew, p.isFallback, p.createdAt, p.reviewedAt "
            + "FROM TrendingWeightProposal p "
            + "JOIN p.narrowSpec ns "
            + "JOIN ns.specialization s "
            + "JOIN s.major m "
            + "WHERE p.status = :status "
            + "ORDER BY p.createdAt DESC")
    java.util.List<Object[]> findByStatusWithHierarchy(
            @org.springframework.data.repository.query.Param("status") com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus status);

    /**
     * [nsId, version, createdAt, isFallback] của mọi proposal, sắp theo CNH rồi
     * version giảm dần — bản ghi ĐẦU TIÊN của mỗi nsId chính là lần tính trending
     * weight gần nhất (cùng thứ tự với GET /trending-weight/history). Dùng để suy
     * ra "CNH nào đang dùng hệ số dự phòng / lâu chưa có dữ liệu" trong một query,
     * thay cho một request history cho mỗi CNH.
     */
    @org.springframework.data.jpa.repository.Query("SELECT p.narrowSpec.id, p.version, p.createdAt, p.isFallback "
            + "FROM TrendingWeightProposal p "
            + "ORDER BY p.narrowSpec.id, p.version DESC")
    java.util.List<Object[]> findRecencyByNarrowSpec();
}

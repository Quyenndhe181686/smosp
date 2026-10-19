package com.sep490_g47.smosp.admin.repository;

import com.sep490_g47.smosp.admin.entity.AiApiUsageLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface AiApiUsageLogRepository extends JpaRepository<AiApiUsageLog, UUID> {

    // AC-56-02b/BV-41: truoc day khong loc theo provider, gop chung moi provider
    // lam mot. Vo hai luc nay vi he thong chi co dung "gemini", nhung them mot
    // provider AI thu hai se lam quota cua Gemini bi tinh nham token cua provider
    // khac — dung Long lam kieu tra ve (khong phai long) vi SUM co the ra NULL
    // khi khong co dong nao khop.
    @Query("SELECT SUM(a.tokenCount) FROM AiApiUsageLog a WHERE a.provider = :provider AND a.calledAt >= :from")
    Long sumTokenCountSince(@Param("provider") String provider, @Param("from") LocalDateTime from);

    @Query("SELECT a.purpose, SUM(a.tokenCount) FROM AiApiUsageLog a "
            + "WHERE a.provider = :provider AND a.calledAt >= :from GROUP BY a.purpose")
    List<Object[]> sumTokenByPurposeSince(@Param("provider") String provider, @Param("from") LocalDateTime from);

    /**
     * Tổng token theo từng tháng — dùng cho biểu đồ mức tiêu thụ token AI của
     * dashboard Admin. Mỗi dòng: [năm, tháng, tổng token].
     */
    @Query("SELECT YEAR(a.calledAt), MONTH(a.calledAt), SUM(a.tokenCount) FROM AiApiUsageLog a " +
           "WHERE a.provider = :provider AND a.calledAt >= :from GROUP BY YEAR(a.calledAt), MONTH(a.calledAt) " +
           "ORDER BY YEAR(a.calledAt), MONTH(a.calledAt)")
    List<Object[]> sumTokenByMonthSince(@Param("provider") String provider, @Param("from") LocalDateTime from);
}

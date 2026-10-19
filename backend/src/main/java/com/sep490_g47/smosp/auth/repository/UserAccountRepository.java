package com.sep490_g47.smosp.auth.repository;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserAccountRepository extends JpaRepository<UserAccount, UUID> {

    Optional<UserAccount> findByEmail(String email);

    Optional<UserAccount> findByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByUsername(String username);

    /**
     * Mọi tài khoản đang hoạt động của một vai trò. Dùng để phát thông báo cho cả
     * nhóm, ví dụ báo cho toàn bộ Content Manager khi có báo cáo lỗi mới (AC-09-01).
     *
     * Lọc theo status để không gửi cho tài khoản đã bị Admin vô hiệu hoá — chúng
     * vẫn nằm trong bảng nhưng không ai đăng nhập để đọc.
     */
    java.util.List<UserAccount> findByRole_NameAndStatus(String roleName, String status);

    @Query("SELECT u FROM UserAccount u JOIN u.role r WHERE r.name != 'ROLE_SUPER_ADMIN' " +
           "AND (CAST(:keyword AS string) IS NULL OR LOWER(u.username) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(u.email) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) " +
           "OR LOWER(u.displayName) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))) " +
           "AND (CAST(:roleName AS string) IS NULL OR r.name = CAST(:roleName AS string)) " +
           "AND (CAST(:status AS string) IS NULL OR u.status = CAST(:status AS string))")
    Page<UserAccount> findAllForAdmin(@Param("keyword") String keyword,
                                      @Param("roleName") String roleName,
                                      @Param("status") String status,
                                      Pageable pageable);

    @Query("SELECT COUNT(u) FROM UserAccount u JOIN u.role r WHERE r.name = 'ROLE_ADMIN' AND u.status = 'ACTIVE'")
    long countActiveAdmins();

    @Query("SELECT r.name, COUNT(u) FROM UserAccount u JOIN u.role r WHERE r.name != 'ROLE_SUPER_ADMIN' GROUP BY r.name")
    java.util.List<Object[]> countByRoleGrouped();

    @Query("SELECT u.status, COUNT(u) FROM UserAccount u JOIN u.role r WHERE r.name != 'ROLE_SUPER_ADMIN' GROUP BY u.status")
    java.util.List<Object[]> countByStatusGrouped();

    /** Số tài khoản theo từng trạng thái trong phạm vi một vai trò. Mỗi dòng: [status, số lượng]. */
    @Query("SELECT u.status, COUNT(u) FROM UserAccount u JOIN u.role r WHERE r.name = :roleName GROUP BY u.status")
    java.util.List<Object[]> countByStatusForRole(@Param("roleName") String roleName);

    /** Số tài khoản của một vai trò được tạo từ mốc thời gian truyền vào. */
    @Query("SELECT COUNT(u) FROM UserAccount u JOIN u.role r WHERE r.name = :roleName AND u.createdAt >= :from")
    long countCreatedSinceForRole(@Param("roleName") String roleName,
                                  @Param("from") java.time.LocalDateTime from);
}
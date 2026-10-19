package com.sep490_g47.smosp.roadmap.repository;

import com.sep490_g47.smosp.roadmap.entity.PersonalRoadmap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PersonalRoadmapRepository extends JpaRepository<PersonalRoadmap, UUID> {
    List<PersonalRoadmap> findByStudentProfileIdOrderByCreatedAtDesc(UUID studentProfileId);

    /**
     * Các lộ trình cá nhân đã clone từ một narrow spec — dùng để biết ai bị ảnh
     * hưởng khi CM gỡ công khai narrow spec đó (BR-25).
     *
     * Cố ý dùng derived query thay vì JPQL có JOIN FETCH: JPQL bị Hibernate kiểm
     * lúc bootstrap nên câu sai làm app không khởi động được, còn derived query
     * chỉ suy từ tên thuộc tính. Đổi lại là N+1 khi nạp studentProfile.userAccount,
     * chấp nhận được vì đây là thao tác hiếm của CM trên vài lộ trình, và cả vòng
     * lặp nằm trong transaction của publishNarrowSpec() nên LAZY vẫn nạp được.
     */
    List<PersonalRoadmap> findByNarrowSpecId(UUID narrowSpecId);
}

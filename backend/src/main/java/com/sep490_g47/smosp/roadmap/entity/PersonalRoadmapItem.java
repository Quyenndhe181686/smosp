package com.sep490_g47.smosp.roadmap.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.course.entity.Course;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "personal_roadmap_item", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"roadmap_id", "course_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonalRoadmapItem extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "roadmap_id", nullable = false)
    private PersonalRoadmap personalRoadmap;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(name = "progress_status", nullable = false)
    @Builder.Default
    private String progressStatus = "PLANNED"; // PLANNED / IN_PROGRESS / COMPLETED

    @Column(name = "is_removed_from_standard", nullable = false)
    @Builder.Default
    private Boolean isRemovedFromStandard = false;

    @Column(name = "manually_edited", nullable = false)
    @Builder.Default
    private Boolean manuallyEdited = false;

    // CỐ Ý cho phép null, KHÔNG đặt @Builder.Default.
    //
    // Hai cột này được thêm cùng tính năng "đổi kỳ cá nhân". Khai báo cũ là
    // nullable=false + DEFAULT 1 + @Builder.Default=1, nên giá trị không bao giờ
    // null — và điều đó giết chết nhánh dự phòng mà chính getRoadmapDetail() đã
    // viết sẵn cho dữ liệu cũ:
    //
    //     int origTerm = item.getOriginalTermNo() != null ? item.getOriginalTermNo()
    //             : (standardCourseTermMap.containsKey(cId) ? ... : 1);
    //
    // Điều kiện != null luôn đúng nên vế tra standardCourseTermMap là code chết.
    // Cộng với ddl-auto=update chạy ALTER TABLE ... ADD COLUMN ... DEFAULT 1, mọi
    // bản ghi có TRƯỚC khi deploy nhận giá trị 1 → toàn bộ Personal Roadmap của
    // sinh viên cũ dồn hết về Kỳ 1, mất cấu trúc 9 kỳ, không lỗi không cảnh báo.
    //
    // Để null thì bản ghi cũ mang null và nhánh dự phòng sống lại đúng ý đồ ban
    // đầu. Bản ghi mới vẫn luôn có giá trị vì cloneRoadmap() set tường minh từ
    // Standard Roadmap.
    @Column(name = "original_term_no")
    private Integer originalTermNo;

    @Column(name = "personal_term_no")
    private Integer personalTermNo;

    @Column(name = "is_advanced_registration", nullable = false, columnDefinition = "boolean DEFAULT false")
    @Builder.Default
    private Boolean isAdvancedRegistration = false;

    @Column(name = "grade", precision = 4, scale = 2)
    private java.math.BigDecimal grade;
}

package com.sep490_g47.smosp.course.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "course_prerequisite", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"course_id", "prerequisite_id"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CoursePrerequisite extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "prerequisite_id", nullable = false)
    private Course prerequisiteCourse;

    @Column(name = "group_no", nullable = false)
    @Builder.Default
    private Integer groupNo = 1;
}

package com.sep490_g47.smosp.transcript.entity;

import com.sep490_g47.smosp.course.entity.Course;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.util.UUID;

import com.sep490_g47.smosp.common.entity.BaseEntity;

@Entity
@Table(name = "student_course_grade")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class StudentCourseGrade extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transcript_id", nullable = false)
    private Transcript transcript;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "course_id", nullable = true)
    private Course course;

    @Column(name = "course_code_raw", nullable = false)
    private String courseCodeRaw;

    @Column(name = "grade", precision = 4, scale = 1)
    private BigDecimal grade;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private CourseGradeStatus status;
}

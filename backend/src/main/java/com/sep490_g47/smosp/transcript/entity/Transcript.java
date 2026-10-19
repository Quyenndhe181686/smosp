package com.sep490_g47.smosp.transcript.entity;

import com.sep490_g47.smosp.student.entity.StudentProfile;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.sep490_g47.smosp.common.entity.BaseEntity;

@Entity
@Table(name = "transcript")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Transcript extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_profile_id", nullable = false)
    private StudentProfile studentProfile;

    @Column(name = "upload_time", nullable = false)
    private LocalDateTime uploadTime;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "total_credits")
    private Integer totalCredits;

    @Column(name = "completed_courses")
    private Integer completedCourses;

    @OneToMany(mappedBy = "transcript", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<StudentCourseGrade> grades = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preset_id")
    private TranscriptMappingPreset preset;
}

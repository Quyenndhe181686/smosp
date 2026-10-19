package com.sep490_g47.smosp.student.entity;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.major.entity.Major;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "student_profile")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class StudentProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private UserAccount userAccount;

    @Column(name = "full_name")
    private String fullName;

    @Column(name = "student_code")
    private String studentCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "major_id")
    private Major major;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "specialization_id")
    private Specialization specialization;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_narrow_spec_id")
    private NarrowSpecialization currentNarrowSpec;

    @Column(name = "current_term")
    private Integer currentTerm;

    @Column(name = "cumulative_gpa", precision = 5, scale = 3)
    private BigDecimal cumulativeGpa;

    @Column(name = "profile_updated_at")
    private LocalDateTime profileUpdatedAt;
}

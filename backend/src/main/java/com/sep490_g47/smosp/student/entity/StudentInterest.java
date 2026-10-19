package com.sep490_g47.smosp.student.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.interest.entity.InterestOption;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "student_interest",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"student_profile_id", "interest_option_id"})
    }
)
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class StudentInterest extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_profile_id", nullable = false)
    private StudentProfile studentProfile;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interest_option_id", nullable = false)
    private InterestOption interestOption;

    @Column(name = "declared_at", nullable = false)
    private LocalDateTime declaredAt;
}

package com.sep490_g47.smosp.roadmap.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.student.entity.StudentProfile;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "personal_roadmap")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonalRoadmap extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private StudentProfile studentProfile;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "narrow_spec_id", nullable = false)
    private NarrowSpecialization narrowSpec;

    @Column(nullable = false)
    private String name;

    @Column(name = "cloned_at", nullable = false)
    private LocalDateTime clonedAt;

    @OneToMany(mappedBy = "personalRoadmap", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PersonalRoadmapItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "personalRoadmap", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RoadmapBookmark> bookmarks = new ArrayList<>();

    @OneToMany(mappedBy = "personalRoadmap", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<RoadmapNote> notes = new ArrayList<>();

    @OneToMany(mappedBy = "personalRoadmap", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<PersonalRoadmapResource> resources = new ArrayList<>();
}

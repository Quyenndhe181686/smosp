package com.sep490_g47.smosp.roadmap.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import com.sep490_g47.smosp.course.entity.Course;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "personal_roadmap_resource", indexes = {
        @Index(name = "idx_p_resource_roadmap_course", columnList = "roadmap_id, course_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonalRoadmapResource extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "roadmap_id", nullable = false)
    private PersonalRoadmap personalRoadmap;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String url;

    @Column(name = "public_id")
    private String publicId;

    @Column(name = "resource_type", nullable = false)
    private String resourceType; // e.g., FILE, LINK, DOCS, ARTICLE, EXERCISE

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "file_name")
    private String fileName;
}

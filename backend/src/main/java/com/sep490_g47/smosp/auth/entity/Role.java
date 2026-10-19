package com.sep490_g47.smosp.auth.entity;

import com.sep490_g47.smosp.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "role")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
public class Role extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true, length = 50)
    private String name; // ROLE_STUDENT, ROLE_CONTENT_MANAGER, ROLE_ADMIN

    @Column(columnDefinition = "TEXT")
    private String description;
}

package com.sep490_g47.smosp.admin.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserListItemResponse {
    private UUID id;
    private String identifier;
    private String displayName;
    private String role;
    private String status;
    private LocalDateTime createdAt;
    private Boolean forceChangePassword;
}

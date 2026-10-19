package com.sep490_g47.smosp.account.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import com.sep490_g47.smosp.common.dto.response.BaseResponse;

import java.util.Map;
import java.util.UUID;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponse extends BaseResponse {
    private UUID id;
    private String type;
    private String title;
    private String body;
    private Map<String, Object> metadata;
    private Boolean isRead;
}

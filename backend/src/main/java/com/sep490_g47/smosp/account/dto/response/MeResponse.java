package com.sep490_g47.smosp.account.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import com.sep490_g47.smosp.common.dto.response.BaseResponse;

import java.util.UUID;

@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class MeResponse extends BaseResponse {
    private UUID id;
    private String role;
    private String identifier;
    private String displayName;
    private boolean notifEnabled;
    private boolean hasPassword;
    private String status;
}

package com.sep490_g47.smosp.account.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdatePreferencesRequest {

    @NotBlank(message = "Tên hiển thị không được để trống")
    private String displayName;

    @NotNull(message = "notifEnabled is required")
    private Boolean notifEnabled;
}

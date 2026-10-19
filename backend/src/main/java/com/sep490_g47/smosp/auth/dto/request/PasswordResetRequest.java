package com.sep490_g47.smosp.auth.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class PasswordResetRequest {

    @NotBlank
    @Email(message = "Email không hợp lệ")
    private String email;
}
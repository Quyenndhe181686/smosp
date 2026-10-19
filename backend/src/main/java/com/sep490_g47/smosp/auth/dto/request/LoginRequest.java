package com.sep490_g47.smosp.auth.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Data
public class LoginRequest {

    @NotBlank(message = "Identifier cannot be blank")
    private String identifier; // email (Student) hoặc username (CM/Admin)

    @NotBlank(message = "Password cannot be blank")
//    @Size(min = 8, max = 128, message = "Password must be between 8 and 128 characters")
//    @Pattern(
//        regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9]).+$",
//        message = "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
//    )
    private String password;
}
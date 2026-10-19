package com.sep490_g47.smosp.admin.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateStatusRequest {
    // Whitelist dung; khong chi @NotNull. AdminUserServiceImpl.updateStatus() so
    // khop chinh xac "INACTIVE" (chu hoa) de kich hoat guard "giu it nhat 1 Admin
    // active" (BR-20) va huy session (BR-44); AuthServiceImpl.login() cung so
    // khop chinh xac "INACTIVE" de chan dang nhap. Gui "inactive" chu thuong truoc
    // day vuot ca hai guard MA tai khoan van dang nhap duoc binh thuong, vi khong
    // cho nao trong chuoi nhan ra day la trang thai INACTIVE that.
    //
    // KHONG cho PENDING_VERIFICATION: do la trang thai he thong tu gan luc dang
    // ky (AuthPersistence.java:71), khong phai thu Admin duoc gan tay.
    @NotNull
    @Pattern(regexp = "ACTIVE|INACTIVE", message = "status phải là ACTIVE hoặc INACTIVE")
    private String status;
}

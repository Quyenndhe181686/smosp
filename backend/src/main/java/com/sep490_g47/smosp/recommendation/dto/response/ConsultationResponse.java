package com.sep490_g47.smosp.recommendation.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConsultationResponse {
    private String text;
    // Rỗng nếu narrow_spec chưa đủ dữ liệu job — FE ẩn hẳn khối UI khi rỗng,
    // không hiện placeholder giả (tránh giống card "0%" nhìn như lỗi).
    private List<String> relatedJobs;
}

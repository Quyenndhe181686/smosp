package com.sep490_g47.smosp.crawler.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490_g47.smosp.auth.utils.HashUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Dấu vân tay của một raw_job, tính TRÊN ĐÚNG những trường mà normalize đọc.
 *
 * VÌ SAO KHÔNG SO CẢ PAYLOAD
 * --------------------------
 * {@code persistPage} trước đây so nguyên chuỗi JSON 106 trường để biết tin có
 * đổi không. Trong đó có hàng loạt trường biến động mỗi lần fetch:
 * {@code numOfApplications}, {@code lastSyncedOn}, {@code lastUpdatedOn},
 * {@code prettyApprovedOn}, {@code prettyOnlineOn}, {@code onlineOnText},
 * {@code priorityOrder}, {@code exposureStatusUpdatedOn}, {@code isRefreshJob}…
 *
 * Đo thật: 4.886/5.463 raw_job (89%) từng bị đánh dấu "đã đổi". Mỗi lần như vậy
 * {@code resetToPendingByRawJobId} đá tracking của MỌI Specialization dùng chung
 * tin đó về PENDING — trung bình 3,32 ngành. Ngành nào đã normalize xong thì
 * không còn sự kiện nào chạy lại, tracking nằm PENDING vĩnh viễn và UI quay mãi.
 *
 * NHỮNG GÌ ĐƯỢC BĂM
 * -----------------
 * Đúng bốn thứ {@code NormalizeItemProcessor} lấy ra khỏi payload:
 * <ul>
 *   <li>{@code jobTitle}</li>
 *   <li>{@code jobLevelId} — quyết định cả {@code isJunior}</li>
 *   <li>{@code approvedOn} nhưng CHỈ 10 ký tự đầu, vì normalize cũng chỉ lấy
 *       phần ngày ({@code LocalDate.parse(approvedOnStr.substring(0, 10))});
 *       giữ cả giờ phút thì hash lại đổi vô ích</li>
 *   <li>{@code skills[].skillName} — trim + lowercase y hệt normalize, bỏ chuỗi
 *       rỗng, và SẮP XẾP vì thứ tự không ảnh hưởng kết quả khớp</li>
 * </ul>
 *
 * Đổi những trường này thì normalize ra kết quả khác, nên phải chạy lại. Đổi
 * bất cứ trường nào khác thì không.
 *
 * ⚠️ Lớp này phải bám sát {@code NormalizeItemProcessor.processOne}. Thêm trường
 * mới vào phần đọc payload ở đó thì phải thêm vào đây, nếu không tin sẽ không
 * được normalize lại khi trường đó thay đổi.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RawJobContentHash {

    /** Ký tự phân tách, chọn ký tự điều khiển để không đụng nội dung thật. */
    private static final String FIELD_SEP = "";
    private static final String SKILL_SEP = "";

    private final ObjectMapper objectMapper;

    /**
     * @return chuỗi hash, hoặc null nếu payload không parse được — bên gọi coi
     *         null là "không so sánh được" và fallback về so chuỗi thô.
     */
    public String of(String rawPayloadJson) {
        if (rawPayloadJson == null) {
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(rawPayloadJson);

            String jobTitle = root.path("jobTitle").asText("");
            int jobLevelId = root.path("jobLevelId").asInt(-1);

            String approvedOn = root.path("approvedOn").asText("");
            String postedDate = approvedOn.length() >= 10 ? approvedOn.substring(0, 10) : approvedOn;

            List<String> skills = new ArrayList<>();
            JsonNode skillsNode = root.path("skills");
            if (skillsNode.isArray()) {
                for (JsonNode skill : skillsNode) {
                    String name = skill.path("skillName").asText("").trim().toLowerCase();
                    if (!name.isEmpty()) {
                        skills.add(name);
                    }
                }
            }
            Collections.sort(skills);

            return HashUtil.sha256(jobTitle + FIELD_SEP + jobLevelId + FIELD_SEP + postedDate
                    + FIELD_SEP + String.join(SKILL_SEP, skills));
        } catch (Exception e) {
            log.warn("Khong parse duoc raw_payload de tinh content hash — se fallback so chuoi tho", e);
            return null;
        }
    }
}

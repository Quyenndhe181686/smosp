package com.sep490_g47.smosp.recommendation.service.impl;

import com.sep490_g47.smosp.crawler.entity.JobNormalized;
import com.sep490_g47.smosp.crawler.repository.JobNormalizedRepository;
import com.sep490_g47.smosp.gemini.dto.GeminiResponse;
import com.sep490_g47.smosp.gemini.service.GeminiService;
import com.sep490_g47.smosp.recommendation.dto.response.ConsultationResponse;
import com.sep490_g47.smosp.recommendation.dto.response.RecommendationDetailResponse;
import com.sep490_g47.smosp.recommendation.entity.RecommendationItem;
import com.sep490_g47.smosp.recommendation.repository.RecommendationItemRepository;
import com.sep490_g47.smosp.recommendation.service.ConsultationService;
import com.sep490_g47.smosp.recommendation.service.RecommendationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConsultationServiceImpl implements ConsultationService {

    private final RecommendationService recommendationService;
    private final GeminiService geminiService;
    private final JobNormalizedRepository jobNormalizedRepository;
    private final RecommendationItemRepository recommendationItemRepository;

    // Rewrite prompt + add related jobs
    // Created by: BaoTQ - 260813
    // Số job tối thiểu để hiển thị khối "Cơ hội nghề nghiệp liên quan" — dưới
    // ngưỡng này ẩn hẳn khối thay vì hiện 1-2 job trông thưa thớt/thiếu tin cậy.
    private static final int MIN_JOBS_TO_SHOW = 2;

    @Override
    public ConsultationResponse getConsultationForLatest(UUID nsId) {
        RecommendationDetailResponse detail = recommendationService.getRecommendationItemDetail(nsId);
        return processConsultation(detail);
    }

    @Override
    public ConsultationResponse getConsultationByResult(UUID resultId, UUID nsId) {
        RecommendationDetailResponse detail = recommendationService.getRecommendationItemDetailByResult(resultId, nsId);
        return processConsultation(detail);
    }

    /**
     * Bản giải thích được lưu THẲNG vào {@code recommendation_item.ai_explanation},
     * đúng chỗ thiết kế CSDL đã chừa sẵn từ đầu (cùng cờ {@code explanation_cached}).
     *
     * Trước đây chỗ này dùng một {@code ConcurrentHashMap} trong bộ nhớ với TTL 10
     * phút, còn hai cột kia không nơi nào đọc hay ghi. Hệ quả: mỗi lần khởi động lại
     * là mất sạch, nhiều instance không dùng chung được, và cùng một sinh viên xem
     * lại đúng một chuyên ngành sau 10 phút lại tốn thêm một lượt gọi Gemini — token
     * mất tiền thật.
     *
     * KHÔNG cần TTL: một RecommendationItem là ảnh chụp của ĐÚNG MỘT lần chạy gợi ý,
     * mọi số liệu trong nó đã cố định, nên lời giải thích cho nó cũng không có lý do
     * gì đổi theo thời gian. Chạy lại gợi ý sinh ra item mới → tự khắc có giải thích
     * mới. Đây là ngữ nghĩa đúng hơn hẳn TTL 10 phút cũ.
     *
     * CỐ Ý không có {@code @Transactional}: giữa phần đọc và phần ghi có một lời gọi
     * Gemini kéo dài hàng chục giây, bọc transaction quanh đây đồng nghĩa giam một DB
     * connection suốt thời gian đó trên một endpoint sinh viên nào cũng gọi được —
     * đúng lý do {@code GeminiServiceImpl.generateContent()} cũng không bọc. Lời gọi
     * {@code save()} lẻ đã tự chạy trong transaction ngắn của Spring Data.
     */
    private ConsultationResponse processConsultation(RecommendationDetailResponse detail) {
        UUID itemId = detail.getId();

        // 1. Lấy top job thật liên quan tới narrow_spec — dùng thẳng quan hệ
        // JobNormalized.narrowSpec đã có sẵn từ lúc normalize (keyword matching),
        // không match lại. Dưới ngưỡng MIN_JOBS_TO_SHOW thì coi như chưa đủ data,
        // trả rỗng để FE ẩn khối UI, và Gemini cũng không nhắc tới trong văn bản.
        //
        // Tính lại mỗi lần thay vì lưu kèm: không có cột nào để chứa, và đây là một
        // truy vấn theo index, rẻ hơn nhiều so với một lượt gọi Gemini.
        List<JobNormalized> recentJobs = jobNormalizedRepository
                .findTop5ByNarrowSpec_IdOrderByPostedDateDesc(detail.getNarrowSpecId());
        List<String> relatedJobs = recentJobs.size() >= MIN_JOBS_TO_SHOW
                ? recentJobs.stream().map(JobNormalized::getTitle).filter(t -> t != null && !t.isBlank()).distinct().toList()
                : List.of();

        // 2. Đã có bản giải thích lưu sẵn thì dùng lại, không gọi AI nữa.
        RecommendationItem item = recommendationItemRepository.findById(itemId).orElse(null);
        if (item != null && Boolean.TRUE.equals(item.getExplanationCached())
                && item.getAiExplanation() != null && !item.getAiExplanation().isBlank()) {
            return new ConsultationResponse(item.getAiExplanation(), relatedJobs);
        }

        // 3. Build prompt
        String prompt = buildPrompt(detail, relatedJobs);

        // 4. Call Gemini
        GeminiResponse geminiResponse = geminiService.generateContent(prompt, "consultation", detail.getNarrowSpecId());

        String text = geminiResponse.getText();
        boolean aiSucceeded = text != null && !text.trim().isEmpty()
                && !text.contains("[AI service unavailable]");

        // 5. Fallback if failed
        if (!aiSucceeded) {
            text = generateFallbackText(detail);
        }

        // 6. CHỈ lưu khi AI thật sự trả về nội dung.
        //
        // Lưu cả văn bản dự phòng sẽ bật explanation_cached=true và đóng đinh vĩnh
        // viễn đoạn template đó vào item: nhánh số 2 ở trên sẽ chặn mọi lần thử lại,
        // nên một sự cố AI thoáng qua (hết quota, mạng lỗi, sai API key) biến thành
        // hỏng vĩnh viễn. Không lưu thì lần xem sau tự động gọi lại AI.
        if (aiSucceeded && item != null) {
            item.setAiExplanation(text);
            item.setExplanationCached(true);
            recommendationItemRepository.save(item);
        } else if (item == null) {
            log.warn("[consultation] Khong tim thay RecommendationItem {} de luu ai_explanation", itemId);
        }

        return new ConsultationResponse(text, relatedJobs);
    }

    /**
     * Prompt viết lại theo giọng cố vấn thật, không nhắc thuật ngữ nội bộ
     * ("trọng số", "chuẩn hóa"), số làm tròn khớp UI, có ví dụ mẫu (few-shot) để
     * Gemini bám đúng cấu trúc 4 phần thay vì tự do diễn giải.
     */
    private String buildPrompt(RecommendationDetailResponse detail, List<String> relatedJobs) {
        int matchPercent = (int) Math.round(nz(detail.getFinalScore()));
        int gpaScore = (int) Math.round(nz(detail.getGpaScore()));
        int skillScore = (int) Math.round(nz(detail.getSkillScore()));
        int interestScore = (int) Math.round(nz(detail.getInterestScore()));
        int trendingWeight = (int) Math.round(nz(detail.getTrendingWeightSnapshot()));

        // Yếu tố mạnh nhất theo đúng công thức thật (điểm x trọng số), nhưng diễn
        // giải tự nhiên cho Gemini, không lộ số trọng số thô ra prompt dạng kỹ thuật.
        BigDecimal wGpa = detail.getWGpaSnapshot() != null ? detail.getWGpaSnapshot() : new BigDecimal("0.40");
        BigDecimal wSkill = detail.getWSkillSnapshot() != null ? detail.getWSkillSnapshot() : new BigDecimal("0.35");
        BigDecimal wInt = detail.getWIntSnapshot() != null ? detail.getWIntSnapshot() : new BigDecimal("0.25");

        BigDecimal gpaWeighted = nzBig(detail.getGpaScore()).multiply(wGpa);
        BigDecimal skillWeighted = nzBig(detail.getSkillScore()).multiply(wSkill);
        BigDecimal interestWeighted = nzBig(detail.getInterestScore()).multiply(wInt);
        String strongestFactor = "sự yêu thích với lĩnh vực này";
        if (gpaWeighted.compareTo(skillWeighted) >= 0 && gpaWeighted.compareTo(interestWeighted) >= 0) {
            strongestFactor = "kết quả học tập";
        } else if (skillWeighted.compareTo(gpaWeighted) >= 0 && skillWeighted.compareTo(interestWeighted) >= 0) {
            strongestFactor = "kỹ năng chuyên môn đã tích lũy";
        }

        String marketNote = trendingWeight >= 50
                ? "Thị trường ngành này hiện đang có nhu cầu tuyển dụng khá tích cực — hãy nhắc điều này với giọng khích lệ."
                : "Chưa có đủ tín hiệu thị trường nổi bật cho ngành này — bỏ qua phần liên hệ thị trường, đừng nhắc tiêu cực.";

        String jobsNote = relatedJobs.isEmpty()
                ? "Chưa có dữ liệu vị trí công việc thật cho ngành này — không tự bịa tên công việc."
                : "Một vài vị trí công việc thật gần đây liên quan tới ngành này: "
                        + String.join(", ", relatedJobs) + ".";

        return String.format(
            "Bạn là một cố vấn học vụ đang trò chuyện trực tiếp, ấm áp và chân thành với một sinh viên. " +
            "Dựa ĐÚNG các số liệu sau (không thêm thông tin ngoài, không tự bịa số liệu hay tên công việc), " +
            "viết đoạn tư vấn tiếng Việt TỰ NHIÊN như con người nói chuyện — " +
            "TUYỆT ĐỐI KHÔNG dùng các từ kỹ thuật/nội bộ như \"trọng số\", \"chuẩn hóa\", \"điểm phù hợp Profile_Score\", " +
            "không dùng số thập phân dài (chỉ dùng số nguyên, VD \"67%%\" không phải \"66.91%%\").\n\n" +
            "Dữ liệu:\n" +
            "- Chuyên ngành hẹp: %s\n" +
            "- Mức độ phù hợp tổng thể: %d%%\n" +
            "- Điểm học tập: %d/100\n" +
            "- Điểm kỹ năng: %d/100\n" +
            "- Điểm sở thích: %d/100\n" +
            "- Yếu tố đang mạnh nhất: %s\n" +
            "- %s\n" +
            "- %s\n\n" +
            "Viết theo đúng cấu trúc 4 phần, tổng cộng 4-5 câu:\n" +
            "1. Mở đầu cá nhân hoá — nhắc tên ngành và mức độ phù hợp.\n" +
            "2. Điểm mạnh nổi bật — diễn giải tự nhiên, gắn với yếu tố đang mạnh nhất ở trên.\n" +
            "3. Liên hệ thị trường theo đúng chỉ dẫn ở trên (bỏ qua nếu được yêu cầu bỏ qua).\n" +
            "4. Gợi ý cải thiện ngắn gọn + 1 câu nhắc đây là gợi ý dựa dữ liệu, không phải cam kết.\n\n" +
            "Ví dụ mẫu về giọng văn cần đạt được (không copy nguyên văn, chỉ tham khảo cách viết):\n" +
            "\"Chào bạn! Với mức độ phù hợp 72%%, Kỹ sư cầu nối Nhật Bản đang là một lựa chọn khá sáng giá " +
            "với bạn. Sự yêu thích của bạn với lĩnh vực này rất rõ ràng — đây chính là động lực lớn nhất " +
            "giúp bạn theo đuổi ngành này lâu dài. Thêm vào đó, nhu cầu tuyển dụng ngành này hiện đang khá " +
            "sôi động, mở ra nhiều cơ hội việc làm sau khi ra trường. Để tự tin hơn, bạn nên dành thời gian " +
            "trau dồi thêm kỹ năng chuyên môn — đây sẽ là mảnh ghép giúp hồ sơ của bạn hoàn thiện hơn. " +
            "Đây là gợi ý dựa trên dữ liệu, không phải cam kết nhé!\"",
            detail.getNarrowSpecName(), matchPercent, gpaScore, skillScore, interestScore,
            strongestFactor, marketNote, jobsNote
        );
    }

    private String generateFallbackText(RecommendationDetailResponse detail) {
        // Fallback đơn giản: tìm yếu tố có điểm nhân trọng số cao nhất — giọng văn
        // giữ ấm áp tương tự prompt chính, không lộ thuật ngữ nội bộ.
        BigDecimal wGpa = detail.getWGpaSnapshot() != null ? detail.getWGpaSnapshot() : new BigDecimal("0.40");
        BigDecimal wSkill = detail.getWSkillSnapshot() != null ? detail.getWSkillSnapshot() : new BigDecimal("0.35");
        BigDecimal wInt = detail.getWIntSnapshot() != null ? detail.getWIntSnapshot() : new BigDecimal("0.25");

        BigDecimal gpa = nzBig(detail.getGpaScore()).multiply(wGpa);
        BigDecimal skill = nzBig(detail.getSkillScore()).multiply(wSkill);
        BigDecimal interest = nzBig(detail.getInterestScore()).multiply(wInt);

        String strength = "sự yêu thích của bạn với lĩnh vực này";
        if (gpa.compareTo(skill) >= 0 && gpa.compareTo(interest) >= 0) {
            strength = "kết quả học tập của bạn";
        } else if (skill.compareTo(gpa) >= 0 && skill.compareTo(interest) >= 0) {
            strength = "kỹ năng chuyên môn bạn đã tích lũy";
        }

        return String.format(
                "Chào bạn! Với chuyên ngành %s, điểm mạnh nổi bật nhất của bạn hiện đang nằm ở %s. " +
                "Các yếu tố còn lại vẫn còn dư địa để cải thiện thêm, bạn có thể dành thời gian trau dồi dần. " +
                "Đây là gợi ý dựa trên dữ liệu, không phải cam kết nhé!",
                detail.getNarrowSpecName(), strength);
    }

    private double nz(BigDecimal value) {
        return value == null ? 0.0 : value.doubleValue();
    }

    private BigDecimal nzBig(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
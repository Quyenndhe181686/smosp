package com.sep490_g47.smosp.common.config;

import com.sep490_g47.smosp.auth.entity.Role;
import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.RoleRepository;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {


    private final RoleRepository roleRepository;
    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final com.sep490_g47.smosp.transcript.repository.TranscriptMappingPresetRepository presetRepository;
    private final com.sep490_g47.smosp.student.repository.StudentProfileRepository studentProfileRepository;
    private final com.sep490_g47.smosp.crawler.repository.CrawlerSourceRepository crawlerSourceRepository;
    private final com.sep490_g47.smosp.admin.repository.SystemConfigRepository systemConfigRepository;

    /** Mật khẩu mặc định cho tài khoản mẫu — chỉ dùng được khi chạy dev. */
    private static final String DEV_DEFAULT_PASSWORD = "12345678";

    /**
     * Có tạo 3 tài khoản mẫu (admin / contentmanager / student) hay không.
     * Đặt {@code smosp.seed.accounts.enabled=false} ở môi trường thật.
     */
    @org.springframework.beans.factory.annotation.Value("${smosp.seed.accounts.enabled:true}")
    private boolean seedAccounts;

    /**
     * Mật khẩu cho 3 tài khoản mẫu. Đặt qua biến môi trường
     * {@code SMOSP_SEED_ACCOUNTS_PASSWORD} để không dùng mật khẩu mặc định.
     */
    @org.springframework.beans.factory.annotation.Value("${smosp.seed.accounts.password:" + DEV_DEFAULT_PASSWORD + "}")
    private String seedPassword;

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void run(String... args) {
        List<String> roles = List.of("ROLE_STUDENT", "ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN");
        for (String roleName : roles) {
            if (roleRepository.findByName(roleName).isEmpty()) {
                roleRepository.save(Role.builder().name(roleName).build());
                log.info("Seeded role: {}", roleName);
            }
        }

        seedSampleAccounts();
        seedReferenceData();
        seedSystemConfigs();
    }

    /**
     * Ba tài khoản mẫu để chạy dev.
     *
     * VÌ SAO PHẢI TẮT ĐƯỢC: class này là {@link CommandLineRunner} không gắn
     * {@code @Profile}, mà dự án cũng chưa cấu hình profile nào — nghĩa là nó chạy
     * ở MỌI môi trường, kể cả production. Trước đây nó tạo một ROLE_SUPER_ADMIN
     * với mật khẩu "12345678" nằm ngay trong mã nguồn công khai.
     *
     * Lưu ý {@code forceChangePassword} KHÔNG cứu được tình huống này: nó chỉ là
     * cờ trả về cho frontend, người biết mật khẩu vẫn đăng nhập được rồi tự đổi
     * sang mật khẩu của mình và chiếm luôn tài khoản. Cách duy nhất có tác dụng là
     * không tạo tài khoản đó, hoặc không dùng mật khẩu ai cũng biết.
     */
    private void seedSampleAccounts() {
        if (!seedAccounts) {
            log.info("[seed] smosp.seed.accounts.enabled=false — bo qua 3 tai khoan mau");
            return;
        }
        if (DEV_DEFAULT_PASSWORD.equals(seedPassword)) {
            log.warn("[seed] Dang tao tai khoan mau voi MAT KHAU MAC DINH cong khai trong ma nguon. "
                    + "Chi chap nhan duoc khi chay dev. O moi truong that phai dat "
                    + "smosp.seed.accounts.enabled=false, hoac dat SMOSP_SEED_ACCOUNTS_PASSWORD.");
        }

        // Seed Admin User
        if (userAccountRepository.findByUsername("admin").isEmpty()) {
            Role adminRole = roleRepository.findByName("ROLE_SUPER_ADMIN").orElseThrow();
            UserAccount adminUser = userAccountRepository.save(UserAccount.builder()
                    .username("admin")
                    .email("admin@smosp.com")
                    .passwordHash(passwordEncoder.encode(seedPassword))
                    .role(adminRole)
                    .build());
            log.info("Seeded admin user");
        }

        // Seed Content Manager User
        if (userAccountRepository.findByUsername("contentmanager").isEmpty()) {
            Role cmRole = roleRepository.findByName("ROLE_CONTENT_MANAGER").orElseThrow();
            userAccountRepository.save(UserAccount.builder()
                    .username("contentmanager")
                    .email("contentmanager@smosp.com")
                    .passwordHash(passwordEncoder.encode(seedPassword))
                    .role(cmRole)
                    .build());
            log.info("Seeded content manager user");
        }

        // Seed Student User
        if (userAccountRepository.findByUsername("student").isEmpty()) {
            Role studentRole = roleRepository.findByName("ROLE_STUDENT").orElseThrow();
            UserAccount studentAcc = userAccountRepository.save(UserAccount.builder()
                    .username("student")
                    .email("student@smosp.com")
                    .passwordHash(passwordEncoder.encode(seedPassword))
                    .role(studentRole)
                    .status("ACTIVE")
                    .build());
            
            studentProfileRepository.save(com.sep490_g47.smosp.student.entity.StudentProfile.builder()
                    .userAccount(studentAcc)
                    .fullName("Test Student")
                    .studentCode("HE181686")
                    .build());
            log.info("Seeded student user and profile");
        }
    }

    /** Dữ liệu tham chiếu hệ thống cần để chạy — luôn seed, không phụ thuộc cờ tài khoản mẫu. */
    private void seedReferenceData() {
        // Seed Default Transcript Mapping Preset
        if (presetRepository.count() == 0) {
            java.util.Map<String, String> mapping = new java.util.HashMap<>();
            mapping.put("courseCode", "Subject Code");
            mapping.put("grade", "Grade");
            mapping.put("status", "Status");
            
            com.sep490_g47.smosp.transcript.entity.TranscriptMappingPreset defaultPreset = 
                    com.sep490_g47.smosp.transcript.entity.TranscriptMappingPreset.builder()
                            .presetName("FPT Standard Transcript Format")
                            .columnMapping(mapping)
                            .isDefault(true)
                            .isActive(true)
                            .build();
            presetRepository.save(defaultPreset);
            log.info("Seeded default transcript mapping preset");
        }
        // Seed Crawler Source
        if (crawlerSourceRepository.findByAdapterKey("vietnamworks").isEmpty()) {
            crawlerSourceRepository.save(com.sep490_g47.smosp.crawler.entity.CrawlerSource.builder()
                    .name("VietnamWorks")
                    .adapterKey("vietnamworks")
                    .isEnabled(true)
                    .build());
            log.info("Seeded VietnamWorks crawler source");
        }
    }

    private void seedSystemConfigs() {
        // CHỈ tạo khi thiếu, không bao giờ ghi đè.
        //
        // Trước đây khối này chia if/else theo count()==0. Hai nhánh dần lệch nhau:
        // nhánh else ghi đè VÔ ĐIỀU KIỆN svol_threshold về "5" mỗi lần khởi động,
        // nên Admin đổi giá trị qua UI xong restart là mất, không log không cảnh báo.
        // Đó vốn là migration 100→5 của commit ff6c400 (2026-07-20), chạy xong nhiệm
        // vụ nhưng không ai dọn. crawler_schedule cũng bị ghi đè description y vậy.
        //
        // Gộp hai nhánh về một danh sách + ensureConfig() để không còn chỗ cho kiểu
        // lệch đó: thêm key mới chỉ cần thêm một dòng, và không nhánh nào ghi đè
        // được lựa chọn của Admin.
        ensureConfig("ai_provider", "gemini", "AI Provider");
        ensureConfig("ai_model", "gemini-2.5-flash", "AI Model");
        ensureConfig("ai_max_tokens", "1000", "AI Max Tokens");
        ensureConfig("ai_monthly_token_quota", "1000000",
                "Ngưỡng token AI dùng/tháng — cảnh báo Admin khi đạt 80% (BV-41)");
        // SỐ NGÀY, không phải cron. Ba nơi cùng đọc key này — CrawlScheduler
        // (parseIntervalDays), whitelist ghi của AdminSystemConfigServiceImpl
        // (intInRange(1,30)) và màn DataCrawlerConfigPage (parseInt) — đều hiểu là
        // số ngày. Seed cron "0 0 0 * * MON" làm scheduler log warn mỗi phút rồi rơi
        // về mặc định 7, còn màn Admin báo "không đọc được cấu hình".
        // Giá trị 7 khớp DEFAULT_INTERVAL_DAYS của CrawlScheduler.
        ensureConfig("crawler_schedule", "7",
                "Chu kỳ cào tự động, tính bằng SỐ NGÀY (1–30). CrawlScheduler đọc key này");
        ensureConfig("crawler_max_pages_safety_cap", "200",
                "Trần an toàn cứng số trang tối đa crawler được phép gọi 1 lần — chỉ để chặn vòng lặp vô hạn "
                        + "nếu API trả nbPages bất thường, KHÔNG phải giới hạn nghiệp vụ");
        ensureConfig("svol_threshold", "5",
                "Số tin tối thiểu trong một cửa sổ để Sacc được coi là đo được. Dưới ngưỡng thì narrow spec "
                        + "rơi vào hồ sơ SPARSE và TW chỉ phản ánh Svol");
        // 15 chứ không phải 30: VietnamWorks chỉ trả ~45 ngày lịch sử, nên cửa sổ 30
        // ngày đẩy cửa sổ SO SÁNH ra ngoài vùng có dữ liệu (phủ 37% số ngày) và sinh
        // "tăng trưởng" ảo — trung vị Sacc +385%, 30/31 narrow spec "tăng" trên 100%.
        // Ở 15 ngày độ phủ đạt 100% và trung vị về -0.04.
        ensureConfig("tw_window_days", "15", "Số ngày của một cửa sổ Trending Weight");
        ensureConfig("tw_min_prev_coverage", "0.8",
                "Tỉ lệ ngày CÓ DỮ LIỆU tối thiểu của cửa sổ trước để Sacc được dùng (0..1). Dưới ngưỡng thì "
                        + "mọi narrow spec về hồ sơ SPARSE");
        ensureConfig("tw_emerging_max_svol", "15",
                "Svol phải DƯỚI ngưỡng này thì narrow spec mới được xếp hồ sơ EMERGING");
        ensureConfig("tw_emerging_min_sacc", "0.10",
                "Sacc phải TỪ ngưỡng này trở lên thì narrow spec mới được xếp hồ sơ EMERGING");
        // 30 ≈ p95 của phân phối Svol quan sát được trên 2574 đề xuất (p95 = 31, trung
        // vị 2, max 145). Ở mức này 5.9% CNH bão hoà ở 100 điểm.
        // 0.7 ≈ p95 của phân phối Sacc trên 891 đề xuất không fallback (p05 -0.53,
        // trung vị -0.06, p95 +0.71). Biên ĐỐI XỨNG: [-0.7, +0.7] -> [0, 100].
        ensureConfig("tw_sacc_cap", "0.7",
                "Biên đối xứng của Sacc khi chuẩn hoá: |Sacc| từ ngưỡng này trở lên đều bão hoà "
                        + "(0 hoặc 100 điểm). Thay cho chuẩn hoá min-max theo đợt");
        ensureConfig("tw_svol_cap", "30",
                "Trần bão hoà của Svol khi chuẩn hoá: từ ngưỡng này trở lên đều tính 100 điểm. "
                        + "Thay cho chuẩn hoá min-max theo đợt, để TW so sánh được giữa các đợt cào");
    }

    /**
     * Tạo config nếu chưa có, và KHÔNG động vào nếu đã có.
     *
     * Đây là điểm mấu chốt của DEF_21: seeder chạy mỗi lần khởi động, nên bất kỳ
     * thao tác ghi đè nào ở đây cũng đồng nghĩa xoá cấu hình Admin vĩnh viễn. Muốn
     * đẩy một giá trị mới xuống DB đã tồn tại thì viết script migration chạy một
     * lần, đừng mượn seeder.
     */
    private void ensureConfig(String key, String value, String description) {
        if (systemConfigRepository.findByConfigKey(key).isEmpty()) {
            systemConfigRepository.save(com.sep490_g47.smosp.admin.entity.SystemConfig.builder()
                    .configKey(key).configValue(value).description(description)
                    .build());
            log.info("Seeded system config: {} = {}", key, value);
        }
    }
}

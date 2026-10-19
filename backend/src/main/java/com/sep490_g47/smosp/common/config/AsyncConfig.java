package com.sep490_g47.smosp.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
@EnableAsync
@EnableScheduling
public class AsyncConfig {

    /**
     * Pool cho phiên crawl — job chạy lâu nên không được phép chiếm thread của
     * Tomcat (request sẽ treo đúng bấy nhiêu lâu, và OSIV giữ luôn 1 DB connection
     * suốt request đó).
     *
     * corePoolSize=2 là mức chặn song song của /run-all: task thứ 3 trở đi nằm chờ
     * trong queue thay vì cùng lúc bắn HTTP vào VietnamWorks (tránh rate-limit).
     *
     * queueCapacity phải LỚN HƠN số Specialization có cấu hình crawl. Trước đây để
     * 20 trong khi /run-all bắn 33 task: sức chứa thật chỉ 2 core + 20 queue + 2
     * task nới tới maxPool = 24, nên 9 task cuối bị RejectedExecutionException.
     * Batch của chúng đã kịp ghi RUNNING xuống DB rồi mà không thread nào nhận, dẫn
     * tới 9 batch treo vĩnh viễn và guard "spec đang chạy dở" chặn luôn lần cào sau.
     * Để 200 cho dư sức chứa kể cả khi trường mở thêm ngành.
     */
    @Bean("crawlExecutor")
    public ThreadPoolTaskExecutor crawlExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("crawl-job-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }

    /**
     * Pool RIÊNG cho normalize. Trước đây normalize dùng chung crawlExecutor với
     * crawl, nên trong một đợt /run-all hai loại task tranh nhau cùng một hàng đợi:
     * crawl chiếm hết chỗ, task normalize sinh ra sau bị từ chối và batch bị đánh
     * FAILED oan ("Auto-normalize dispatch failed: ExecutorService ... did not
     * accept task"). Tách pool để chuỗi tự động crawl ➔ normalize không tự bóp cổ
     * chính nó.
     */
    @Bean("normalizeExecutor")
    public ThreadPoolTaskExecutor normalizeExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(4);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("normalize-job-");
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }

    /**
     * Pool cho @Scheduled. Mặc định Spring chỉ cấp 1 thread cho toàn bộ scheduled
     * task — mà vòng quét dọn tracking mồ côi (OrphanTrackingSweeper) chạy normalize
     * thật, có thể chiếm thread khá lâu và làm mọi task định kỳ khác trong tương lai
     * bị trễ theo. Tách pool riêng, đặt tên rõ để đọc log cho dễ.
     *
     * poolSize phải LỚN HƠN số @Scheduled hiện có, cộng biên cho task chạy lâu.
     * Đang có 4: CrawlScheduler (mỗi phút — đây là thứ DUY NHẤT kích hoạt cào tự
     * động), OrphanTrackingSweeper (3h sáng, gọi normalize ĐỒNG BỘ, không timeout),
     * TrendingWeightProposalExpiryJob (3h30), PipelineRecoveryRunner (mỗi 15 phút).
     *
     * Để 2 như trước là nguy hiểm: @Scheduled không chờ lượt trước xong mới xếp lượt
     * sau, nên chỉ cần sweep một hôm bị treo (khoá DB chẳng hạn) giữ 1 thread vô hạn,
     * rồi một task khác chiếm nốt thread thứ 2, là CrawlScheduler KHÔNG BAO GIỜ có
     * thread để chạy nữa — toàn hệ thống ngừng cào tự động mà không có lấy một dòng
     * log lỗi, vì method còn không được gọi tới.
     */
    @Bean
    public ThreadPoolTaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(6);
        scheduler.setThreadNamePrefix("scheduled-task-");
        scheduler.setWaitForTasksToCompleteOnShutdown(false);
        scheduler.setAwaitTerminationSeconds(30);
        scheduler.initialize();
        return scheduler;
    }
}

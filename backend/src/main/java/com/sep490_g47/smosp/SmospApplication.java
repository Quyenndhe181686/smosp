package com.sep490_g47.smosp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// @EnableAsync đã chuyển sang common/config/AsyncConfig.java, nằm cạnh bean
// crawlExecutor để chỉ có 1 nơi khai báo cấu hình async.
@SpringBootApplication
public class SmospApplication {

	public static void main(String[] args) {
		SpringApplication.run(SmospApplication.class, args);
	}

}

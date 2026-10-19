package com.sep490_g47.smosp.major.service;

import com.sep490_g47.smosp.major.entity.Major;
import com.sep490_g47.smosp.major.repository.MajorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Phần ghi DB của luồng upload ảnh Major, tách khỏi {@link MajorImageService}
 * để transaction chỉ bọc đúng thao tác ghi.
 *
 * Bắt buộc là bean riêng: nếu để chung class với method orchestration thì
 * self-invocation không đi qua Spring proxy và @Transactional bị bỏ qua hoàn toàn.
 */
@Component
@RequiredArgsConstructor
public class MajorImagePersistence {

    private final MajorRepository majorRepository;

    @Transactional
    public void updateImageUrl(String code, String imageUrl) {
        Major major = majorRepository.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Major not found"));
        major.setImageUrl(imageUrl);
        majorRepository.save(major);
    }
}

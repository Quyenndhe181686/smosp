package com.sep490_g47.smosp.specialization.service;

import com.sep490_g47.smosp.specialization.entity.Specialization;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Phần ghi DB của luồng upload ảnh Specialization, tách khỏi
 * {@link SpecializationImageService} để transaction chỉ bọc đúng thao tác ghi.
 *
 * Bắt buộc là bean riêng: nếu để chung class với method orchestration thì
 * self-invocation không đi qua Spring proxy và @Transactional bị bỏ qua hoàn toàn.
 */
@Component
@RequiredArgsConstructor
public class SpecializationImagePersistence {

    private final SpecializationRepository specializationRepository;

    @Transactional
    public void updateImageUrl(String code, String imageUrl) {
        Specialization specialization = specializationRepository.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Specialization not found"));
        specialization.setImageUrl(imageUrl);
        specializationRepository.save(specialization);
    }
}

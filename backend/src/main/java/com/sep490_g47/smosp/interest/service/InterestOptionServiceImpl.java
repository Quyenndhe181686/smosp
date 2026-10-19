package com.sep490_g47.smosp.interest.service;

import com.sep490_g47.smosp.account.entity.Notification;
import com.sep490_g47.smosp.account.repository.NotificationRepository;
import com.sep490_g47.smosp.interest.dto.request.InterestOptionRequest;
import com.sep490_g47.smosp.interest.dto.request.StatusUpdateRequest;
import com.sep490_g47.smosp.interest.dto.response.InterestOptionResponse;
import com.sep490_g47.smosp.interest.entity.InterestOption;
import com.sep490_g47.smosp.interest.repository.InterestOptionRepository;
import com.sep490_g47.smosp.student.entity.StudentInterest;
import com.sep490_g47.smosp.student.repository.StudentInterestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class InterestOptionServiceImpl implements InterestOptionService {

    private final InterestOptionRepository interestOptionRepository;
    private final StudentInterestRepository studentInterestRepository;
    private final NotificationRepository notificationRepository;

    @Override
    @Transactional(readOnly = true)
    public List<InterestOptionResponse> getSpecializationInterests(UUID specializationId) {
        return interestOptionRepository.findBySpecializationId(specializationId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public InterestOptionResponse createInterestOption(InterestOptionRequest request) {
        if (interestOptionRepository.existsBySpecializationIdAndLabel(request.getSpecializationId(), request.getLabel())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Interest label already exists in this specialization (BR-10)");
        }

        InterestOption option = InterestOption.builder()
                .specializationId(request.getSpecializationId())
                .label(request.getLabel())
                .isActive(true)
                .build();

        return mapToResponse(interestOptionRepository.save(option));
    }

    @Override
    @Transactional
    public InterestOptionResponse updateInterestOption(UUID id, InterestOptionRequest request) {
        InterestOption option = interestOptionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "InterestOption not found"));

        boolean specializationChanged = !option.getSpecializationId().equals(request.getSpecializationId());

        if ((!option.getLabel().equals(request.getLabel()) || specializationChanged) &&
                interestOptionRepository.existsBySpecializationIdAndLabel(request.getSpecializationId(), request.getLabel())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Interest label already exists in this specialization (BR-10)");
        }

        option.setLabel(request.getLabel());
        option.setSpecializationId(request.getSpecializationId());

        InterestOptionResponse response = mapToResponse(interestOptionRepository.save(option));

        if (specializationChanged) {
            cascadeRemoveMismatchedDeclarations(option);
        }

        return response;
    }

    /**
     * Cùng gap BR-10 và cùng quyết định BA (cascade + notification) đã áp dụng
     * cho SkillServiceImpl.updateSkill() (L1_UNIT_TEST_DEF_19) — InterestOption
     * có cấu trúc/lỗ hổng giống hệt Skill nên áp dụng lại cùng pattern.
     */
    private void cascadeRemoveMismatchedDeclarations(InterestOption option) {
        List<StudentInterest> declarations = studentInterestRepository.findByInterestOption_Id(option.getId());

        List<StudentInterest> mismatched = declarations.stream()
                .filter(si -> si.getStudentProfile().getSpecialization() == null ||
                        !si.getStudentProfile().getSpecialization().getId().equals(option.getSpecializationId()))
                .collect(Collectors.toList());

        if (mismatched.isEmpty()) {
            return;
        }

        List<Notification> notifications = mismatched.stream()
                .map(si -> Notification.builder()
                        .user(si.getStudentProfile().getUserAccount())
                        .type("INTEREST_REMOVED")
                        .title("Sở thích đã bị gỡ khỏi hồ sơ")
                        .body("Sở thích \"" + option.getLabel() + "\" đã được chuyển sang chuyên ngành khác và không còn thuộc chuyên ngành của bạn, nên đã bị gỡ khỏi danh sách sở thích đã khai báo.")
                        .metadata(Map.of("interestOptionId", option.getId().toString()))
                        .isRead(false)
                        .build())
                .collect(Collectors.toList());

        studentInterestRepository.deleteAll(mismatched);
        notificationRepository.saveAll(notifications);
    }

    @Override
    @Transactional
    public InterestOptionResponse updateStatus(UUID id, StatusUpdateRequest request) {
        InterestOption option = interestOptionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "InterestOption not found"));

        option.setIsActive(request.getIsActive()); // BR-09: Soft delete / toggle active
        return mapToResponse(interestOptionRepository.save(option));
    }

    private InterestOptionResponse mapToResponse(InterestOption option) {
        return InterestOptionResponse.builder()
                .id(option.getId())
                .specializationId(option.getSpecializationId())
                .label(option.getLabel())
                .isActive(option.getIsActive())
                .createdAt(option.getCreatedAt())
                .updatedAt(option.getUpdatedAt())
                .build();
    }
}

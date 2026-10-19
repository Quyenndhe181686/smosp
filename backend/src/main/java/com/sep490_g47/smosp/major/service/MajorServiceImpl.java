package com.sep490_g47.smosp.major.service;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.major.dto.request.MajorRequest;
import com.sep490_g47.smosp.major.dto.response.MajorResponse;
import com.sep490_g47.smosp.major.dto.request.StatusUpdateRequest;
import com.sep490_g47.smosp.major.entity.Major;
import com.sep490_g47.smosp.major.repository.MajorRepository;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.transcript.entity.AdminActionLog;
import com.sep490_g47.smosp.transcript.repository.AdminActionLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.GrantedAuthority;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MajorServiceImpl implements MajorService {

    private final MajorRepository majorRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final com.sep490_g47.smosp.specialization.repository.SpecializationRepository specializationRepository;
    private final AdminActionLogRepository adminActionLogRepository;
    private final UserAccountRepository userAccountRepository;

    @Override
    @Transactional
    public MajorResponse createMajor(MajorRequest request) {
        if (majorRepository.existsByCode(request.getCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Major code already exists");
        }

        if (majorRepository.existsByNameIgnoreCase(request.getName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Major name already exists");
        }

        Major major = Major.builder()
                .code(request.getCode())
                .name(request.getName())
                .description(request.getDescription())
                .tuitionPerTerm(request.getTuitionPerTerm())
                .pricePerCredit(request.getPricePerCredit())
                .isActive(true)
                .build();
        
        boolean tuitionSet = request.getTuitionPerTerm() != null || request.getPricePerCredit() != null;
        if (tuitionSet) {
            major.setTuitionUpdatedAt(LocalDateTime.now());
        }

        major = majorRepository.save(major);

        if (tuitionSet) {
            logTuitionChange(major, null, null, request.getTuitionPerTerm(), request.getPricePerCredit());
        }

        return mapToResponse(major);
    }

    @Override
    @Transactional
    public MajorResponse updateMajor(UUID id, MajorRequest request) {
        Major major = majorRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Major not found"));

        if (majorRepository.existsByCodeAndIdNot(request.getCode(), id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Major code already exists for another record");
        }

        if (majorRepository.existsByNameIgnoreCaseAndIdNot(request.getName(), id)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Major name already exists for another record");
        }

        // Objects.equals() tren BigDecimal goi .equals() — SO CA SCALE, khong chi
        // gia tri. Cot DB la numeric(15,2) nen gia tri doc ve luon scale=2; request
        // tu client co the scale khac (vd gui "1000" -> scale=0). "1000" va
        // "1000.00" ve mat toan hoc bang nhau nhung .equals() tra false, nen
        // tuitionUpdatedAt bi dong dau lai o MOI lan sua Major — ke ca khi chi sua
        // mo ta, khong dung gi den hoc phi. compareTo() == 0 so dung GIA TRI.
        boolean tuitionChanged = !bigDecimalEquals(request.getTuitionPerTerm(), major.getTuitionPerTerm())
                || !bigDecimalEquals(request.getPricePerCredit(), major.getPricePerCredit());
        BigDecimal oldTuition = major.getTuitionPerTerm();
        BigDecimal oldPrice = major.getPricePerCredit();
        if (tuitionChanged) {
            major.setTuitionUpdatedAt(LocalDateTime.now());
        }

        major.setCode(request.getCode());
        major.setName(request.getName());
        major.setDescription(request.getDescription());
        major.setTuitionPerTerm(request.getTuitionPerTerm());
        major.setPricePerCredit(request.getPricePerCredit());

        major = majorRepository.save(major);

        // BR-12; UC-114/UC-81 buoc 5 doi ghi "va CM thuc hien". Truoc day thay doi
        // hoc phi chi luu tuitionUpdatedAt (moc thoi gian), khong luu danh tinh
        // nguoi thuc hien — Major/BaseEntity khong co truong nguoi sua. Dung lai
        // AdminActionLog, cung mau da dung o AdminUserServiceImpl/
        // TranscriptPresetServiceImpl, thay vi them cot rieng cho Major.
        if (tuitionChanged) {
            logTuitionChange(major, oldTuition, oldPrice, request.getTuitionPerTerm(), request.getPricePerCredit());
        }

        return mapToResponse(major);
    }

    @Override
    @Transactional
    public MajorResponse updateMajorStatus(UUID id, StatusUpdateRequest request) {
        Major major = majorRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Major not found"));

        if (Objects.equals(major.getIsActive(), request.getIsActive())) {
            return mapToResponse(major);
        }

        if (!request.getIsActive()) {
            boolean hasActiveSpecs = specializationRepository.existsByMajorIdAndIsActiveTrue(id);
            if (hasActiveSpecs) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate Major because it has active Specializations");
            }
            boolean hasActiveChildren = narrowSpecRepository.existsBySpecialization_Major_IdAndIsPublishedTrue(id);
            if (hasActiveChildren) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deactivate Major because it has active NarrowSpecializations");
            }
        }

        major.setIsActive(request.getIsActive());
        major = majorRepository.save(major);

        return mapToResponse(major);
    }

    @Override
    @Transactional(readOnly = true)
    public List<MajorResponse> getAllMajors() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        boolean isStaff = false;

        if (authentication != null && authentication.isAuthenticated() && !authentication.getPrincipal().equals("anonymousUser")) {
            for (GrantedAuthority authority : authentication.getAuthorities()) {
                String role = authority.getAuthority();
                if ("ROLE_CONTENT_MANAGER".equals(role) || "ROLE_ADMIN".equals(role)) {
                    isStaff = true;
                    break;
                }
            }
        }

        List<Major> majors;
        if (isStaff) {
            majors = majorRepository.findAllByOrderByCodeAsc();
        } else {
            majors = majorRepository.findByIsActiveTrueOrderByCodeAsc();
        }

        return majors.stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private MajorResponse mapToResponse(Major major) {
        return MajorResponse.builder()
                .id(major.getId())
                .code(major.getCode())
                .name(major.getName())
                .description(major.getDescription())
                .imageUrl(major.getImageUrl())
                .tuitionPerTerm(major.getTuitionPerTerm())
                .pricePerCredit(major.getPricePerCredit())
                .tuitionUpdatedAt(major.getTuitionUpdatedAt())
                .createdAt(major.getCreatedAt())
                .updatedAt(major.getUpdatedAt())
                .isActive(major.getIsActive())
                .build();
    }

    /** So sanh GIA TRI, bo qua scale — xem giai thich o updateMajor(). */
    private boolean bigDecimalEquals(BigDecimal a, BigDecimal b) {
        if (a == null || b == null) {
            return a == b;
        }
        return a.compareTo(b) == 0;
    }

    private void logTuitionChange(Major major, BigDecimal oldTuition, BigDecimal oldPrice,
                                   BigDecimal newTuition, BigDecimal newPrice) {
        String identifier = SecurityContextHolder.getContext().getAuthentication().getName();
        UserAccount actor = userAccountRepository.findByEmail(identifier)
                .or(() -> userAccountRepository.findByUsername(identifier))
                .orElse(null);
        if (actor == null) {
            // Mat audit khong dang de huy mot thao tac cau hinh da hop le — nhung
            // phai de lai dau vet o muc WARN de con phat hien duoc, cung nguyen tac
            // da ap dung o AdminCrawlerSourceServiceImpl.logAction().
            org.slf4j.LoggerFactory.getLogger(MajorServiceImpl.class)
                    .warn("[audit] Khong ghi duoc AdminActionLog cho thay doi hoc phi Major {} — "
                            + "khong tra duoc UserAccount cho principal '{}'", major.getId(), identifier);
            return;
        }

        adminActionLogRepository.save(AdminActionLog.builder()
                .actor(actor)
                .action("UPDATE_MAJOR_TUITION")
                .targetType("Major")
                .targetId(major.getId())
                .detail(String.format("tuitionPerTerm: %s -> %s, pricePerCredit: %s -> %s",
                        oldTuition, newTuition, oldPrice, newPrice))
                .build());
    }
}

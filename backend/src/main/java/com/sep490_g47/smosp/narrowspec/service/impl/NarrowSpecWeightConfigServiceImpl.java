package com.sep490_g47.smosp.narrowspec.service.impl;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProfile;
import com.sep490_g47.smosp.narrowspec.dto.request.WeightConfigUpdateRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.WeightConfigAuditResponse;
import com.sep490_g47.smosp.narrowspec.dto.response.WeightConfigResponse;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecWeightConfig;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecWeightConfigAudit;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecWeightConfigAuditRepository;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecWeightConfigRepository;
import com.sep490_g47.smosp.narrowspec.service.NarrowSpecWeightConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class NarrowSpecWeightConfigServiceImpl implements NarrowSpecWeightConfigService {

    private final NarrowSpecWeightConfigRepository weightConfigRepository;
    private final NarrowSpecWeightConfigAuditRepository auditRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final UserAccountRepository userAccountRepository;

    private UserAccount getCurrentUser() {
        String principalName = SecurityContextHolder.getContext().getAuthentication().getName();
        return userAccountRepository.findByUsername(principalName)
                .orElseGet(() -> userAccountRepository.findByEmail(principalName)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found")));
    }

    @Override
    public WeightConfigResponse getWeightConfig(UUID narrowSpecId) {
        NarrowSpecialization narrowSpec = narrowSpecRepository.findById(narrowSpecId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "NarrowSpec not found"));

        Optional<NarrowSpecWeightConfig> configOpt = weightConfigRepository.findByNarrowSpecId(narrowSpecId);
        if (configOpt.isPresent()) {
            return mapToResponse(configOpt.get());
        }

        return WeightConfigResponse.builder()
                .narrowSpecId(narrowSpec.getId())
                .narrowSpecName(narrowSpec.getName())
                .alphaBase(narrowSpec.getSpecialization().getAlphaBase())
                .wGpa(new BigDecimal("0.400"))
                .wSkill(new BigDecimal("0.350"))
                .wInt(new BigDecimal("0.250"))
                .wSacc(new BigDecimal("0.500"))
                .wSvol(new BigDecimal("0.300"))
                .wJunior(new BigDecimal("0.200"))
                .updatedBy(null)
                .updatedAt(null)
                .build();
    }

    @Override
    @Transactional
    public WeightConfigResponse updateWeightConfig(UUID narrowSpecId, WeightConfigUpdateRequest request) {
        // Validation
        if (request.getAlphaBase().compareTo(BigDecimal.ZERO) <= 0 || request.getAlphaBase().compareTo(BigDecimal.ONE) >= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "alphaBase must be between 0.0 and 1.0 (exclusive)");
        }

        if (request.getWGpa().compareTo(BigDecimal.ZERO) <= 0 || 
            request.getWSkill().compareTo(BigDecimal.ZERO) <= 0 || 
            request.getWInt().compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Weights must be > 0");
        }

        BigDecimal sum = request.getWGpa().add(request.getWSkill()).add(request.getWInt());
        if (sum.compareTo(new BigDecimal("0.999")) < 0 || sum.compareTo(new BigDecimal("1.001")) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tổng W_gpa + W_skill + W_int phải bằng 1.0");
        }

        // Bộ ba trọng số Trending Weight KHÔNG còn nhận giá trị tự do: chúng là giá
        // trị dẫn xuất của 1 trong 3 hồ sơ (xem TrendingWeightProfile). Mỗi lần tính
        // TW, hệ thống ghi đè ba cột này theo hồ sơ — nên nếu vẫn cho nhập số tuỳ ý
        // thì thao tác của CM sẽ bị mất lặng lẽ ở lần tính kế tiếp.
        //
        // Vẫn giữ nguyên hình dạng request để không phá hợp đồng API với frontend:
        // số gửi lên phải khớp một hồ sơ, và được dịch thành profile_override.
        TrendingWeightProfile requestedProfile = matchProfile(
                request.getWSvol(), request.getWSacc(), request.getWJunior());
        if (requestedProfile == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Trọng số Trending Weight phải khớp một trong ba hồ sơ: "
                    + "MATURE (Svol 0.5 / Sacc 0.3 / Junior 0.2), "
                    + "EMERGING (0.2 / 0.6 / 0.2), "
                    + "SPARSE (1.0 / 0 / 0). "
                    + "Hệ thống tự gán hồ sơ theo đặc tính dữ liệu; đặt bộ số khớp một hồ sơ "
                    + "để ghi đè thủ công.");
        }

        NarrowSpecialization narrowSpec = narrowSpecRepository.findById(narrowSpecId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "NarrowSpec not found"));
        UserAccount currentUser = getCurrentUser();

        Optional<NarrowSpecWeightConfig> configOpt = weightConfigRepository.findByNarrowSpecId(narrowSpecId);
        NarrowSpecWeightConfig config;

        if (configOpt.isPresent()) {
            config = configOpt.get();
            
            // Insert audit
            NarrowSpecWeightConfigAudit audit = NarrowSpecWeightConfigAudit.builder()
                    .narrowSpec(narrowSpec)
                    .alphaBaseOld(config.getAlphaBase())
                    .alphaBaseNew(request.getAlphaBase())
                    .wGpaOld(config.getWGpa())
                    .wGpaNew(request.getWGpa())
                    .wSkillOld(config.getWSkill())
                    .wSkillNew(request.getWSkill())
                    .wIntOld(config.getWInt())
                    .wIntNew(request.getWInt())
                    .wSaccOld(config.getWSacc())
                    .wSaccNew(request.getWSacc())
                    .wSvolOld(config.getWSvol())
                    .wSvolNew(request.getWSvol())
                    .wJuniorOld(config.getWJunior())
                    .wJuniorNew(request.getWJunior())
                    .changedBy(currentUser)
                    .changedAt(LocalDateTime.now())
                    .note(request.getNote())
                    .build();
            auditRepository.save(audit);
            
            config.setAlphaBase(request.getAlphaBase());
            config.setWGpa(request.getWGpa());
            config.setWSkill(request.getWSkill());
            config.setWInt(request.getWInt());
            config.setWSacc(request.getWSacc());
            config.setWSvol(request.getWSvol());
            config.setWJunior(request.getWJunior());
            config.setProfileOverride(requestedProfile);
            config.setUpdatedBy(currentUser);
        } else {
            config = NarrowSpecWeightConfig.builder()
                    .narrowSpec(narrowSpec)
                    .alphaBase(request.getAlphaBase())
                    .wGpa(request.getWGpa())
                    .wSkill(request.getWSkill())
                    .wInt(request.getWInt())
                    .wSacc(request.getWSacc())
                    .wSvol(request.getWSvol())
                    .wJunior(request.getWJunior())
                    .profileOverride(requestedProfile)
                    .updatedBy(currentUser)
                    .build();
        }

        NarrowSpecWeightConfig saved = weightConfigRepository.save(config);
        return mapToResponse(saved);
    }

    @Override
    public Page<WeightConfigAuditResponse> getWeightConfigAudit(UUID narrowSpecId, Pageable pageable) {
        if (!narrowSpecRepository.existsById(narrowSpecId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "NarrowSpec not found");
        }
        return auditRepository.findByNarrowSpecIdOrderByChangedAtDesc(narrowSpecId, pageable)
                .map(this::mapAuditToResponse);
    }

    /** Bộ ba trọng số gửi lên khớp hồ sơ nào, hay không khớp cái nào (null). */
    private TrendingWeightProfile matchProfile(BigDecimal wSvol, BigDecimal wSacc, BigDecimal wJunior) {
        for (TrendingWeightProfile p : TrendingWeightProfile.values()) {
            if (near(wSvol, p.getWSvol()) && near(wSacc, p.getWSacc()) && near(wJunior, p.getWJunior())) {
                return p;
            }
        }
        return null;
    }

    private boolean near(BigDecimal actual, double expected) {
        return actual != null && actual.subtract(BigDecimal.valueOf(expected)).abs()
                .compareTo(new BigDecimal("0.001")) <= 0;
    }

    private WeightConfigResponse mapToResponse(NarrowSpecWeightConfig config) {
        return WeightConfigResponse.builder()
                .narrowSpecId(config.getNarrowSpec().getId())
                .narrowSpecName(config.getNarrowSpec().getName())
                .alphaBase(config.getAlphaBase())
                .wGpa(config.getWGpa())
                .wSkill(config.getWSkill())
                .wInt(config.getWInt())
                .wSacc(config.getWSacc())
                .wSvol(config.getWSvol())
                .wJunior(config.getWJunior())
                .updatedBy(config.getUpdatedBy() != null ? config.getUpdatedBy().getDisplayName() : null)
                .updatedAt(config.getUpdatedAt())
                .build();
    }

    private WeightConfigAuditResponse mapAuditToResponse(NarrowSpecWeightConfigAudit audit) {
        return WeightConfigAuditResponse.builder()
                .changedAt(audit.getChangedAt())
                .changedBy(audit.getChangedBy() != null ? audit.getChangedBy().getDisplayName() : null)
                .note(audit.getNote())
                .alphaBaseOld(audit.getAlphaBaseOld())
                .alphaBaseNew(audit.getAlphaBaseNew())
                .wGpaOld(audit.getWGpaOld())
                .wGpaNew(audit.getWGpaNew())
                .wSkillOld(audit.getWSkillOld())
                .wSkillNew(audit.getWSkillNew())
                .wIntOld(audit.getWIntOld())
                .wIntNew(audit.getWIntNew())
                .wSaccOld(audit.getWSaccOld())
                .wSaccNew(audit.getWSaccNew())
                .wSvolOld(audit.getWSvolOld())
                .wSvolNew(audit.getWSvolNew())
                .wJuniorOld(audit.getWJuniorOld())
                .wJuniorNew(audit.getWJuniorNew())
                .build();
    }
}

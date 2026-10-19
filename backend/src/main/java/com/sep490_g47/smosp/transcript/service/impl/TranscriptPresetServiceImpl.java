package com.sep490_g47.smosp.transcript.service.impl;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.transcript.dto.request.TranscriptMappingPresetRequest;
import com.sep490_g47.smosp.transcript.dto.response.TranscriptMappingPresetResponse;
import com.sep490_g47.smosp.transcript.entity.AdminActionLog;
import com.sep490_g47.smosp.transcript.entity.TranscriptMappingPreset;
import com.sep490_g47.smosp.transcript.repository.AdminActionLogRepository;
import com.sep490_g47.smosp.transcript.repository.TranscriptMappingPresetRepository;
import com.sep490_g47.smosp.transcript.service.TranscriptPresetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TranscriptPresetServiceImpl implements TranscriptPresetService {

    private final TranscriptMappingPresetRepository presetRepository;
    private final AdminActionLogRepository actionLogRepository;
    private final UserAccountRepository userAccountRepository;

    private UserAccount getCurrentUser() {
        String identifier = SecurityContextHolder.getContext().getAuthentication().getName();
        return userAccountRepository.findByEmail(identifier)
                .or(() -> userAccountRepository.findByUsername(identifier))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }

    private void logAction(UserAccount actor, String action, UUID targetId, String detail) {
        AdminActionLog log = AdminActionLog.builder()
                .actor(actor)
                .action(action)
                .targetType("TranscriptMappingPreset")
                .targetId(targetId)
                .detail(detail)
                .build();
        actionLogRepository.save(log);
    }

    private TranscriptMappingPresetResponse mapToResponse(TranscriptMappingPreset entity) {
        TranscriptMappingPresetResponse res = TranscriptMappingPresetResponse.builder()
                .id(entity.getId())
                .presetName(entity.getPresetName())
                .columnMapping(entity.getColumnMapping())
                .isDefault(entity.getIsDefault())
                .isActive(entity.getIsActive())
                .build();
        res.setCreatedAt(entity.getCreatedAt());
        res.setUpdatedAt(entity.getUpdatedAt());
        return res;
    }

    @Override
    public List<TranscriptMappingPresetResponse> getAllPresets() {
        return presetRepository.findByIsDeletedFalse().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public TranscriptMappingPresetResponse createPreset(TranscriptMappingPresetRequest request) {
        // Dem tren preset CHUA xoa — soft-delete ma van dem ca preset da xoa thi
        // tran 5 preset khong bao gio duoc giai phong, mat het y nghia cua viec
        // chuyen sang soft-delete.
        if (presetRepository.countByIsDeletedFalse() >= 5) {
            throw new IllegalArgumentException("Max 5 presets allowed. Please delete old ones.");
        }

        if (presetRepository.findByIsDeletedFalse().stream()
                .anyMatch(p -> p.getPresetName() != null && p.getPresetName().trim().equalsIgnoreCase(request.getPresetName().trim()))) {
            throw new IllegalArgumentException("Tên mẫu bảng điểm đã tồn tại (DEF_44)");
        }

        TranscriptMappingPreset preset = TranscriptMappingPreset.builder()
                .presetName(request.getPresetName().trim())
                .columnMapping(request.getColumnMapping())
                .isDefault(false)
                .isActive(false)
                .build();

        TranscriptMappingPreset saved = presetRepository.save(preset);
        logAction(getCurrentUser(), "CREATE_PRESET", saved.getId(), request.getPresetName());
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public TranscriptMappingPresetResponse updatePreset(UUID id, TranscriptMappingPresetRequest request) {
        TranscriptMappingPreset preset = presetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Preset not found"));

        if (Boolean.TRUE.equals(preset.getIsDeleted())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Preset has been deleted");
        }

        if (presetRepository.findByIsDeletedFalse().stream()
                .anyMatch(p -> !p.getId().equals(id) && p.getPresetName() != null && p.getPresetName().trim().equalsIgnoreCase(request.getPresetName().trim()))) {
            throw new IllegalArgumentException("Tên mẫu bảng điểm đã tồn tại (DEF_44)");
        }

        preset.setPresetName(request.getPresetName().trim());

        if (!preset.getColumnMapping().equals(request.getColumnMapping())) {
            preset.setColumnMapping(request.getColumnMapping());
        }

        TranscriptMappingPreset saved = presetRepository.save(preset);
        logAction(getCurrentUser(), "UPDATE_PRESET", saved.getId(), request.getPresetName());
        return mapToResponse(saved);
    }

    @Override
    @Transactional
    public void deletePreset(UUID id) {
        TranscriptMappingPreset preset = presetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Preset not found"));

        if (Boolean.TRUE.equals(preset.getIsDeleted())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Preset has already been deleted");
        }

        if (preset.getIsActive()) {
            throw new IllegalArgumentException("Cannot delete an active preset. Activate another one first.");
        }

        if (preset.getIsDefault()) {
            List<TranscriptMappingPreset> allPresets = presetRepository.findByIsDeletedFalse();
            if (allPresets.size() == 1) {
                throw new IllegalArgumentException("Cannot delete the only default preset.");
            }
            // Find another one to set as default
            TranscriptMappingPreset newDefault = allPresets.stream()
                    .filter(p -> !p.getId().equals(id) && p.getIsActive())
                    .findFirst()
                    .orElseGet(() -> allPresets.stream()
                            .filter(p -> !p.getId().equals(id))
                            .findFirst()
                            .orElse(null));

            if (newDefault != null) {
                newDefault.setIsDefault(true);
                presetRepository.save(newDefault);
            }
        }

        // UC-108 Postconditions: soft-delete, bao toan lich su parse. Transcript.preset_id
        // la FK that khong co @OnDelete — hard delete se nem loi vi pham khoa ngoai
        // tho neu preset nay dang duoc Transcript cu tham chieu.
        preset.setIsDeleted(true);
        presetRepository.save(preset);
        logAction(getCurrentUser(), "DELETE_PRESET", id, preset.getPresetName());
    }

    @Override
    @Transactional
    public TranscriptMappingPresetResponse activatePreset(UUID id) {
        TranscriptMappingPreset presetToActivate = presetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Preset not found"));

        if (Boolean.TRUE.equals(presetToActivate.getIsDeleted())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot activate a deleted preset");
        }

        presetRepository.findByIsActiveTrue().ifPresent(activePreset -> {
            activePreset.setIsActive(false);
            presetRepository.save(activePreset);
        });

        presetToActivate.setIsActive(true);
        TranscriptMappingPreset saved = presetRepository.save(presetToActivate);
        logAction(getCurrentUser(), "ACTIVATE_PRESET", saved.getId(), saved.getPresetName());
        return mapToResponse(saved);
    }

}


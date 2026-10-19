package com.sep490_g47.smosp.tagmap.service;

import com.sep490_g47.smosp.interest.entity.InterestOption;
import com.sep490_g47.smosp.interest.repository.InterestOptionRepository;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.skill.entity.Skill;
import com.sep490_g47.smosp.skill.repository.SkillRepository;
import com.sep490_g47.smosp.tagmap.dto.request.TagMapEntryRequest;
import com.sep490_g47.smosp.tagmap.dto.response.TagMapResponse;
import com.sep490_g47.smosp.tagmap.entity.TagMap;
import com.sep490_g47.smosp.tagmap.repository.TagMapRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TagMapServiceImpl implements TagMapService {

    private final TagMapRepository tagMapRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final SkillRepository skillRepository;
    private final InterestOptionRepository interestOptionRepository;

    @Override
    @Transactional(readOnly = true)
    public List<TagMapResponse> getTagMap(UUID narrowSpecId) {
        return tagMapRepository.findByNarrowSpecId(narrowSpecId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<TagMapResponse> updateTagMap(UUID narrowSpecId, List<TagMapEntryRequest> entries) {
        // 1. Validate NAC-39-02 (guard "tag map khong duoc rong"). Nhan cu NAC-32-02
        // trich sai — quy tac Holland da bi cat khoi scope, khong con lien quan.
        if (entries == null || entries.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tag map phải có ít nhất 1 mục ánh xạ (NAC-39-02)");
        }

        // Fetch NarrowSpecialization to get specialization_id
        NarrowSpecialization narrowSpec = narrowSpecRepository.findById(narrowSpecId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "NarrowSpecialization not found"));
        UUID expectedSpecializationId = narrowSpec.getSpecialization().getId();

        // 2. Validate cross-specialization for each entry
        List<TagMap> newEntries = new ArrayList<>();
        for (TagMapEntryRequest entry : entries) {
            if (entry.getWeight() == null || 
                entry.getWeight().compareTo(new BigDecimal("0.1")) < 0 || 
                entry.getWeight().compareTo(new BigDecimal("10.0")) > 0) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Trọng số phải trong khoảng 0.1 đến 10.0");
            }

            String sourceType = entry.getSourceType().toUpperCase();
            
            if ("SKILL".equals(sourceType)) {
                Skill skill = skillRepository.findById(entry.getSourceId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Skill not found with id: " + entry.getSourceId()));
                if (!skill.getSpecializationId().equals(expectedSpecializationId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Skill does not belong to the Specialization of this NarrowSpecialization");
                }
            } else if ("INTEREST".equals(sourceType)) {
                InterestOption interest = interestOptionRepository.findById(entry.getSourceId())
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "InterestOption not found with id: " + entry.getSourceId()));
                if (!interest.getSpecializationId().equals(expectedSpecializationId)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "InterestOption does not belong to the Specialization of this NarrowSpecialization");
                }
            } else {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid sourceType: " + sourceType);
            }

            String mappingType = entry.getMappingType() != null ? entry.getMappingType().toUpperCase() : null;
            if (!"DIRECT".equals(mappingType) && !"SHARED".equals(mappingType)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid mappingType: " + entry.getMappingType() + " (Must be DIRECT or SHARED)");
            }

            newEntries.add(TagMap.builder()
                    .narrowSpecId(narrowSpecId)
                    .sourceType(sourceType)
                    .sourceId(entry.getSourceId())
                    .mappingType(mappingType)
                    .weight(entry.getWeight())
                    .build());
        }

        // 3. Delete all old entries
        tagMapRepository.deleteByNarrowSpecId(narrowSpecId);

        // 4. Save new entries
        return tagMapRepository.saveAll(newEntries).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    private TagMapResponse mapToResponse(TagMap tagMap) {
        String sourceName = "Unknown";
        if ("SKILL".equals(tagMap.getSourceType())) {
            sourceName = skillRepository.findById(tagMap.getSourceId())
                    .map(Skill::getName)
                    .orElse("Unknown Skill");
        } else if ("INTEREST".equals(tagMap.getSourceType())) {
            sourceName = interestOptionRepository.findById(tagMap.getSourceId())
                    .map(InterestOption::getLabel)
                    .orElse("Unknown Interest");
        }

        return TagMapResponse.builder()
                .id(tagMap.getId())
                .sourceType(tagMap.getSourceType())
                .sourceId(tagMap.getSourceId())
                .sourceName(sourceName)
                .mappingType(tagMap.getMappingType())
                .weight(tagMap.getWeight())
                .createdAt(tagMap.getCreatedAt())
                .updatedAt(tagMap.getUpdatedAt())
                .build();
    }
}

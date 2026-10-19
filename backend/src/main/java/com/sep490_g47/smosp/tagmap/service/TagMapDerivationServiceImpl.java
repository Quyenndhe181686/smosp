package com.sep490_g47.smosp.tagmap.service;

import com.sep490_g47.smosp.course.entity.Course;
import com.sep490_g47.smosp.course.entity.CoursePrerequisite;
import com.sep490_g47.smosp.course.repository.CoursePrerequisiteRepository;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.entity.NsCourse;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.narrowspec.repository.NsCourseRepository;
import com.sep490_g47.smosp.skill.entity.CourseSkillMap;
import com.sep490_g47.smosp.skill.entity.Skill;
import com.sep490_g47.smosp.skill.repository.CourseSkillMapRepository;
import com.sep490_g47.smosp.skill.repository.SkillRepository;
import com.sep490_g47.smosp.specialization.repository.SpecCourseRepository;
import com.sep490_g47.smosp.tagmap.dto.response.TagMapResponse;
import com.sep490_g47.smosp.tagmap.dto.response.TagMapSuggestionResponse;
import com.sep490_g47.smosp.tagmap.dto.response.TagMapSyncResponse;
import com.sep490_g47.smosp.tagmap.entity.TagMap;
import com.sep490_g47.smosp.tagmap.repository.TagMapRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TagMapDerivationServiceImpl implements TagMapDerivationService {

    private static final String SOURCE_TYPE_SKILL = "SKILL";
    private static final String MAPPING_DIRECT = "DIRECT";
    private static final String MAPPING_SHARED = "SHARED";
    private static final String STATUS_APPROVED = "APPROVED";
    private static final String EXTRACTION_SOURCE = "DERIVED_FROM_COURSE";
    private static final BigDecimal DEFAULT_WEIGHT = BigDecimal.ONE;

    private final TagMapRepository tagMapRepository;
    private final TagMapService tagMapService;
    private final NarrowSpecRepository narrowSpecRepository;
    private final NsCourseRepository nsCourseRepository;
    private final SpecCourseRepository specCourseRepository;
    private final CourseRepository courseRepository;
    private final CoursePrerequisiteRepository coursePrerequisiteRepository;
    private final CourseSkillMapRepository courseSkillMapRepository;
    private final SkillRepository skillRepository;

    /** Một kỹ năng suy ra được, kèm nguồn gốc để hiển thị cho CM. */
    private record DerivedSkill(UUID skillId, String skillName, boolean fromPrerequisite, String reason) {
        String mappingType() {
            return fromPrerequisite ? MAPPING_SHARED : MAPPING_DIRECT;
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<TagMapSuggestionResponse> getSuggestions(UUID narrowSpecId) {
        NarrowSpecialization narrowSpec = requireNarrowSpec(narrowSpecId);

        Set<UUID> alreadyMapped = mappedSkillIds(narrowSpecId);

        return derive(narrowSpec).values().stream()
                .filter(d -> !alreadyMapped.contains(d.skillId()))
                .map(d -> TagMapSuggestionResponse.builder()
                        .sourceType(SOURCE_TYPE_SKILL)
                        .sourceId(d.skillId())
                        .sourceName(d.skillName())
                        .mappingType(d.mappingType())
                        .weight(DEFAULT_WEIGHT)
                        .reason(d.reason())
                        .fromPrerequisite(d.fromPrerequisite())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public TagMapSyncResponse syncFromCourses(UUID narrowSpecId) {
        NarrowSpecialization narrowSpec = requireNarrowSpec(narrowSpecId);
        List<TagMapResponse> added = insertMissing(narrowSpec);

        return TagMapSyncResponse.builder()
                .narrowSpecId(narrowSpecId)
                .narrowSpecName(narrowSpec.getName())
                .addedCount(added.size())
                .added(added)
                .entries(tagMapService.getTagMap(narrowSpecId))
                .build();
    }

    @Override
    @Transactional
    public List<String> syncNarrowSpecsAffectedByCourses(Collection<UUID> courseIds) {
        if (courseIds == null || courseIds.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = courseIds.stream().filter(Objects::nonNull).distinct().collect(Collectors.toList());
        if (ids.isEmpty()) {
            return List.of();
        }

        Set<UUID> affectedNsIds = new LinkedHashSet<>();
        nsCourseRepository.findByCourseIdIn(ids)
                .forEach(nc -> affectedNsIds.add(nc.getNarrowSpec().getId()));

        // Môn vừa đổi kỹ năng có thể là TIÊN QUYẾT của một môn trong combo khác —
        // combo đó cũng phải nhận kỹ năng mới.
        List<UUID> dependentCourseIds = coursePrerequisiteRepository.findByPrerequisiteCourse_IdIn(ids).stream()
                .map(edge -> edge.getCourse().getId())
                .distinct()
                .collect(Collectors.toList());
        if (!dependentCourseIds.isEmpty()) {
            nsCourseRepository.findByCourseIdIn(dependentCourseIds)
                    .forEach(nc -> affectedNsIds.add(nc.getNarrowSpec().getId()));
        }

        List<String> touched = new ArrayList<>();
        for (UUID nsId : affectedNsIds) {
            NarrowSpecialization narrowSpec = narrowSpecRepository.findById(nsId).orElse(null);
            if (narrowSpec == null) {
                continue;
            }
            if (!insertMissing(narrowSpec).isEmpty()) {
                touched.add(narrowSpec.getName());
            }
        }
        return touched;
    }

    /** Ghi các mục suy ra còn thiếu; mục CM đã cấu hình được giữ nguyên. */
    private List<TagMapResponse> insertMissing(NarrowSpecialization narrowSpec) {
        Map<UUID, DerivedSkill> derived = derive(narrowSpec);
        if (derived.isEmpty()) {
            return List.of();
        }

        Set<UUID> alreadyMapped = mappedSkillIds(narrowSpec.getId());

        List<DerivedSkill> missing = derived.values().stream()
                .filter(d -> !alreadyMapped.contains(d.skillId()))
                .collect(Collectors.toList());
        if (missing.isEmpty()) {
            return List.of();
        }

        List<TagMap> toAdd = missing.stream()
                .map(d -> TagMap.builder()
                        .narrowSpecId(narrowSpec.getId())
                        .sourceType(SOURCE_TYPE_SKILL)
                        .sourceId(d.skillId())
                        .mappingType(d.mappingType())
                        .weight(DEFAULT_WEIGHT)
                        .rationale(d.reason())
                        .extractionSource(EXTRACTION_SOURCE)
                        .build())
                .collect(Collectors.toList());

        Map<UUID, DerivedSkill> bySkillId = missing.stream()
                .collect(Collectors.toMap(DerivedSkill::skillId, Function.identity(), (a, b) -> a));

        return tagMapRepository.saveAll(toAdd).stream()
                .map(t -> TagMapResponse.builder()
                        .id(t.getId())
                        .sourceType(t.getSourceType())
                        .sourceId(t.getSourceId())
                        .sourceName(bySkillId.get(t.getSourceId()).skillName())
                        .mappingType(t.getMappingType())
                        .weight(t.getWeight())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Kỹ năng của các môn trong combo, cộng thêm kỹ năng của môn tiên quyết TRỰC TIẾP
     * của chúng khi môn tiên quyết đó cũng nằm trong chương trình của chuyên ngành.
     * Môn nằm sẵn trong combo luôn thắng (DIRECT) nếu một kỹ năng đến từ cả hai phía.
     */
    private Map<UUID, DerivedSkill> derive(NarrowSpecialization narrowSpec) {
        List<NsCourse> nsCourses = nsCourseRepository.findByNarrowSpecId(narrowSpec.getId());
        if (nsCourses.isEmpty()) {
            return Map.of();
        }
        UUID specializationId = narrowSpec.getSpecialization().getId();

        Set<UUID> nsCourseIds = nsCourses.stream()
                .map(nc -> nc.getCourse().getId())
                .collect(Collectors.toCollection(LinkedHashSet::new));

        Set<UUID> specCourseIds = specCourseRepository.findBySpecializationId(specializationId).stream()
                .map(sc -> sc.getCourse().getId())
                .collect(Collectors.toSet());

        // prerequisiteId -> một môn trong combo đang lấy nó làm tiên quyết (để giải thích cho CM)
        Map<UUID, UUID> prereqToDependent = new LinkedHashMap<>();
        for (CoursePrerequisite edge : coursePrerequisiteRepository.findByCourse_IdIn(nsCourseIds)) {
            UUID prereqId = edge.getPrerequisiteCourse().getId();
            // Đã nằm trong combo thì tính là DIRECT ở nhánh dưới; ngoài chương trình
            // của chuyên ngành thì không tính (cấm ánh xạ chéo chuyên ngành).
            if (nsCourseIds.contains(prereqId) || !specCourseIds.contains(prereqId)) {
                continue;
            }
            prereqToDependent.putIfAbsent(prereqId, edge.getCourse().getId());
        }

        Set<UUID> allCourseIds = new LinkedHashSet<>(nsCourseIds);
        allCourseIds.addAll(prereqToDependent.keySet());

        Map<UUID, Course> courseById = courseRepository.findAllById(allCourseIds).stream()
                .collect(Collectors.toMap(Course::getId, Function.identity()));

        List<CourseSkillMap> skillMaps = courseSkillMapRepository
                .findByCourseIdIn(new ArrayList<>(allCourseIds)).stream()
                .filter(this::isApproved)
                .collect(Collectors.toList());
        if (skillMaps.isEmpty()) {
            return Map.of();
        }

        Set<UUID> skillIds = skillMaps.stream()
                .map(CourseSkillMap::getSkillId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // Kỹ năng phải đang bật và thuộc đúng chuyên ngành chứa CNH — ánh xạ chéo
        // chuyên ngành bị cấm, nên kỹ năng lệch chuyên ngành bị bỏ qua thay vì báo lỗi.
        Map<UUID, Skill> skillById = skillRepository.findAllById(skillIds).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .filter(s -> specializationId.equals(s.getSpecializationId()))
                .collect(Collectors.toMap(Skill::getId, Function.identity()));

        Map<UUID, DerivedSkill> result = new LinkedHashMap<>();

        // Lượt 1: môn nằm trực tiếp trong combo
        for (CourseSkillMap map : skillMaps) {
            if (!nsCourseIds.contains(map.getCourseId())) {
                continue;
            }
            Skill skill = skillById.get(map.getSkillId());
            if (skill == null) {
                continue;
            }
            result.putIfAbsent(skill.getId(), new DerivedSkill(
                    skill.getId(), skill.getName(), false,
                    "Từ môn " + label(courseById.get(map.getCourseId()))));
        }

        // Lượt 2: môn tiên quyết thuộc chuyên ngành
        for (CourseSkillMap map : skillMaps) {
            UUID dependentId = prereqToDependent.get(map.getCourseId());
            if (dependentId == null) {
                continue;
            }
            Skill skill = skillById.get(map.getSkillId());
            if (skill == null) {
                continue;
            }
            result.putIfAbsent(skill.getId(), new DerivedSkill(
                    skill.getId(), skill.getName(), true,
                    "Từ môn tiên quyết " + label(courseById.get(map.getCourseId()))
                            + " của môn " + label(courseById.get(dependentId))));
        }

        return result;
    }

    private NarrowSpecialization requireNarrowSpec(UUID narrowSpecId) {
        return narrowSpecRepository.findById(narrowSpecId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "NarrowSpecialization not found"));
    }

    private Set<UUID> mappedSkillIds(UUID narrowSpecId) {
        return tagMapRepository.findByNarrowSpecId(narrowSpecId).stream()
                .filter(t -> SOURCE_TYPE_SKILL.equalsIgnoreCase(t.getSourceType()))
                .map(TagMap::getSourceId)
                .collect(Collectors.toSet());
    }

    /** Cột status NOT NULL DEFAULT 'APPROVED'; bản ghi cũ có thể còn null. */
    private boolean isApproved(CourseSkillMap map) {
        return map.getStatus() == null || STATUS_APPROVED.equalsIgnoreCase(map.getStatus());
    }

    private String label(Course course) {
        if (course == null) {
            return "không rõ";
        }
        return course.getCode() + " – " + course.getName();
    }
}

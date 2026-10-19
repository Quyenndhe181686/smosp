package com.sep490_g47.smosp.skill.service;

import com.sep490_g47.smosp.account.entity.Notification;
import com.sep490_g47.smosp.account.repository.NotificationRepository;
import com.sep490_g47.smosp.skill.dto.request.SkillAliasUpdateRequest;
import com.sep490_g47.smosp.skill.dto.request.SkillCourseMapRequest;
import com.sep490_g47.smosp.skill.dto.request.SkillRequest;
import com.sep490_g47.smosp.skill.dto.request.StatusUpdateRequest;
import com.sep490_g47.smosp.skill.dto.response.SkillResponse;
import com.sep490_g47.smosp.skill.entity.CourseSkillMap;
import com.sep490_g47.smosp.skill.entity.Skill;
import com.sep490_g47.smosp.skill.entity.SkillAlias;
import com.sep490_g47.smosp.skill.repository.CourseSkillMapRepository;
import com.sep490_g47.smosp.skill.repository.SkillRepository;
import com.sep490_g47.smosp.student.entity.StudentSkill;
import com.sep490_g47.smosp.student.repository.StudentSkillRepository;
import com.sep490_g47.smosp.tagmap.service.TagMapDerivationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SkillServiceImpl implements SkillService {

    private final SkillRepository skillRepository;
    private final CourseSkillMapRepository courseSkillMapRepository;
    private final StudentSkillRepository studentSkillRepository;
    private final NotificationRepository notificationRepository;
    private final TagMapDerivationService tagMapDerivationService;
    private final com.sep490_g47.smosp.specialization.repository.SpecCourseRepository specCourseRepository;
    private final com.sep490_g47.smosp.narrowspec.repository.NsCourseRepository nsCourseRepository;

    @Override
    @Transactional(readOnly = true)
    public List<SkillResponse> getSpecializationSkills(UUID specializationId) {
        return skillRepository.findBySpecializationId(specializationId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public SkillResponse createSkill(SkillRequest request) {
        if (skillRepository.existsBySpecializationIdAndName(request.getSpecializationId(), request.getName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Skill name already exists in this specialization (BR-10)");
        }

        Skill skill = Skill.builder()
                .specializationId(request.getSpecializationId())
                .name(request.getName())
                .isActive(true)
                .build();

        return mapToResponse(skillRepository.save(skill));
    }

    @Override
    @Transactional
    public SkillResponse updateSkill(UUID id, SkillRequest request) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Skill not found"));

        boolean specializationChanged = !skill.getSpecializationId().equals(request.getSpecializationId());

        if ((!skill.getName().equals(request.getName()) || specializationChanged) &&
                skillRepository.existsBySpecializationIdAndName(request.getSpecializationId(), request.getName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Skill name already exists in this specialization (BR-10)");
        }

        skill.setName(request.getName());
        skill.setSpecializationId(request.getSpecializationId());

        SkillResponse response = mapToResponse(skillRepository.save(skill));

        if (specializationChanged) {
            cascadeRemoveMismatchedDeclarations(skill);
        }

        return response;
    }

    /**
     * BR-10 gap (L1_UNIT_TEST_DEF_19), quyết định BA 2026-07-24: khi CM đổi
     * specializationId của Skill, StudentSkill của Student không còn thuộc
     * Specialization mới bị coi là không hợp lệ ngầm — xoá + báo cho Student
     * biết lý do, thay vì để lại dữ liệu mơ hồ (không xoá cũng không hợp lệ).
     */
    private void cascadeRemoveMismatchedDeclarations(Skill skill) {
        List<StudentSkill> declarations = studentSkillRepository.findBySkill_Id(skill.getId());

        List<StudentSkill> mismatched = declarations.stream()
                .filter(ss -> ss.getStudentProfile().getSpecialization() == null ||
                        !ss.getStudentProfile().getSpecialization().getId().equals(skill.getSpecializationId()))
                .collect(Collectors.toList());

        if (mismatched.isEmpty()) {
            return;
        }

        List<Notification> notifications = mismatched.stream()
                .map(ss -> Notification.builder()
                        .user(ss.getStudentProfile().getUserAccount())
                        .type("SKILL_REMOVED")
                        .title("Kỹ năng đã bị gỡ khỏi hồ sơ")
                        .body("Kỹ năng \"" + skill.getName() + "\" đã được chuyển sang chuyên ngành khác và không còn thuộc chuyên ngành của bạn, nên đã bị gỡ khỏi danh sách kỹ năng đã khai báo.")
                        .metadata(Map.of("skillId", skill.getId().toString()))
                        .isRead(false)
                        .build())
                .collect(Collectors.toList());

        studentSkillRepository.deleteAll(mismatched);
        notificationRepository.saveAll(notifications);
    }

    @Override
    @Transactional
    public SkillResponse updateStatus(UUID id, StatusUpdateRequest request) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Skill not found"));

        skill.setIsActive(request.getIsActive()); // BR-09: Soft delete / toggle active
        return mapToResponse(skillRepository.save(skill));
    }

    @Override
    @Transactional
    public SkillResponse updateAliases(UUID id, SkillAliasUpdateRequest request) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Skill not found"));

        skill.getAliases().clear();
        if (request.getAliases() != null) {
            for (String aliasStr : request.getAliases()) {
                SkillAlias alias = SkillAlias.builder()
                        .skill(skill)
                        .alias(aliasStr)
                        .build();
                skill.getAliases().add(alias);
            }
        }

        return mapToResponse(skillRepository.save(skill));
    }

    @Override
    @Transactional
    public SkillResponse updateCourseMap(UUID id, SkillCourseMapRequest request) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Skill not found"));

        if (!Boolean.TRUE.equals(skill.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Không thể gán môn học cho kỹ năng đã bị vô hiệu hóa.");
        }

        // Delete all old mappings for this skill and flush immediately to avoid unique constraint violations
        courseSkillMapRepository.deleteBySkillId(id);
        courseSkillMapRepository.flush();

        // Insert new mappings (filtering duplicates)
        List<UUID> distinctCourseIds = List.of();
        if (request.getCourseIds() != null) {
            distinctCourseIds = request.getCourseIds().stream()
                    .filter(Objects::nonNull)
                    .distinct()
                    .collect(Collectors.toList());

            // Validate that all courses belong to the skill's specialization
            for (UUID courseId : distinctCourseIds) {
                boolean isRelated = false;
                List<com.sep490_g47.smosp.specialization.entity.SpecCourse> specCourses = specCourseRepository.findByCourseId(courseId);
                for (var sc : specCourses) {
                    if (sc.getSpecialization().getId().equals(skill.getSpecializationId())) {
                        isRelated = true;
                        break;
                    }
                }
                if (!isRelated) {
                    List<com.sep490_g47.smosp.narrowspec.entity.NsCourse> nsCourses = nsCourseRepository.findByCourseId(courseId);
                    for (var nc : nsCourses) {
                        if (nc.getNarrowSpec().getSpecialization().getId().equals(skill.getSpecializationId())) {
                            isRelated = true;
                            break;
                        }
                    }
                }
                if (!isRelated) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Môn học không thuộc chuyên ngành của kỹ năng này.");
                }

                CourseSkillMap map = CourseSkillMap.builder()
                        .skillId(id)
                        .courseId(courseId)
                        .build();
                courseSkillMapRepository.save(map);
            }
        }

        // Gán kỹ năng cho môn thì chuyên ngành hẹp chứa môn đó (hoặc chứa môn lấy nó
        // làm tiên quyết) cũng phải có kỹ năng này — trước đây CM phải sang màn Tag Map
        // nhập tay lần hai, và thường quên, khiến engine gợi ý mất đầu vào.
        SkillResponse response = mapToResponse(skill);
        response.setAutoMappedNarrowSpecs(
                tagMapDerivationService.syncNarrowSpecsAffectedByCourses(distinctCourseIds));
        return response;
    }

    private SkillResponse mapToResponse(Skill skill) {
        List<UUID> courseIds = List.of();
        if (skill.getId() != null) {
            courseIds = courseSkillMapRepository.findBySkillId(skill.getId()).stream()
                    .map(CourseSkillMap::getCourseId)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        }

        return SkillResponse.builder()
                .id(skill.getId())
                .specializationId(skill.getSpecializationId())
                .name(skill.getName())
                .isActive(skill.getIsActive())
                .createdAt(skill.getCreatedAt())
                .updatedAt(skill.getUpdatedAt())
                .aliases(skill.getAliases() != null ?
                        skill.getAliases().stream().map(SkillAlias::getAlias).collect(Collectors.toList()) :
                        List.of())
                .courseIds(courseIds)
                .build();
    }
}

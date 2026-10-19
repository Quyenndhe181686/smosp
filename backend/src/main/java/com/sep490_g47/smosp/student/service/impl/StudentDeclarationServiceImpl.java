package com.sep490_g47.smosp.student.service.impl;

import org.springframework.web.server.ResponseStatusException;
import com.sep490_g47.smosp.course.entity.Course;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import com.sep490_g47.smosp.interest.dto.response.InterestOptionResponse;
import com.sep490_g47.smosp.interest.entity.InterestOption;
import com.sep490_g47.smosp.interest.repository.InterestOptionRepository;
import com.sep490_g47.smosp.skill.dto.response.SkillResponse;
import com.sep490_g47.smosp.skill.entity.CourseSkillMap;
import com.sep490_g47.smosp.skill.entity.Skill;
import com.sep490_g47.smosp.skill.repository.CourseSkillMapRepository;
import com.sep490_g47.smosp.skill.repository.SkillRepository;
import com.sep490_g47.smosp.student.entity.StudentInterest;
import com.sep490_g47.smosp.student.entity.StudentProfile;
import com.sep490_g47.smosp.student.entity.StudentSkill;
import com.sep490_g47.smosp.student.repository.StudentInterestRepository;
import com.sep490_g47.smosp.student.repository.StudentProfileRepository;
import com.sep490_g47.smosp.student.repository.StudentSkillRepository;
import com.sep490_g47.smosp.student.service.StudentDeclarationService;
import com.sep490_g47.smosp.transcript.repository.StudentCourseGradeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StudentDeclarationServiceImpl implements StudentDeclarationService {

    private final StudentProfileRepository studentProfileRepository;
    private final SkillRepository skillRepository;
    private final InterestOptionRepository interestOptionRepository;
    private final StudentSkillRepository studentSkillRepository;
    private final StudentInterestRepository studentInterestRepository;
    private final StudentCourseGradeRepository studentCourseGradeRepository;
    private final CourseSkillMapRepository courseSkillMapRepository;
    private final CourseRepository courseRepository;

    @Override
    public List<SkillResponse> getSkillOptions(UUID userId) {
        StudentProfile studentProfile = getStudentProfile(userId);
        if (studentProfile.getSpecialization() == null) return new ArrayList<>();

        List<Skill> skills = skillRepository.findBySpecializationIdAndIsActiveTrue(studentProfile.getSpecialization().getId());
        return skills.stream().map(this::mapToSkillResponse).collect(Collectors.toList());
    }

    @Override
    public List<SkillResponse> searchSkillOptions(UUID userId, String keyword) {
        StudentProfile studentProfile = getStudentProfile(userId);
        if (studentProfile.getSpecialization() == null) return new ArrayList<>();

        List<Skill> skills = skillRepository.findBySpecializationIdAndIsActiveTrue(studentProfile.getSpecialization().getId());
        if (keyword != null && !keyword.trim().isEmpty()) {
            String lowerKeyword = keyword.toLowerCase();
            skills = skills.stream()
                    .filter(s -> s.getName().toLowerCase().contains(lowerKeyword) ||
                            (s.getAliases() != null && s.getAliases().stream().anyMatch(a -> a.getAlias() != null && a.getAlias().toLowerCase().contains(lowerKeyword))))
                    .collect(Collectors.toList());
        }
        return skills.stream().map(this::mapToSkillResponse).collect(Collectors.toList());
    }

    @Override
    public List<SkillResponse> getSkillSuggestions(UUID userId) {
        StudentProfile studentProfile = getStudentProfile(userId);

        // Get declared skill IDs
        Set<UUID> declaredSkillIds = studentSkillRepository.findByStudentProfileId(studentProfile.getId())
                .stream().map(ss -> ss.getSkill().getId()).collect(Collectors.toSet());

        // Get passed courses
        List<UUID> passedCourseIds = studentCourseGradeRepository.findPassedCourseIdsByUserId(userId);
        if (passedCourseIds.isEmpty()) return new ArrayList<>();

        // Get skills from passed courses
        List<CourseSkillMap> skillMaps = courseSkillMapRepository.findByCourseIdIn(passedCourseIds);
        Map<UUID, List<UUID>> skillToCourseIds = new HashMap<>();
        for (CourseSkillMap map : skillMaps) {
            if (!declaredSkillIds.contains(map.getSkillId())) {
                skillToCourseIds.computeIfAbsent(map.getSkillId(), k -> new ArrayList<>()).add(map.getCourseId());
            }
        }

        if (skillToCourseIds.isEmpty()) return new ArrayList<>();

        // Fetch valid skills for specialization or general skills
        List<Skill> validSkills = skillRepository.findAllById(skillToCourseIds.keySet()).stream()
                .filter(s -> studentProfile.getSpecialization() != null && studentProfile.getSpecialization().getId().equals(s.getSpecializationId()))
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .collect(Collectors.toList());

        // Fetch course details for course names
        Set<UUID> allCourseIds = skillToCourseIds.values().stream().flatMap(List::stream).collect(Collectors.toSet());
        Map<UUID, Course> courseMap = courseRepository.findAllById(allCourseIds).stream()
                .collect(Collectors.toMap(Course::getId, c -> c));

        List<SkillResponse> result = new ArrayList<>();
        for (Skill skill : validSkills) {
            SkillResponse res = mapToSkillResponse(skill);
            List<UUID> cIds = skillToCourseIds.getOrDefault(skill.getId(), new ArrayList<>());
            List<String> cNames = cIds.stream()
                    .map(cId -> courseMap.get(cId))
                    .filter(Objects::nonNull)
                    .map(c -> c.getCode() + (c.getName() != null && !c.getName().isBlank() ? " (" + c.getName() + ")" : ""))
                    .collect(Collectors.toList());

            res.setCourseIds(cIds);
            res.setSourceCourseNames(cNames);
            if (!cNames.isEmpty()) {
                res.setSuggestedReason("Gợi ý từ môn học đã hoàn thành: " + String.join(", ", cNames));
                res.setSourceCourseName(cNames.get(0));
            } else {
                res.setSuggestedReason("Gợi ý dựa trên môn học đã hoàn thành trong bảng điểm");
            }
            result.add(res);
        }

        return result;
    }

    @Override
    public List<SkillResponse> getDeclaredSkills(UUID userId) {
        StudentProfile studentProfile = getStudentProfile(userId);
        List<StudentSkill> declaredSkills = studentSkillRepository.findByStudentProfileId(studentProfile.getId());
        return declaredSkills.stream().map(ss -> mapToSkillResponse(ss.getSkill())).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<SkillResponse> updateDeclaredSkills(UUID userId, List<UUID> skillIds) {
        StudentProfile studentProfile = getStudentProfile(userId);
        UUID specId = studentProfile.getSpecialization() != null ? studentProfile.getSpecialization().getId() : null;

        // Verify all skills exist and belong to the correct specialization
        List<Skill> validSkills = new ArrayList<>();
        for (UUID skillId : skillIds) {
            Skill skill = skillRepository.findById(skillId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Skill not found: " + skillId));
            if (specId == null || !specId.equals(skill.getSpecializationId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Skill " + skill.getName() + " does not belong to student's specialization");
            }
            if (skill.getAliases() != null) {
                skill.getAliases().size(); // Initialize lazy collection before clearAutomatically detaches it
            }
            validSkills.add(skill);
        }

        // Delete old and insert new
        studentSkillRepository.deleteByStudentProfileId(studentProfile.getId());

        List<StudentSkill> newEntries = validSkills.stream()
                .map(skill -> StudentSkill.builder()
                        .studentProfile(studentProfile)
                        .skill(skill)
                        .declaredAt(LocalDateTime.now())
                        .build())
                .collect(Collectors.toList());

        studentSkillRepository.saveAll(newEntries);

        return validSkills.stream().map(this::mapToSkillResponse).collect(Collectors.toList());
    }

    @Override
    public List<InterestOptionResponse> getInterestOptions(UUID userId) {
        StudentProfile studentProfile = getStudentProfile(userId);
        if (studentProfile.getSpecialization() == null) return new ArrayList<>();

        List<InterestOption> options = interestOptionRepository.findBySpecializationIdAndIsActiveTrue(studentProfile.getSpecialization().getId());
        return options.stream().map(this::mapToInterestOptionResponse).collect(Collectors.toList());
    }

    @Override
    public List<InterestOptionResponse> getDeclaredInterests(UUID userId) {
        StudentProfile studentProfile = getStudentProfile(userId);
        List<StudentInterest> declaredInterests = studentInterestRepository.findByStudentProfileId(studentProfile.getId());
        return declaredInterests.stream().map(si -> mapToInterestOptionResponse(si.getInterestOption())).collect(Collectors.toList());
    }

    @Override
    @Transactional
    public List<InterestOptionResponse> updateDeclaredInterests(UUID userId, List<UUID> interestOptionIds) {
        StudentProfile studentProfile = getStudentProfile(userId);
        UUID specId = studentProfile.getSpecialization() != null ? studentProfile.getSpecialization().getId() : null;

        // Verify all interests exist and belong to the correct specialization
        List<InterestOption> validInterests = new ArrayList<>();
        for (UUID interestId : interestOptionIds) {
            InterestOption interest = interestOptionRepository.findById(interestId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Interest not found: " + interestId));
            if (specId == null || !specId.equals(interest.getSpecializationId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Interest " + interest.getLabel() + " does not belong to student's specialization");
            }
            validInterests.add(interest);
        }

        // Delete old and insert new
        studentInterestRepository.deleteByStudentProfileId(studentProfile.getId());

        List<StudentInterest> newEntries = validInterests.stream()
                .map(interest -> StudentInterest.builder()
                        .studentProfile(studentProfile)
                        .interestOption(interest)
                        .declaredAt(LocalDateTime.now())
                        .build())
                .collect(Collectors.toList());

        studentInterestRepository.saveAll(newEntries);

        return validInterests.stream().map(this::mapToInterestOptionResponse).collect(Collectors.toList());
    }

    private StudentProfile getStudentProfile(UUID userId) {
        return studentProfileRepository.findByUserAccountId(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "StudentProfile not found"));
    }

    private SkillResponse mapToSkillResponse(Skill skill) {
        SkillResponse res = new SkillResponse();
        res.setId(skill.getId());
        res.setSpecializationId(skill.getSpecializationId());
        res.setName(skill.getName());
        res.setIsActive(skill.getIsActive());
        List<String> aliasList = skill.getAliases() != null ? 
            skill.getAliases().stream().map(a -> a.getAlias()).collect(Collectors.toList()) : new ArrayList<>();
        res.setAliases(aliasList);
        return res;
    }

    private InterestOptionResponse mapToInterestOptionResponse(InterestOption io) {
        InterestOptionResponse res = new InterestOptionResponse();
        res.setId(io.getId());
        res.setSpecializationId(io.getSpecializationId());
        res.setLabel(io.getLabel());
        res.setIsActive(io.getIsActive());
        return res;
    }
}

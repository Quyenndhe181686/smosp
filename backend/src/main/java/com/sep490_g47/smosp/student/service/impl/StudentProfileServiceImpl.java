package com.sep490_g47.smosp.student.service.impl;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.major.entity.Major;
import com.sep490_g47.smosp.major.repository.MajorRepository;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.specialization.entity.Specialization;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import com.sep490_g47.smosp.student.dto.response.StudentProfileResponse;
import com.sep490_g47.smosp.student.dto.request.UpdateStudentProfileRequest;
import com.sep490_g47.smosp.student.entity.StudentProfile;
import com.sep490_g47.smosp.student.repository.StudentProfileRepository;
import com.sep490_g47.smosp.student.service.StudentProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StudentProfileServiceImpl implements StudentProfileService {

    private final StudentProfileRepository studentProfileRepository;
    private final UserAccountRepository userAccountRepository;
    private final MajorRepository majorRepository;
    private final SpecializationRepository specializationRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final com.sep490_g47.smosp.student.repository.StudentSkillRepository studentSkillRepository;
    private final com.sep490_g47.smosp.student.repository.StudentInterestRepository studentInterestRepository;

    @Override
    @Transactional(readOnly = true)
    public StudentProfileResponse getMyProfile(UUID userId) {
        StudentProfile profile = studentProfileRepository.findByUserAccountId(userId).orElse(null);
        if (profile == null) {
            UserAccount userAccount = userAccountRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
            
            return StudentProfileResponse.builder()
                    .fullName(userAccount.getDisplayName())
                    .build();
        }
        return mapToResponseDTO(profile);
    }

    @Override
    @Transactional
    public StudentProfileResponse updateMyProfile(UUID userId, UpdateStudentProfileRequest request) {
        if (request.getCurrentTerm() <= 4 && request.getCurrentNarrowSpecId() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Students in terms 1 to 4 have not started a narrow specialization yet. Please leave the narrow specialization empty.");
        }

        UserAccount userAccount = userAccountRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        StudentProfile profile = studentProfileRepository.findByUserAccountId(userId)
                .orElseGet(() -> StudentProfile.builder()
                        .userAccount(userAccount)
                        .build());

        Major newMajor = majorRepository.findById(request.getMajorId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Major not found"));

        Specialization newSpec = specializationRepository.findById(request.getSpecializationId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Specialization not found"));

        NarrowSpecialization newNarrowSpec = null;
        if (request.getCurrentNarrowSpecId() != null) {
            newNarrowSpec = narrowSpecRepository.findById(request.getCurrentNarrowSpecId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Narrow Specialization not found"));
            
            if (!newNarrowSpec.getSpecialization().getId().equals(newSpec.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Narrow Specialization does not belong to the selected Specialization");
            }
        }

        boolean majorChanged = profile.getMajor() == null || !profile.getMajor().getId().equals(newMajor.getId());
        boolean specChanged = profile.getSpecialization() == null || !profile.getSpecialization().getId().equals(newSpec.getId());

        if (specChanged && profile.getId() != null) {
            studentSkillRepository.deleteByStudentProfileId(profile.getId());
            studentInterestRepository.deleteByStudentProfileId(profile.getId());
        }
        
        profile.setFullName(request.getFullName());
        profile.setStudentCode(request.getStudentCode());
        profile.setCurrentTerm(request.getCurrentTerm());
        profile.setMajor(newMajor);
        
        // update UserAccount's display name as well
        userAccount.setDisplayName(request.getFullName());
        userAccountRepository.save(userAccount);

        if (majorChanged) {
            if (!newSpec.getMajor().getId().equals(newMajor.getId())) {
                profile.setSpecialization(null);
                profile.setCurrentNarrowSpec(null);
            } else {
                profile.setSpecialization(newSpec);
                profile.setCurrentNarrowSpec(newNarrowSpec);
            }
        } else {
            if (!newSpec.getMajor().getId().equals(newMajor.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Specialization does not belong to the selected Major");
            }
            profile.setSpecialization(newSpec);
            profile.setCurrentNarrowSpec(newNarrowSpec);
        }

        profile.setProfileUpdatedAt(LocalDateTime.now());
        profile = studentProfileRepository.save(profile);

        return mapToResponseDTO(profile);
    }

    private StudentProfileResponse mapToResponseDTO(StudentProfile profile) {
        return StudentProfileResponse.builder()
                .id(profile.getId())
                .fullName(profile.getFullName())
                .studentCode(profile.getStudentCode())
                .majorId(profile.getMajor() != null ? profile.getMajor().getId() : null)
                .majorName(profile.getMajor() != null ? profile.getMajor().getName() : null)
                .specializationId(profile.getSpecialization() != null ? profile.getSpecialization().getId() : null)
                .specializationName(profile.getSpecialization() != null ? profile.getSpecialization().getName() : null)
                .currentNarrowSpecId(profile.getCurrentNarrowSpec() != null ? profile.getCurrentNarrowSpec().getId() : null)
                .currentNarrowSpecName(profile.getCurrentNarrowSpec() != null ? profile.getCurrentNarrowSpec().getName() : null)
                .currentTerm(profile.getCurrentTerm())
                .cumulativeGpa(profile.getCumulativeGpa())
                .profileUpdatedAt(profile.getProfileUpdatedAt())
                .build();
    }
}

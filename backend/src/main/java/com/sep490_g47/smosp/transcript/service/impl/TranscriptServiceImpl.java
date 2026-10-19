package com.sep490_g47.smosp.transcript.service.impl;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.course.entity.Course;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import com.sep490_g47.smosp.student.entity.StudentProfile;
import com.sep490_g47.smosp.student.repository.StudentProfileRepository;
import com.sep490_g47.smosp.transcript.dto.response.StudentCourseGradeResponse;
import com.sep490_g47.smosp.transcript.dto.response.TranscriptResponse;
import com.sep490_g47.smosp.transcript.entity.CourseGradeStatus;
import com.sep490_g47.smosp.transcript.entity.StudentCourseGrade;
import com.sep490_g47.smosp.transcript.entity.Transcript;
import com.sep490_g47.smosp.transcript.entity.TranscriptMappingPreset;
import com.sep490_g47.smosp.transcript.repository.TranscriptMappingPresetRepository;
import com.sep490_g47.smosp.transcript.repository.TranscriptRepository;

import com.sep490_g47.smosp.transcript.service.TranscriptParserService;
import com.sep490_g47.smosp.transcript.service.TranscriptService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TranscriptServiceImpl implements TranscriptService {

    private final TranscriptRepository transcriptRepository;
    private final CourseRepository courseRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final UserAccountRepository userAccountRepository;
    private final TranscriptMappingPresetRepository presetRepository;
    private final TranscriptParserService parserService;


    private StudentProfile getCurrentStudent() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        UserAccount user = userAccountRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        return studentProfileRepository.findByUserAccountId(user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student profile not found"));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public TranscriptResponse uploadTranscript(MultipartFile file) {
        // BV-09: bang diem toi da 5 MB. Truoc day khong tang nao ep gioi han nay —
        // spring.servlet.multipart.max-file-size trong application.yml dat 25 MB
        // (tran ky thuat cua Spring, khong phai gioi han nghiep vu), nen mot file
        // 6 MB van lot qua Spring roi di het luong parse + luu ma khong bi chan o
        // dau. Kiem ngay dau tien, truoc ca rate-limit, de khong ton cong dem DB
        // cho mot file se bi tu choi.
        final long maxTranscriptFileSizeBytes = 5L * 1024 * 1024;
        if (file.isEmpty() || file.getSize() == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File bảng điểm không được rỗng (0 byte)");
        }
        if (file.getSize() > maxTranscriptFileSizeBytes) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Bảng điểm không được vượt quá 5MB");
        }

        StudentProfile student = getCurrentStudent();

        // Rate limiting (BV-11)
        long uploadsInLastHour = transcriptRepository.countByStudentProfileIdAndUploadTimeAfter(
                student.getId(), LocalDateTime.now().minusHours(1));
        if (uploadsInLastHour >= 3) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Rate limit exceeded. Please try again later.");
        }

        TranscriptMappingPreset preset = presetRepository.findByIsActiveTrue()
                .orElseGet(() -> presetRepository.findByIsDefaultTrue().stream().findFirst()
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "No active or default preset found")));

        // Parse file first before uploading, fail fast
        List<TranscriptParserService.ParsedGradeDTO> parsedRows = parserService.parseTranscript(file, preset.getColumnMapping());

        if (parsedRows.size() < 1 || parsedRows.size() > 150) {
            throw new IllegalArgumentException("Invalid number of course rows (must be 1-150). Found: " + parsedRows.size());
        }

        // Delete ALL previous transcripts of the student to ensure completely replaced data (AC-15-03)
        List<Transcript> oldTranscripts = transcriptRepository.findAllByStudentProfileId(student.getId());
        transcriptRepository.deleteAll(oldTranscripts);

        Transcript transcript = Transcript.builder()
                .studentProfile(student)
                .uploadTime(LocalDateTime.now())
                .fileName(file.getOriginalFilename())
                .preset(preset)
                .totalCredits(0)
                .completedCourses(0)
                .build();

        int completedCoursesCount = 0;
        int totalCompletedCredits = 0;
        BigDecimal totalGpaPoints = BigDecimal.ZERO;
        int gpaCredits = 0;

        for (TranscriptParserService.ParsedGradeDTO row : parsedRows) {
            Course course = courseRepository.findByCode(row.getCourseCodeRaw()).orElse(null);
            CourseGradeStatus status = mapStatus(row.getStatusStr());

            boolean isCompleted = isCourseCompleted(row.getGrade(), status);

            StudentCourseGrade grade = StudentCourseGrade.builder()
                    .transcript(transcript)
                    .course(course)
                    .courseCodeRaw(row.getCourseCodeRaw())
                    .grade(row.getGrade())
                    .status(status)
                    .build();

            transcript.getGrades().add(grade);

            if (isCompleted && course != null) {
                completedCoursesCount++;
                totalCompletedCredits += (course.getCredits() != null ? course.getCredits() : 0);
            }

            if (course != null && Boolean.TRUE.equals(course.getCountsTowardGpa()) && row.getGrade() != null && status == CourseGradeStatus.PASSED) {
                int c = course.getCredits() != null ? course.getCredits() : 0;
                gpaCredits += c;
                totalGpaPoints = totalGpaPoints.add(row.getGrade().multiply(new BigDecimal(c)));
            }
        }

        transcript.setCompletedCourses(completedCoursesCount);
        transcript.setTotalCredits(totalCompletedCredits);
        transcriptRepository.save(transcript);

        // Update student GPA
        if (gpaCredits > 0) {
            student.setCumulativeGpa(totalGpaPoints.divide(new BigDecimal(gpaCredits), 3, RoundingMode.HALF_UP));
        } else {
            log.warn("Transcript uploaded for student {} has no matching courses with GPA credits; cumulativeGpa set to null", student.getId());
            student.setCumulativeGpa(null);
        }
        student.setProfileUpdatedAt(LocalDateTime.now());
        studentProfileRepository.save(student);

        return mapToResponse(transcript, student.getCumulativeGpa());
    }

    private CourseGradeStatus mapStatus(String statusStr) {
        if (statusStr == null) throw new IllegalArgumentException("Status cannot be null");
        String s = statusStr.trim().toLowerCase();
        if (s.equals("passed")) return CourseGradeStatus.PASSED;
        if (s.equals("failed") || s.equals("not passed")) return CourseGradeStatus.FAILED;
        if (s.equals("studying")) return CourseGradeStatus.STUDYING;
        if (s.equals("not started")) return CourseGradeStatus.NOT_STARTED;
        throw new IllegalArgumentException("Unknown course status: " + statusStr);
    }

    private boolean isCourseCompleted(BigDecimal grade, CourseGradeStatus status) {
        if (grade != null && grade.compareTo(new BigDecimal("5.0")) >= 0) return true;
        if (grade == null && status == CourseGradeStatus.PASSED) return true;
        return false;
    }


    @Override
    public TranscriptResponse getLatestTranscript() {
        StudentProfile student = getCurrentStudent();
        return transcriptRepository.findFirstByStudentProfileIdOrderByUploadTimeDesc(student.getId())
                .map(t -> mapToResponse(t, student.getCumulativeGpa()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No transcript uploaded yet"));
    }

    @Override
    public List<StudentCourseGradeResponse> getMyGrades() {
        TranscriptResponse latest = getLatestTranscript();
        return latest.getGrades();
    }

    private TranscriptResponse mapToResponse(Transcript transcript, BigDecimal cumulativeGpa) {
        List<StudentCourseGradeResponse> gradeResponses = transcript.getGrades().stream()
                .map(g -> {
                    var course = g.getCourse();
                    return StudentCourseGradeResponse.builder()
                            .id(g.getId())
                            .courseId(course != null ? course.getId() : null)
                            .courseCodeRaw(g.getCourseCodeRaw())
                            .courseCode(course != null ? course.getCode() : g.getCourseCodeRaw())
                            .courseName(course != null ? course.getName() : null)
                            .credits(course != null ? course.getCredits() : null)
                            .countsTowardGpa(course != null ? course.getCountsTowardGpa() : true)
                            .grade(g.getGrade())
                            .status(g.getStatus())
                            .build();
                })
                .collect(Collectors.toList());

        return TranscriptResponse.builder()
                .id(transcript.getId())
                .fileName(transcript.getFileName())
                .uploadTime(transcript.getUploadTime())
                .totalCredits(transcript.getTotalCredits())
                .completedCourses(transcript.getCompletedCourses())
                .cumulativeGpa(cumulativeGpa)
                .grades(gradeResponses)
                .build();
    }
}

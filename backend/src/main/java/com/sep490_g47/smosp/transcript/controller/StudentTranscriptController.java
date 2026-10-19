package com.sep490_g47.smosp.transcript.controller;

import com.sep490_g47.smosp.transcript.dto.response.StudentCourseGradeResponse;
import com.sep490_g47.smosp.transcript.dto.response.TranscriptResponse;
import com.sep490_g47.smosp.transcript.service.TranscriptService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/students/me")
@RequiredArgsConstructor
public class StudentTranscriptController {

    private final TranscriptService transcriptService;

    @PostMapping(value = "/transcripts", consumes = org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<TranscriptResponse> uploadTranscript(
            @RequestParam("file") MultipartFile file,
            @org.springframework.security.core.annotation.AuthenticationPrincipal com.sep490_g47.smosp.auth.security.CustomUserDetails userDetails) {
        TranscriptResponse response = transcriptService.uploadTranscript(file);
        return ResponseEntity.ok(response);
    }


    @GetMapping("/transcripts/latest")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<TranscriptResponse> getLatestTranscript() {
        return ResponseEntity.ok(transcriptService.getLatestTranscript());
    }

    @GetMapping("/grades")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<StudentCourseGradeResponse>> getMyGrades() {
        return ResponseEntity.ok(transcriptService.getMyGrades());
    }
}

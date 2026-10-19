package com.sep490_g47.smosp.transcript.service;

import com.sep490_g47.smosp.transcript.dto.response.StudentCourseGradeResponse;
import com.sep490_g47.smosp.transcript.dto.response.TranscriptResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface TranscriptService {
    TranscriptResponse uploadTranscript(MultipartFile file);
    TranscriptResponse getLatestTranscript();
    List<StudentCourseGradeResponse> getMyGrades();
}

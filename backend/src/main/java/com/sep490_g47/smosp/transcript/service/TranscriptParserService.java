package com.sep490_g47.smosp.transcript.service;

import org.springframework.web.multipart.MultipartFile;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.Builder;
import lombok.Data;

public interface TranscriptParserService {
    List<ParsedGradeDTO> parseTranscript(MultipartFile file, Map<String, String> columnMapping);

    @Data
    @Builder
    class ParsedGradeDTO {
        private String courseCodeRaw;
        private BigDecimal grade;
        private String statusStr;
    }
}

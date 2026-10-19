package com.sep490_g47.smosp.transcript.service.impl;

import com.sep490_g47.smosp.transcript.service.TranscriptParserService;
import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.*;

@Service
public class TranscriptParserServiceImpl implements TranscriptParserService {

    @Override
    public List<ParsedGradeDTO> parseTranscript(MultipartFile file, Map<String, String> columnMapping) {
        try {
            byte[] bytes = file.getBytes();
            return parsePoi(bytes, columnMapping);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to parse transcript file: " + e.getMessage(), e);
        }
    }

    private List<ParsedGradeDTO> parsePoi(byte[] bytes, Map<String, String> columnMapping) throws Exception {
        Workbook workbook;
        try (InputStream is = new ByteArrayInputStream(bytes)) {
            workbook = WorkbookFactory.create(is);
        } catch (Exception e) {
            throw new IllegalArgumentException("File không đúng định dạng Excel. Vui lòng mở file bằng Microsoft Excel, chọn Save As -> Excel Workbook (.xlsx) rồi tải lên lại.");
        }

        try {
            Sheet sheet = workbook.getSheetAt(0); // Only parse first sheet
            
            String mappedCourseCode = "Subject Code";
            String mappedGrade = "Grade";
            String mappedStatus = "Status";
            
            for (Map.Entry<String, String> entry : columnMapping.entrySet()) {
                if (entry.getValue() == null) continue;
                String sysField = entry.getValue().trim();
                if ("courseCode".equalsIgnoreCase(sysField)) mappedCourseCode = entry.getKey();
                else if ("grade".equalsIgnoreCase(sysField)) mappedGrade = entry.getKey();
                else if ("status".equalsIgnoreCase(sysField)) mappedStatus = entry.getKey();
            }

            int courseCodeIdx = -1, gradeIdx = -1, statusIdx = -1;
            int headerRowIdx = -1;

            for (Row row : sheet) {
                for (Cell cell : row) {
                    if (cell.getCellType() == CellType.STRING) {
                        String val = cell.getStringCellValue().trim().toLowerCase();
                        if (val.equals(mappedCourseCode.trim().toLowerCase())) courseCodeIdx = cell.getColumnIndex();
                        if (val.equals(mappedGrade.trim().toLowerCase())) gradeIdx = cell.getColumnIndex();
                        if (val.equals(mappedStatus.trim().toLowerCase())) statusIdx = cell.getColumnIndex();
                    }
                }
                if (courseCodeIdx >= 0 && gradeIdx >= 0 && statusIdx >= 0) {
                    headerRowIdx = row.getRowNum();
                    break;
                }
            }

            if (headerRowIdx == -1) {
                throw new IllegalArgumentException("Could not find header row with mapped columns in Excel file");
            }

            List<ParsedGradeDTO> result = new ArrayList<>();
            for (int i = headerRowIdx + 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null) continue;

                String courseCode = getCellStringValue(row.getCell(courseCodeIdx));
                String gradeStr = getCellStringValue(row.getCell(gradeIdx));
                String statusStr = getCellStringValue(row.getCell(statusIdx));

                String firstCellVal = getCellStringValue(row.getCell(0));
                if (firstCellVal.startsWith("(*)")) break;

                if (courseCode.isEmpty() && statusStr.isEmpty()) continue;

                result.add(buildDTO(courseCode, gradeStr, statusStr));
            }

            return result;
        } finally {
            if (workbook != null) {
                workbook.close();
            }
        }
    }

    private String getCellStringValue(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING: return cell.getStringCellValue().trim();
            case NUMERIC: return String.valueOf(cell.getNumericCellValue());
            case BOOLEAN: return String.valueOf(cell.getBooleanCellValue());
            default: return "";
        }
    }

    private ParsedGradeDTO buildDTO(String courseCode, String gradeStr, String statusStr) {
        BigDecimal grade = null;
        if (!gradeStr.isEmpty()) {
            try {
                grade = new BigDecimal(gradeStr);
                if (grade.compareTo(BigDecimal.ZERO) < 0 || grade.compareTo(BigDecimal.TEN) > 0) {
                    throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Điểm của môn " + courseCode + " nằm ngoài miền hợp lệ (0.0 - 10.0)");
                }
            } catch (NumberFormatException e) {
                throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Định dạng điểm không hợp lệ ở môn " + courseCode + ": " + gradeStr);
            }
        }
        return ParsedGradeDTO.builder()
                .courseCodeRaw(courseCode)
                .grade(grade)
                .statusStr(statusStr)
                .build();
    }
}

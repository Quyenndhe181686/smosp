package com.sep490_g47.smosp.major.controller;

import com.sep490_g47.smosp.major.dto.request.MajorRequest;
import com.sep490_g47.smosp.major.dto.response.MajorResponse;
import com.sep490_g47.smosp.major.dto.request.StatusUpdateRequest;
import com.sep490_g47.smosp.major.service.MajorImageService;
import com.sep490_g47.smosp.major.service.MajorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/majors")
@PreAuthorize("hasRole('CONTENT_MANAGER')")
@RequiredArgsConstructor
public class CmMajorController {

    private final MajorService majorService;
    private final MajorImageService majorImageService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public MajorResponse createMajor(@Valid @RequestBody MajorRequest request) {
        return majorService.createMajor(request);
    }

    @PutMapping("/{id}")
    @ResponseStatus(HttpStatus.OK)
    public MajorResponse updateMajor(@PathVariable UUID id, @Valid @RequestBody MajorRequest request) {
        return majorService.updateMajor(id, request);
    }

    @PatchMapping("/{id}/status")
    @ResponseStatus(HttpStatus.OK)
    public MajorResponse updateMajorStatus(@PathVariable UUID id, @Valid @RequestBody StatusUpdateRequest request) {
        return majorService.updateMajorStatus(id, request);
    }

    @PostMapping(value = "/{code}/image", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, String>> uploadMajorImage(
            @PathVariable String code,
            @RequestParam("file") MultipartFile file) {
        
        String contentType = file.getContentType();
        if (contentType == null || !(contentType.equals("image/png") || contentType.equals("image/jpeg"))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "File must be image/png or image/jpeg");
        }
        
        String publicUrl = majorImageService.uploadAndUpdateMajorImage(code, file);
        return ResponseEntity.ok(Collections.singletonMap("url", publicUrl));
    }
}

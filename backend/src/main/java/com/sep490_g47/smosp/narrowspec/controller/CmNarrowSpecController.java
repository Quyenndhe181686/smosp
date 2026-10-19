package com.sep490_g47.smosp.narrowspec.controller;

import com.sep490_g47.smosp.narrowspec.dto.request.NarrowSpecRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.NarrowSpecResponse;
import com.sep490_g47.smosp.narrowspec.dto.request.NsCourseRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.NsCourseResponse;
import com.sep490_g47.smosp.narrowspec.dto.request.NsExcludedCourseRequest;
import com.sep490_g47.smosp.narrowspec.dto.response.NsExcludedCourseResponse;
import com.sep490_g47.smosp.narrowspec.dto.request.PublishRequest;
import com.sep490_g47.smosp.narrowspec.service.NarrowSpecService;
import com.sep490_g47.smosp.tagmap.dto.request.TagMapEntryRequest;
import com.sep490_g47.smosp.tagmap.dto.response.TagMapResponse;
import com.sep490_g47.smosp.tagmap.dto.response.TagMapSuggestionResponse;
import com.sep490_g47.smosp.tagmap.dto.response.TagMapSyncResponse;
import com.sep490_g47.smosp.tagmap.service.TagMapDerivationService;
import com.sep490_g47.smosp.tagmap.service.TagMapService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/narrow-specs")
@RequiredArgsConstructor
public class CmNarrowSpecController {

    private final NarrowSpecService narrowSpecService;
    private final TagMapService tagMapService;
    private final TagMapDerivationService tagMapDerivationService;

    @PostMapping
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public NarrowSpecResponse createNarrowSpec(@Valid @RequestBody NarrowSpecRequest request) {
        return narrowSpecService.createNarrowSpec(request);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public NarrowSpecResponse updateNarrowSpec(@PathVariable UUID id, @Valid @RequestBody NarrowSpecRequest request) {
        return narrowSpecService.updateNarrowSpec(id, request);
    }

    @PatchMapping("/{id}/publish")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public NarrowSpecResponse publishNarrowSpec(@PathVariable UUID id, @Valid @RequestBody PublishRequest request) {
        return narrowSpecService.publishNarrowSpec(id, request);
    }

    @GetMapping("/{id}/courses")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'STUDENT', 'ADMIN')")
    public List<NsCourseResponse> getNarrowSpecCourses(@PathVariable UUID id) {
        return narrowSpecService.getNarrowSpecCourses(id);
    }

    @PutMapping("/{id}/courses")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public List<NsCourseResponse> updateNarrowSpecCourses(
            @PathVariable UUID id,
            @Valid @RequestBody List<NsCourseRequest> requests) {
        return narrowSpecService.updateNarrowSpecCourses(id, requests);
    }

    // Bốn method dưới đây trước đây KHÔNG có @PreAuthorize, trong khi mọi method
    // khác của controller đều có. SecurityConfig cũng không có rule riêng cho hai
    // path này: dòng 57 chỉ permitAll cho "/api/narrow-specs/*" (đúng MỘT segment),
    // không phủ "/{id}/excluded-courses". Chúng rơi xuống .anyRequest().authenticated()
    // — tức bất kỳ ai đã đăng nhập, kể cả STUDENT, đều gọi được.
    //
    // Đã probe thật: STUDENT gọi PUT /excluded-courses và PUT /tag-map đều trả 200
    // và ghi bản ghi thật vào DB. Hai bảng này quyết định roadmap công khai mà mọi
    // sinh viên khác nhìn thấy, và là đầu vào của thuật toán gợi ý.
    //
    // Hai GET cũng khoá: chưa tìm thấy use case nào cần Student đọc trực tiếp
    // NsExcludedCourse.note hay TagMap.weight.
    @GetMapping("/{id}/excluded-courses")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public List<NsExcludedCourseResponse> getExcludedCourses(@PathVariable UUID id) {
        return narrowSpecService.getExcludedCourses(id);
    }

    @PutMapping("/{id}/excluded-courses")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public List<NsExcludedCourseResponse> updateExcludedCourses(
            @PathVariable UUID id,
            @Valid @RequestBody List<NsExcludedCourseRequest> requests) {
        return narrowSpecService.updateExcludedCourses(id, requests);
    }

    @GetMapping("/{id}/tag-map")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public List<TagMapResponse> getTagMap(@PathVariable UUID id) {
        return tagMapService.getTagMap(id);
    }

    @PutMapping("/{id}/tag-map")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public List<TagMapResponse> updateTagMap(
            @PathVariable UUID id,
            @Valid @RequestBody List<TagMapEntryRequest> requests) {
        return tagMapService.updateTagMap(id, requests);
    }

    /** Kỹ năng suy ra từ môn học của CNH (kể cả qua môn tiên quyết) mà tag map còn thiếu. */
    @GetMapping("/{id}/tag-map/suggestions")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public List<TagMapSuggestionResponse> getTagMapSuggestions(@PathVariable UUID id) {
        return tagMapDerivationService.getSuggestions(id);
    }

    /** Ghi các kỹ năng suy ra còn thiếu vào tag map; mục CM đã cấu hình giữ nguyên. */
    @PostMapping("/{id}/tag-map/sync")
    @PreAuthorize("hasAnyRole('CONTENT_MANAGER', 'ADMIN')")
    public TagMapSyncResponse syncTagMapFromCourses(@PathVariable UUID id) {
        return tagMapDerivationService.syncFromCourses(id);
    }
}

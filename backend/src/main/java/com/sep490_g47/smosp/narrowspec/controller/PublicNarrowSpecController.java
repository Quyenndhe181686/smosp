package com.sep490_g47.smosp.narrowspec.controller;

import com.sep490_g47.smosp.narrowspec.service.NarrowSpecService;
import com.sep490_g47.smosp.roadmap.dto.response.RoadmapResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/narrow-specs")
@RequiredArgsConstructor
public class PublicNarrowSpecController {

    private final NarrowSpecService narrowSpecService;

    @GetMapping("/{id}/roadmap")
    public RoadmapResponse getStandardRoadmap(@PathVariable UUID id) {
        return narrowSpecService.getStandardRoadmap(id);
    }
}

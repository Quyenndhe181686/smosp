package com.sep490_g47.smosp.roadmap.dto.request;
import lombok.Data;
import jakarta.validation.constraints.NotBlank;
@Data public class RenameRoadmapRequest { @NotBlank private String name; }
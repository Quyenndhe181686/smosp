package com.sep490_g47.smosp.roadmap.dto.request;
import lombok.Data;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.NotBlank;
@Data public class UpdateNoteRequest { @NotBlank @Size(max = 500) private String note; }
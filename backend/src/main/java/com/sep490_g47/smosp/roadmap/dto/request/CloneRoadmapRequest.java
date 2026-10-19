package com.sep490_g47.smosp.roadmap.dto.request;
import lombok.Data;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
@Data public class CloneRoadmapRequest { @NotNull private UUID narrowSpecId; }
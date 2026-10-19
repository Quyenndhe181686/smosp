package com.sep490_g47.smosp.catalog.dto.response;

import com.sep490_g47.smosp.major.dto.response.MajorResponse;
import com.sep490_g47.smosp.narrowspec.dto.response.NarrowSpecResponse;
import com.sep490_g47.smosp.specialization.dto.response.SpecializationResponse;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CatalogSearchResponse {
    private List<MajorResponse> majors;
    private List<SpecializationResponse> specializations;
    private List<NarrowSpecResponse> narrowSpecs;
}

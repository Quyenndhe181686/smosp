package com.sep490_g47.smosp.catalog.service;

import com.sep490_g47.smosp.catalog.dto.request.CatalogSearchRequest;
import com.sep490_g47.smosp.catalog.dto.response.CatalogSearchResponse;
import com.sep490_g47.smosp.catalog.dto.response.NarrowSpecDetailResponse;
import com.sep490_g47.smosp.narrowspec.dto.response.NarrowSpecResponse;
import com.sep490_g47.smosp.specialization.dto.response.SpecializationResponse;

import java.util.List;
import java.util.UUID;

public interface PublicCatalogService {
    List<SpecializationResponse> getSpecializationsByMajor(UUID majorId);
    List<NarrowSpecResponse> getNarrowSpecsBySpecialization(UUID specializationId);
    NarrowSpecDetailResponse getNarrowSpecDetail(UUID id);
    CatalogSearchResponse searchCatalog(CatalogSearchRequest request);
}

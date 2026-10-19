package com.sep490_g47.smosp.tagmap.service;

import com.sep490_g47.smosp.tagmap.dto.request.TagMapEntryRequest;
import com.sep490_g47.smosp.tagmap.dto.response.TagMapResponse;

import java.util.List;
import java.util.UUID;

public interface TagMapService {
    List<TagMapResponse> getTagMap(UUID narrowSpecId);
    List<TagMapResponse> updateTagMap(UUID narrowSpecId, List<TagMapEntryRequest> entries);
}

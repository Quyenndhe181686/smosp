package com.sep490_g47.smosp.crawler.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class VnwSearchResponse {
    private VnwMeta meta;
    private List<Map<String, Object>> data;
}

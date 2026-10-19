package com.sep490_g47.smosp.crawler.dto.response;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonIgnoreProperties(ignoreUnknown = true)
public class VnwMeta {
    private int nbHits;
    private int nbPages;
    private int page;
    private int hitsPerPage;
}

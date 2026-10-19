package com.sep490_g47.smosp.tagmap.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/** Kết quả đồng bộ tag_map từ môn học của một chuyên ngành hẹp. */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TagMapSyncResponse {
    private UUID narrowSpecId;
    private String narrowSpecName;
    /** Số mục vừa được thêm mới (mục CM đã có sẵn không bị đụng tới). */
    private Integer addedCount;
    private List<TagMapResponse> added;
    /** Toàn bộ tag_map của CNH sau khi đồng bộ. */
    private List<TagMapResponse> entries;
}

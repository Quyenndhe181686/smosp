package com.sep490_g47.smosp.skill.dto.response;

import com.sep490_g47.smosp.common.dto.response.BaseResponse;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

import java.util.List;
import java.util.UUID;

@Data
@EqualsAndHashCode(callSuper = true)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class SkillResponse extends BaseResponse {
    private UUID id;
    private UUID specializationId;
    private String name;
    private Boolean isActive;
    private List<String> aliases;
    private List<UUID> courseIds;
    private String sourceCourseName;
    private List<String> sourceCourseNames;
    private String suggestedReason;
    /**
     * Tên các chuyên ngành hẹp vừa được tự động nhận kỹ năng này khi CM lưu ánh xạ
     * môn học. Chỉ được điền ở PUT /cm/skills/{id}/course-map.
     */
    private List<String> autoMappedNarrowSpecs;
}

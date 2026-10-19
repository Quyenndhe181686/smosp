package com.sep490_g47.smosp.recommendation.service.impl;

import com.sep490_g47.smosp.auth.entity.UserAccount;
import com.sep490_g47.smosp.auth.repository.UserAccountRepository;
import com.sep490_g47.smosp.course.entity.Course;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposal;
import com.sep490_g47.smosp.crawler.entity.TrendingWeightProposalStatus;
import com.sep490_g47.smosp.crawler.repository.TrendingWeightProposalRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecWeightConfig;
import com.sep490_g47.smosp.narrowspec.entity.NarrowSpecialization;
import com.sep490_g47.smosp.narrowspec.entity.NsCourse;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecRepository;
import com.sep490_g47.smosp.narrowspec.repository.NarrowSpecWeightConfigRepository;
import com.sep490_g47.smosp.narrowspec.repository.NsCourseRepository;
import com.sep490_g47.smosp.recommendation.dto.response.*;
import com.sep490_g47.smosp.recommendation.entity.RecommendationItem;
import com.sep490_g47.smosp.recommendation.entity.RecommendationResult;
import com.sep490_g47.smosp.recommendation.repository.RecommendationItemRepository;
import com.sep490_g47.smosp.recommendation.repository.RecommendationResultRepository;
import com.sep490_g47.smosp.recommendation.service.RecommendationService;
import com.sep490_g47.smosp.skill.entity.CourseSkillMap;
import com.sep490_g47.smosp.skill.repository.CourseSkillMapRepository;
import com.sep490_g47.smosp.specialization.entity.SpecCourse;
import com.sep490_g47.smosp.specialization.repository.SpecCourseRepository;
import com.sep490_g47.smosp.student.entity.StudentInterest;
import com.sep490_g47.smosp.student.entity.StudentProfile;
import com.sep490_g47.smosp.student.entity.StudentSkill;
import com.sep490_g47.smosp.student.repository.StudentInterestRepository;
import com.sep490_g47.smosp.student.repository.StudentProfileRepository;
import com.sep490_g47.smosp.student.repository.StudentSkillRepository;
import com.sep490_g47.smosp.course.repository.CourseRepository;
import com.sep490_g47.smosp.skill.repository.SkillRepository;
import com.sep490_g47.smosp.interest.repository.InterestOptionRepository;
import com.sep490_g47.smosp.skill.entity.Skill;
import com.sep490_g47.smosp.interest.entity.InterestOption;
import com.sep490_g47.smosp.tagmap.entity.TagMap;
import com.sep490_g47.smosp.tagmap.repository.TagMapRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

import com.sep490_g47.smosp.transcript.repository.TranscriptRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class RecommendationServiceImpl implements RecommendationService {

    private final UserAccountRepository userAccountRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final NarrowSpecRepository narrowSpecRepository;
    private final TagMapRepository tagMapRepository;
    private final StudentSkillRepository studentSkillRepository;
    private final StudentInterestRepository studentInterestRepository;
    private final NarrowSpecWeightConfigRepository narrowSpecWeightConfigRepository;
    private final TrendingWeightProposalRepository trendingWeightProposalRepository;
    private final RecommendationResultRepository recommendationResultRepository;
    private final RecommendationItemRepository recommendationItemRepository;
    private final CourseSkillMapRepository courseSkillMapRepository;
    private final NsCourseRepository nsCourseRepository;
    private final SpecCourseRepository specCourseRepository;
    private final SkillRepository skillRepository;
    private final InterestOptionRepository interestOptionRepository;
    private final CourseRepository courseRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final TranscriptRepository transcriptRepository;

    private StudentProfile getCurrentStudent() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not authenticated");
        }
        String identifier = authentication.getName();
        UserAccount user = userAccountRepository.findByEmail(identifier)
                .orElseGet(() -> userAccountRepository.findByUsername(identifier)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found")));

        return studentProfileRepository.findByUserAccountId(user.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Student profile not found"));
    }

    @Override
    @Transactional
    public RecommendationResultResponse runRecommendation() {
        StudentProfile student = getCurrentStudent();

        if (student.getSpecialization() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Vui lòng khai báo chuyên ngành trong hồ sơ cá nhân trước khi sử dụng tính năng gợi ý");
        }

        List<StudentSkill> studentSkills = studentSkillRepository.findByStudentProfileId(student.getId());
        List<StudentInterest> studentInterests = studentInterestRepository.findByStudentProfileId(student.getId());
        boolean hasTranscript = (student.getCumulativeGpa() != null)
                || transcriptRepository.findFirstByStudentProfileIdOrderByUploadTimeDesc(student.getId()).isPresent();

        if (studentSkills.isEmpty() && studentInterests.isEmpty() && !hasTranscript) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Vui lòng khai báo ít nhất một thông tin trong hồ sơ (bảng điểm, kỹ năng hoặc sở thích) trước khi sử dụng tính năng gợi ý");
        }

        List<NarrowSpecialization> publishedNsList = narrowSpecRepository.findBySpecializationIdAndIsPublishedTrue(student.getSpecialization().getId());
        if (publishedNsList.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Chuyên ngành của bạn hiện chưa có chuyên ngành hẹp nào được công bố");
        }

        BigDecimal sGpa = (student.getCumulativeGpa() != null)
                ? student.getCumulativeGpa().multiply(BigDecimal.TEN)
                : BigDecimal.ZERO;

        RecommendationResult result = RecommendationResult.builder()
                .student(student)
                .calculatedAt(LocalDateTime.now())
                .build();
        result = recommendationResultRepository.save(result);

        List<RecommendationItem> items = new ArrayList<>();

        for (NarrowSpecialization ns : publishedNsList) {
            List<TagMap> nsTags = tagMapRepository.findByNarrowSpecId(ns.getId());
            
            // SKILL calculation
            List<TagMap> skillTags = nsTags.stream().filter(t -> "SKILL".equals(t.getSourceType())).toList();
            BigDecimal skillDenom = skillTags.stream().map(TagMap::getWeight).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal skillNum = BigDecimal.ZERO;
            Set<UUID> studentSkillIds = studentSkills.stream().map(s -> s.getSkill().getId()).collect(Collectors.toSet());
            for (TagMap tag : skillTags) {
                if (studentSkillIds.contains(tag.getSourceId())) {
                    skillNum = skillNum.add(tag.getWeight());
                }
            }
            BigDecimal sSkill = BigDecimal.ZERO;
            if (skillDenom.compareTo(BigDecimal.ZERO) > 0) {
                sSkill = skillNum.divide(skillDenom, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
            }

            // INTEREST calculation
            List<TagMap> interestTags = nsTags.stream().filter(t -> "INTEREST".equals(t.getSourceType())).toList();
            BigDecimal intDenom = interestTags.stream().map(TagMap::getWeight).reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal intNum = BigDecimal.ZERO;
            Set<UUID> studentInterestIds = studentInterests.stream().map(s -> s.getInterestOption().getId()).collect(Collectors.toSet());
            for (TagMap tag : interestTags) {
                if (studentInterestIds.contains(tag.getSourceId())) {
                    intNum = intNum.add(tag.getWeight());
                }
            }
            BigDecimal sInt = BigDecimal.ZERO;
            if (intDenom.compareTo(BigDecimal.ZERO) > 0) {
                sInt = intNum.divide(intDenom, 4, RoundingMode.HALF_UP).multiply(new BigDecimal("100"));
            }

            // Config weights
            BigDecimal wGpa = new BigDecimal("0.40");
            BigDecimal wSkill = new BigDecimal("0.35");
            BigDecimal wInt = new BigDecimal("0.25");
            BigDecimal alphaBase = ns.getSpecialization().getAlphaBase() != null ? ns.getSpecialization().getAlphaBase() : new BigDecimal("0.70");

            Optional<NarrowSpecWeightConfig> configOpt = narrowSpecWeightConfigRepository.findByNarrowSpecId(ns.getId());
            if (configOpt.isPresent()) {
                NarrowSpecWeightConfig config = configOpt.get();
                BigDecimal sum = config.getWGpa().add(config.getWSkill()).add(config.getWInt());
                if (sum.compareTo(BigDecimal.ONE) == 0 || sum.subtract(BigDecimal.ONE).abs().compareTo(new BigDecimal("0.01")) < 0) {
                    wGpa = config.getWGpa();
                    wSkill = config.getWSkill();
                    wInt = config.getWInt();
                    alphaBase = config.getAlphaBase();
                } else {
                    log.warn("Weight sum != 1.0 for NS {}. Using defaults.", ns.getCode());
                }
            }

            BigDecimal profileScore = wGpa.multiply(sGpa)
                    .add(wSkill.multiply(sSkill))
                    .add(wInt.multiply(sInt));

            BigDecimal currentTw = ns.getCurrentTw();
            BigDecimal alphaActual;
            boolean fallbackApplied = false;

            if (currentTw == null) {
                alphaActual = BigDecimal.ONE;
                fallbackApplied = true;
            } else {
                List<TrendingWeightProposal> proposals = trendingWeightProposalRepository.findByNarrowSpecIdOrderByVersionDesc(ns.getId());
                TrendingWeightProposal latestAccepted = proposals.stream()
                        .filter(p -> TrendingWeightProposalStatus.ACCEPTED.equals(p.getStatus()))
                        .findFirst().orElse(null);

                if (latestAccepted != null && latestAccepted.isFallback()) {
                    alphaActual = alphaBase.add(BigDecimal.ONE.subtract(alphaBase).multiply(new BigDecimal("0.5")));
                    fallbackApplied = true;
                } else {
                    alphaActual = alphaBase;
                }
            }

            BigDecimal finalScore = alphaActual.multiply(profileScore);
            if (currentTw != null) {
                finalScore = finalScore.add(BigDecimal.ONE.subtract(alphaActual).multiply(currentTw));
            }

            // --- NEW: Generate Gaps & JSON Snapshots ---
            List<SkillGapResponse> skillGaps = new ArrayList<>();
            List<CourseSuggestionResponse> suggestedCourses = new ArrayList<>();
            
            Set<UUID> validCourseIds = new HashSet<>();
            List<NsCourse> nsCourses = nsCourseRepository.findByNarrowSpecId(ns.getId());
            validCourseIds.addAll(nsCourses.stream().map(c -> c.getCourse().getId()).collect(Collectors.toSet()));
            List<SpecCourse> specCourses = specCourseRepository.findBySpecializationId(student.getSpecialization().getId());
            validCourseIds.addAll(specCourses.stream().map(c -> c.getCourse().getId()).collect(Collectors.toSet()));
            
            for (TagMap tag : skillTags) {
                boolean has = studentSkillIds.contains(tag.getSourceId());
                String skillName = skillRepository.findById(tag.getSourceId())
                        .map(Skill::getName)
                        .orElse("Unknown Skill");
                        
                skillGaps.add(SkillGapResponse.builder()
                        .id(tag.getSourceId())
                        .name(skillName)
                        .weight(tag.getWeight())
                        .studentHas(has)
                        .build());
                
                if (!has) {
                    List<CourseSkillMap> mappings = courseSkillMapRepository.findBySkillId(tag.getSourceId());
                    for (CourseSkillMap map : mappings) {
                        Course course = courseRepository.findById(map.getCourseId()).orElse(null);
                        if (course != null && validCourseIds.contains(course.getId())) {
                            boolean alreadyAdded = suggestedCourses.stream().anyMatch(c -> c.getCode().equals(course.getCode()));
                            if (!alreadyAdded) {
                                suggestedCourses.add(CourseSuggestionResponse.builder()
                                        .code(course.getCode())
                                        .name(course.getName())
                                        .credits(course.getCredits())
                                        .supplementsSkill(skillName)
                                        .build());
                            }
                        }
                    }
                }
            }
            
            List<InterestGapResponse> interestGaps = new ArrayList<>();
            for (TagMap tag : interestTags) {
                if (!studentInterestIds.contains(tag.getSourceId())) {
                    String interestLabel = interestOptionRepository.findById(tag.getSourceId())
                            .map(InterestOption::getLabel)
                            .orElse("Unknown Interest");
                            
                    interestGaps.add(InterestGapResponse.builder()
                            .id(tag.getSourceId())
                            .label(interestLabel)
                            .weight(tag.getWeight())
                            .build());
                }
            }
            
            skillGaps.sort((a, b) -> b.getWeight().compareTo(a.getWeight()));
            interestGaps.sort((a, b) -> b.getWeight().compareTo(a.getWeight()));
            
            String skillGapsJson = null;
            String interestGapsJson = null;
            String suggestedCoursesJson = null;
            try {
                skillGapsJson = objectMapper.writeValueAsString(skillGaps);
                interestGapsJson = objectMapper.writeValueAsString(interestGaps);
                suggestedCoursesJson = objectMapper.writeValueAsString(suggestedCourses);
            } catch (Exception e) {
                log.error("Error serializing snapshot JSON", e);
            }
            // --- END NEW ---

            RecommendationItem item = RecommendationItem.builder()
                    .result(result)
                    .narrowSpec(ns)
                    .gpaScore(sGpa)
                    .skillScore(sSkill)
                    .interestScore(sInt)
                    .wGpaSnapshot(wGpa)
                    .wSkillSnapshot(wSkill)
                    .wIntSnapshot(wInt)
                    .profileScore(profileScore)
                    .trendingWeightSnapshot(currentTw)
                    .alphaActual(alphaActual)
                    .finalScore(finalScore)
                    .fallbackApplied(fallbackApplied)
                    .aiExplanation(null)
                    .explanationCached(false)
                    .skillGapsSnapshot(skillGapsJson)
                    .interestGapsSnapshot(interestGapsJson)
                    .suggestedCoursesSnapshot(suggestedCoursesJson)
                    .build();
            items.add(item);
        }

// Làm tròn trước khi sort — tránh 2 NS lệch 0.0001 nhưng UI hiển thị giống nhau
        for (RecommendationItem item : items) {
            item.setFinalScore(item.getFinalScore().setScale(0, RoundingMode.HALF_UP));
            item.setProfileScore(item.getProfileScore().setScale(0, RoundingMode.HALF_UP));
            item.setSkillScore(item.getSkillScore().setScale(0, RoundingMode.HALF_UP));
            item.setInterestScore(item.getInterestScore().setScale(0, RoundingMode.HALF_UP));
        }

// Sắp xếp: 4 tầng, đảm bảo thứ tự hiển thị luôn ổn định
        items.sort(
                Comparator
                        .comparing(RecommendationItem::getFinalScore, Comparator.reverseOrder())
                        .thenComparing(RecommendationItem::getFallbackApplied, Comparator.nullsLast(Comparator.naturalOrder()))     // false trước true
                        .thenComparing(RecommendationItem::getProfileScore, Comparator.reverseOrder())
                        .thenComparing(i -> i.getNarrowSpec().getCode())
        );

// Gán rank ĐỒNG HẠNG: bằng điểm thì cùng rank, rank sau nhảy cóc (1,2,2,4,5)
        int rank = 1;
        int position = 0;
        BigDecimal prevScore = null;
        for (RecommendationItem item : items) {
            position++;
            if (prevScore == null || item.getFinalScore().compareTo(prevScore) != 0) {
                rank = position;
            }
            item.setRank(rank);
            prevScore = item.getFinalScore();
        }

        recommendationItemRepository.saveAll(items);

        // Cleanup older results
        List<RecommendationResult> allResults = recommendationResultRepository.findByStudentIdOrderByCalculatedAtDesc(student.getId());
        if (allResults.size() > 5) {
            List<RecommendationResult> toDelete = allResults.subList(5, allResults.size());
            List<UUID> toDeleteIds = toDelete.stream().map(RecommendationResult::getId).collect(Collectors.toList());
            recommendationItemRepository.deleteByResultIdIn(toDeleteIds);
            recommendationResultRepository.deleteAll(toDelete);
        }

        return mapToResultResponse(result, items);
    }

    @Override
    @Transactional(readOnly = true)
    public RecommendationResultResponse getLatestRecommendation() {
        StudentProfile student = getCurrentStudent();
        RecommendationResult latest = recommendationResultRepository.findFirstByStudentIdOrderByCalculatedAtDesc(student.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chưa có kết quả gợi ý, vui lòng chạy phân tích trước"));

        List<RecommendationItem> items = recommendationItemRepository.findByResultIdOrderByRankAsc(latest.getId());
        return mapToResultResponse(latest, items);
    }

    @Override
    @Transactional(readOnly = true)
    public RecommendationDetailResponse getRecommendationItemDetail(UUID nsId) {
        StudentProfile student = getCurrentStudent();
        RecommendationResult latest = recommendationResultRepository.findFirstByStudentIdOrderByCalculatedAtDesc(student.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chưa có kết quả gợi ý, vui lòng chạy phân tích trước"));

        RecommendationItem item = recommendationItemRepository.findByResultIdAndNarrowSpecId(latest.getId(), nsId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy kết quả phân tích cho chuyên ngành hẹp này"));

        return mapToDetailResponse(item, student);
    }

    @Override
    @Transactional(readOnly = true)
    public List<RecommendationDetailResponse> compareRecommendations(List<UUID> nsIds) {
        // Chi co chan tren (>4), thieu chan duoi. Gui 0 hoac 1 phan tu truoc day
        // van qua duoc: 0 phan tu tra ve danh sach rong (khong phai loi, nhung
        // "so sanh" 0 thu khong co nghia gi), 1 phan tu tra ve mot ket qua don le
        // duoi ten API "compare" — ca hai deu la hanh vi sai duoc chap nhan thanh
        // cong thay vi bi tu choi.
        if (nsIds == null || nsIds.size() < 2 || nsIds.size() > 4) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Phải chọn từ 2 đến 4 chuyên ngành hẹp để so sánh");
        }
        
        StudentProfile student = getCurrentStudent();
        RecommendationResult latest = recommendationResultRepository.findFirstByStudentIdOrderByCalculatedAtDesc(student.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Chưa có kết quả gợi ý, vui lòng chạy phân tích trước"));

        List<RecommendationItem> items = recommendationItemRepository.findByResultIdAndNarrowSpecIdIn(latest.getId(), nsIds);
        
        return items.stream()
                .map(item -> mapToDetailResponse(item, student))
                .collect(Collectors.toList());
    }

    private RecommendationResultResponse mapToResultResponse(RecommendationResult result, List<RecommendationItem> items) {
        List<RecommendationItemResponse> itemResponses = items.stream()
                .map(i -> RecommendationItemResponse.builder()
                        .id(i.getId())
                        .narrowSpecId(i.getNarrowSpec().getId())
                        .narrowSpecCode(i.getNarrowSpec().getCode())
                        .narrowSpecName(i.getNarrowSpec().getName())
                        .finalScore(i.getFinalScore())
                        .rank(i.getRank())
                        .fallbackApplied(i.getFallbackApplied())
                        .build())
                .collect(Collectors.toList());

        return RecommendationResultResponse.builder()
                .id(result.getId())
                .calculatedAt(result.getCalculatedAt())
                .items(itemResponses)
                .build();
    }

    private RecommendationDetailResponse mapToDetailResponse(RecommendationItem item, StudentProfile student) {
        List<SkillGapResponse> skillGaps = new ArrayList<>();
        List<InterestGapResponse> interestGaps = new ArrayList<>();
        List<CourseSuggestionResponse> suggestedCourses = new ArrayList<>();
        try {
            if (item.getSkillGapsSnapshot() != null) {
                skillGaps = objectMapper.readValue(item.getSkillGapsSnapshot(), new com.fasterxml.jackson.core.type.TypeReference<List<SkillGapResponse>>(){});
            }
            if (item.getInterestGapsSnapshot() != null) {
                interestGaps = objectMapper.readValue(item.getInterestGapsSnapshot(), new com.fasterxml.jackson.core.type.TypeReference<List<InterestGapResponse>>(){});
            }
            if (item.getSuggestedCoursesSnapshot() != null) {
                suggestedCourses = objectMapper.readValue(item.getSuggestedCoursesSnapshot(), new com.fasterxml.jackson.core.type.TypeReference<List<CourseSuggestionResponse>>(){});
            }
        } catch (Exception e) {
            log.error("Error deserializing snapshot JSON", e);
        }

        List<TrendingWeightProposal> proposals = trendingWeightProposalRepository.findByNarrowSpecIdOrderByVersionDesc(item.getNarrowSpec().getId());
        TrendingWeightProposal latestProposal = proposals.stream()
                .filter(p -> TrendingWeightProposalStatus.ACCEPTED.equals(p.getStatus()))
                .findFirst()
                .orElse(proposals.isEmpty() ? null : proposals.get(0));

        BigDecimal svol = latestProposal != null ? latestProposal.getSvolNew() : null;
        BigDecimal sacc = latestProposal != null ? latestProposal.getSaccNew() : null;
        BigDecimal juniorRatio = latestProposal != null ? latestProposal.getJuniorRatioNew() : null;

        return RecommendationDetailResponse.builder()
                .id(item.getId())
                .narrowSpecId(item.getNarrowSpec().getId())
                .narrowSpecCode(item.getNarrowSpec().getCode())
                .narrowSpecName(item.getNarrowSpec().getName())
                .gpaScore(item.getGpaScore())
                .skillScore(item.getSkillScore())
                .interestScore(item.getInterestScore())
                .wGpaSnapshot(item.getWGpaSnapshot())
                .wSkillSnapshot(item.getWSkillSnapshot())
                .wIntSnapshot(item.getWIntSnapshot())
                .profileScore(item.getProfileScore())
                .trendingWeightSnapshot(item.getTrendingWeightSnapshot())
                .alphaActual(item.getAlphaActual())
                .svol(svol)
                .sacc(sacc)
                .juniorRatio(juniorRatio)
                .finalScore(item.getFinalScore())
                .rank(item.getRank())
                .fallbackApplied(item.getFallbackApplied())
                .skillGap(skillGaps)
                .interestGap(interestGaps)
                .suggestedCourses(suggestedCourses)
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<RecommendationHistoryResponse> getRecommendationHistory() {
        StudentProfile student = getCurrentStudent();
        List<RecommendationResult> list = recommendationResultRepository.findByStudentIdOrderByCalculatedAtDesc(student.getId());
        return list.stream()
                .map(r -> RecommendationHistoryResponse.builder()
                        .id(r.getId())
                        .calculatedAt(r.getCalculatedAt())
                        .build())
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public RecommendationResultResponse getRecommendationResultById(UUID resultId) {
        StudentProfile student = getCurrentStudent();
        RecommendationResult res = recommendationResultRepository.findById(resultId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy kết quả gợi ý"));

        if (!res.getStudent().getId().equals(student.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền truy cập kết quả này");
        }

        List<RecommendationItem> items = recommendationItemRepository.findByResultIdOrderByRankAsc(res.getId());
        return mapToResultResponse(res, items);
    }

    @Override
    @Transactional(readOnly = true)
    public RecommendationDetailResponse getRecommendationItemDetailByResult(UUID resultId, UUID nsId) {
        StudentProfile student = getCurrentStudent();
        RecommendationResult res = recommendationResultRepository.findById(resultId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy kết quả gợi ý"));

        if (!res.getStudent().getId().equals(student.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Không có quyền truy cập kết quả này");
        }

        RecommendationItem item = recommendationItemRepository.findByResultIdAndNarrowSpecId(res.getId(), nsId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy kết quả phân tích cho chuyên ngành hẹp này"));

        return mapToDetailResponse(item, student);
    }
}

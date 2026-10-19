import { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef, Fragment } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Layout from "../../components/layout/Layout";
import { logout } from "../../services/authService";
import {
    getMajors,
    getSpecializationsByMajor,
    getNarrowSpecsBySpecialization,
    getStandardRoadmap,
    getSpecializationSkills,
    getNarrowSpecDetail
} from "../../services/catalogService";
import { getCourseDetail } from "../../services/courseService";
import { getStudentProfile, getMyGrades } from "../../services/studentService";
import {
    getMyRoadmaps,
    getRoadmapDetail,
    cloneRoadmap,
    renameRoadmap,
    deleteRoadmap,
    syncTranscript,
    updateProgress,
    updateGrade,
    addBookmark,
    removeBookmark,
    updateNote,
    removeNote,
    reorderRoadmapItems,
    batchReorderRoadmapItems,
    uploadPersonalResourceFile,
    addPersonalResourceLink,
    deletePersonalResource
} from "../../services/roadmapService";
import { AlertTriangle, Compass, Sliders } from 'lucide-react';
import { ProfileFlowToast } from "../../components/student/ProfileFlowNav";
import "./StudentRoadmap.css";

/* ---------- bộ icon: toàn bộ dạng solid (fill), cùng viewBox 24 ----------
   Dùng fill="currentColor" nên icon luôn ăn theo màu chữ của phần tử cha. */
const solidIcon = (path, defaultSize) => {
    const Icon = ({ size, ...p }) => (
        <svg viewBox="0 0 24 24" fill="currentColor" width={size || defaultSize} height={size || defaultSize} aria-hidden="true" {...p}>
            {path}
        </svg>
    );
    return Icon;
};

const IconSparkle = solidIcon(<path d="M12 1.8l2 6.2 6.2 2-6.2 2-2 6.2-2-6.2-6.2-2 6.2-2 2-6.2zM19 14.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" />, 14);
const IconSync = solidIcon(<path d="M12 5V2L7.2 6.5 12 11V8a5 5 0 1 1-4.9 6.1H5a7 7 0 1 0 7-9.1z" />, 14);
const IconPencil = solidIcon(<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />, 14);
const IconTrash = solidIcon(<path d="M9.5 2h5a1 1 0 0 1 .9.6L16 4h4v2H4V4h4l.6-1.4A1 1 0 0 1 9.5 2zM5.6 8h12.8l-.9 12.1a2 2 0 0 1-2 1.9H8.5a2 2 0 0 1-2-1.9L5.6 8z" />, 14);
const IconSearch = solidIcon(<path fillRule="evenodd" clipRule="evenodd" d="M10.8 3a7.8 7.8 0 1 0 4.6 14.1l4.3 4.3 1.6-1.6-4.3-4.3A7.8 7.8 0 0 0 10.8 3zm0 2.2a5.6 5.6 0 1 1 0 11.2 5.6 5.6 0 0 1 0-11.2z" />, 15);
const IconGraduation = solidIcon(<path d="M12 2 1 7l11 5 9-4.09V17h2V7L12 2zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />, 20);
const IconFlag = solidIcon(<path d="M5 2v20h2.2v-7.4h10.9l-2.6-3.9 2.6-3.9H7.2V2H5z" />, 19);
const IconNote = solidIcon(<path d="M3 17.3V21h3.7L17.8 9.9 14.1 6.2 3 17.3zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7L20.7 7z" />, 13);
const IconBook = solidIcon(<path d="M6.5 2H20v15.2H6.5A2.5 2.5 0 0 0 4 19.7V4.5A2.5 2.5 0 0 1 6.5 2zM6.5 18.7H20V22H6.5a1.65 1.65 0 0 1 0-3.3z" />, 13);
const IconAlert = solidIcon(<path fillRule="evenodd" clipRule="evenodd" d="M13.3 3.4a1.5 1.5 0 0 0-2.6 0l-9 15.6A1.5 1.5 0 0 0 3 21.2h18a1.5 1.5 0 0 0 1.3-2.2l-9-15.6zM12 8.4c.6 0 1.1.5 1.1 1.1v4.3a1.1 1.1 0 0 1-2.2 0V9.5c0-.6.5-1.1 1.1-1.1zm0 9.4a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z" />, 13);
const IconStar = ({ filled, ...p }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true" data-filled={filled ? 'true' : 'false'} {...p}>
        <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1L12 2z" />
    </svg>
);
const IconInfo = solidIcon(<path fillRule="evenodd" clipRule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1.1 15.2h-2.2v-6.4h2.2v6.4zm0-8.1h-2.2V6.9h2.2v2.2z" />, 14);
const IconMap = solidIcon(<path d="M8.6 2.1 2 5.4v16.5l6.6-3.3V2.1zM10.6 2.1v16.5l2.8 1.4V3.5l-2.8-1.4zM15.4 3.5v16.5L22 16.7V.2l-6.6 3.3z" />, 40);
const IconInbox = solidIcon(<path d="M5.5 3h13a2 2 0 0 1 1.8 1.2L23 11.1V19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-7.9l2.7-6.9A2 2 0 0 1 5.5 3zM4.4 11h4.2l2 3h2.8l2-3h4.2l-1.9-5.2a.6.6 0 0 0-.6-.4H6.9a.6.6 0 0 0-.6.4L4.4 11z" />, 40);
const IconBookOpen = solidIcon(<path d="M2 3.4h5.6A4.4 4.4 0 0 1 12 7.8V21a3.5 3.5 0 0 0-3.1-1.9H2V3.4zM22 3.4h-5.6A4.4 4.4 0 0 0 12 7.8V21a3.5 3.5 0 0 1 3.1-1.9H22V3.4z" />, 40);
const IconChevronUp = solidIcon(<path d="M12 7.6 19.4 16H4.6L12 7.6z" />, 13);
const IconChevronDown = solidIcon(<path d="M12 16.4 4.6 8h14.8L12 16.4z" />, 13);
const IconX = solidIcon(<path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4z" />, 12);
const IconArrowsUpDown = solidIcon(<path d="M8 2.2 3.4 8h2.9v7.4h3.4V8h2.9L8 2.2zM16 21.8l4.6-5.8h-2.9V8.6h-3.4V16h-2.9l4.6 5.8z" />, 14);
const IconCheck = solidIcon(<path d="M9.6 16.3 4.9 11.6 3.4 13l6.2 6.2L20.6 8.2 19.2 6.8 9.6 16.3z" />, 14);
const IconTarget = solidIcon(<path fillRule="evenodd" clipRule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.4a6.6 6.6 0 1 1 0 13.2 6.6 6.6 0 0 1 0-13.2zm0 3.4a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z" />, 13);
const IconPin = solidIcon(<path d="M14.4 2 22 9.6l-1.9 1.9-1.1-.4-3.4 3.4.5 4.3L14.6 20l-4.1-4.1L5 21.4 3.7 20l5.5-5.5L5 10.4l1.2-1.5 4.3.5 3.4-3.4-.4-1.1L14.4 2z" />, 14);
/* Tên lửa — mốc "Bắt đầu" trong bảng hướng dẫn. */
const IconRocket = solidIcon(<path d="M13.2 2c3.9.4 7 3.5 7.4 7.4l-6.1 6.1-4.9-4.9L13.2 2zM8.4 10.9l4.7 4.7-3.3 2.2-3.6-3.6 2.2-3.3zM5.4 16.6l2 2C6.6 20.5 4.8 21.6 2.6 22c.4-2.2 1.5-4 2.8-5.4z" />, 14);
/* Bảng màu — mục giải thích màu thẻ môn. */
const IconPalette = solidIcon(<path fillRule="evenodd" clipRule="evenodd" d="M12 2a10 10 0 0 0 0 20c1.5 0 2.6-1.1 2.6-2.5 0-.7-.3-1.3-.7-1.7-.4-.4-.6-.9-.6-1.4 0-1.1.9-2 2-2h2.3A6.4 6.4 0 0 0 22 10.7C22 5.9 17.6 2 12 2zM6.6 12.6a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4zm3.1-4.4a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4zm4.6 0a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4zm3.4 3.5a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4z" />, 14);
/* Con trỏ bấm — mục "Xem chi tiết". */
const IconCursorClick = solidIcon(<path d="M4 2.6 19.6 9 13 11.6 10.4 18.2 4 2.6zM14.3 13.8l2-2 5 5-2 2-5-5z" />, 14);

const RES_TYPE_COLORS = { LINK: '#034EA2', ARTICLE: '#51B848', DOCS: '#6d28d9', EXERCISE: '#C45A0A', FILE: '#0284C7' };
const resTypeBadge = (type) => {
    const color = RES_TYPE_COLORS[type] || RES_TYPE_COLORS.LINK;
    return { background: color + '18', color, padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' };
};
const RESOURCE_TYPES = ['FILE', 'LINK', 'DOCS', 'ARTICLE', 'EXERCISE'];
const FILE_BASED_RESOURCE_TYPES = new Set(['FILE', 'DOCS']);

const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024 * 1024) return `(${(bytes / 1024).toFixed(1)} KB)`;
    return `(${(bytes / (1024 * 1024)).toFixed(1)} MB)`;
};
const formatShortFileName = (name, maxChars = 5) => {
    if (!name) return '';
    const dotIndex = name.lastIndexOf('.');
    const ext = dotIndex !== -1 ? name.slice(dotIndex) : '';
    const base = dotIndex !== -1 ? name.slice(0, dotIndex) : name;
    if (base.length <= maxChars) return name;
    return `${base.slice(0, maxChars)}...${ext}`;
};
const STATUSES_REQUIRING_PREREQ_CHECK = new Set(['studying', 'done']);
const EMPTY_COURSES = [];

const UNASSIGNED_TERM = 99;

/* ============ Kỳ Block 5 ============
   Giữa hai kỳ chính có một kỳ phụ tên "Block 5" dành riêng cho học vượt / học lại, trừ sau
   kỳ 6. Kỳ này được mã hoá thẳng vào số kỳ theo quy ước BLOCK5_BASE + N = "Block 5 sau kỳ N",
   giống cách 99 đang biểu diễn nhóm "chưa gán kỳ", nên backend không phải đổi schema.
   Ban đầu Block 5 luôn rỗng — sinh viên tự đưa môn vào bằng nút ▲▼. */
const BLOCK5_BASE = 100;
const NO_BLOCK5_AFTER_TERM = 6;

const TERM_CREDIT_LIMIT = 21;      // trần tín chỉ của một kỳ chính
const TERM_COURSE_LIMIT = 7;       // trần số môn của một kỳ chính
const BLOCK5_CREDIT_LIMIT = 6;     // trần tín chỉ của một kỳ Block 5
const BLOCK5_COURSE_LIMIT = 2;     // trần số môn của một kỳ Block 5
const ADVANCED_CREDIT_LIMIT = 6;   // trần tín chỉ được học vượt trong một kỳ
const ADVANCED_COURSE_LIMIT = 2;   // trần số môn được học vượt trong một kỳ

const isBlock5Term = (t) => Number(t) > BLOCK5_BASE;
const block5Host = (t) => Number(t) - BLOCK5_BASE;
/* Vị trí của kỳ trên trục: Block 5 sau kỳ N nằm giữa kỳ N và N+1. */
const termSortKey = (t) => {
    const n = Number(t);
    if (n === UNASSIGNED_TERM) return Number.MAX_SAFE_INTEGER;
    return isBlock5Term(n) ? block5Host(n) + 0.5 : n;
};
const termLabel = (t) => {
    const n = Number(t);
    if (n === UNASSIGNED_TERM) return "Chưa gán kỳ";
    // Nhãn hiển thị trên mốc kỳ phải ngắn để vừa viên tròn; chi tiết "sau Kỳ N" nằm ở tooltip
    return isBlock5Term(n) ? "Block 5" : `Kỳ ${n}`;
};
const termShortLabel = (t) => {
    const n = Number(t);
    if (n === UNASSIGNED_TERM) return "nhóm chưa gán kỳ";
    return isBlock5Term(n) ? `Block 5 sau Kỳ ${block5Host(n)}` : `Kỳ ${n}`;
};
const termCreditLimit = (t) => (isBlock5Term(t) ? BLOCK5_CREDIT_LIMIT : TERM_CREDIT_LIMIT);
const termCourseLimit = (t) => (isBlock5Term(t) ? BLOCK5_COURSE_LIMIT : TERM_COURSE_LIMIT);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_MAX_LENGTH = 500;

const SKILL_TAG_H = 28;
const SKILL_GAP = 8;
const CURVE_W = 34;

function hasGrade(course) {
    return course?.grade !== null && course?.grade !== undefined && String(course.grade).trim() !== "";
}

function evaluatePrerequisiteGroups(course, statusByCode) {
    const groups = course?.prerequisiteGroupCodes;
    if (!groups || groups.length === 0) return { satisfied: true, missingCodes: [] };

    const missingGroups = [];
    for (const group of groups) {
        const satisfied = group.some((code) => statusByCode[code] === 'done');
        if (!satisfied) {
            missingGroups.push(`(${group.join(" HOẶC ")})`);
        }
    }

    if (missingGroups.length > 0) {
        return { satisfied: false, missingCodes: [missingGroups.join(" VÀ ")] };
    }
    return { satisfied: true, missingCodes: [] };
}

/* ---------- bản sao thu nhỏ của các thành phần thật trên trang ----------
   Dùng trong khung hướng dẫn: người dùng nhìn thấy đúng hình dạng nút / thẻ môn
   mà họ phải bấm, thay vì chỉ đọc chữ mô tả. Giữ nguyên màu, bo góc và bóng đổ
   của bản thật để nhận ra ngay. */
function MiniPersonalizeBtn() {
    return <span className="sr-mini-btn sr-mini-btn--primary"><IconSparkle size={11} /> Cá nhân hóa</span>;
}

function MiniFloatingBtn({ icon, label }) {
    return <span className="sr-mini-btn">{icon} {label}</span>;
}

function MiniCourseTag() {
    return (
        <span className="sr-mini-tag">
            <span className="sr-mini-tag-code">SE1701</span>
            <span className="sr-mini-tag-credits">3 TC</span>
        </span>
    );
}

function CourseDescriptionText({ text }) {
    const [expanded, setExpanded] = useState(false);
    if (!text) return null;
    const maxLength = 200;
    if (text.length <= maxLength) return <span style={{ whiteSpace: 'pre-line' }}>{text}</span>;
    return (
        <div style={{ whiteSpace: 'pre-line' }}>
            {expanded ? text : `${text.substring(0, maxLength)}...`}
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                style={{ background: 'none', border: 'none', color: '#034EA2', cursor: 'pointer', padding: 0, marginLeft: '8px', fontSize: '13px', fontWeight: '500', display: 'inline' }}
            >
                {expanded ? 'Thu gọn' : 'Xem thêm'}
            </button>
        </div>
    );
}

function MiniReorderPair() {
    return (
        <span className="sr-mini-reorder">
            <span className="sr-mini-updown sr-mini-updown--up"><IconChevronUp size={9} /></span>
            <span className="sr-mini-updown sr-mini-updown--down"><IconChevronDown size={9} /></span>
        </span>
    );
}

function SkillFan({ skills, side, isDone }) {
    const n = skills.length;
    const fanHeight = n * SKILL_TAG_H + (n - 1) * SKILL_GAP;
    const midY = fanHeight / 2;
    const strokeColor = isDone ? "#16A34A" : "#7C3AED";
    return (
        <div className={`sr-skill-fan sr-skill-fan--${side}`}>
            <svg width={CURVE_W} height={fanHeight} viewBox={`0 0 ${CURVE_W} ${fanHeight}`} style={{ flexShrink: 0, overflow: "visible" }}>
                {skills.map((_, i) => {
                    const ty = i * (SKILL_TAG_H + SKILL_GAP) + SKILL_TAG_H / 2;
                    const d = side === "right"
                        ? `M 0 ${midY} C ${CURVE_W * 0.55} ${midY}, ${CURVE_W * 0.55} ${ty}, ${CURVE_W} ${ty}`
                        : `M ${CURVE_W} ${midY} C ${CURVE_W * 0.45} ${midY}, ${CURVE_W * 0.45} ${ty}, 0 ${ty}`;
                    return <path key={i} className="sr-fan-path" d={d} fill="none" stroke={strokeColor} strokeWidth="3" strokeDasharray="2 6" strokeLinecap="round" />;
                })}
            </svg>
            <div className="sr-skill-tags-col">
                {skills.map((sk, i) => (
                    <div className={`sr-skill-tag${isDone ? " sr-skill-tag--done" : ""}`} style={{ height: SKILL_TAG_H }} title={sk} key={i}>{sk}</div>
                ))}
            </div>
        </div>
    );
}

/**
 * Dropdown thay cho <select> gốc — <select> không cho phép cắt bớt chữ trong danh sách
 * option cũng như hiện tooltip khi rê chuột.
 *
 * Nhãn đang chọn và từng dòng trong danh sách đều cắt bằng dấu "…" khi quá dài;
 * rê chuột vào một dòng thì dòng đó bung ra hiển thị đầy đủ (xuống dòng).
 */
function FilterSelect({ value, onChange, options, placeholder, disabled, className = "", widthClass = "" }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    const selectedOption = options.find((o) => String(o.value) === String(value));
    const label = selectedOption ? selectedOption.label : placeholder;

    /* Suy ra từ state thay vì đóng menu bằng effect: nếu dropdown bị vô hiệu hóa
       (VD: bật chế độ sắp xếp) thì coi như đang đóng. */
    const isOpen = open && !disabled;

    useEffect(() => {
        if (!isOpen) return undefined;
        const onPointerDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const onKeyDown = (e) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKeyDown);
        };
    }, [isOpen]);

    const pick = (val) => { setOpen(false); onChange(val); };

    return (
        <div className={`sr-select ${widthClass} ${className}`} ref={rootRef}>
            <button
                type="button"
                className={`sr-select-trigger${isOpen ? " sr-select-trigger--open" : ""}`}
                disabled={disabled}
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                title={label}
            >
                <span className="sr-select-label">{label}</span>
                <IconChevronDown className="sr-select-caret" />
            </button>

            {isOpen && (
                <ul className="sr-select-menu" role="listbox">
                    <li>
                        <button
                            type="button"
                            className={`sr-select-option${!selectedOption ? " sr-select-option--active" : ""}`}
                            onClick={() => pick("")}
                            title={placeholder}
                        >
                            <span className="sr-select-option-text">{placeholder}</span>
                        </button>
                    </li>
                    {options.map((o) => (
                        <li key={o.value}>
                            <button
                                type="button"
                                role="option"
                                aria-selected={String(o.value) === String(value)}
                                className={`sr-select-option${String(o.value) === String(value) ? " sr-select-option--active" : ""}`}
                                onClick={() => pick(o.value)}
                                title={o.label}
                            >
                                <span className="sr-select-option-text">{o.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default function StudentRoadmap() {
    const navigate = useNavigate();
    const { specId, nsId } = useParams();
    const [searchParams] = useSearchParams();
    const roadmapIdParam = searchParams.get("roadmapId");
    const targetCourseCode = searchParams.get("courseCode") || searchParams.get("code");

    const username = localStorage.getItem("username") || "Sinh viên";
    const handleLogout = async () => { await logout(); navigate("/login"); };

    const [mode, setMode] = useState(roadmapIdParam ? "personal" : "original");

    const [majors, setMajors] = useState([]);
    const [specializations, setSpecializations] = useState([]);
    const [narrowSpecs, setNarrowSpecs] = useState([]);
    const [selectedMajor, setSelectedMajor] = useState("");
    const [selectedSpec, setSelectedSpec] = useState("");
    const [selectedNs, setSelectedNs] = useState("");
    const [specSkills, setSpecSkills] = useState([]);

    const [myRoadmaps, setMyRoadmaps] = useState([]);
    const [activeRoadmapId, setActiveRoadmapId] = useState("");
    const [personalizing, setPersonalizing] = useState(false);

    const [originalCourses, setOriginalCourses] = useState([]);
    const [personalRoadmap, setPersonalRoadmap] = useState(null);
    const [loadingRoadmap, setLoadingRoadmap] = useState(false);

    const [selectedCode, setSelectedCode] = useState(null);
    const [selectedCourseDetail, setSelectedCourseDetail] = useState(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [offscreen, setOffscreen] = useState({ up: false, down: false });
    const [trackHeight, setTrackHeight] = useState(0);
    const [trunkStart, setTrunkStart] = useState(0);
    const [finishTop, setFinishTop] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    /* Hướng dẫn dùng CHUNG ngăn trượt với chi tiết môn: mở mặc định, tắt/bật
       bằng nút "Hướng dẫn" trên toolbar. */
    const [showGuide, setShowGuide] = useState(true);
    /* Liên kết 2 chiều giữa thẻ hướng dẫn và nút thật trên trang:
         guideHint — đang rê chuột trên THẺ HƯỚNG DẪN ➔ làm sáng nút thật tương ứng
         uiHint    — đang rê chuột trên NÚT THẬT      ➔ làm sáng thẻ hướng dẫn tương ứng
       Tách 2 biến để khi rê 1 thẻ môn thì chỉ thẻ hướng dẫn sáng, chứ không làm
       sáng ngược lại toàn bộ thẻ môn khác trên trục. */
    const [guideHint, setGuideHint] = useState(null);
    const [uiHint, setUiHint] = useState(null);

    const [customResources, setCustomResources] = useState([]);
    const [submittingResource, setSubmittingResource] = useState(false);
    const [notesText, setNotesText] = useState("");
    const [newResource, setNewResource] = useState({ title: '', url: '', resourceType: '', file: null });

    /* Kích thước chiều rộng ngăn chi tiết môn học (kéo thả như IDE panel) */
    const [detailPanelWidth, setDetailPanelWidth] = useState(() => {
        try {
            const saved = localStorage.getItem('sr_detail_panel_width');
            return saved ? Math.max(340, Math.min(window.innerWidth * 0.85, parseInt(saved, 10))) : 460;
        } catch (_) {
            return 460;
        }
    });
    const [isResizingDetail, setIsResizingDetail] = useState(false);

    const handleResizeMouseDown = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizingDetail(true);
        const startX = e.clientX;
        const startWidth = detailPanelWidth;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const handleMouseMove = (moveEvent) => {
            const delta = startX - moveEvent.clientX;
            const minW = 340;
            const maxW = Math.min(window.innerWidth * 0.85, 1000);
            const newWidth = Math.max(minW, Math.min(maxW, startWidth + delta));
            setDetailPanelWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizingDetail(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            setDetailPanelWidth((curr) => {
                try { localStorage.setItem('sr_detail_panel_width', String(curr)); } catch (_) { }
                return curr;
            });
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [detailPanelWidth]);

    const [isReordering, setIsReordering] = useState(false);
    /* Hướng nút ▲/▼ đang được rê chuột — dùng để làm nổi đúng thẻ hướng dẫn tương ứng
       ở panel bên phải, giúp người dùng biết nút đó làm gì mà không cần đọc hết. */
    const [hoveredMoveDir, setHoveredMoveDir] = useState(null);
    const [savingReorder, setSavingReorder] = useState(false);
    const [cancelingReorder, setCancelingReorder] = useState(false);
    const reorderOriginalTermByIdRef = useRef({});
    const isSyncingRef = useRef(false);

    const [studentCurrentTerm, setStudentCurrentTerm] = useState(null);
    const [showRiskModal, setShowRiskModal] = useState(false);
    const [pendingAdvancedMove, setPendingAdvancedMove] = useState(null);
    const [riskAcknowledged, setRiskAcknowledged] = useState(false);
    const [submittingAdvanced, setSubmittingAdvanced] = useState(false);

    const [toast, setToast] = useState(null);
    const [showRulesModal, setShowRulesModal] = useState(false);
    // Tham số URL sai / CNH đã gỡ công bố — trước đây cả 2 đều im lặng (DEF_134/DEF_136/DEF_143)
    const [urlParamError, setUrlParamError] = useState("");
    const [courseDeleted, setCourseDeleted] = useState(false);
    const [unpublishedNsName, setUnpublishedNsName] = useState("");
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [renameInputVal, setRenameInputVal] = useState("");
    const [savingRename, setSavingRename] = useState(false);
    const [showToolbar, setShowToolbar] = useState(true);
    const [zoomLevel, setZoomLevel] = useState(1);

    const [gradeInputVal, setGradeInputVal] = useState("");
    const [savingGrade, setSavingGrade] = useState(false);

    const showToast = useCallback((message, type = "info") => {
        setToast({ message, type });
        setTimeout(() => {
            setToast((current) => (current && current.message === message ? null : current));
        }, 4500);
    }, []);

    const scrollerRef = useRef(null);
    const axisInnerRef = useRef(null);
    const nodeRefs = useRef({});
    const rowRefs = useRef({});
    const termRowRefs = useRef({});
    const firstTermRowRef = useRef(null);

    /* ============ load danh mục ngành + danh sách lộ trình cá nhân ============ */
    useEffect(() => {
        getMajors().then((data) => setMajors(data.filter((m) => m.isActive))).catch((e) => console.error(e));
        refreshMyRoadmaps();
        getStudentProfile()
            .then((p) => { if (p?.currentTerm) setStudentCurrentTerm(p.currentTerm); })
            .catch((e) => console.error("Failed to fetch student profile current term:", e));
    }, []);

    const refreshMyRoadmaps = useCallback(async () => {
        try {
            const list = await getMyRoadmaps();
            setMyRoadmaps(list || []);
            return list || [];
        } catch (e) {
            console.error("Failed to load my roadmaps:", e);
            return [];
        }
    }, []);

    const syncFiltersToNs = useCallback(async (targetNsId) => {
        if (!targetNsId || majors.length === 0) return;
        isSyncingRef.current = true;
        try {
            let targetSpecId = null;
            let nsName = "";
            try {
                const nsDetail = await getNarrowSpecDetail(targetNsId);
                targetSpecId = nsDetail?.specializationId;
                nsName = nsDetail?.name || "";
            } catch (e) {
                console.error("Failed to resolve spec for ns:", e);
                // nsId đúng định dạng nhưng không tồn tại -> nói rõ thay vì im lặng (DEF_134)
                setUrlParamError("Chuyên ngành hẹp trong đường dẫn không tồn tại hoặc đã bị xoá.");
            }
            if (!targetSpecId) return;

            for (const major of majors) {
                try {
                    const specs = await getSpecializationsByMajor(major.id);
                    const matchedSpec = specs.find((s) => s.id === targetSpecId);
                    if (matchedSpec) {
                        const activeSpecs = specs.filter((s) => s.isActive);
                        const nsList = await getNarrowSpecsBySpecialization(targetSpecId);
                        const publishedNs = nsList.filter((n) => n.isPublished);

                        setSelectedMajor(major.id);
                        setSpecializations(activeSpecs);
                        setSelectedSpec(targetSpecId);
                        setNarrowSpecs(publishedNs);
                        if (publishedNs.some((n) => n.id === targetNsId)) {
                            setSelectedNs(targetNsId);
                            setUnpublishedNsName("");
                        } else {
                            // BR-25: CNH đã gỡ công bố -> phải giải thích vì sao bộ lọc/trục trống (DEF_136/DEF_143)
                            setUnpublishedNsName(nsName || "Chuyên ngành hẹp này");
                        }
                        return;
                    }
                } catch (e) { console.error("Failed to sync filters to ns:", e); }
            }
        } finally {
            setTimeout(() => {
                isSyncingRef.current = false;
            }, 150);
        }
    }, [majors]);

    /* ============ resolve lựa chọn ban đầu từ URL hoặc Profile ============ */
    useEffect(() => {
        if (majors.length === 0) return;
        let cancelled = false;

        const resolve = async () => {
            let targetSpecId = specId;
            let targetNsId = nsId;
            setUrlParamError("");

            // UUID sai định dạng thì chặn ngay, không âm thầm rơi vào trạng thái rỗng (DEF_134)
            if (targetNsId && !UUID_PATTERN.test(targetNsId)) {
                setUrlParamError("Mã chuyên ngành hẹp trong đường dẫn không hợp lệ. Hãy chọn lại từ bộ lọc phía trên.");
                return;
            }
            if (targetSpecId && targetSpecId !== "select" && !UUID_PATTERN.test(targetSpecId)) {
                setUrlParamError("Mã chuyên ngành trong đường dẫn không hợp lệ. Hãy chọn lại từ bộ lọc phía trên.");
                return;
            }

            // 1. Nếu có roadmapId param trên URL (Lộ trình cá nhân cụ thể)
            if (roadmapIdParam) {
                try {
                    const detail = await getRoadmapDetail(roadmapIdParam);
                    if (!cancelled && detail) {
                        targetNsId = detail.narrowSpecId;
                        setActiveRoadmapId(detail.id);
                        setMode("personal");
                        if (targetNsId) await syncFiltersToNs(targetNsId);
                        return;
                    }
                } catch (err) {
                    console.error("Failed to fetch roadmap detail for URL resolve:", err);
                    // Lộ trình cá nhân đã bị xoá -> giải thích trước khi rơi về mode Gốc (DEF_140)
                    if (!cancelled) {
                        setUrlParamError(
                            err.response?.status === 404
                                ? "Lộ trình cá nhân này đã bị xoá. Màn hình đã chuyển về chế độ Khung chương trình gốc."
                                : "Không mở được lộ trình cá nhân này. Màn hình đã chuyển về chế độ Khung chương trình gốc."
                        );
                    }
                }
            }

            // 2. Nếu có nsId trên URL
            if (targetNsId) {
                if (!targetSpecId || targetSpecId === "select") {
                    try {
                        const nsDetail = await getNarrowSpecDetail(targetNsId);
                        if (!cancelled && nsDetail?.specializationId) targetSpecId = nsDetail.specializationId;
                    } catch (err) {
                        console.error("Failed reverse lookup ns->spec:", err);
                    }
                }
                setMode("original");
                setActiveRoadmapId("");
                if (targetNsId) await syncFiltersToNs(targetNsId);
                return;
            }

            // 3. Nếu có specId trên URL
            if (targetSpecId && targetSpecId !== "select") {
                setMode("original");
                setActiveRoadmapId("");
                for (const major of majors) {
                    try {
                        const specs = await getSpecializationsByMajor(major.id);
                        if (cancelled) return;
                        const matchedSpec = specs.find((s) => s.id === targetSpecId);
                        if (matchedSpec) {
                            setSelectedMajor(major.id);
                            setSpecializations(specs.filter((s) => s.isActive));
                            setSelectedSpec(targetSpecId);
                            const nsList = await getNarrowSpecsBySpecialization(targetSpecId);
                            setNarrowSpecs(nsList.filter((n) => n.isPublished));
                            setSelectedNs("");
                            return;
                        }
                    } catch (e) { console.error(e); }
                }
                // Quét hết mà không khớp Major nào -> báo lỗi tham số thay vì im lặng (DEF_134)
                if (!cancelled) {
                    setUrlParamError("Không tìm thấy chuyên ngành khớp với đường dẫn. Hãy chọn lại từ bộ lọc phía trên.");
                }
                return;
            }

            // 4. Mặc định vào trang /student/roadmap (không param URL): tự động kiểm tra Hồ sơ sinh viên
            try {
                const profile = await getStudentProfile();
                if (cancelled) return;

                const userNarrowSpecId = profile?.currentNarrowSpecId || profile?.narrowSpecId;
                if (userNarrowSpecId) {
                    setMode("original");
                    setActiveRoadmapId("");
                    await syncFiltersToNs(userNarrowSpecId);
                } else if (profile?.specializationId) {
                    setMode("original");
                    setActiveRoadmapId("");
                    for (const major of majors) {
                        const specs = await getSpecializationsByMajor(major.id);
                        if (cancelled) return;
                        const matchedSpec = specs.find((s) => s.id === profile.specializationId);
                        if (matchedSpec) {
                            setSelectedMajor(major.id);
                            setSpecializations(specs.filter((s) => s.isActive));
                            setSelectedSpec(profile.specializationId);
                            const nsList = await getNarrowSpecsBySpecialization(profile.specializationId);
                            setNarrowSpecs(nsList.filter((n) => n.isPublished));
                            setSelectedNs("");
                            return;
                        }
                    }
                } else {
                    // Chưa khai báo chuyên ngành/CNH: để trống bộ lọc
                    setSelectedMajor("");
                    setSelectedSpec("");
                    setSpecializations([]);
                    setSelectedNs("");
                    setNarrowSpecs([]);
                    setActiveRoadmapId("");
                    setMode("original");
                }
            } catch (err) {
                console.error("Failed to load profile for initial roadmap filtering:", err);
            }
        };

        resolve();
        return () => { cancelled = true; };
    }, [specId, nsId, roadmapIdParam, majors, syncFiltersToNs]);

    /* ============ cascade filter thủ công ============ */
    useEffect(() => {
        if (!selectedMajor || isSyncingRef.current) return;
        let alive = true;
        getSpecializationsByMajor(selectedMajor).then((data) => {
            if (!alive || isSyncingRef.current) return;
            const active = data.filter((s) => s.isActive);
            setSpecializations(active);
            if (!(selectedSpec && active.some((s) => s.id === selectedSpec))) {
                setSelectedSpec("");
                setNarrowSpecs([]);
                setSelectedNs("");
            }
        }).catch((e) => console.error(e));
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMajor]);

    useEffect(() => {
        if (!selectedSpec) { setSpecSkills([]); return; }
        getSpecializationSkills(selectedSpec).then((d) => setSpecSkills(d || [])).catch((e) => console.error("Failed to fetch spec skills:", e));
        if (isSyncingRef.current) return;
        let alive = true;
        getNarrowSpecsBySpecialization(selectedSpec).then((data) => {
            if (!alive || isSyncingRef.current) return;
            const published = data.filter((n) => n.isPublished);
            setNarrowSpecs(published);
            if (!(selectedNs && published.some((n) => n.id === selectedNs))) {
                setSelectedNs("");
            }
        }).catch((e) => console.error(e));
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSpec]);

    const matchedPersonalRoadmap = useMemo(() => {
        if (!selectedNs) return null;
        return myRoadmaps.find((r) => (r.narrowSpecId || r.nsId) === selectedNs) || null;
    }, [myRoadmaps, selectedNs]);

    useEffect(() => {
        if (mode === "personal" && !activeRoadmapId && !matchedPersonalRoadmap) {
            setMode("original");
        }
    }, [selectedNs, matchedPersonalRoadmap, mode, activeRoadmapId]);

    /* ============ load dữ liệu môn học theo mode ============ */
    useEffect(() => {
        if (mode !== "original" || !selectedNs) { setOriginalCourses([]); return; }
        let alive = true;
        (async () => {
            try {
                setLoadingRoadmap(true);
                const roadmapData = await getStandardRoadmap(selectedNs);
                const courseIdToCode = {};
                (roadmapData.terms || []).forEach((tg) => (tg.courses || []).forEach((c) => { courseIdToCode[c.courseId] = c.code; }));
                const combined = [];
                (roadmapData.terms || []).forEach((tg) => {
                    (tg.courses || []).forEach((c) => {
                        const prerequisiteCodes = (c.prerequisiteGroups || []).flat().map((id) => courseIdToCode[id]).filter(Boolean);
                        combined.push({
                            id: c.courseId, code: c.code, name: c.name,
                            credits: c.credits ?? 3,
                            // Môn chưa gán kỳ phải gom vào nhóm cuối trục, không bị nuốt mất (DEF_131)
                            term: tg.termOrder ?? UNASSIGNED_TERM,
                            description: c.description || "Chưa có mô tả môn học.",
                            // DTO có countsTowardGpa nhưng nhánh Gốc trước đây không map -> nhãn
                            // "Không tính GPA" không bao giờ hiện ở mode Gốc (DEF_130)
                            countsTowardGpa: c.countsTowardGpa,
                            courseType: c.courseType,
                            prerequisiteCodes, prerequisiteGroupCodes: [],
                            status: null, bookmarked: false, notes: "",
                            isRemovedFromStandard: false,
                        });
                    });
                });
                if (alive) setOriginalCourses(combined);
            } catch (e) {
                console.error("Failed to load curriculum:", e);
                if (alive) setOriginalCourses([]);
            } finally {
                if (alive) setLoadingRoadmap(false);
            }
        })();
        return () => { alive = false; };
    }, [mode, selectedNs]);

    const loadPersonal = useCallback(async (roadmapId) => {
        if (!roadmapId) { setPersonalRoadmap(null); return; }
        try {
            setLoadingRoadmap(true);
            const [detail, myGradesList] = await Promise.all([
                getRoadmapDetail(roadmapId),
                getMyGrades().catch(() => [])
            ]);

            const gradeMap = {};
            (myGradesList || []).forEach((g) => {
                const keyCode = (g.courseCode || g.courseCodeRaw || '').toLowerCase();
                const keyId = g.courseId ? String(g.courseId).toLowerCase() : null;
                if (keyCode) gradeMap[keyCode] = g;
                if (keyId) gradeMap[keyId] = g;
            });

            const courseIdToCode = {};
            (detail.terms || []).forEach((g) => (g.courses || []).forEach((item) => { courseIdToCode[item.courseId] = item.code; }));
            const flat = [];
            (detail.terms || []).forEach((tg) => {
                (tg.courses || []).forEach((c) => {
                    let status = "todo";
                    if (c.progressStatus === "IN_PROGRESS") status = "studying";
                    else if (c.progressStatus === "COMPLETED") status = "done";
                    const prerequisiteCodes = (c.prerequisiteGroups || []).flat().map((id) => courseIdToCode[id]).filter(Boolean);
                    const prerequisiteGroupCodes = (c.prerequisiteGroups || [])
                        .map((group) => group.map((id) => courseIdToCode[id]).filter(Boolean))
                        .filter((g) => g.length > 0);

                    const matchedGrade = gradeMap[String(c.courseId).toLowerCase()] || gradeMap[String(c.code).toLowerCase()];
                    const initGrade = c.grade !== undefined && c.grade !== null
                        ? c.grade
                        : (matchedGrade?.grade !== undefined && matchedGrade?.grade !== null ? matchedGrade.grade : null);
                    const countsGpa = c.countsTowardGpa !== undefined && c.countsTowardGpa !== null
                        ? c.countsTowardGpa
                        : (c.countTowardGpa !== undefined && c.countTowardGpa !== null
                            ? c.countTowardGpa
                            : (matchedGrade?.countsTowardGpa !== undefined ? matchedGrade.countsTowardGpa : true));

                    flat.push({
                        id: c.courseId, code: c.code, name: c.name, credits: c.credits, term: tg.termOrder,
                        description: c.description || "Chưa có mô tả môn học.",
                        status, bookmarked: !!c.bookmarked, notes: c.note || "",
                        prerequisiteCodes, prerequisiteGroupCodes,
                        isRemovedFromStandard: !!c.isRemovedFromStandard,
                        originalTermNo: c.originalTermNo || tg.termOrder,
                        personalTermNo: c.personalTermNo || tg.termOrder,
                        isAdvancedRegistration: !!c.isAdvancedRegistration,
                        countsTowardGpa: countsGpa !== false,
                        countTowardGpa: countsGpa !== false,
                        grade: initGrade,
                        resources: c.resources || [],
                    });
                });
            });
            setPersonalRoadmap({ id: detail.id, name: detail.name, nsId: detail.narrowSpecId, nsName: detail.narrowSpecName, courses: flat });
            if (detail.narrowSpecId) {
                syncFiltersToNs(detail.narrowSpecId);
            }

            let specIdForSkills = detail.specializationId;
            if (!specIdForSkills && detail.narrowSpecId) {
                try {
                    const nsDetail = await getNarrowSpecDetail(detail.narrowSpecId);
                    specIdForSkills = nsDetail?.specializationId;
                } catch (e) { console.error(e); }
            }
            if (!specIdForSkills) {
                try {
                    const profile = await getStudentProfile();
                    specIdForSkills = profile?.specializationId;
                } catch (e) { console.error(e); }
            }
            if (specIdForSkills) {
                try {
                    const skillsData = await getSpecializationSkills(specIdForSkills);
                    setSpecSkills(skillsData || []);
                } catch (e) { console.error(e); }
            }
        } catch (e) {
            console.error("Failed to load roadmap detail:", e);
            setPersonalRoadmap(null);
        } finally {
            setLoadingRoadmap(false);
        }
    }, [syncFiltersToNs]);

    useEffect(() => {
        if (mode === "personal") loadPersonal(activeRoadmapId);
    }, [mode, activeRoadmapId, loadPersonal]);

    useEffect(() => {
        rowRefs.current = {};
        nodeRefs.current = {};
        termRowRefs.current = {};
        firstTermRowRef.current = null;
        setTrunkStart(0);
        setFinishTop(0);
    }, [mode]);

    useEffect(() => {
        if (mode === "personal" && !activeRoadmapId && matchedPersonalRoadmap) {
            setActiveRoadmapId(matchedPersonalRoadmap.id);
        }
    }, [mode, activeRoadmapId, matchedPersonalRoadmap]);

    useEffect(() => {
        const courses = mode === "personal" ? personalRoadmap?.courses : originalCourses;
        if (targetCourseCode && courses && courses.length > 0) {
            const found = courses.find((c) => c.code.toLowerCase() === targetCourseCode.toLowerCase());
            if (found) {
                setSelectedCode(found.code);
                setTimeout(() => {
                    nodeRefs.current[found.code]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
                }, 300);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetCourseCode, personalRoadmap, originalCourses, mode]);

    /* ============ dựng dữ liệu trục dọc: dùng CHUNG cho cả 2 mode ============ */
    const activeCourses = useMemo(() => {
        const src = mode === "personal" ? (personalRoadmap?.courses || EMPTY_COURSES) : originalCourses;
        return src;
    }, [mode, personalRoadmap, originalCourses]);

    const codeSet = useMemo(() => new Set(activeCourses.map((c) => c.code)), [activeCourses]);
    /* Danh sách kỳ trên trục. Riêng lộ trình cá nhân luôn chèn thêm một hàng Block 5 rỗng
       giữa hai kỳ chính liền nhau (trừ sau kỳ 6) để sinh viên có chỗ đưa môn vào. */
    const TERMS = useMemo(() => {
        // Ép về số và loại giá trị rác: chỉ cần một phần tử NaN là comparator trả NaN và
        // thứ tự cả trục thành không xác định.
        const fromCourses = Array.from(new Set(
            activeCourses.map((c) => Number(c.term)).filter((t) => Number.isFinite(t))
        ));
        const all = new Set(fromCourses);
        if (mode === "personal" && fromCourses.length > 0) {
            const mainTerms = fromCourses.filter((t) => t !== UNASSIGNED_TERM && !isBlock5Term(t));
            const lastMainTerm = mainTerms.length > 0 ? Math.max(...mainTerms) : 0;
            for (let t = 1; t <= lastMainTerm; t += 1) {
                // Giữ ĐỦ dãy kỳ 1..N kể cả khi một kỳ tạm thời không còn môn nào. Nếu chỉ lấy kỳ
                // từ danh sách môn thì dời nốt môn cuối của một kỳ đi sẽ làm kỳ đó biến mất khỏi
                // trục, nhìn như lộ trình nhảy cóc và cũng không còn chỗ để dời môn trở lại.
                all.add(t);
                // "Giữa các kỳ" nên chỉ chèn Block 5 khi còn kỳ chính phía sau
                if (t !== NO_BLOCK5_AFTER_TERM && t < lastMainTerm) {
                    all.add(BLOCK5_BASE + t);
                }
            }
        }
        return Array.from(all).sort((a, b) => termSortKey(a) - termSortKey(b));
    }, [activeCourses, mode]);
    // Kỳ 99 ("chưa gán kỳ") phải nằm trong phạm vi dời để nút ▲▼ đưa được môn vào đó (DEF_145).
    // Luôn bổ sung UNASSIGNED_TERM ở cuối kể cả khi hiện chưa có môn nào ở nhóm này.
    const movableTerms = useMemo(() => {
        const real = TERMS.filter((t) => t !== UNASSIGNED_TERM);
        return real.length > 0 ? [...real, UNASSIGNED_TERM] : real;
    }, [TERMS]);

    const COURSES = useMemo(() => activeCourses.map((c) => ({
        ...c,
        prereq: (c.prerequisiteCodes || []).filter((p) => codeSet.has(p)),
        prereqGroups: (c.prerequisiteGroupCodes || []).map(g => g.filter(p => codeSet.has(p))).filter(g => g.length > 0),
    })), [activeCourses, codeSet]);

    const COURSE_MAP = useMemo(() => {
        const map = {};
        COURSES.forEach((c) => { map[c.code] = c; });
        return map;
    }, [COURSES]);

    const selected = selectedCode ? COURSE_MAP[selectedCode] : null;

    const statusByCode = useMemo(() => {
        const map = {};
        COURSES.forEach((c) => { map[c.code] = c.status; });
        return map;
    }, [COURSES]);

    const gpaStats = useMemo(() => {
        if (mode !== "personal" || !personalRoadmap || !personalRoadmap.courses) {
            return { gpa: null, totalCredits: 0, totalCourses: 0 };
        }
        let totalPoints = 0;
        let totalCredits = 0;
        let totalCourses = 0;

        personalRoadmap.courses.forEach((c) => {
            const isDone = c.status === "done";
            const countsGpa = c.countsTowardGpa !== false && c.countTowardGpa !== false;
            const gradeVal = c.grade !== null && c.grade !== undefined && String(c.grade).trim() !== "" ? parseFloat(c.grade) : null;

            if (isDone && countsGpa && gradeVal !== null && !isNaN(gradeVal) && gradeVal >= 0 && gradeVal <= 10) {
                const cr = c.credits ?? 3;
                totalPoints += gradeVal * cr;
                totalCredits += cr;
                totalCourses += 1;
            }
        });

        if (totalCredits === 0) return { gpa: null, totalCredits: 0, totalCourses: 0 };
        const gpa = (totalPoints / totalCredits).toFixed(3);
        return { gpa, totalCredits, totalCourses };
    }, [mode, personalRoadmap]);

    useEffect(() => {
        if (selected) {
            setGradeInputVal(selected.grade !== null && selected.grade !== undefined ? String(selected.grade) : "");
        } else {
            setGradeInputVal("");
        }
    }, [selectedCode, selected?.grade]);

    const handleSaveGrade = async () => {
        if (!selected || !selectedCode || mode !== "personal" || !activeRoadmapId) return;

        const rawVal = gradeInputVal.trim();
        let num = rawVal === '' ? null : parseFloat(rawVal);
        if (num !== null && (isNaN(num) || num < 0 || num > 10)) {
            showToast("Điểm số phải nằm trong khoảng từ 0 đến 10", "error");
            return;
        }

        try {
            setSavingGrade(true);
            await updateGrade(activeRoadmapId, selected.id, num);

            setPersonalRoadmap((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    courses: prev.courses.map((c) => (c.code === selectedCode ? { ...c, grade: num } : c)),
                };
            });
            showToast(`Đã lưu điểm môn ${selectedCode} thành công!`, "success");
        } catch (e) {
            console.error("Failed to update grade on backend:", e);
            const msg = e?.response?.data?.message || "Không thể lưu điểm môn học trên hệ thống";
            showToast(msg, "error");
        } finally {
            setSavingGrade(false);
        }
    };

    const termGroups = useMemo(() => {
        const groups = {};
        TERMS.forEach((t) => { groups[t] = []; });
        COURSES.forEach((c) => { groups[c.term].push(c); });
        return groups;
    }, [COURSES, TERMS]);

    const directPrereqs = useMemo(() => {
        if (!selectedCode) return new Set();
        return new Set(COURSE_MAP[selectedCode]?.prereq || []);
    }, [selectedCode, COURSE_MAP]);

    const prereqCheck = useMemo(() => {
        if (!selected || mode !== "personal") return { satisfied: true, missingCodes: [] };
        return evaluatePrerequisiteGroups(selected, statusByCode);
    }, [selected, statusByCode, mode]);

    /* Tìm theo MÃ MÔN và TÊN MÔN như FDS/Guide modal hứa — ưu tiên mã bắt đầu bằng từ khóa (DEF_137) */
    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [];
        return COURSES
            .filter((c) => c.code.toLowerCase().includes(q) || (c.name || "").toLowerCase().includes(q))
            .sort((a, b) => {
                const aStarts = a.code.toLowerCase().startsWith(q) ? 0 : 1;
                const bStarts = b.code.toLowerCase().startsWith(q) ? 0 : 1;
                if (aStarts !== bStarts) return aStarts - bStarts;
                return a.code.localeCompare(b.code);
            })
            .slice(0, 8);
    }, [searchQuery, COURSES]);

    function handleSelectSearchResult(code) {
        setSelectedCode(code);
        setSearchQuery("");
        setTimeout(() => {
            nodeRefs.current[code]?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }, 50);
    }

    const showProgressTrack = mode === "personal";

    const courseProgressStats = useMemo(() => {
        if (mode !== "personal" || COURSES.length === 0) return { done: 0, total: 0 };
        const total = COURSES.length;
        const done = COURSES.filter((c) => c.status === "done").length;
        return { done, total };
    }, [COURSES, mode]);

    const percentDone = useMemo(() => {
        if (mode !== "personal" || courseProgressStats.total === 0) return 0;
        return Math.round((courseProgressStats.done / courseProgressStats.total) * 100);
    }, [courseProgressStats, mode]);

    useLayoutEffect(() => {
        const measure = () => {
            if (axisInnerRef.current) setTrackHeight(axisInnerRef.current.scrollHeight);
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [TERMS, termGroups]);

    /* ============ đo lại trục dọc (đường kẻ + điểm kết thúc) ============
       Dùng ResizeObserver thay vì chỉ dựa vào effect dependencies, vì khi
       đang "Sắp xếp" (kéo môn qua kỳ khác), chiều cao thực tế của
       khung lộ trình có thể thay đổi qua nhiều lần cập nhật liên tiếp
       (cảnh báo quá tải tín chỉ xuất hiện/biến mất, môn cuối cùng đổi kỳ...).
       ResizeObserver đảm bảo đường kẻ trục + điểm kết thúc luôn được đo lại
       chính xác theo chiều cao mới nhất, tránh bị "kéo không hết". */
    useLayoutEffect(() => {
        const container = axisInnerRef.current;
        if (!container || TERMS.length === 0) { setFinishTop(0); setTrunkStart(0); return; }

        const measure = () => {
            if (!axisInnerRef.current) return;
            const innerRect = axisInnerRef.current.getBoundingClientRect();

            if (firstTermRowRef.current) {
                const r = firstTermRowRef.current.getBoundingClientRect();
                setTrunkStart(r.top - innerRect.top + r.height / 2);
            }

            // Kỳ cuối trên trục có thể là một nhóm RỖNG (Block 5 sinh ra đã rỗng sẵn), nên phải
            // lùi ngược tìm kỳ có môn gần nhất. Nếu chỉ nhìn kỳ cuối thì finishTop = 0 và cả
            // đường trục lẫn thanh tiến độ đều biến mất.
            let lastCourse = null;
            for (let i = TERMS.length - 1; i >= 0 && !lastCourse; i -= 1) {
                const group = termGroups[TERMS[i]] || [];
                if (group.length > 0) lastCourse = group[group.length - 1];
            }
            if (!lastCourse) { setFinishTop(0); return; }
            const el = rowRefs.current[lastCourse.code];
            if (!el) return;
            const r2 = el.getBoundingClientRect();
            setFinishTop(r2.top - innerRect.top + r2.height / 2);
        };

        measure();

        let raf1 = requestAnimationFrame(() => {
            measure();
            raf1 = requestAnimationFrame(measure);
        });

        let ro = null;
        if (typeof ResizeObserver !== "undefined") {
            ro = new ResizeObserver(() => measure());
            ro.observe(container);
        }

        return () => {
            cancelAnimationFrame(raf1);
            if (ro) ro.disconnect();
        };
    }, [TERMS, termGroups, trackHeight, mode, loadingRoadmap, isReordering]);

    useEffect(() => {
        if (!selectedCode) { setSelectedCourseDetail(null); setCourseDeleted(false); return; }
        const courseObj = COURSE_MAP[selectedCode];
        if (!courseObj) return;
        let active = true;
        setLoadingDetail(true);
        setCourseDeleted(false);
        getCourseDetail(courseObj.id)
            .then((data) => { if (active) { setSelectedCourseDetail(data); setCourseDeleted(false); } })
            .catch((err) => {
                console.error(err);
                if (!active) return;
                setSelectedCourseDetail(null);
                // 404 = môn đã bị xoá, không phải "chưa có tài nguyên" (DEF_135)
                setCourseDeleted(err.response?.status === 404);
            })
            .finally(() => { if (active) setLoadingDetail(false); });
        return () => { active = false; };
    }, [selectedCode, COURSE_MAP]);

    useEffect(() => {
        if (mode !== "personal" || !activeRoadmapId || !selectedCode || !selected) { setCustomResources([]); return; }
        setCustomResources(selected.resources || []);
    }, [mode, selectedCode, activeRoadmapId, selected]);

    useEffect(() => {
        if (selected) {
            setNotesText(selected.notes || "");
            setNewResource({ title: "", url: "", resourceType: "", file: null });
        } else {
            setNotesText("");
        }
    }, [selectedCode, selected]);

    /* ============ phát hiện môn tiên quyết nằm ngoài màn hình (trên/dưới) ============ */
    useEffect(() => {
        const container = scrollerRef.current;
        if (!selectedCode || directPrereqs.size === 0 || !container) {
            setOffscreen({ up: false, down: false });
            return;
        }
        const check = () => {
            const cRect = container.getBoundingClientRect();
            let up = false, down = false;
            directPrereqs.forEach((code) => {
                const el = nodeRefs.current[code];
                if (!el) return;
                const r = el.getBoundingClientRect();
                if (r.bottom < cRect.top) up = true;
                else if (r.top > cRect.bottom) down = true;
            });
            setOffscreen({ up, down });
        };
        check();
        container.addEventListener("scroll", check);
        window.addEventListener("resize", check);
        return () => {
            container.removeEventListener("scroll", check);
            window.removeEventListener("resize", check);
        };
    }, [selectedCode, directPrereqs, termGroups]);

    function scrollToPrereq(direction) {
        const container = scrollerRef.current;
        if (!container) return;
        const cRect = container.getBoundingClientRect();
        const codes = Array.from(directPrereqs);
        const targetCode = codes.find((code) => {
            const el = nodeRefs.current[code];
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return direction === "up" ? r.bottom < cRect.top : r.top > cRect.bottom;
        });
        const el = targetCode && nodeRefs.current[targetCode];
        el?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }

    /* ============ chọn / bỏ chọn môn ============
       Trục cuộn bằng chuột/bàn phím như một vùng cuộn bình thường (đã bỏ kéo-giữ).
       Bấm vào thẻ môn ➔ mở ngăn chi tiết; bấm ra vùng trống hoặc lớp nền mờ ➔ đóng. */
    const closeDetail = useCallback(() => {
        setSelectedCode(null);
        setSelectedCourseDetail(null);
    }, []);

    function handleNodeClick(code) {
        if (selectedCode === code) { closeDetail(); }
        else { setSelectedCode(code); }
    }

    /* Bấm vào khoảng trống của trục (không trúng thẻ môn nào) thì bỏ chọn. */
    function handleAxisBackgroundClick(e) {
        if (e.target.closest(".sr-tag")) return;
        if (selectedCode) closeDetail();
    }

    const detailOpen = !!selectedCode && !isReordering;

    /* ============ hai ngăn trượt ở hai bên ============
         - HƯỚNG DẪN   trượt vào từ cạnh TRÁI  (bật/tắt bằng nút "Hướng dẫn")
         - CHI TIẾT MÔN trượt vào từ cạnh PHẢI (bật khi chọn 1 thẻ môn)
       Hai ngăn dùng chung một khung, cùng bề rộng, mở tắt độc lập nhau. Khi có
       ngăn mở thì khung lộ trình thu lại một chút để trục không bị che. */
    useEffect(() => {
        if (!detailOpen && !showGuide) return undefined;
        /* Esc đóng ngăn chi tiết trước; không có ngăn chi tiết thì ẩn hướng dẫn. */
        const onKeyDown = (e) => {
            if (e.key !== "Escape") return;
            if (detailOpen) closeDetail();
            else setShowGuide(false);
        };
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
    }, [detailOpen, showGuide, closeDetail]);

    /* Props gắn vào NÚT THẬT: rê vào thì thẻ hướng dẫn cùng loại sáng lên. */
    const uiHintProps = (key) => ({
        onMouseEnter: () => setUiHint(key),
        onMouseLeave: () => setUiHint((k) => (k === key ? null : k)),
        onFocus: () => setUiHint(key),
        onBlur: () => setUiHint((k) => (k === key ? null : k)),
    });
    /* Props gắn vào THẺ HƯỚNG DẪN: rê vào thì nút thật cùng loại sáng lên. */
    const guideHintProps = (key) => ({
        onMouseEnter: () => setGuideHint(key),
        onMouseLeave: () => setGuideHint((k) => (k === key ? null : k)),
    });
    const hl = (key) => (guideHint === key ? " sr-hl" : "");
    const guideCls = (key) => (guideHint === key || uiHint === key ? " sr-guide-item--active" : "");

    /* Bật "Sắp xếp " thì mở sẵn ngăn hướng dẫn để thấy ngay quy định đổi kỳ. */
    const handleCancelReorder = useCallback(() => {
        if (Object.keys(reorderOriginalTermByIdRef.current).length > 0) {
            setPersonalRoadmap(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    courses: prev.courses.map(c => {
                        const originalTerm = reorderOriginalTermByIdRef.current[c.code];
                        if (originalTerm !== undefined) {
                            return { ...c, term: originalTerm };
                        }
                        return c;
                    })
                };
            });
        }
        setIsReordering(false);
        reorderOriginalTermByIdRef.current = {};
    }, []);

    const toggleReordering = () => {
        if (!isReordering) {
            const backup = {};
            (personalRoadmap?.courses || []).forEach(c => {
                backup[c.code] = c.term;
            });
            reorderOriginalTermByIdRef.current = backup;
            setIsReordering(true);
            setShowGuide(true);
        } else {
            handleCancelReorder();
        }
    };

    function nodeVariant(course) {
        if (selectedCode && course.code === selectedCode) return "selected";
        return course.status || "todo";
    }

    /* ============ handlers ============ */
    const handlePersonalize = async () => {
        if (!selectedNs) { showToast("Vui lòng chọn chuyên ngành hẹp trước khi cá nhân hóa lộ trình.", "info"); return; }
        try {
            setPersonalizing(true);
            const cloned = await cloneRoadmap(selectedNs);
            let newId = cloned?.id;

            const refreshed = await refreshMyRoadmaps();
            if (!newId) {
                const match = refreshed
                    .filter((r) => (r.narrowSpecId || r.nsId) === selectedNs)
                    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
                newId = match?.id;
            }

            if (newId) {
                try {
                    await syncTranscript(newId);
                } catch (syncErr) {
                    console.error("Auto-sync transcript after personalize failed:", syncErr);
                }
                await refreshMyRoadmaps();
                setActiveRoadmapId(newId);
                setMode("personal");
                setSelectedCode(null);
                showToast("Cá nhân hóa lộ trình học tập thành công!", "success");
                navigate(`/student/personal-roadmap?roadmapId=${newId}`, { replace: true });
            } else {
                showToast("Đã tạo lộ trình cá nhân nhưng không xác định được ID để đồng bộ. Vui lòng tải lại trang.", "error");
            }
        } catch (err) {
            console.error("Failed to personalize roadmap:", err);
            const status = err.response?.status;
            if (status === 400) {
                showToast("Bạn đã đạt giới hạn tối đa 5 lộ trình học tập cá nhân. Vui lòng xóa bớt lộ trình cũ trước khi tạo lộ trình mới.", "error");
            } else {
                showToast("Không thể cá nhân hóa lộ trình học tập. Vui lòng thử lại sau.", "error");
            }
        } finally {
            setPersonalizing(false);
        }
    };

    const handleStatusChange = async (newStatus) => {
        if (!selectedCode || !personalRoadmap || !activeRoadmapId) return;
        const courseObj = COURSE_MAP[selectedCode];
        if (!courseObj) return;

        if (STATUSES_REQUIRING_PREREQ_CHECK.has(newStatus) && newStatus !== courseObj.status) {
            const check = evaluatePrerequisiteGroups(courseObj, statusByCode);
            if (!check.satisfied) {
                showToast(`Không thể cập nhật trạng thái: môn "${courseObj.code}" yêu cầu hoàn thành môn tiên quyết trước. Còn thiếu: ${check.missingCodes.join(", ")}`, "error");
                return;
            }
        }

        let backendStatus = "PLANNED";
        if (newStatus === "studying") backendStatus = "IN_PROGRESS";
        else if (newStatus === "done") backendStatus = "COMPLETED";

        try {
            await updateProgress(activeRoadmapId, courseObj.id, backendStatus);
            setPersonalRoadmap((prev) => ({
                ...prev,
                courses: prev.courses.map((c) => (c.code === selectedCode ? { ...c, status: newStatus } : c)),
            }));
        } catch (e) {
            console.error("Failed to update progress:", e);
            const backendMessage = e?.response?.data?.message;
            showToast(backendMessage || "Không thể cập nhật trạng thái trên hệ thống.", "error");
        }
    };

    /* Kỳ đích khi bấm ▲/▼ trên một môn. Trả về null nếu đã ở đầu/cuối danh sách kỳ. */
    const getTargetTerm = useCallback((course, direction) => {
        const idxNow = movableTerms.indexOf(course?.term);
        if (idxNow === -1) return null;
        const idxTarget = direction === "up" ? idxNow - 1 : idxNow + 1;
        if (idxTarget < 0 || idxTarget >= movableTerms.length) return null;
        return movableTerms[idxTarget];
    }, [movableTerms]);

    /* XÉT TỪNG môn tiên quyết một, không gom nhóm OR/AND: mỗi tiên quyết phải hoặc đã hoàn
       thành, hoặc không nằm trong chính kỳ đích của lộ trình CÁ NHÂN — tức là không bị học
       đồng thời với môn đang dời. Nhờ xét theo kỳ cá nhân nên trường hợp tiên quyết đã được
       học vượt lên kỳ sớm hơn tự động hợp lệ.
       Trả về mã các môn tiên quyết đang chặn (rỗng nghĩa là hợp lệ). */
    const findPrereqsInTerm = useCallback((course, targetTerm) => {
        const codes = course?.prerequisiteCodes || [];
        return codes.filter((code) => {
            const prereq = COURSE_MAP[code];
            if (!prereq) return false;
            return prereq.status !== "done" && Number(prereq.term) === Number(targetTerm);
        });
    }, [COURSE_MAP]);

    /* Chiều ngược lại của cùng một ràng buộc: dời môn X (chưa học xong) vào kỳ đích mà ở đó
       có môn Y coi X là tiên quyết thì cũng thành học cùng kỳ -> chặn. */
    const findDependentsInTerm = useCallback((course, targetTerm) => {
        if (!course || course.status === "done") return [];
        return COURSES
            .filter((c) => c.id !== course.id
                && Number(c.term) === Number(targetTerm)
                && (c.prerequisiteCodes || []).includes(course.code))
            .map((c) => c.code);
    }, [COURSES]);

    /* Tổng tín chỉ đang nằm trong một kỳ, bỏ qua môn đang được dời. */
    const creditsInTerm = useCallback((term, excludeCourseId) => COURSES
        .filter((c) => Number(c.term) === Number(term) && c.id !== excludeCourseId)
        .reduce((sum, c) => sum + (c.credits || 0), 0), [COURSES]);

    const coursesInTerm = useCallback((term, excludeCourseId) => COURSES
        .filter((c) => Number(c.term) === Number(term) && c.id !== excludeCourseId)
        .length, [COURSES]);

    /* Tổng tín chỉ ĐANG học vượt trong một kỳ — quota học vượt tính theo tín chỉ, không theo môn. */
    const advancedCreditsInTerm = useCallback((term, excludeCourseId) => COURSES
        .filter((c) => Number(c.term) === Number(term) && c.id !== excludeCourseId && c.isAdvancedRegistration)
        .reduce((sum, c) => sum + (c.credits || 0), 0), [COURSES]);

    const advancedCoursesInTerm = useCallback((term, excludeCourseId) => COURSES
        .filter((c) => Number(c.term) === Number(term) && c.id !== excludeCourseId && c.isAdvancedRegistration)
        .length, [COURSES]);

    /* Lý do KHÔNG được phép dời môn sang kỳ đích, hoặc null nếu hợp lệ.
       Dùng CHUNG cho nút ▲▼ (disable + tooltip giải thích ngay khi hover)
       và handleMoveTerm, để quy tắc dời kỳ chỉ có một nguồn duy nhất. */
    const getMoveBlockReason = useCallback((course, targetTerm) => {
        if (!course || targetTerm == null) return null;

        // Áp cho MỌI thao tác dời kỳ, không riêng học vượt: dời kỳ liền trước khi kỳ hiện tại
        // của sinh viên không phải kỳ đích thì backend xử lý như "đổi kỳ hiển thị" (Rule 2),
        // nhưng xung đột học cùng kỳ với tiên quyết thì vẫn y hệt nên phải chặn như nhau.
        const blockingPrereqs = findPrereqsInTerm(course, targetTerm);
        if (blockingPrereqs.length > 0) {
            return `Không thể chuyển môn ${course.code} sang ${termShortLabel(targetTerm)}: môn tiên quyết ${blockingPrereqs.join(", ")} đang ở ${termShortLabel(targetTerm)} và chưa hoàn thành, không được học cùng kỳ với môn này.`;
        }

        const blockingDependents = findDependentsInTerm(course, targetTerm);
        if (blockingDependents.length > 0) {
            return `Không thể chuyển môn ${course.code} sang ${termShortLabel(targetTerm)}: môn ${blockingDependents.join(", ")} ở ${termShortLabel(targetTerm)} có ${course.code} là môn tiên quyết, không được học cùng kỳ.`;
        }

        // Trần tín chỉ của kỳ đích: kỳ chính 21 TC, Block 5 chỉ 6 TC.
        // Nhóm "chưa gán kỳ" là chỗ chứa tạm nên không áp trần.
        if (Number(targetTerm) !== UNASSIGNED_TERM) {
            const limit = termCreditLimit(targetTerm);
            const courseLimit = termCourseLimit(targetTerm);
            const creditsNow = creditsInTerm(targetTerm, course.id);
            const coursesNow = coursesInTerm(targetTerm, course.id);
            const moving = course.credits || 0;

            if (creditsNow + moving > limit) {
                return `Không thể chuyển môn ${course.code} sang ${termShortLabel(targetTerm)}: kỳ này đang có ${creditsNow} tín chỉ, thêm môn này (${moving} TC) sẽ vượt trần ${limit} tín chỉ.`;
            }
            if (coursesNow + 1 > courseLimit) {
                return `Không thể chuyển môn ${course.code} sang ${termShortLabel(targetTerm)}: kỳ này đang có ${coursesNow} môn học, thêm môn này sẽ vượt trần ${courseLimit} môn.`;
            }
        }

        const origTerm = course.originalTermNo || course.term;
        const targetKey = termSortKey(targetTerm);
        const origKey = termSortKey(origTerm);

        if (!isBlock5Term(targetTerm) && [0, 5, 6, 9].includes(Number(targetTerm))) {
            return `Không được phép dời môn học vào kỳ ${targetTerm}.`;
        }

        if (targetKey < origKey) {
            if (origKey - targetKey > 1) {
                return `Không được phép học vượt môn học quá 1 kỳ so với kỳ gốc (kỳ ${origTerm}).`;
            }

            if (!isBlock5Term(targetTerm)) {
                const advCoursesNow = advancedCoursesInTerm(targetTerm, course.id);
                if (advCoursesNow + 1 > ADVANCED_COURSE_LIMIT) {
                    return `Không thể học vượt môn ${course.code} vào ${termShortLabel(targetTerm)}: vượt quá tối đa ${ADVANCED_COURSE_LIMIT} môn học vượt trong một kỳ.`;
                }
            }
        }

        // Đưa môn vào Block 5 không phải là đơn học vượt (Block 5 có trần 6 TC của riêng nó),
        // nên không cần biết kỳ hiện tại và cũng không áp các luật học vượt phía dưới.
        if (isBlock5Term(targetTerm)) return null;

        return null;
    }, [studentCurrentTerm, findPrereqsInTerm, findDependentsInTerm, creditsInTerm, coursesInTerm, advancedCreditsInTerm, advancedCoursesInTerm]);

    const handleMoveTerm = async (code, direction) => {
        if (!personalRoadmap || !activeRoadmapId) return;
        const courseObj = personalRoadmap.courses.find((c) => c.code === code);
        if (!courseObj || courseObj.isRemovedFromStandard) return;

        const targetTerm = getTargetTerm(courseObj, direction);
        if (targetTerm == null) return;

        const origTerm = courseObj.originalTermNo || courseObj.term;

        // Vướng quy tắc thì nút đã bị disable + hiện lý do ngay tại chỗ khi hover,
        // nên ở đây chỉ cần chặn im lặng, không bắn thêm popup/toast nữa.
        if (getMoveBlockReason(courseObj, targetTerm)) return;

        // Check if this is an Advanced Registration move (Rule 1)
        const isAdvancedMove = (origTerm === studentCurrentTerm + 1 && targetTerm === studentCurrentTerm);

        if (isAdvancedMove && !courseObj.isAdvancedRegistration) {
            setPendingAdvancedMove({ course: courseObj, targetTerm });
            setRiskAcknowledged(false);
            setShowRiskModal(true);
            return;
        }

        // Update local state instead of calling API immediately
        setPersonalRoadmap(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                courses: prev.courses.map(c => {
                    if (c.code === code) {
                        return { ...c, term: targetTerm, isAdvancedRegistration: isAdvancedMove || c.isAdvancedRegistration };
                    }
                    return c;
                })
            };
        });
    };

    const handleConfirmAdvancedMove = async () => {
        if (!pendingAdvancedMove || !activeRoadmapId || !riskAcknowledged) return;

        // Update local state instead of calling API immediately
        setPersonalRoadmap(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                courses: prev.courses.map(c => {
                    if (c.code === pendingAdvancedMove.course.code) {
                        return { ...c, term: pendingAdvancedMove.targetTerm, isAdvancedRegistration: true };
                    }
                    return c;
                })
            };
        });

        setShowRiskModal(false);
        setPendingAdvancedMove(null);
        setRiskAcknowledged(false);
    };

    const handleSaveReorder = async () => {
        if (!activeRoadmapId || !personalRoadmap) return;

        const changedCourses = personalRoadmap.courses.filter(c => {
            const originalTerm = reorderOriginalTermByIdRef.current[c.code];
            return originalTerm !== undefined && originalTerm !== c.term;
        });

        if (changedCourses.length === 0) {
            setIsReordering(false);
            reorderOriginalTermByIdRef.current = {};
            showToast("Không có thay đổi nào để lưu.", "info");
            return;
        }

        setSavingReorder(true);
        try {
            const payload = {
                moves: changedCourses.map(course => ({
                    courseId: course.id,
                    targetTerm: course.term,
                    acknowledgedRisk: course.isAdvancedRegistration || (termSortKey(course.term) < termSortKey(course.originalTermNo || course.term) && !isBlock5Term(course.term))
                }))
            };

            await batchReorderRoadmapItems(activeRoadmapId, payload);

            showToast("Đã lưu các thay đổi sắp xếp thành công!", "success");
            await loadPersonal(activeRoadmapId);
            setIsReordering(false);
            reorderOriginalTermByIdRef.current = {};
        } catch (e) {
            console.error("Failed to batch save reorder:", e);
            const msg = e?.response?.data?.message || "Có lỗi xảy ra khi lưu thay đổi, hệ thống sẽ tải lại lộ trình.";
            showToast(msg, "error");
            await loadPersonal(activeRoadmapId);
        } finally {
            setSavingReorder(false);
        }
    };

    const handleBookmarkToggle = async () => {
        if (!selectedCode || !personalRoadmap || !activeRoadmapId) return;
        const courseObj = COURSE_MAP[selectedCode];
        if (!courseObj) return;
        const willBookmark = !courseObj.bookmarked;
        try {
            if (willBookmark) await addBookmark(activeRoadmapId, courseObj.id);
            else await removeBookmark(activeRoadmapId, courseObj.id);
            setPersonalRoadmap((prev) => ({
                ...prev,
                courses: prev.courses.map((c) => (c.code === selectedCode ? { ...c, bookmarked: willBookmark } : c)),
            }));
        } catch (e) {
            console.error(e);
            showToast("Không thể cập nhật trạng thái yêu thích trên hệ thống.", "error");
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedCode || !personalRoadmap || !activeRoadmapId) return;
        const courseObj = COURSE_MAP[selectedCode];
        if (!courseObj) return;
        // Chặn độ dài ở client thay vì đẩy chuỗi 501 ký tự lên server (DEF_146)
        if (notesText.trim().length > NOTE_MAX_LENGTH) {
            showToast(`Ghi chú không được vượt quá ${NOTE_MAX_LENGTH} ký tự.`, "error");
            return;
        }
        try {
            if (!notesText.trim()) await removeNote(activeRoadmapId, courseObj.id);
            else await updateNote(activeRoadmapId, courseObj.id, notesText.trim());
            setPersonalRoadmap((prev) => ({
                ...prev,
                courses: prev.courses.map((c) => (c.code === selectedCode ? { ...c, notes: notesText } : c)),
            }));
            showToast("Đã lưu ghi chú thành công!", "success");
        } catch (e) {
            console.error(e);
            showToast("Không thể lưu ghi chú trên hệ thống.", "error");
        }
    };

    const handleAddResource = async (e) => {
        e.preventDefault();
        if (!selectedCode || !personalRoadmap || !activeRoadmapId || !selected) return;
        if (!newResource.resourceType) { showToast("Vui lòng chọn loại tài nguyên.", "info"); return; }

        const isFileBased = FILE_BASED_RESOURCE_TYPES.has(newResource.resourceType);

        if (isFileBased) {
            if (!newResource.file) { showToast("Vui lòng chọn tệp để tải lên.", "info"); return; }
            if (newResource.file.size > 25 * 1024 * 1024) {
                showToast("Kích thước tệp vượt quá giới hạn tối đa 25MB.", "error");
                return;
            }
            const existingFilesCount = (customResources || []).filter((r) => r.publicId || r.fileSize || FILE_BASED_RESOURCE_TYPES.has(r.resourceType)).length;
            if (existingFilesCount >= 3) {
                showToast("Mỗi môn học trong lộ trình cá nhân chỉ được phép tải lên tối đa 3 tệp tài nguyên.", "error");
                return;
            }
        } else {
            if (!newResource.title.trim()) { showToast("Vui lòng nhập tên tài nguyên.", "info"); return; }
            if (!newResource.url.trim()) { showToast("Vui lòng nhập đường dẫn liên kết.", "info"); return; }
        }

        try {
            setSubmittingResource(true);
            let createdRes;
            if (isFileBased) {
                const titleParam = newResource.title.trim() || newResource.file.name;
                createdRes = await uploadPersonalResourceFile(activeRoadmapId, selected.id, titleParam, newResource.resourceType, newResource.file);
            } else {
                createdRes = await addPersonalResourceLink(activeRoadmapId, selected.id, {
                    title: newResource.title.trim(),
                    url: newResource.url.trim(),
                    resourceType: newResource.resourceType
                });
            }

            if (createdRes) {
                const updated = [...customResources, createdRes];
                setCustomResources(updated);
                setPersonalRoadmap((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        courses: prev.courses.map((c) => (c.code === selectedCode ? { ...c, resources: updated } : c))
                    };
                });
            }
            setNewResource({ title: "", url: "", resourceType: "", file: null });
            showToast("Đã thêm tài nguyên cá nhân thành công!", "success");
        } catch (err) {
            console.error("Failed to add resource:", err);
            const msg = err?.response?.data?.message || "Không thể thêm tài nguyên cá nhân";
            showToast(msg, "error");
        } finally {
            setSubmittingResource(false);
        }
    };

    const handleDeleteResource = async (resId) => {
        if (!selectedCode || !selected || !activeRoadmapId) return;
        if (!window.confirm("Bạn có chắc chắn muốn xóa học liệu cá nhân này không?")) return;
        try {
            await deletePersonalResource(activeRoadmapId, resId);
            const updated = customResources.filter((r) => r.id !== resId);
            setCustomResources(updated);
            setPersonalRoadmap((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    courses: prev.courses.map((c) => (c.code === selectedCode ? { ...c, resources: updated } : c))
                };
            });
            showToast("Đã xóa tài nguyên cá nhân thành công!", "success");
        } catch (err) {
            console.error("Failed to delete resource:", err);
            const msg = err?.response?.data?.message || "Không thể xóa tài nguyên cá nhân";
            showToast(msg, "error");
        }
    };

    const handleOpenRenameModal = () => {
        if (!personalRoadmap) return;
        setRenameInputVal(personalRoadmap.name || "");
        setShowRenameModal(true);
    };

    const confirmRenameRoadmap = async (e) => {
        if (e) e.preventDefault();
        if (!personalRoadmap || !activeRoadmapId) return;

        const trimmedName = renameInputVal.trim();
        if (!trimmedName) {
            showToast("Tên lộ trình không được để trống.", "error");
            return;
        }
        if (trimmedName.length > 100) {
            showToast("Tên lộ trình không được vượt quá 100 ký tự.", "error");
            return;
        }

        try {
            setSavingRename(true);
            const updated = await renameRoadmap(activeRoadmapId, trimmedName);
            const newName = updated?.name || trimmedName;
            setPersonalRoadmap((prev) => (prev ? { ...prev, name: newName } : prev));
            await refreshMyRoadmaps();
            setShowRenameModal(false);
            showToast(`Đã đổi tên lộ trình thành "${newName}".`, "success");
        } catch (err) {
            console.error("Failed to rename roadmap:", err);
            const msg = err?.response?.data?.message || "Không thể đổi tên lộ trình.";
            showToast(msg, "error");
        } finally {
            setSavingRename(false);
        }
    };

    const handleDeleteRoadmap = () => {
        if (!personalRoadmap) return;
        setShowDeleteConfirmModal(true);
    };

    const confirmDeleteRoadmap = async () => {
        if (!personalRoadmap) return;
        setShowDeleteConfirmModal(false);
        try {
            const deletedName = personalRoadmap.name || personalRoadmap.nsName || "lộ trình cá nhân";
            await deleteRoadmap(activeRoadmapId);
            // Nói rõ vì sao màn đổi sang chế độ Gốc sau khi xoá (DEF_149)
            showToast(`Đã xóa "${deletedName}". Màn hình chuyển về chế độ Khung chương trình gốc.`, "success");
            setActiveRoadmapId("");
            setPersonalRoadmap(null);
            setMode("original");
            // Bỏ ?roadmapId= khỏi URL để F5 không cố mở lại lộ trình đã xoá
            if (roadmapIdParam) {
                navigate("/student/roadmap", { replace: true });
            }
            await refreshMyRoadmaps();
        } catch (e) {
            console.error(e);
            showToast("Không thể xóa lộ trình.", "error");
        }
    };

    const handleSyncTranscript = async () => {
        if (!personalRoadmap || !activeRoadmapId) return;
        // Thao tác ghi đè toàn bộ tiến độ/điểm — phải xác nhận trước, không ghi đè ngay (DEF_147)
        const doneCount = (personalRoadmap.courses || []).filter((c) => c.status === "done").length;
        const ok = window.confirm(
            `Đồng bộ điểm sẽ ghi đè tiến độ và điểm của lộ trình này bằng dữ liệu trong bảng điểm mới nhất của bạn.\n\n` +
            `Lộ trình hiện có ${doneCount} môn đang ở trạng thái "Đã hoàn thành". ` +
            `Những thay đổi thủ công bạn đã nhập có thể bị ghi đè và không khôi phục được.\n\nTiếp tục đồng bộ?`
        );
        if (!ok) return;
        try {
            setLoadingRoadmap(true);
            await syncTranscript(activeRoadmapId);
            showToast("Đã đồng bộ tiến trình học tập từ bảng điểm của bạn thành công!", "success");
            await loadPersonal(activeRoadmapId);
        } catch (e) {
            console.error(e);
            showToast("Không thể đồng bộ bảng điểm. Vui lòng kiểm tra lại bảng điểm của bạn.", "error");
        } finally {
            setLoadingRoadmap(false);
        }
    };

    // Môn thực sự đã bị dời khỏi kỳ gốc (khác vị trí hiện tại), dùng cho badge "Gốc K{n}"
    const isMovedFromOriginal = (course) =>
        mode === "personal" &&
        course.originalTermNo != null &&
        Number(course.originalTermNo) !== Number(course.term);

    /* ============ render trục dọc ============ */
    function renderCourseRow(course, side) {
        const variant = nodeVariant(course);
        const isPrereq = directPrereqs.has(course.code);
        const courseSkillsList = specSkills
            // Kỹ năng đã bị CM tắt không được hiện thành tag trên môn (DEF_129)
            .filter((s) => s.isActive !== false && s.courseIds && (s.courseIds.includes(course.id) || s.courseIds.includes(course.code)))
            .map((s) => s.name);
        const skills = courseSkillsList.length > 0 ? courseSkillsList : ["Kỹ năng rèn luyện"];

        const canMoveTerm = mode === "personal" && isReordering && !course.isRemovedFromStandard;
        const termIdxNow = movableTerms.indexOf(course.term);
        const isFirstTerm = termIdxNow <= 0;
        const isLastTerm = termIdxNow === -1 || termIdxNow >= movableTerms.length - 1;

        // Vướng quy tắc (học vượt...) thì disable NGAY nút, kèm lý do hiện lúc hover —
        // thay vì cho bấm rồi mới báo lỗi bằng popup.
        const upBlockReason = !canMoveTerm ? null
            : isFirstTerm ? "Đây đã là kỳ sớm nhất trong lộ trình, không thể chuyển lên nữa."
                : getMoveBlockReason(course, getTargetTerm(course, "up"));
        const downBlockReason = !canMoveTerm ? null
            : isLastTerm ? "Đây đã là nhóm cuối trong lộ trình, không thể chuyển xuống nữa."
                : getMoveBlockReason(course, getTargetTerm(course, "down"));

        const tagEl = (
            <div
                ref={(el) => { if (el) nodeRefs.current[course.code] = el; }}
                role="button"
                tabIndex={0}
                onClick={() => handleNodeClick(course.code)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleNodeClick(course.code); } }}
                {...uiHintProps("detail")}
                className={`sr-tag sr-tag--${variant}${isPrereq ? " sr-tag--prereq" : ""}${canMoveTerm ? " sr-tag--reordering" : ""}${guideHint === "detail" ? " sr-tag--hint" : ""}`}
            >
                {course.isAdvancedRegistration && (
                    <div className="sr-advanced-badge" title="Môn học vượt">Học vượt</div>
                )}
                {course.countsTowardGpa === false && (
                    <div className="sr-no-gpa-top-badge" title="Môn học này không tính vào GPA tích lũy">Không tính GPA</div>
                )}

                {/* Hàng 1: mã môn — điểm nằm ngay cạnh mã, không đẩy thẻ dài xuống */}
                <div className="sr-tag-top">
                    <span className="sr-tag-code">{course.code}</span>
                    {mode === "personal" && course.status === "done" && (
                        hasGrade(course)
                            ? <span className="sr-tag-grade" title={`Điểm: ${course.grade}`}>{course.grade}</span>
                            : <span className="sr-tag-grade sr-tag-grade--missing" title="Chưa nhập điểm cho môn này">--</span>
                    )}
                </div>

                {/* Hàng 2: tín chỉ + kỳ gốc, xếp ngang cho gọn */}
                <div className="sr-tag-meta">
                    <span className="sr-tag-credits">{course.credits} TC</span>
                    {/* Chỉ đánh dấu môn ĐÃ bị dời khỏi kỳ gốc, không phải mọi môn có thể dời (DEF_142) */}
                    {isMovedFromOriginal(course) && (
                        <span
                            className="sr-tag-orig-term"
                            title={`Môn này đã được dời khỏi kỳ gốc trong khung chuẩn (Kỳ ${course.originalTermNo})`}
                        >
                            Gốc K{course.originalTermNo}
                        </span>
                    )}
                </div>
            </div>
        );

        /* Cụm ▲▼ đứng NGOÀI thẻ môn, ngay cạnh thẻ — không chiếm thêm 1 dòng bên trong thẻ.
           Rê chuột vào nút sẽ làm nổi thẻ hướng dẫn tương ứng ở panel bên phải. */
        const reorderEl = canMoveTerm ? (
            <div className="sr-tag-reorder">
                {/* Tooltip nằm ở lớp bọc chứ không nằm trong <button>: nút disabled không nhận
                    sự kiện chuột nên nếu gắn vào nút thì hover sẽ không hiện được lý do. */}
                <span
                    className="sr-tag-reorder-slot"
                    onMouseEnter={() => setHoveredMoveDir("up")}
                    onMouseLeave={() => setHoveredMoveDir(null)}
                >
                    <button
                        type="button"
                        className={`sr-tag-reorder-btn sr-tag-reorder-btn--up${hoveredMoveDir === "up" ? " sr-tag-reorder-btn--hint" : ""}`}
                        disabled={isFirstTerm || !!upBlockReason}
                        onClick={(e) => { e.stopPropagation(); handleMoveTerm(course.code, "up"); }}
                        onFocus={() => setHoveredMoveDir("up")}
                        onBlur={() => setHoveredMoveDir(null)}
                        aria-label="Chuyển sang kỳ trước"
                        aria-describedby={upBlockReason ? `sr-reorder-why-up-${course.code}` : undefined}
                    >
                        <IconChevronUp />
                    </button>
                    <span
                        id={upBlockReason ? `sr-reorder-why-up-${course.code}` : undefined}
                        role={upBlockReason ? "note" : undefined}
                        className={`sr-reorder-tooltip${upBlockReason ? " sr-reorder-tooltip--blocked" : ""}`}
                    >
                        {upBlockReason || `Chuyển sang ${termIdxNow > 0 ? termShortLabel(movableTerms[termIdxNow - 1]) : "kỳ trước"}`}
                    </span>
                </span>
                <span
                    className="sr-tag-reorder-slot"
                    onMouseEnter={() => setHoveredMoveDir("down")}
                    onMouseLeave={() => setHoveredMoveDir(null)}
                >
                    <button
                        type="button"
                        className={`sr-tag-reorder-btn sr-tag-reorder-btn--down${hoveredMoveDir === "down" ? " sr-tag-reorder-btn--hint" : ""}`}
                        disabled={isLastTerm || !!downBlockReason}
                        onClick={(e) => { e.stopPropagation(); handleMoveTerm(course.code, "down"); }}
                        onFocus={() => setHoveredMoveDir("down")}
                        onBlur={() => setHoveredMoveDir(null)}
                        aria-label="Chuyển sang kỳ sau"
                        aria-describedby={downBlockReason ? `sr-reorder-why-down-${course.code}` : undefined}
                    >
                        <IconChevronDown />
                    </button>
                    <span
                        id={downBlockReason ? `sr-reorder-why-down-${course.code}` : undefined}
                        role={downBlockReason ? "note" : undefined}
                        className={`sr-reorder-tooltip${downBlockReason ? " sr-reorder-tooltip--blocked" : ""}`}
                    >
                        {downBlockReason || `Chuyển sang ${termIdxNow >= 0 && termIdxNow < movableTerms.length - 1 ? termShortLabel(movableTerms[termIdxNow + 1]) : "kỳ sau"}`}
                    </span>
                </span>
            </div>
        ) : null;
        /* Nhánh nối trục ➔ môn. Ô tròn đậm màu (::before) nằm ở đầu chạm trục,
           màu theo đúng trạng thái môn nên vẫn đọc được ngữ nghĩa như thẻ môn. */
        const connectorEl = (
            <div
                className={`sr-connector-line sr-connector-line--${side} sr-connector-line--${variant}${isPrereq ? " sr-connector-line--prereq" : ""}`}
            />
        );
        const fanEl = <SkillFan skills={skills} side={side} isDone={course.status === "done"} />;

        return (
            <div
                className="sr-row"
                key={course.code}
                ref={(el) => { if (el) rowRefs.current[course.code] = el; }}
            >
                <div
                    className="sr-branch"
                    style={{ gridColumn: side === "right" ? "2" : "1", justifySelf: side === "right" ? "start" : "end" }}
                >
                    {side === "right"
                        ? (<>{connectorEl}{tagEl}{reorderEl}{fanEl}</>)
                        : (<>{fanEl}{reorderEl}{tagEl}{connectorEl}</>)}
                </div>
            </div>
        );
    }

    function buildRows() {
        const rows = [];
        let globalIdx = 0;
        TERMS.forEach((term, termIdx) => {
            const coursesInTerm = termGroups[term] || [];
            const isBlock5 = isBlock5Term(term);
            const creditsHere = coursesInTerm.reduce((sum, c) => sum + (c.credits || 0), 0);

            rows.push(
                <div
                    className={`sr-term-row${isBlock5 ? " sr-term-row--block5" : ""}`}
                    key={`term-${term}`}
                    id={`term-row-${term}`}
                    ref={(el) => {
                        if (termIdx === 0) firstTermRowRef.current = el;
                        if (el) termRowRefs.current[term] = el;
                    }}
                >
                    <div
                        className={`sr-term-pill${isBlock5 ? " sr-term-pill--block5" : ""}`}
                        title={term === UNASSIGNED_TERM ? undefined
                            : `${termShortLabel(term)}: ${creditsHere}/${termCreditLimit(term)} tín chỉ`}
                    >
                        {termLabel(term)}
                    </div>
                    {/* Block 5 sinh ra rỗng — nói luôn cho sinh viên biết nó dùng để làm gì */}
                    {isBlock5 && coursesInTerm.length === 0 && (
                        <div className="sr-block5-empty">
                            Kỳ phụ dành cho học vượt / học lại — tối đa {BLOCK5_COURSE_LIMIT} môn / {BLOCK5_CREDIT_LIMIT} tín chỉ.
                            Dùng nút ▲▼ trên thẻ môn để đưa môn vào đây.
                        </div>
                    )}
                </div>
            );

            coursesInTerm.forEach((c) => {
                const side = globalIdx % 2 === 0 ? "right" : "left";
                globalIdx += 1;
                rows.push(renderCourseRow(c, side));
            });
        });
        return rows;
    }

    const noRoadmapAtAll = mode === "personal" && myRoadmaps.length === 0;

    return (
        <Layout role="student" user={{ name: username }} onLogout={handleLogout} onLogoClick={() => navigate('/')} onGoHome={() => navigate('/')}>
            <ProfileFlowToast toast={toast} onClose={() => setToast(null)} />
            <div className="sr-page">
                <header className="sr-header">
                    <div>
                        <h1 className="sr-title">
                            <span className="sr-title-icon"><Compass size={20} strokeWidth={2.5} /></span>
                            Lộ trình học tập
                        </h1>
                        <p className="sr-subtitle">
                            {isReordering
                                ? "Đang sắp xếp lộ trình — (Bản nháp) hãy kéo thả các môn và bấm Lưu thay đổi khi hoàn tất"
                                : mode === "personal"
                                    ? "Theo dõi tiến độ và cá nhân hóa lộ trình của bạn"
                                    : "Khám phá khung chương trình chuẩn và cá nhân hóa lộ trình"}
                        </p>
                    </div>
                    <div className="sr-header-actions">
                        {myRoadmaps.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <FilterSelect
                                    widthClass="sr-select--wide"
                                    placeholder="-- Chọn lộ trình cá nhân --"
                                    value={mode === "personal" ? activeRoadmapId : ""}
                                    options={myRoadmaps.map((r) => ({
                                        value: r.id,
                                        label: `${r.name} (Cập nhật ${new Date(r.updatedAt || r.createdAt || new Date()).toLocaleDateString('vi-VN')})`
                                    }))}
                                    onChange={(val) => {
                                        if (!val) return;
                                        setActiveRoadmapId(val);
                                        setSelectedCode(null);
                                        setMode("personal");
                                        // Đồng bộ URL để F5 / chia sẻ link giữ đúng lộ trình đang xem (DEF_138)
                                        navigate(`/student/personal-roadmap?roadmapId=${val}`, { replace: true });
                                    }}
                                />
                                {mode === "personal" && activeRoadmapId && (
                                    <button
                                        type="button"
                                        className="sr-floating-btn"
                                        onClick={handleOpenRenameModal}
                                        disabled={isReordering}
                                        title="Đổi tên lộ trình cá nhân đang chọn"
                                        style={{ height: '36px', padding: '0 12px', gap: '6px' }}
                                    >
                                        <IconPencil size={13} /> Đổi tên
                                    </button>
                                )}
                            </div>
                        )}
                        {mode === "original" && !matchedPersonalRoadmap && (
                            <button className={`sr-personalize-btn${hl("start")}`} onClick={handlePersonalize} disabled={!selectedNs || TERMS.length === 0 || personalizing} {...uiHintProps("start")}>
                                {personalizing ? "Đang cá nhân hóa…" : (<><IconSparkle /> Cá nhân hóa</>)}
                            </button>
                        )}
                        {(matchedPersonalRoadmap || (mode === "personal" && activeRoadmapId)) && (
                            <div className="sr-mode-toggle">
                                <button className={`sr-mode-btn ${mode === "personal" ? "active" : ""}`} onClick={() => setMode("personal")}>Cá nhân hóa</button>
                                <button className={`sr-mode-btn ${mode === "original" ? "active" : ""}`} onClick={() => { setMode("original"); setSelectedCode(null); }}>Gốc</button>
                            </div>
                        )}
                    </div>
                </header>

                <div className={`sr-body${showGuide ? " sr-body--guide-open" : ""}${detailOpen ? " sr-body--detail-open" : ""}`}>
                    {/* Hướng dẫn — nằm ở cột bên TRÁI. Tách hẳn với form của roadmap, có thể tắt đi, không đè lên roadmap. */}
                    <aside
                        className={`sr-drawer sr-drawer--left${showGuide ? " sr-drawer--open" : ""}`}
                        role="dialog"
                        aria-label="Hướng dẫn sử dụng lộ trình"
                    >
                        <div className="sr-drawer-topbar">
                            <div className="sr-drawer-title-wrap">
                                <h2 className="sr-drawer-title">
                                    {isReordering ? "Hướng dẫn đổi kỳ học" : "Hướng dẫn sử dụng lộ trình"}
                                </h2>
                                <div className="sr-panel-heading">
                                    <span className="sr-panel-code">
                                        {isReordering ? "SẮP XẾP" : "HƯỚNG DẪN"}
                                    </span>
                                    {isReordering && (
                                        <span className="sr-panel-term">Quy định đổi kỳ</span>
                                    )}
                                </div>
                            </div>
                            <div className="sr-drawer-topbar-actions">
                                <button
                                    className="sr-drawer-close"
                                    onClick={() => setShowGuide(false)}
                                    aria-label="Ẩn hướng dẫn"
                                >
                                    <IconX size={12} /> Đóng
                                </button>
                            </div>
                        </div>

                        <div className="sr-drawer-body">
                            {isReordering ? (
                                <div className="sr-reorder-guidance-panel">
                                    <div className="sr-reorder-guidance-section">
                                        {/* Rê vào thẻ hướng dẫn ➝ nút ▲ / ▼ thật trên mọi thẻ môn sáng lên,
                                        và ngược lại rê vào nút thật thì thẻ hướng dẫn sáng lên. */}
                                        <div
                                            className={`sr-reorder-direction-card sr-reorder-direction-card--up${hoveredMoveDir === "up" ? " sr-reorder-direction-card--active" : ""}`}
                                            onMouseEnter={() => setHoveredMoveDir("up")}
                                            onMouseLeave={() => setHoveredMoveDir((d) => (d === "up" ? null : d))}
                                        >
                                            <div className="sr-direction-icon"><IconChevronUp size={12} /></div>
                                            <div className="sr-direction-info">
                                                <strong>Lùi về kỳ trước</strong>
                                                <p>Đưa môn của kỳ liền sau về kỳ đang học là <strong>học vượt</strong>.</p>
                                                <span className="sr-guide-demo"><MiniCourseTag /><MiniReorderPair /></span>
                                            </div>
                                        </div>

                                        <div
                                            className={`sr-reorder-direction-card sr-reorder-direction-card--down${hoveredMoveDir === "down" ? " sr-reorder-direction-card--active" : ""}`}
                                            onMouseEnter={() => setHoveredMoveDir("down")}
                                            onMouseLeave={() => setHoveredMoveDir((d) => (d === "down" ? null : d))}
                                        >
                                            <div className="sr-direction-icon"><IconChevronDown size={12} /></div>
                                            <div className="sr-direction-info">
                                                <strong>Tiến sang kỳ sau</strong>
                                                <p>Dùng khi bạn <strong>học chậm, tạm hoãn hoặc học lại</strong> môn đó.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="sr-reorder-rules-box">
                                        <div className="sr-rules-box-title"><IconPin /> Quy định khi đổi kỳ:</div>
                                        <ul className="sr-panel-rules-list">
                                            <li><strong>Học vượt:</strong> kỳ 1, 2, 3, 4, 7, 8 — tối đa 2 môn / kỳ (tổng không quá 21 tín chỉ/kỳ), phải xác nhận rủi ro.</li>
                                            <li><strong>Đổi kỳ:</strong> tối đa 2 môn / kỳ, không lùi vào kỳ OJT / Đồ án / dự bị (5, 6, 9).</li>
                                            <li><strong>Học chậm:</strong> dời sang kỳ sau thì không giới hạn.</li>
                                            <li><strong>Tiên quyết:</strong> không dời môn vào kỳ đang có môn tiên quyết chưa hoàn thành của nó.</li>
                                        </ul>
                                    </div>
                                </div>
                            ) : (
                                /* Mỗi thẻ kèm bản sao thu nhỏ của đúng nút / thẻ môn thật.
                                   Rê vào thẻ ➝ thành phần thật trên trang sáng lên (và ngược lại). */
                                <ul className="sr-guide-list">
                                    <li className={`sr-guide-item${guideCls("start")}`} {...guideHintProps("start")}>
                                        <span className="sr-guide-icon sr-guide-icon--indigo"><IconRocket /></span>
                                        <span className="sr-guide-text">
                                            <strong>Bắt đầu</strong>
                                            Chọn ngành học rồi bấm:
                                            <span className="sr-guide-demo"><MiniPersonalizeBtn /></span>
                                        </span>
                                    </li>
                                    <li className={`sr-guide-item${guideCls("detail")}`} {...guideHintProps("detail")}>
                                        <span className="sr-guide-icon sr-guide-icon--sky"><IconCursorClick /></span>
                                        <span className="sr-guide-text">
                                            <strong>Xem chi tiết</strong>
                                            Bấm thẻ môn để mở, bấm ra ngoài để đóng:
                                            <span className="sr-guide-demo"><MiniCourseTag /></span>
                                        </span>
                                    </li>
                                    <li className={`sr-guide-item${guideCls("reorder")}`} {...guideHintProps("reorder")}>
                                        <span className="sr-guide-icon sr-guide-icon--violet"><IconArrowsUpDown /></span>
                                        <span className="sr-guide-text">
                                            <strong>Sắp xếp </strong>
                                            Bật nút này rồi đổi kỳ bằng ▲▼ trên thẻ môn:
                                            <span className="sr-guide-demo">
                                                <MiniFloatingBtn icon={<IconArrowsUpDown size={11} />} label="Sắp xếp" />
                                                <MiniReorderPair />
                                            </span>
                                        </span>
                                    </li>
                                    <li className={`sr-guide-item${guideCls("sync")}`} {...guideHintProps("sync")}>
                                        <span className="sr-guide-icon sr-guide-icon--green"><IconSync /></span>
                                        <span className="sr-guide-text">
                                            <strong>Đồng bộ điểm</strong>
                                            Cập nhật trạng thái theo bảng điểm thật:
                                            <span className="sr-guide-demo">
                                                <MiniFloatingBtn icon={<IconSync size={11} />} label="Đồng bộ điểm" />
                                            </span>
                                        </span>
                                    </li>
                                </ul>
                            )}
                        </div>
                    </aside>

                    <div className="sr-canvas-container" style={{ position: 'relative' }}>
                        <div style={{ padding: showToolbar ? '10px 16px 0' : '10px 16px', borderBottom: showToolbar ? 'none' : '1.5px solid #EEF2F6', background: '#fff', display: 'flex', justifyContent: 'flex-end', flexShrink: 0, gap: '10px' }}>
                            <button
                                onClick={() => setShowToolbar(!showToolbar)}
                                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                                onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                                onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#475569'; }}
                                title={showToolbar ? 'Thu gọn thanh tìm kiếm và bộ lọc' : 'Mở rộng thanh tìm kiếm và bộ lọc'}
                            >
                                <Sliders size={14} /> {showToolbar ? 'Thu gọn công cụ' : 'Mở công cụ'}
                            </button>
                        </div>
                        {showToolbar && (
                            <div className="sr-canvas-toolbar" style={{ borderTop: 'none', paddingTop: 0 }}>
                                <div className="sr-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                    {/* Bật/tắt ngăn hướng dẫn — nằm ngay bên cạnh ô tìm kiếm môn */}
                                    <button
                                        type="button"
                                        className={`sr-guide-toggle${showGuide ? " sr-guide-toggle--on" : ""}`}
                                        onClick={() => setShowGuide((v) => !v)}
                                        title={showGuide ? "Ẩn hướng dẫn" : "Hiện hướng dẫn"}
                                        aria-expanded={showGuide}
                                    >
                                        <IconInfo /> Hướng dẫn
                                    </button>
                                    <div className="sr-search-box">
                                        <IconSearch className="sr-search-icon" />
                                        <input
                                            type="text"
                                            placeholder="Tìm theo mã hoặc tên môn (VD: SE1701, Lập trình)…"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        {searchResults.length > 0 && (
                                            <div className="sr-search-results">
                                                {searchResults.map((c) => (
                                                    <button key={c.code} type="button" className="sr-search-result-item" onClick={() => handleSelectSearchResult(c.code)}>
                                                        <span className="sr-search-result-code">{c.code}</span>
                                                        <span className="sr-search-result-name">{c.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>


                                </div>

                                <div className="sr-toolbar-filters">
                                    <FilterSelect
                                        placeholder="-- Ngành học --"
                                        value={selectedMajor}
                                        options={majors.map((m) => ({ value: m.id, label: m.name }))}
                                        onChange={(val) => {
                                            setSelectedMajor(val);
                                            setMode("original");
                                            setActiveRoadmapId("");
                                            setPersonalRoadmap(null);
                                            setSelectedCode(null);
                                            if (!val) { setSpecializations([]); setSelectedSpec(""); setNarrowSpecs([]); setSelectedNs(""); }
                                        }}
                                        disabled={isReordering}
                                    />

                                    <FilterSelect
                                        placeholder="-- Chuyên ngành --"
                                        value={selectedSpec}
                                        options={specializations.map((s) => ({ value: s.id, label: s.name }))}
                                        onChange={(val) => {
                                            setSelectedSpec(val);
                                            setMode("original");
                                            setActiveRoadmapId("");
                                            setPersonalRoadmap(null);
                                            setSelectedCode(null);
                                            if (!val) { setNarrowSpecs([]); setSelectedNs(""); }
                                        }}
                                        disabled={!selectedMajor || isReordering}
                                    />

                                    <FilterSelect
                                        placeholder="-- Chuyên ngành hẹp --"
                                        value={selectedNs}
                                        options={narrowSpecs.map((n) => ({ value: n.id, label: n.name }))}
                                        onChange={(val) => {
                                            setSelectedNs(val);
                                            setMode("original");
                                            setActiveRoadmapId("");
                                            setPersonalRoadmap(null);
                                            setSelectedCode(null);
                                        }}
                                        disabled={!selectedSpec || isReordering}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="sr-canvas-scroll-area">
                            {(urlParamError || unpublishedNsName) && (
                                <div className="sr-top-overload-banner" style={{ marginBottom: '10px' }}>
                                    <IconAlert />
                                    <div className="sr-overload-text">
                                        {urlParamError && <span>{urlParamError} </span>}
                                        {unpublishedNsName && (
                                            <span>
                                                “{unpublishedNsName}” đã được gỡ công bố nên không còn khung chương trình để hiển thị.
                                                Hãy chọn một chuyên ngành hẹp khác trong bộ lọc phía trên.
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Thông báo chỉ hiển thị 1 nơi duy nhất: toast nổi ở góc phải trên (ProfileFlowToast) */}
                            {mode === "personal" && personalRoadmap && (
                                <div className="sr-canvas-header-bar">
                                    {personalRoadmap && (
                                        <div className="sr-canvas-top-actions" style={{ flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '5px 12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: '600', color: '#1E293B' }}>
                                                <span className="sr-gpa-label"><IconGraduation size={15} /> GPA:</span>
                                                <span style={{ color: gpaStats.gpa ? '#F37021' : '#64748B', fontSize: '14px', fontWeight: '700' }}>
                                                    {gpaStats.gpa ? `${gpaStats.gpa} / 10.0` : 'Chưa có điểm'}
                                                </span>

                                            </div>
                                            <button className={`sr-floating-btn${hl("sync")}`} onClick={handleSyncTranscript} disabled={isReordering} {...uiHintProps("sync")}>
                                                <IconSync /> Đồng bộ điểm
                                            </button>
                                            <button
                                                className={`sr-floating-btn${hl("reorder")}`}
                                                onClick={toggleReordering}
                                                {...uiHintProps("reorder")}
                                            >
                                                <IconArrowsUpDown /> {isReordering ? "Hủy sắp xếp" : "Sắp xếp "}
                                            </button>
                                            <button className="sr-floating-btn sr-floating-btn--danger" onClick={handleDeleteRoadmap} disabled={isReordering}>
                                                <IconTrash /> Xóa lộ trình
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Hoàn tất khi đang sắp xếp — neo góc phải-dưới của khung roadmap */}
                            {isReordering && (
                                <div className="sr-canvas-bottom-actions">
                                    <button className="sr-reorder-save-btn" onClick={handleSaveReorder} disabled={savingReorder}>
                                        <IconCheck /> {savingReorder ? "Đang lưu..." : "Lưu thay đổi"}
                                    </button>
                                    <button className="sr-floating-btn" onClick={handleCancelReorder} disabled={savingReorder}>
                                        <IconX /> Hủy
                                    </button>
                                </div>
                            )}

                            {offscreen.up && (
                                <button className="sr-offscreen-arrow sr-offscreen-arrow--up" onClick={() => scrollToPrereq("up")} title="Môn tiên quyết nằm ở phía trên">
                                    <IconChevronUp /> Môn tiên quyết
                                </button>
                            )}
                            {offscreen.down && (
                                <button className="sr-offscreen-arrow sr-offscreen-arrow--down" onClick={() => scrollToPrereq("down")} title="Môn tiên quyết nằm ở phía dưới">
                                    Môn tiên quyết <IconChevronDown />
                                </button>
                            )}

                            {noRoadmapAtAll ? (
                                <div className="sr-empty-state">
                                    <IconMap className="sr-empty-icon" />
                                    <h3>Bạn chưa có lộ trình cá nhân nào</h3>
                                    <p>Chọn Ngành học / Chuyên ngành / Chuyên ngành hẹp ở trên, sau đó bấm "Cá nhân hóa" để tạo lộ trình riêng.</p>
                                </div>
                            ) : !selectedNs && mode === "original" ? (
                                <div className="sr-empty-state">
                                    <IconMap className="sr-empty-icon" />
                                    <h3>Chưa chọn lộ trình</h3>
                                    <p>Vui lòng chọn Ngành học, Chuyên ngành và Chuyên ngành hẹp ở bộ lọc phía trên để khám phá khung chương trình.</p>
                                </div>
                            ) : loadingRoadmap ? (
                                <div className="sr-empty-state"><div className="sr-spinner-text">Đang tải lộ trình học tập...</div></div>
                            ) : TERMS.length === 0 ? (
                                <div className="sr-empty-state">
                                    <IconInbox className="sr-empty-icon" />
                                    {/* Phân biệt rõ nguyên nhân trục rỗng thay vì 1 message chung (BR-25, DEF_136) */}
                                    <h3>{unpublishedNsName ? "Chuyên ngành hẹp đã được gỡ công bố" : "Chương trình học trống"}</h3>
                                    <p>
                                        {unpublishedNsName
                                            ? `“${unpublishedNsName}” hiện không còn được công bố nên khung chương trình của nó đã bị ẩn. Hãy chọn một chuyên ngành hẹp khác ở bộ lọc phía trên.`
                                            : "Chưa có môn học nào được phân bổ."}
                                    </p>
                                </div>
                            ) : (
                                <div
                                    className="sr-axis-scroller"
                                    ref={scrollerRef}
                                    onClick={handleAxisBackgroundClick}
                                >
                                    <div className="sr-axis-inner" style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
                                        <div className="sr-axis-main" ref={axisInnerRef}>
                                            {finishTop > trunkStart && (
                                                <div className="sr-trunk-tick" style={{ top: `${trunkStart}px`, height: `${finishTop - trunkStart}px` }} />
                                            )}
                                            {finishTop > 0 && (
                                                <div className="sr-finish-marker" style={{ top: `${finishTop}px` }} title="Kết thúc lộ trình"><IconFlag /></div>
                                            )}
                                            {buildRows()}
                                        </div>

                                        {showProgressTrack && (
                                            <div className="sr-axis-progress-col">
                                                {finishTop > trunkStart && (
                                                    <>
                                                        <div className="sr-progress-track" style={{ top: `${trunkStart}px`, height: `${finishTop - trunkStart}px` }} />
                                                        <div
                                                            className="sr-progress-fill"
                                                            style={{ top: `${trunkStart}px`, height: `${Math.round((finishTop - trunkStart) * percentDone / 100)}px` }}
                                                        />
                                                        <div
                                                            className="sr-progress-marker"
                                                            style={{ top: `${trunkStart + Math.round((finishTop - trunkStart) * percentDone / 100)}px` }}
                                                            title={`Tiến độ: ${percentDone}%`}
                                                        >
                                                            <IconGraduation />
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Nút điều khiển Zoom cho Roadmap */}
                        {!noRoadmapAtAll && TERMS.length > 0 && (
                            <div style={{ position: 'absolute', bottom: '24px', left: '24px', display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffffee', border: '1px solid #cbd5e1', padding: '4px 8px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, backdropFilter: 'blur(4px)' }}>
                                <button
                                    onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', color: '#475569', padding: '0 8px' }}
                                    title="Thu nhỏ"
                                >−</button>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', minWidth: '40px', textAlign: 'center' }}>{Math.round(zoomLevel * 100)}%</span>
                                <button
                                    onClick={() => setZoomLevel(z => Math.min(1.5, z + 0.1))}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold', color: '#475569', padding: '0 8px' }}
                                    title="Phóng to"
                                >+</button>
                            </div>
                        )}
                    </div>

                    {/* Lớp nền mờ + ngăn chi tiết trượt vào từ cạnh phải.
                        Cả hai đều neo trong .sr-body nên KHÔNG che sidebar / navbar chung. */}
                    <div
                        className={`sr-drawer-scrim${detailOpen ? " sr-drawer-scrim--open" : ""}`}
                        onClick={closeDetail}
                        aria-hidden="true"
                    />
                    <aside
                        className={`sr-drawer sr-drawer--right${detailOpen ? " sr-drawer--open" : ""}${isResizingDetail ? " sr-drawer--resizing" : ""}`}
                        style={{
                            width: `${detailPanelWidth}px`,
                            maxWidth: 'min(85vw, 1000px)',
                            minWidth: '340px'
                        }}
                        role="dialog"
                        aria-label="Chi tiết môn học"
                    >
                        {/* Thanh kéo thay đổi chiều rộng panel (Antigravity / VSCode style) */}
                        <div
                            className={`sr-drawer-resizer${isResizingDetail ? " sr-drawer-resizer--active" : ""}`}
                            onMouseDown={handleResizeMouseDown}
                            title="Kéo sang trái/phải để thay đổi độ rộng ngăn chi tiết môn học"
                        >
                            <div className="sr-drawer-resizer-line" />
                        </div>

                        {selected && (
                            <>
                                {/* Đầu ngăn: tên môn là tiêu đề lớn, các chip mã môn / kỳ / tín chỉ
                                    xếp thành 1 hàng ngay dưới — đọc được ngay môn nào mà không phải dò. */}
                                <div className="sr-drawer-topbar">
                                    <div className="sr-drawer-title-wrap">
                                        <h2 className="sr-drawer-title">{selected.name}</h2>
                                        <div className="sr-panel-heading">
                                            <span className="sr-panel-code">{selected.code}</span>
                                            <span className="sr-panel-term">Kỳ {selected.term}</span>
                                            <span className="sr-panel-term sr-panel-term--credits">{selected.credits} tín chỉ</span>
                                            {selected.countsTowardGpa === false && (
                                                <span
                                                    className="sr-panel-gpa-pill sr-panel-gpa-pill--no"
                                                    title="Môn học này không tính vào GPA tích lũy"
                                                >
                                                    Không tính GPA
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="sr-drawer-topbar-actions">
                                        {mode === "personal" && (
                                            <button className={`sr-bookmark-btn ${selected.bookmarked ? "active" : ""}`} onClick={handleBookmarkToggle} title={selected.bookmarked ? "Bỏ đánh dấu yêu thích" : "Đánh dấu yêu thích"}><IconStar filled={selected.bookmarked} /></button>
                                        )}
                                        <button className="sr-drawer-close" onClick={closeDetail} aria-label="Đóng chi tiết môn học">
                                            <IconX size={12} /> Đóng
                                        </button>
                                    </div>
                                </div>

                                <div className="sr-drawer-body">
                                    {/* Cảnh báo môn đã bị lược bỏ đặt ngay đầu nội dung — đây là bối cảnh
                                    cần biết trước khi đọc trạng thái / điểm, không nên nằm cuối panel. */}
                                    {selected.isRemovedFromStandard && (
                                        <div className="sr-panel-warning sr-dspan">
                                            <IconAlert /> <strong>Môn này đã bị lược bỏ khỏi chương trình chuẩn mới nhất.</strong> Lộ trình cá nhân của bạn vẫn giữ lại môn này.
                                        </div>
                                    )}

                                    <div className="sr-drawer-grid">
                                        {mode === "personal" && (
                                            <div className="sr-panel-status-section">
                                                <h3 className="sr-panel-section-title sr-sec--indigo"><IconTarget size={15} /> Trạng thái môn học</h3>
                                                <div className="sr-status-selector">
                                                    <button className={`sr-status-option sr-status-option--todo ${(selected.status === "todo" || !selected.status) ? "active" : ""}`} onClick={() => handleStatusChange("todo")}>Chưa học</button>
                                                    <button
                                                        className={`sr-status-option sr-status-option--studying ${selected.status === "studying" ? "active" : ""}`}
                                                        onClick={() => handleStatusChange("studying")}
                                                        disabled={selected.status !== "studying" && !prereqCheck.satisfied}
                                                        title={selected.status !== "studying" && !prereqCheck.satisfied ? `Cần hoàn thành trước: ${prereqCheck.missingCodes.join(", ")}` : undefined}
                                                    >Đang học</button>
                                                    <button
                                                        className={`sr-status-option sr-status-option--done ${selected.status === "done" ? "active" : ""}`}
                                                        onClick={() => handleStatusChange("done")}
                                                        disabled={selected.status !== "done" && !prereqCheck.satisfied}
                                                        title={selected.status !== "done" && !prereqCheck.satisfied ? `Cần hoàn thành trước: ${prereqCheck.missingCodes.join(", ")}` : undefined}
                                                    >Đã học xong</button>
                                                </div>
                                                {!prereqCheck.satisfied && (
                                                    <div className="sr-prereq-warning"><IconAlert /> Chưa thể đánh dấu "Đang học"/"Đã học xong" — cần hoàn thành: <strong>{prereqCheck.missingCodes.join(", ")}</strong></div>
                                                )}
                                            </div>
                                        )}

                                        {mode === "personal" && selected.status === "done" && (
                                            <div className="sr-panel-grade-section">
                                                <label className="sr-status-label sr-sec--green" htmlFor="sr-grade-input"><IconGraduation size={15} /> Điểm môn học</label>
                                                <div className="sr-grade-row">
                                                    <input
                                                        id="sr-grade-input"
                                                        type="number"
                                                        min="0"
                                                        max="10"
                                                        step="0.1"
                                                        className="sr-grade-input"
                                                        value={gradeInputVal}
                                                        placeholder="0 – 10"
                                                        onChange={(e) => setGradeInputVal(e.target.value)}
                                                    />
                                                    <span className="sr-grade-scale">/ 10</span>
                                                    <button
                                                        type="button"
                                                        className="sr-save-grade-btn"
                                                        onClick={handleSaveGrade}
                                                        disabled={savingGrade}
                                                    >
                                                        {savingGrade ? "Đang lưu…" : (<><IconCheck size={13} /> Lưu điểm</>)}
                                                    </button>
                                                </div>
                                                <div className={`sr-gpa-note${selected.countsTowardGpa !== false ? ' sr-gpa-note--counts' : ''}`}>
                                                    {selected.countsTowardGpa !== false
                                                        ? "Môn có tính vào GPA"
                                                        : "Không tính vào GPA (Thể chất / Quốc phòng / môn phụ)"}
                                                </div>
                                            </div>
                                        )}

                                        {/* Số tín chỉ đã hiển thị dạng chip ở đầu panel nên không lặp lại tại đây. */}
                                        <div className="sr-panel-section sr-dspan">
                                            <h3 className="sr-panel-section-title sr-sec--sky"><IconInfo size={15} /> Thông tin môn học</h3>
                                            <dl className="sr-panel-fields">
                                                <div className="sr-panel-field">
                                                    <dt>Môn tiên quyết</dt>
                                                    <dd className="sr-field-tags" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        {selected.prereqGroups && selected.prereqGroups.length > 0 ? (
                                                            selected.prereqGroups.map((group, idx) => (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                                                    {idx > 0 && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>VÀ</span>}
                                                                    {group.map((code, gIdx) => (
                                                                        <Fragment key={code}>
                                                                            {gIdx > 0 && <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>HOẶC</span>}
                                                                            <span className={`sr-prereq-badge ${mode === "personal" && statusByCode[code] === "done" ? "sr-prereq-badge--met" : ""}`}>{code}</span>
                                                                        </Fragment>
                                                                    ))}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <span className="sr-prereq-badge sr-prereq-badge--none">Không có</span>
                                                        )}
                                                    </dd>
                                                </div>
                                                <div className="sr-panel-field">
                                                    <dt>Kỹ năng rèn luyện (Skills)</dt>
                                                    <dd className="sr-field-tags">
                                                        {(() => {
                                                            const selectedIdStr = String(selected.id || '').toLowerCase();
                                                            const selectedCodeStr = String(selected.code || '').toLowerCase();
                                                            // Kỹ năng đã bị CM tắt không được hiện thành tag (DEF_129)
                                                            const rawSkills = specSkills.filter((s) =>
                                                                s.isActive !== false &&
                                                                Array.isArray(s.courseIds) && s.courseIds.some((cid) => {
                                                                    const cidStr = String(cid || '').toLowerCase();
                                                                    return cidStr === selectedIdStr || cidStr === selectedCodeStr;
                                                                })
                                                            );
                                                            const linkedSkills = Array.from(new Map(rawSkills.map((s) => [s.name.trim().toLowerCase(), s])).values());
                                                            if (linkedSkills.length > 0) {
                                                                return linkedSkills.map((s) => (
                                                                    <span key={s.id || s.name} className="sr-prereq-badge sr-prereq-badge--skill">{s.name}</span>
                                                                ));
                                                            }
                                                            return <span className="sr-prereq-badge sr-prereq-badge--none">Chưa có kỹ năng liên kết</span>;
                                                        })()}
                                                    </dd>
                                                </div>
                                                <div className="sr-panel-field sr-panel-field--block">
                                                    <dt>Mô tả</dt>
                                                    <dd>
                                                        {courseDeleted
                                                            ? "Môn học này không còn tồn tại trong hệ thống."
                                                            : <CourseDescriptionText text={selectedCourseDetail?.description || selected?.description || "Chưa có mô tả môn học."} />}
                                                    </dd>
                                                </div>
                                            </dl>
                                        </div>

                                        {mode === "personal" && (
                                            <div className="sr-panel-section">
                                                <h3 className="sr-panel-section-title sr-sec--amber"><IconNote size={15} /> Ghi chú cá nhân</h3>
                                                <textarea className="sr-notes-textarea" placeholder="Nhập ghi chú học tập cho môn học này..." value={notesText} maxLength={NOTE_MAX_LENGTH} onChange={(e) => setNotesText(e.target.value)} />
                                                <div className="sr-notes-counter" style={{ textAlign: 'right', fontSize: '11.5px', color: '#64748B' }}>
                                                    {notesText.length}/{NOTE_MAX_LENGTH}
                                                </div>
                                                <button className="sr-save-notes-btn" onClick={handleSaveNotes}>Lưu ghi chú</button>
                                            </div>
                                        )}

                                        <div className="sr-panel-section">
                                            <h3 className="sr-panel-section-title sr-sec--violet"><IconBookOpen size={15} /> Học liệu gợi ý</h3>
                                            {loadingDetail ? (
                                                <div className="sr-loading-resources">Đang tải học liệu gợi ý...</div>
                                            ) : (
                                                <ul className="sr-resource-list">
                                                    {courseDeleted ? (
                                                        // Môn không còn tồn tại khác hẳn "chưa có tài nguyên" (DEF_135)
                                                        <li className="sr-resource-item-empty">
                                                            Môn học này không còn tồn tại trong hệ thống (đã bị xoá khỏi danh mục),
                                                            nên không đọc được mô tả và học liệu.
                                                        </li>
                                                    ) : selectedCourseDetail?.learningResources?.length > 0 ? (
                                                        selectedCourseDetail.learningResources.map((r) => (
                                                            <li key={r.id || r.url} className="sr-resource-item sr-resource-item--row">
                                                                <a href={r.url ? (r.url.startsWith('http') ? r.url : `https://${r.url}`) : '#'} target="_blank" rel="noopener noreferrer" className="sr-resource-link sr-resource-link--ellipsis">{r.title || r.name}</a>
                                                                <span style={resTypeBadge(r.resourceType || 'LINK')}>{r.resourceType || 'LINK'}</span>
                                                            </li>
                                                        ))
                                                    ) : (
                                                        <li className="sr-resource-item-empty">Chưa có học liệu gợi ý cho môn học này.</li>
                                                    )}
                                                </ul>
                                            )}
                                        </div>

                                        {mode === "personal" && (
                                            <div className="sr-panel-section sr-dspan">
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                    <h3 className="sr-panel-section-title sr-sec--rose" style={{ margin: 0 }}><IconBook size={15} /> Học liệu cá nhân</h3>
                                                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px', background: customResources.filter((r) => r.publicId || r.fileSize || FILE_BASED_RESOURCE_TYPES.has(r.resourceType)).length >= 3 ? '#FEE2E2' : '#F1F5F9', color: customResources.filter((r) => r.publicId || r.fileSize || FILE_BASED_RESOURCE_TYPES.has(r.resourceType)).length >= 3 ? '#DC2626' : '#475569' }}>
                                                        Tệp: {customResources.filter((r) => r.publicId || r.fileSize || FILE_BASED_RESOURCE_TYPES.has(r.resourceType)).length}/3 file (Max 25MB/file)
                                                    </span>
                                                </div>
                                                <ul className="sr-resource-list">
                                                    {customResources.map((r) => (
                                                        <li key={r.id} className="sr-resource-item sr-resource-item--row">
                                                            <a href={r.url ? (r.url.startsWith('http') ? r.url : `https://${r.url}`) : '#'} target="_blank" rel="noopener noreferrer" className="sr-resource-link sr-resource-link--ellipsis sr-resource-link--with-icon">
                                                                <IconBook /> {r.title || r.name} {formatBytes(r.fileSize)}
                                                            </a>
                                                            <span style={resTypeBadge(r.resourceType || 'LINK')}>{r.resourceType || 'LINK'}</span>
                                                            <button className="sr-delete-resource-btn" onClick={() => handleDeleteResource(r.id)} title="Xóa học liệu">×</button>
                                                        </li>
                                                    ))}
                                                    {customResources.length === 0 && <li className="sr-resource-item-empty">Chưa có học liệu cá nhân nào.</li>}
                                                </ul>

                                                <form onSubmit={handleAddResource} className="sr-add-resource-form">
                                                    <div className="sr-add-resource-title sr-sec--rose"><IconPin size={15} /> Thêm tài nguyên mới</div>

                                                    <select
                                                        className="sr-resource-input"
                                                        value={newResource.resourceType}
                                                        onChange={(e) => setNewResource({ title: "", url: "", resourceType: e.target.value, file: null })}
                                                        disabled={submittingResource}
                                                    >
                                                        <option value="">-- Chọn loại tài nguyên --</option>
                                                        {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t === 'FILE' ? 'FILE (Tệp tải lên)' : t}</option>)}
                                                    </select>

                                                    {newResource.resourceType && (
                                                        <>
                                                            <input
                                                                type="text"
                                                                placeholder="Tên tài nguyên (tùy chọn với tệp)..."
                                                                value={newResource.title}
                                                                onChange={(e) => setNewResource((p) => ({ ...p, title: e.target.value }))}
                                                                className="sr-resource-input"
                                                                disabled={submittingResource}
                                                            />

                                                            {FILE_BASED_RESOURCE_TYPES.has(newResource.resourceType) ? (
                                                                <>
                                                                    <div
                                                                        className="sr-file-dropzone"
                                                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                                        onDrop={(e) => {
                                                                            e.preventDefault();
                                                                            e.stopPropagation();
                                                                            if (submittingResource || customResources.filter((r) => r.publicId || r.fileSize || FILE_BASED_RESOURCE_TYPES.has(r.resourceType)).length >= 3) return;
                                                                            const selectedFile = e.dataTransfer.files[0];
                                                                            if (selectedFile) {
                                                                                if (selectedFile.size > 25 * 1024 * 1024) {
                                                                                    showToast("Kích thước tệp vượt quá giới hạn tối đa 25MB.", "error");
                                                                                    return;
                                                                                }
                                                                                setNewResource((p) => ({ ...p, file: selectedFile }));
                                                                            }
                                                                        }}
                                                                        onClick={() => document.getElementById('hidden-file-input').click()}
                                                                        style={{ border: '2px dashed #cbd5e1', borderRadius: '6px', padding: '16px', textAlign: 'center', backgroundColor: '#f8fafc', cursor: 'pointer', marginBottom: '12px' }}
                                                                    >
                                                                        <input
                                                                            id="hidden-file-input"
                                                                            type="file"
                                                                            style={{ display: 'none' }}
                                                                            onChange={(e) => {
                                                                                const selectedFile = e.target.files[0];
                                                                                if (selectedFile) {
                                                                                    if (selectedFile.size > 25 * 1024 * 1024) {
                                                                                        showToast("Kích thước tệp vượt quá giới hạn tối đa 25MB.", "error");
                                                                                        e.target.value = null;
                                                                                        setNewResource((p) => ({ ...p, file: null }));
                                                                                        return;
                                                                                    }
                                                                                    setNewResource((p) => ({ ...p, file: selectedFile }));
                                                                                }
                                                                                e.target.value = null; // Clear input to allow selecting same file again
                                                                            }}
                                                                            disabled={submittingResource || customResources.filter((r) => r.publicId || r.fileSize || FILE_BASED_RESOURCE_TYPES.has(r.resourceType)).length >= 3}
                                                                        />
                                                                        {newResource.file ? (
                                                                            <div>
                                                                                <span
                                                                                    title={newResource.file.name}
                                                                                    style={{
                                                                                        fontWeight: '600',
                                                                                        color: '#334155',
                                                                                        display: 'block',
                                                                                        marginBottom: '4px',
                                                                                        fontSize: '13px'
                                                                                    }}
                                                                                >
                                                                                    📄 {formatShortFileName(newResource.file.name, 5)}
                                                                                </span>
                                                                                <span style={{ fontSize: '12px', color: '#64748b' }}>{(newResource.file.size / 1024).toFixed(1)} KB</span>
                                                                            </div>
                                                                        ) : (
                                                                            <div>
                                                                                <div style={{ color: '#64748b', marginBottom: '4px', fontWeight: '500' }}>Kéo thả tệp vào đây hoặc click để chọn</div>
                                                                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Giới hạn 25MB</div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {customResources.filter((r) => r.publicId || r.fileSize || FILE_BASED_RESOURCE_TYPES.has(r.resourceType)).length >= 3 && (
                                                                        <div style={{ fontSize: '11.5px', color: '#DC2626', marginBottom: '8px', fontWeight: '500' }}>
                                                                            ⚠️ Đã đạt giới hạn tối đa 3 tệp cho môn học này. Vui lòng xóa bớt tệp trước khi tải tệp mới.
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    placeholder="URL liên kết (VD: https://...)"
                                                                    value={newResource.url}
                                                                    onChange={(e) => setNewResource((p) => ({ ...p, url: e.target.value }))}
                                                                    className="sr-resource-input"
                                                                    disabled={submittingResource}
                                                                />
                                                            )}

                                                            <button
                                                                type="submit"
                                                                className="sr-add-resource-btn"
                                                                disabled={submittingResource || (FILE_BASED_RESOURCE_TYPES.has(newResource.resourceType) && customResources.filter((r) => r.publicId || r.fileSize || FILE_BASED_RESOURCE_TYPES.has(r.resourceType)).length >= 3)}
                                                            >
                                                                {submittingResource ? "Đang xử lý tải lên..." : "+ Thêm tài nguyên"}
                                                            </button>
                                                        </>
                                                    )}
                                                </form>
                                            </div>
                                        )}

                                        <div className="sr-panel-report sr-dspan">
                                            <button
                                                type="button"
                                                onClick={() => navigate('/student/content-report', { state: { entityType: 'COURSE', entityId: selected.id, pageLabel: `Môn học: ${selected.name} (${selected.code})` } })}
                                                className="sr-report-btn"
                                            >
                                                <IconAlert /> Báo lỗi nội dung môn học
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </aside>
                </div>
            </div>


            {/* Modal Quy định & Hướng dẫn điều chỉnh kỳ học */}
            {showRulesModal && (
                <div className="sr-modal-overlay" onClick={() => setShowRulesModal(false)}>
                    <div className="sr-modal-content sr-modal-content--wide" onClick={(e) => e.stopPropagation()}>
                        <div className="sr-modal-header">
                            <IconInfo style={{ color: "#4F46E5", width: 22, height: 22 }} />
                            <h3>Quy định & Hướng dẫn điều chỉnh kỳ học</h3>
                            <button type="button" className="sr-panel-close" onClick={() => setShowRulesModal(false)} aria-label="Đóng"><IconX /></button>
                        </div>
                        <div className="sr-modal-body">
                            <ul className="sr-rules-list">
                                <li>
                                    <div className="sr-rules-icon">🚀</div>
                                    <div>
                                        <strong>1. Đăng ký học vượt kỳ</strong>
                                        <p>Áp dụng cho Sinh viên ở các kỳ 1, 2, 3, 4, 7, 8 (không áp dụng các kỳ 5, 6, 9). Sinh viên được chọn học trước các môn thuộc kỳ liền kề tiếp theo. Mỗi kỳ được học vượt tối đa 2 môn (tổng số tín chỉ không được vượt quá 21 tín chỉ) và cần đọc &amp; tích chọn xác nhận rủi ro học phí / môn thay thế. Không đủ điều kiện thì nút ▲ của môn bị làm mờ, rê chuột vào sẽ hiện lý do ngay tại nút.</p>
                                    </div>
                                </li>
                                <li>
                                    <div className="sr-rules-icon">🔄</div>
                                    <div>
                                        <strong>2. Đổi kỳ hiển thị cá nhân</strong>
                                        <p>Được dời môn từ kỳ sau về kỳ liền trước, không giới hạn số môn — kỳ đích chỉ cần không vượt trần {TERM_CREDIT_LIMIT} tín chỉ. Không dời lùi môn vào các kỳ OJT, Đồ án tốt nghiệp hoặc kỳ dự bị (kỳ 5, 6, 9).</p>
                                    </div>
                                </li>
                                <li>
                                    <div className="sr-rules-icon">⏩</div>
                                    <div>
                                        <strong>3. Học chậm kỳ / Học lại</strong>
                                        <p>Bạn có thể tự do dời môn từ kỳ trước sang các kỳ sau để sắp xếp kế hoạch học bù hoặc đăng ký học lại môn phù hợp với bản thân.</p>
                                    </div>
                                </li>
                                <li>
                                    <div className="sr-rules-icon">🧩</div>
                                    <div>
                                        <strong>4. Kỳ Block 5</strong>
                                        <p>Giữa hai kỳ chính liền nhau có thêm một kỳ phụ tên <strong>Block 5</strong> (riêng sau kỳ 6 thì không có). Kỳ này <strong>ban đầu không có môn nào</strong> — nó được dành ra để sinh viên tự đưa môn vào học vượt hoặc học lại, tối đa <strong>{BLOCK5_COURSE_LIMIT} môn / {BLOCK5_CREDIT_LIMIT} tín chỉ</strong>. Dùng nút ▲▼ trên thẻ môn để đưa môn vào hoặc lấy môn ra.</p>
                                    </div>
                                </li>
                                <li>
                                    <div className="sr-rules-icon">⚖️</div>
                                    <div>
                                        <strong>5. Trần số lượng mỗi kỳ</strong>
                                        <p>Một kỳ chính chứa tối đa <strong>{TERM_CREDIT_LIMIT} tín chỉ ({TERM_COURSE_LIMIT} môn)</strong>, một kỳ Block 5 chứa tối đa <strong>{BLOCK5_CREDIT_LIMIT} tín chỉ ({BLOCK5_COURSE_LIMIT} môn)</strong>. Nút dời kỳ sẽ tự mờ khi thao tác làm kỳ đích vượt trần.</p>
                                    </div>
                                </li>
                                <li>
                                    <div className="sr-rules-icon">🔒</div>
                                    <div>
                                        <strong>6. Ràng buộc môn tiên quyết</strong>
                                        <p>Áp dụng cho mọi thao tác dời kỳ ở trên: <strong>mọi môn tiên quyết của môn được dời đều phải đã hoàn thành, hoặc không nằm trong chính kỳ đích</strong> — không được xếp môn tiên quyết và môn cần nó vào học cùng một kỳ. Nếu chính môn tiên quyết đã được bạn dời lên kỳ sớm hơn thì thao tác vẫn hợp lệ, vì hệ thống xét theo thứ tự kỳ trong lộ trình cá nhân của bạn.</p>
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className="sr-modal-footer">
                            <button type="button" className="sr-modal-confirm-btn" onClick={() => setShowRulesModal(false)}>
                                Đã hiểu
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Cảnh báo rủi ro khi học vượt (Rule 1.4) */}
            {showRiskModal && pendingAdvancedMove && (
                <div className="sr-modal-overlay">
                    <div className="sr-modal-content">
                        <div className="sr-modal-header">
                            <IconAlert style={{ color: "#D97706", width: 22, height: 22 }} />
                            <h3>Cảnh báo rủi ro — Đăng ký học vượt kỳ</h3>
                        </div>
                        <div className="sr-modal-body">
                            <p>
                                Bạn đang thực hiện đăng ký <strong>học vượt</strong> cho môn học{" "}
                                <strong>{pendingAdvancedMove.course.code} - {pendingAdvancedMove.course.name}</strong>{" "}
                                (kỳ gốc {pendingAdvancedMove.course.originalTermNo}) lên kỳ hiện tại (Kỳ {pendingAdvancedMove.targetTerm}).
                            </p>
                            <div className="sr-risk-box">
                                <strong>⚠️ CẢNH BÁO QUAN TRỌNG VỀ CHƯƠNG TRÌNH & HỌC PHÍ:</strong>
                                <p>
                                    Nếu chương trình đào tạo của ngành/chuyên ngành có sự thay đổi và môn học vượt này bị thay thế hoặc điều chỉnh nội dung, bạn sẽ phải tự đăng ký học bổ sung môn học thay thế và chịu hoàn toàn chi phí học phí phát sinh cho môn thay thế đó.
                                </p>
                            </div>
                            <label className="sr-risk-checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={riskAcknowledged}
                                    onChange={(e) => setRiskAcknowledged(e.target.checked)}
                                />
                                <span>Tôi đã đọc, hiểu rõ và chấp nhận rủi ro thay đổi chương trình đào tạo & học phí nêu trên.</span>
                            </label>
                        </div>
                        <div className="sr-modal-footer">
                            <button
                                type="button"
                                className="sr-modal-cancel-btn"
                                onClick={() => { setShowRiskModal(false); setPendingAdvancedMove(null); }}
                                disabled={submittingAdvanced}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                className="sr-modal-confirm-btn"
                                onClick={handleConfirmAdvancedMove}
                                disabled={!riskAcknowledged || submittingAdvanced}
                            >
                                {submittingAdvanced ? "Đang xử lý..." : "Xác nhận học vượt"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Đổi tên lộ trình cá nhân */}
            {showRenameModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.55)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        padding: '20px'
                    }}
                >
                    <form
                        onSubmit={confirmRenameRoadmap}
                        style={{
                            background: '#FFFFFF',
                            borderRadius: '16px',
                            padding: '26px',
                            maxWidth: '460px',
                            width: '100%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            fontFamily: "'Be Vietnam Pro', sans-serif"
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#4F46E5' }}>
                                <IconPencil size={20} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                                Đổi tên lộ trình cá nhân
                            </h3>
                        </div>
                        <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: 1.5 }}>
                            Nhập tên mới cho lộ trình cá nhân của bạn bên dưới:
                        </p>
                        <div>
                            <input
                                type="text"
                                value={renameInputVal}
                                onChange={(e) => setRenameInputVal(e.target.value)}
                                placeholder="Tên lộ trình (VD: Lộ trình SE2026)..."
                                maxLength={100}
                                autoFocus
                                style={{
                                    width: '100%',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: '1.5px solid #CBD5E1',
                                    fontSize: '14px',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                }}
                                onFocus={(e) => e.target.style.borderColor = '#4F46E5'}
                                onBlur={(e) => e.target.style.borderColor = '#CBD5E1'}
                            />
                            <div style={{ fontSize: '11.5px', color: '#94A3B8', textAlign: 'right', marginTop: '4px' }}>
                                {renameInputVal.length}/100 ký tự
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                            <button
                                type="button"
                                onClick={() => setShowRenameModal(false)}
                                disabled={savingRename}
                                style={{
                                    padding: '9px 18px',
                                    borderRadius: '8px',
                                    border: '1px solid #CBD5E1',
                                    background: '#FFFFFF',
                                    color: '#334155',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="submit"
                                disabled={savingRename || !renameInputVal.trim()}
                                style={{
                                    padding: '9px 18px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: savingRename || !renameInputVal.trim() ? '#94A3B8' : 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)',
                                    color: '#FFFFFF',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    cursor: savingRename || !renameInputVal.trim() ? 'not-allowed' : 'pointer',
                                    boxShadow: savingRename || !renameInputVal.trim() ? 'none' : '0 4px 12px rgba(79, 70, 229, 0.25)'
                                }}
                            >
                                {savingRename ? "Đang lưu..." : "Lưu thay đổi"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Modal Xác nhận xóa lộ trình cá nhân */}
            {showDeleteConfirmModal && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.55)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10000,
                        padding: '20px'
                    }}
                >
                    <div
                        style={{
                            background: '#FFFFFF',
                            borderRadius: '16px',
                            padding: '26px',
                            maxWidth: '460px',
                            width: '100%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                            fontFamily: "'Be Vietnam Pro', sans-serif"
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AlertTriangle color="#EF4444" size={24} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0F172A' }}>
                                Xác nhận xóa lộ trình cá nhân
                            </h3>
                        </div>
                        <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', lineHeight: 1.6 }}>
                            Bạn có chắc chắn muốn xóa lộ trình <strong>"{personalRoadmap?.name}"</strong>? Hành động này sẽ xóa toàn bộ tiến độ, ghi chú và tùy chỉnh của lộ trình này và <strong>không thể hoàn tác</strong>.
                        </p>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                            <button
                                type="button"
                                onClick={() => setShowDeleteConfirmModal(false)}
                                style={{
                                    padding: '9px 18px',
                                    borderRadius: '8px',
                                    border: '1px solid #CBD5E1',
                                    background: '#FFFFFF',
                                    color: '#334155',
                                    fontWeight: 600,
                                    fontSize: '13px',
                                    cursor: 'pointer'
                                }}
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteRoadmap}
                                style={{
                                    padding: '9px 18px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
                                    color: '#FFFFFF',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
                                }}
                            >
                                Xác nhận xóa
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
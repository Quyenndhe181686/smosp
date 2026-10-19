import { useEffect, useMemo, useState } from 'react'
import {
    getStudentProfile,
    getLatestTranscript,
    getDeclaredSkills,
    getDeclaredInterests,
    getMyGrades
} from '../../services/studentService'

/**
 * Thứ tự khai báo hồ sơ sinh viên:
 *   Thông tin cá nhân ➔ Bảng điểm ➔ Kỹ năng ➔ Sở thích
 *
 * Mỗi bước có một màu nhấn riêng, dùng xuyên suốt cả 4 trang để người dùng
 * luôn biết mình đang đứng ở đâu trong luồng.
 */
export const PROFILE_STEPS = [
    {
        key: 'personalInfo',
        order: 1,
        label: 'Thông tin cá nhân',
        short: 'Cá nhân',
        path: '/student/profile',
        accent: 'indigo',
        hint: 'Họ tên, ngành, chuyên ngành và kỳ học hiện tại'
    },
    {
        key: 'transcript',
        order: 2,
        label: 'Bảng điểm',
        short: 'Bảng điểm',
        path: '/student/profile/transcript',
        accent: 'orange',
        hint: 'Tải bảng điểm để hệ thống tính GPA và môn đã hoàn thành'
    },
    {
        key: 'skills',
        order: 3,
        label: 'Kỹ năng',
        short: 'Kỹ năng',
        path: '/student/profile/skills',
        accent: 'teal',
        hint: 'Chọn kỹ năng bạn đã có — có gợi ý sẵn từ bảng điểm'
    },
    {
        key: 'interests',
        order: 4,
        label: 'Sở thích',
        short: 'Sở thích',
        path: '/student/profile/interests',
        accent: 'pink',
        hint: 'Chọn sở thích nghề nghiệp để tinh chỉnh kết quả gợi ý'
    }
]

const EMPTY_COMPLETION = {
    personalInfo: false,
    transcript: false,
    skills: false,
    interests: false
}

/* ── Cache dùng chung cho mọi trang trong luồng ────────────────────────────
   Nhiều component cùng gọi useProfileFlow() nhưng chỉ gọi API 1 lần; sau khi
   một trang lưu dữ liệu thì gọi refreshProfileFlow() để cập nhật lại stepper. */
let cache = null
let inflight = null
const listeners = new Set()

function toList(value) {
    if (!value) return []
    if (Array.isArray(value)) return value
    if (typeof value === 'object') {
        if (Array.isArray(value.skills)) return value.skills
        if (Array.isArray(value.interests)) return value.interests
        if (Array.isArray(value.grades)) return value.grades
        if (Array.isArray(value.items)) return value.items
        if (Array.isArray(value.data)) return value.data
    }
    return []
}

function settled(result) {
    return result.status === 'fulfilled' ? result.value : null
}

function isMissingData(result) {
    return result.status === 'rejected' && result?.reason?.response?.status === 404;
}

function hasLoadFailed(result) {
    return result.status === 'rejected' && !isMissingData(result);
}

async function loadCompletion() {
    const results = await Promise.allSettled([
        getStudentProfile(),
        getLatestTranscript(),
        getMyGrades(),
        getDeclaredSkills(),
        getDeclaredInterests()
    ])

    const profile = settled(results[0])
    const latestTranscript = settled(results[1])
    const grades = toList(settled(results[2]))
    const skills = toList(settled(results[3]))
    const interests = toList(settled(results[4]))

    const hasTranscript = !!(
        latestTranscript?.id ||
        latestTranscript?.fileUrl ||
        (latestTranscript?.fileName && String(latestTranscript.fileName).trim() !== '') ||
        (Array.isArray(latestTranscript?.grades) && latestTranscript.grades.length > 0) ||
        grades.length > 0
    )
    const hasSkills = skills.length > 0
    const hasInterests = interests.length > 0

    return {
        // FDS ĐK6 yêu cầu đủ 4 thành phần: Họ tên + Ngành + Chuyên ngành + Kỳ học (DEF_109)
        personalInfo: !!(
            profile?.fullName && String(profile.fullName).trim() !== '' &&
            profile?.majorId && profile?.specializationId &&
            profile?.currentTerm != null
        ),
        transcript: hasTranscript,
        skills: hasSkills,
        interests: hasInterests,
        profile: profile || null,
        skillsCount: skills.length,
        interestsCount: interests.length,
        transcriptCount: grades.length,
        loadFailed: {
            skills: hasLoadFailed(results[3]),
            interests: hasLoadFailed(results[4]),
            transcript: hasLoadFailed(results[1]) && hasLoadFailed(results[2])
        }
    }
}

function publish(next) {
    cache = next
    listeners.forEach((listener) => listener(next))
}

export function fetchProfileFlow({ force = false } = {}) {
    if (!force && cache) return Promise.resolve(cache)
    if (inflight) return inflight

    inflight = loadCompletion()
        .then((next) => {
            publish(next)
            return next
        })
        .catch((err) => {
            console.error('Failed to load profile flow completion:', err)
            return cache || { ...EMPTY_COMPLETION, profile: null }
        })
        .finally(() => {
            inflight = null
        })

    return inflight
}

/** Gọi sau khi một bước vừa được lưu để stepper cập nhật ngay. */
export function refreshProfileFlow() {
    return fetchProfileFlow({ force: true })
}

/** Reset cache, dùng khi đăng xuất để tránh dính data của user cũ sang user mới */
export function clearProfileFlowCache() {
    cache = null
    inflight = null
    listeners.forEach((listener) => listener(null))
}

/**
 * @param {string} currentKey khóa bước đang đứng ('personalInfo' | 'transcript' | 'skills' | 'interests')
 */
export function useProfileFlow(currentKey) {
    const [completion, setCompletion] = useState(cache)

    useEffect(() => {
        listeners.add(setCompletion)
        fetchProfileFlow()
        return () => {
            listeners.delete(setCompletion)
        }
    }, [])

    return useMemo(() => {
        const state = completion || { ...EMPTY_COMPLETION, profile: null }
        const currentIndex = PROFILE_STEPS.findIndex((s) => s.key === currentKey)

        const steps = PROFILE_STEPS.map((step, idx) => {
            const done = !!state[step.key]
            // Bước bị "khóa mềm": bước trước đó chưa xong. Vẫn bấm vào được,
            // nhưng hiện rõ là nên quay lại hoàn tất bước trước cho đủ dữ liệu.
            const prevDone = idx === 0 ? true : !!state[PROFILE_STEPS[idx - 1].key]
            return {
                ...step,
                done,
                locked: !done && !prevDone,
                current: idx === currentIndex
            }
        })

        const doneCount = steps.filter((s) => s.done).length
        const firstTodo = steps.find((s) => !s.done) || null

        return {
            steps,
            completion: state,
            profile: state.profile,
            loading: completion === null,
            currentIndex,
            currentStep: currentIndex >= 0 ? steps[currentIndex] : null,
            prevStep: currentIndex > 0 ? steps[currentIndex - 1] : null,
            nextStep: currentIndex >= 0 && currentIndex < steps.length - 1 ? steps[currentIndex + 1] : null,
            firstTodo,
            doneCount,
            totalSteps: steps.length,
            percent: Math.round((doneCount / steps.length) * 100),
            allDone: doneCount === steps.length
        }
    }, [completion, currentKey])
}

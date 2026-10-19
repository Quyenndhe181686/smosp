# SMOSP — Claude Code Context
> SEP490_GR47 | FPT University Hanoi | Last updated: 22/06/2026

---

## 1. PROJECT IDENTITY

| Field | Value |
|-------|-------|
| Full name | A Student Major Orientation Support Platform Based on the Analysis of Personal Profiles and Recruitment Data |
| Short name | SMOSP |
| Group | SEP490_GR47 |
| Supervisor | Tạ Đình Tiến — tientd17@fpt.edu.vn |
| Package root | `com.sep490_g47.smosp` |
| DB name | `smosp` |
| Email (SMTP) | `sep490gr47@gmail.com` via Gmail App Password |

---

## 2. TEAM

| Member | Role | Owned Areas |
|--------|------|-------------|
| BaoTQ | Tech Lead / Full-Stack | Architecture, BE lead, FE-06 (recommendation), FE-14 (crawler/TW) |
| DieuVQ | BA / PM | Requirements, documentation |
| QuyenND | D1 Full-Stack | Auth, student profile, recommendation |
| GiangVT | D2 Frontend Lead | UI components, screens |
| HuyenLTT | QA / Dev | Crawler scheduler, system config (Iter 3) |

---

## 3. TECH STACK

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Java 17, Spring Boot 3.2.x, Maven | Modular Monolith (10 modules) |
| Auth | jjwt 0.12.6, Google OAuth 2.0 | JWT access + refresh tokens |
| API Docs | springdoc-openapi **v2.8.9+** | ⚠️ v2.3.0 breaks on Spring Boot 3.5.x (`NoSuchMethodError`) |
| ORM | JPA/Hibernate + MapStruct | |
| DB | PostgreSQL 17.10 | |
| File Storage | Firebase Storage | |
| Push Notification | Firebase FCM | |
| AI | Gemini (default, swappable per LI-03) | utility only — normalize + NL explain |
| Frontend | React JS 19.2.6, ESLint | |
| Testing | JUnit 5, Mockito, MockMvc, JaCoCo ≥70%, Jest, Playwright (E2E) | |
| Quality | Checkstyle (Java), ESLint (React) | |
| Deploy | Vercel (FE) + Docker (BE) | |
| IDE | IntelliJ IDEA | |
| Diagramming | dbdiagram.io (DBML), draw.io, StarUML | |

---

## 4. MODULE STRUCTURE

```
com.sep490_g47.smosp
├── auth              ← FE-01: JWT, Google OAuth, register/login/reset ✅ DONE
├── account           ← FE-04: /api/me, preferences, FCM token, notifications 🔄 IN PROGRESS
├── student-profile   ← FE-05: profile, transcript parse, skills, interests
├── recommendation    ← FE-06: Compatibility Score (Hierarchical WSM engine)
├── catalog           ← FE-02, FE-13: Major/Spec/NS browse + CM management
├── roadmap           ← FE-07: Standard + Personal Roadmap, bookmarks, notes
├── configuration     ← FE-10–11: Skill/interest/tag-map/question-bank config
├── content-manager   ← FE-14: Crawler execution + Trending Weight approval
├── admin             ← FE-15–16: User management + system config
└── crawler           ← Background: VietnamWorks adapter + Gemini AI normalize pipeline
```

---

## 5. BRANCHING & COMMIT STRATEGY

```
main          ← production-ready, always stable
develop       ← integration branch (target for PRs)
feature/xxx   ← new features (from develop)
fix/xxx       ← bug fixes (from develop)
hotfix/xxx    ← critical fixes (from main)
```

**Commit format (Conventional Commits):**
```
type(scope): short description

Types: feat | fix | docs | refactor | test | chore
Example: feat(auth): add Google OAuth login
```

**PR rules:**
- Standard features → 1 reviewer, merge within 24h
- **High-risk** FE-06, FE-08, FE-14 → **2 reviewers required**
- Merge strategy: squash & merge
- Delete branch after merge
- Self-merge: strictly prohibited

---

## 6. CODING CONVENTIONS

- **Error messages:** English (code-level, logs, exceptions)
- **UI messages:** Vietnamese
- **No hardcoded credentials or secrets in source code**
- **No N+1 queries** (reviewers verify)
- Test coverage: JaCoCo ≥ 70% for business logic classes

---

## 7. ITERATION PLAN

| Iter | Weeks | FE Targets |
|------|-------|------------|
| Iter 1 | W6–7 | FE-01 ✅, FE-05, FE-03, FE-15, FE-11, FE-13 |
| Iter 2 | W8–9 | FE-02, FE-06, FE-07, FE-09, FE-10, FE-12 |
| Iter 3 | W10–11 | FE-08, FE-14, FE-16 + background jobs |

---

## 8. CURRENT CODING STATUS

### ✅ Auth Module — COMPLETE (branch: `feature/auth-module`, merged to `develop`)

Tất cả 10 endpoints đã done:

| # | Method | Endpoint | Notes |
|---|--------|----------|-------|
| 1 | POST | `/api/auth/register` | Tạo tài khoản inactive, gửi activation link |
| 2 | POST | `/api/auth/verify-email` | Kích hoạt qua **LINK** — token ở query param (BV-03: ≤24h) |
| 3 | POST | `/api/auth/verify-email/resend` | Gửi lại link mới, vô hiệu link cũ. Body: `{email}` |
| 4 | POST | `/api/auth/login` | Student dùng email; CM/Admin dùng username |
| 5 | POST | `/api/auth/google` | Google OAuth — chỉ tạo Student account |
| 6 | POST | `/api/auth/logout` | Invalidate refresh token |
| 7 | POST | `/api/auth/refresh` | Issue new access token — **Option B: DB-stored UUID refresh token** (SRS-compliant, AC-01-04) |
| 8 | POST | `/api/auth/password/forgot` | Gửi reset link qua email (BV-04: ≤60min) |
| 9 | POST | `/api/auth/password/reset` | Apply new password via token |
| 10 | PUT | `/api/auth/password/change` | Đổi password khi đã login (~60% done) |

**Email verify dùng LINK** (token ở query param), không phải 6-digit code.
`EmailVerificationToken.token` = UUID string, check bằng `.equals()`.

Entities done: `Role`, `UserAccount`, `OauthIdentity`, `EmailVerificationToken`, `PasswordResetToken`

### 🔄 Account & Notification Module — IN PROGRESS (current sprint, QuyenND)

| # | Method | Endpoint | UC | Status |
|---|--------|----------|----|--------|
| 11 | GET | `/api/me` | UC-09 | Doing |
| 12 | PUT | `/api/me/preferences` | UC-09 | Doing |
| 12.1 | POST | `/api/me/fcm-token` | — | To Do |
| 13 | GET | `/api/notifications` | UC-10 | Doing |
| 14 | PATCH | `/api/notifications/{id}/read` | UC-10 | Doing |
| 15 | PATCH | `/api/notifications/read-all` | UC-10 | Doing |
| 16 | POST | `/api/content-error-reports` | UC-30 | Doing |
| 17 | GET | `/api/content-error-reports` | UC-84 (CM) | Doing |
| 18 | PATCH | `/api/content-error-reports/{id}/status` | UC-87 (CM) | Doing |

**Next:** Commit → PR → merge → begin Catalog module

---

## 9. CORE ARCHITECTURAL DECISIONS ⚠️ DO NOT CHANGE

### Recommendation Algorithm (FE-06 / FT-18–19) — Hierarchical WSM 2 tầng

```
Tầng 1 — Profile Score:
  Profile_Score = W_gpa × S_gpa + W_skill × S_skill + W_int × S_int
                  (W_gpa + W_skill + W_int = 1.0, CM-configured per NS)
  Default: W_gpa=0.40, W_skill=0.35, W_int=0.25

Tầng 2 — Final Score:
  Final_Score = α_actual × Profile_Score + (1 − α_actual) × Trending_Weight
```

**α_base by discipline group (CM-configured per NS, stored in `narrow_spec_weight_config`):**
| Group | α_base |
|-------|--------|
| IT (SE, AI, IS) | 0.70 |
| Business/Marketing | 0.75 |
| Languages | 0.85 |
| Law | 0.90 |
| Digital Art | 0.95 |

**Auto-fallback (when job data is sparse):**
```
S_vol ≥ 100       → α_actual = α_base
0 < S_vol < 100   → α_actual = 1.0 − (S_vol / 100) × (1 − α_base)
S_vol = 0         → α_actual = 1.0  (ignore market signal entirely — BR-27)
```
When α_actual ≠ α_base → mandatory explainability text in output (BR-27).

**Scope:** tính cho tất cả NS published trong **Specialization** của Student (NAC-18-02).
**NOT 70/30 hardcode** — α động theo nhóm ngành.

### Trending Weight (sole market concept)
```
TW = 0.5×Sacc + 0.3×Svol + 0.2×Junior_ratio    (0–100 scale, cấp NS)
```
- Sacc = growth rate (compare 2 crawl cycles)
- Svol = normalized job volume (min-max to [0,1])
- Junior_ratio = ratio of Intern/Fresher/Entry jobs
- Defined at **Narrow Specialization level** (NOT skill level)
- Terms "Market Weight" / "Market Trend Score" are **retired** — do not use

### Gemini AI (utility only, NOT scoring)
- Role 1: batch-normalize raw crawl data (50 jobs/call)
- Role 2: generate NL explanation for top-1 recommendation result (lazy — others on-demand)
- Provider-swappable per LI-03 via FE-16 (Admin System Config)
- AI failure = fallback placeholder, never blocks Compatibility Score display (BR-48, BV-47: 10s timeout)

### Crawler (Adapter Pattern)
- VietnamWorks only in v1.0 (EX-04)
- API: `POST https://ms.vietnamworks.com/job-search/v1.0/search`
- New sources added via new adapters — no core engine changes
- Executor: **Content Manager** (NOT Admin). Admin chỉ config lịch + enable/disable adapter.

### Holland Assessment (FE-08)
- ONLY activated when student considers **broad major transfer** (e.g., SE → AI)
- NOT part of narrow specialization recommendation algorithm
- MBTI deferred to FE-18 (advanced / stretch goal)

### Tag Map
- CM-configured: links `skill/interest → narrow_spec` per Specialization
- Mandatory input for recommendation engine
- Skill & Interest scoped per **Specialization** (`skill.specialization_id`, `interest_option.specialization_id`)
- Cross-specialization mapping: **prohibited** (và do đó cross-major cũng không được)
- CM chọn Major → rồi mới chọn Specialization để cấu hình

### Background Job Pipeline (BR-41 — ATOMIC)
```
JOB-01 (Crawl, cron/manual)
  → JOB-02 (AI Normalize, Gemini batch-50)
    → JOB-03 (TW Calculation → creates trending_weight_proposal)
      → JOB-04 (Notification dispatch to CM)
JOB-05: Gemini API Token Quota Monitor (daily)
```
Atomic all-or-nothing: failure ở bất kỳ step nào → discard entire batch, không partial save.

---

## 10. ACTORS

| Actor | Login | Key Responsibilities |
|-------|-------|---------------------|
| Student | email+password form **hoặc** Google OAuth | Profile, transcript, recommendation, roadmap, Holland (transfer only) |
| Content Manager | username + password (seeded, no self-register) | Catalog, skills, tag map, question bank, curriculum, crawler execute, TW approval |
| Admin | username + password (seeded, no self-register) | User management, crawl schedule config, AI API config, transcript mapping preset, tuition config |
| Guest | None | Browse catalog (public, no login required) |

**Login identifier:**
- Student → `email`
- CM/Admin → `username` (NAC-03-05: email KHÔNG được dùng cho CM/Admin)
- CM/Admin forgot password → Admin-mediated reset thủ công (BR-43), không có self-service email flow

---

## 11. CONTEXT FILES (docs/ folder)

Load khi cần — không cần đọc hết mỗi lần:

| File | Đọc khi nào |
|------|------------|
| `docs/ERD.md` | Viết entity, repository, migration, query |
| `docs/API.md` | Viết controller, service, DTO mới |
| `docs/BR_BV_DC.md` | Viết validation logic, business rules |
| `docs/UC.md` | Hiểu luồng nghiệp vụ của 1 feature cụ thể |
| `docs/AC_NAC.md` | Viết test cases, kiểm tra acceptance criteria |

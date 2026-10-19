# SMOSP — Student Major Orientation Support Platform

A web-based platform helping university students — initially focused on FPT University Hanoi — make informed specialization decisions. Recommends narrow specializations based on declared skills, interests, academic transcripts, and Vietnamese recruitment market data.

*A Student Major Orientation Support Platform Based on the Analysis of Personal Profiles and Recruitment Data*

**SEP490 — Group G47 | FPT University Hanoi**

Supervisor: Tạ Đình Tiến

Status: Iteration 1 (Week 6–7)

---

## Tech Stack

| Category | Tools |
|---|---|
| Technology | React JS 19.2.6, Java / Spring Boot 3.2.x, Python (AI Integration) |
| Database | PostgreSQL 17.10 |
| Authentication | Spring Security, JWT, Firebase |
| AI Integration | Gemini API |
| IDEs / Editors | IntelliJ IDEA 2026.1.2 (Backend), VSCode (Frontend) |
| Diagramming | draw.io, XMind |
| Documentation | Google Docs / Sheets / Slides |
| Version Control | GitHub (source code), Google Drive (documents) |
| Deployment | Vercel (Frontend), Railway (Backend + DB) |
| Project Management | Task Management Excel + GitHub Issues |
| Quality / Linting | Checkstyle (Java), ESLint (React), JaCoCo (Java), Jest (JS) |
| Testing | JUnit 5, Mockito, MockMvc, Playwright (E2E) |
| File Uploads | Cloudinary |

---

## Project Structure

```
sep490-g47-smosp/
├── frontend/
│   ├── src/
│   │   ├── asset/
│   │   ├── components/
│   │   ├── config/
│   │   ├── pages/
│   │   ├── routes/
│   │   └── services/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/sep490_g47/smosp/
│   │   │   └── resources/
│   │   └── test/java/com/sep490_g47/
│   ├── docs/
│   ├── pom.xml
│   └── .env.example
├── .gitignore
└── README.md
```

---

## Getting Started (Local)

### Backend

```bash
cd backend
cp .env.example .env
# Fill in: DB credentials, JWT secret, Cloudinary, Gemini API key
./mvnw spring-boot:run
# Runs on http://localhost:8080
# Swagger UI: http://localhost:8080/swagger-ui.html
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
# Set VITE_API_URL=http://localhost:8080
npm run dev
# Runs on http://localhost:5173
```

Both services must run simultaneously. Never commit `.env` or `application.yml` — they are gitignored.

---

## Features

### Iteration 1 (Weeks 6–7) — Foundation + Profile + Content Setup
- FE-01 Authentication — register, login, Google OAuth, email verify, password reset
- FE-03 Notifications & Alerts
- FE-05 Personal Profile Management — transcript upload, skill/interest declaration
- FE-11 Assessment Question Bank Management (CM)
- FE-13 Specialization Catalog Management (CM)
- FE-15 User/Role Management (Admin)

### Iteration 2 (Weeks 8–9) — Recommendation + Roadmap + Transfer
- FE-02 Specialization Catalog — public 3-level browse
- FE-06 Narrow Specialization Recommendation — WSM scoring + Gemini explanation
- FE-07 Academic Roadmap — curriculum by semester, personal roadmap
- FE-09 Transfer Impact Analysis
- FE-10 Skill & Interest Configuration — tag map (CM)
- FE-12 Curriculum & Learning Resource Management (CM)

### Iteration 3 (Weeks 10–11) — Assessment + Crawler + System Config
- FE-08 Holland Orientation Assessment
- FE-14 Recruitment Data & Weight Management — VietnamWorks crawler (CM)
- FE-16 System Configuration (Admin)

---

## Branching Strategy

```
main        stable releases only — tagged at each version
dev         active integration branch — all features merge here
feature/*   one branch per module (e.g. feature/auth-be, feature/auth-fe)
fix/*       bug fixes during development
hotfix/*    urgent fixes applied directly to main
```

**Version tags:**

| Tag | Milestone | Week |
|---|---|---|
| v0.1.0 | Iteration 1 complete | 7-8 |
| v0.2.0 | Iteration 2 complete | 9-10 |
| v0.3.0 | Iteration 3 complete | 11-12 |
| v1.0.0 | Final release after UAT | 13-14 |

---

## Team

| Name | Role |
|---|---|
| Trần Quốc Bảo (BaoTQ) | Leader / PM / Backend Support |
| Nguyễn Đức Quyền (QuyenND) | Backend Lead |
| Vũ Trường Giang (GiangVT) | Frontend Lead |
| Vũ Quang Diệu (DieuVQ) | Test Lead / Business Analyst |
| Lê Thị Thanh Huyền (HuyenLTT) | Documentation Lead |

---

## Timeline

| Phase | Weeks | Key Deliverables |
|---|---|---|
| Planning & Design | 1–5 | Vision & Scope, PRD, TDS, FDS, Test Plan |
| Iteration 1 | 6–7 | Auth, Profile, Catalog setup — v0.1.0 |
| Iteration 2 | 8–9 | Recommendation, Roadmap, Transfer — v0.2.0 |
| Iteration 3 | 10–11 | Holland, Crawler, System Config — v0.3.0 |
| V&V | 12–13 | System test, E2E, UAT, Deployment Guide |
| Closing | 14 | Final Report, Presentation |

---

## License

MIT

import { Routes, Route, Navigate } from "react-router-dom";

import Homepage from "../pages/Homepage";
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import ForgotPasswordPage from "../pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "../pages/auth/ResetPasswordPage";
import VerifyEmailPage from "../pages/auth/VerifyEmailPage";
import AccountPage from "../pages/auth/AccountPage";
import ChangePasswordPage from "../pages/auth/ChangePasswordPage";
import AdminDashboard from "../pages/admin/AdminDashboard";
import TranscriptPresetsPage from "../pages/admin/TranscriptPresetsPage";
import CmAccountsPage from "../pages/admin/CmAccountsPage";
import StudentAccountsPage from "../pages/admin/StudentAccountsPage";
import DataCrawlerConfigPage from "../pages/admin/DataCrawlerConfigPage";
import AdminReportsPage from "../pages/admin/AdminReportsPage";
import CmDashboard from "../pages/cm/CmDashboard";
import CmCatalogPage from "../pages/cm/CmCatalogPage";
import CmCoursePage from "../pages/cm/CmCoursePage";
import CmCurriculumPage from "../pages/cm/CmCurriculumPage";
import CmSkillsPage from "../pages/cm/CmSkillsPage";
import CmInterestsPage from "../pages/cm/CmInterestsPage";
import CmTagMapPage from "../pages/cm/CmTagmapPage";
import CmErrorReportPage from "../pages/cm/CmErrorReportPage";
import TrendingWeightPage from "../pages/cm/TrendingWeightPage";
import TrendingWeightHistoryPage from "../pages/cm/TrendingWeightHistoryPage";
import CmCompatibilityWeightPage from "../pages/cm/CmCompatibilityWeightPage";
import StudentDashboard from "../pages/student/StudentDashboard";
import ProfileCheckPage from "../pages/student/ProfileCheckPage";
import RecommendationResultPage from "../pages/student/RecommendationResultPage";
import RecommendationDetail from "../pages/student/RecommendationDetail";
// MỚI: gộp AcademicRoadmap (Gốc) + PersonalRoadmap (Cá nhân hóa) thành 1 trang duy nhất
import StudentRoadmap from "../pages/student/StudentRoadmap";
import PersonalInfoPage from "../pages/student/PersonalInfoPage";
import DeclareSkillsPage from "../pages/student/DeclareSkillsPage";
import DeclareInterestsPage from "../pages/student/DeclareInterestsPage";
import TranscriptUploadPage from "../pages/student/TranscriptUploadPage";
import SubmitErrorReportPage from "../pages/student/SubmitErrorReportPage";
import MyReportsPage from "../pages/student/MyReportsPage";
import MajorCatalog from "../pages/guest/Majorcatalog";
import MajorDetailPage from "../pages/guest/MajorDetailPage";
import SpecDetailPage from "../pages/guest/SpecDetailPage";
import NarrowSpecDetailPage from "../pages/guest/NarrowSpecDetailPage";
import NotFoundPage from "../pages/NotFoundPage";
import ProtectedRoute from "./ProtectedRoute";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/settings/account" element={<ProtectedRoute><AccountPage /></ProtectedRoute>} />
      <Route path="/settings/password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/settings" element={<Navigate to="/settings/account" replace />} />
      <Route path="/major-catalog" element={<MajorCatalog />} />
      <Route path="/catalog" element={<MajorCatalog />} />
      <Route path="/catalog/majors/:majorId" element={<MajorDetailPage />} />
      <Route path="/catalog/specializations/:specId" element={<SpecDetailPage />} />
      <Route path="/catalog/narrow-specs/:nsId" element={<NarrowSpecDetailPage />} />


      {/* Role-based Protected Dashboards */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={["ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/transcript-presets"
        element={
          <ProtectedRoute allowedRoles={["ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <TranscriptPresetsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/cm-accounts"
        element={
          <ProtectedRoute allowedRoles={["ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <CmAccountsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/student-accounts"
        element={
          <ProtectedRoute allowedRoles={["ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <StudentAccountsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/crawler"
        element={
          <ProtectedRoute allowedRoles={["ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <DataCrawlerConfigPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute allowedRoles={["ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <AdminReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cm/dashboard"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <CmDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cm/trending-weight"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <TrendingWeightPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cm/trending-weight/history"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <TrendingWeightHistoryPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/cm/catalog"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <CmCatalogPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cm/courses"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <CmCoursePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cm/curriculum"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <CmCurriculumPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cm/skills"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <CmSkillsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cm/interests"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <CmInterestsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cm/tagmap"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <CmTagMapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cm/error-reports"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <CmErrorReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cm/compatibility-weight"
        element={
          <ProtectedRoute allowedRoles={["ROLE_CONTENT_MANAGER", "ROLE_ADMIN", "ROLE_SUPER_ADMIN"]}>
            <CmCompatibilityWeightPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/dashboard"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <StudentDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/student/recommendation"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <ProfileCheckPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/recommendation/result"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <RecommendationResultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/recommendation/detail/:narrowSpecId"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <RecommendationDetail />
          </ProtectedRoute>
        }
      />

      {/* MỚI: tất cả các đường dẫn roadmap (khung chuẩn + cá nhân hóa)
          đều render cùng 1 component StudentRoadmap; component tự xác định
          mode Gốc/Cá nhân hóa dựa trên URL (params vs. ?roadmapId=) */}
      <Route
        path="/student/roadmap"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <StudentRoadmap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/roadmap/:specId"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <StudentRoadmap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/roadmap/:specId/:nsId"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <StudentRoadmap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/personal-roadmap"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <StudentRoadmap />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <PersonalInfoPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile/skills"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <DeclareSkillsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile/interests"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <DeclareInterestsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/profile/transcript"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <TranscriptUploadPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/content-report"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <SubmitErrorReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/my-reports"
        element={
          <ProtectedRoute allowedRoles={["ROLE_STUDENT"]}>
            <MyReportsPage />
          </ProtectedRoute>
        }
      />

      {/* Bắt tất cả — phải nằm CUỐI CÙNG, react-router lấy route khớp nhất nhưng
          giữ đúng thứ tự khai báo cho các nhánh cùng độ ưu tiên. Không có route
          này thì mọi URL sai đều render ra màn hình trắng, không phân biệt được
          với sự cố hệ thống. */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
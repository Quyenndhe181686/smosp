import { Navigate } from "react-router-dom";

/**
 * ProtectedRoute component restricts access to routes based on authentication
 * and optional role requirements.
 * 
 * Props:
 *   allowedRoles: Array of roles that are allowed to access this route (e.g. ["ROLE_ADMIN"])
 *   children: The component to render if access is granted.
 */
function ProtectedRoute({ allowedRoles, children }) {
  const token = localStorage.getItem("accessToken");
  const role = localStorage.getItem("role");

  if (!token) {
    // If not logged in, redirect to login page
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // If logged in but does not have the required role, redirect to appropriate default page
    if (role === "ROLE_ADMIN" || role === "ROLE_SUPER_ADMIN") {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (role === "ROLE_CONTENT_MANAGER") {
      return <Navigate to="/cm/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;

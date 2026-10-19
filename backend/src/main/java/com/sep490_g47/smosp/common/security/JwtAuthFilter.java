package com.sep490_g47.smosp.common.security;

import com.sep490_g47.smosp.auth.service.JwtService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class JwtAuthFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserDetailsServiceImpl userDetailsService;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        // Không có header hoặc không phải Bearer token → bỏ qua
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String jwt = authHeader.substring(7);

        if (!jwtService.isTokenValid(jwt)) {
            filterChain.doFilter(request, response);
            return;
        }

        final String identifier = jwtService.extractSubject(jwt);

        // Chỉ set authentication nếu chưa có trong context
        if (identifier != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails;
            try {
                userDetails = userDetailsService.loadUserByUsername(identifier);
            } catch (org.springframework.security.core.userdetails.UsernameNotFoundException e) {
                // JWT hợp lệ nhưng user không còn trong DB (đã bị xóa, hoặc JWT cũ)
                // → bỏ qua, để Spring Security xử lý là unauthenticated
                filterChain.doFilter(request, response);
                return;
            }

            if (!userDetails.isEnabled()) {
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Account has been deactivated");
                return;
            }

            if (userDetails instanceof com.sep490_g47.smosp.auth.security.CustomUserDetails customUserDetails) {
                Integer tokenVersionInToken = jwtService.extractTokenVersion(jwt);
                if (tokenVersionInToken != null && !tokenVersionInToken.equals(customUserDetails.getTokenVersion())) {
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Token has been revoked");
                    return;
                }

                UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);

                if (customUserDetails.isForceChangePassword()) {
                    String path = request.getRequestURI();
                    if (!path.equals("/api/auth/password/change") &&
                            !path.equals("/api/auth/logout") &&
                            !path.equals("/api/me")) {
                        response.setContentType("application/json");
                        response.setCharacterEncoding("UTF-8");
                        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                        response.getWriter().write(
                                "{\"error\": \"FORCE_CHANGE_PASSWORD_REQUIRED\", \"message\": \"Bạn phải đổi mật khẩu trước khi tiếp tục\"}");
                        return;
                    }
                }
            }
        }

        filterChain.doFilter(request, response);
    }
}
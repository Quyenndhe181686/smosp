package com.sep490_g47.smosp.common.config;

import com.sep490_g47.smosp.common.security.JwtAuthFilter;
import com.sep490_g47.smosp.common.security.UserDetailsServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;
    private final UserDetailsServiceImpl userDetailsService;

    // Fix 405: Bait Request
    // Created by: BaoTQ - 260812
    // URL frontend from application.yml
    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // 1. turn on cors
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Public endpoints
                        .requestMatchers(
                                "/api/auth/register",
                                "/api/auth/verify-email/**",
                                "/api/auth/login",
                                "/api/auth/google",
                                "/api/auth/refresh",
                                "/api/auth/password/forgot",
                                "/api/auth/password/reset",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/api-docs/**",
                                "/v3/api-docs/**",
                                "/api/narrow-specs/*/roadmap")
                        .permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/majors").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/curriculums/**").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/majors/*/specializations")
                        .permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/specializations/*/narrow-specs")
                        .permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/narrow-specs/*").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/courses/*").permitAll()
                        .requestMatchers(org.springframework.http.HttpMethod.POST, "/api/catalog/search").permitAll()
                        .requestMatchers(
                                "/api/auth/logout",
                                "/api/auth/password/change",
                                "/api/me/**")
                        .authenticated()
                        // validate all endpoint
                        .anyRequest().authenticated())
                .authenticationProvider(authenticationProvider())
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    // 2. Detail Configuration of CORS laws
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // allow FE on Local & on Railway call
        configuration.setAllowedOriginPatterns(List.of(
                frontendUrl,
                "http://localhost:5173",
                // Trình duyệt coi 127.0.0.1 và localhost là hai origin khác nhau, nên
                // mở Vite qua http://127.0.0.1:5173 bị chặn CORS -> 403. Chỉ ảnh
                // hưởng lúc dev, nhưng đây là URL Vite in ra ở dòng "Network".
                "http://127.0.0.1:5173",
                "https://*.up.railway.app"));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public AuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
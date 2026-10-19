package com.sep490_g47.smosp.common.exception;

import com.sep490_g47.smosp.auth.dto.response.MessageResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<MessageResponse> handleIllegalArgument(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
                .body(new MessageResponse(ex.getMessage(), false));
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<MessageResponse> handleIllegalState(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new MessageResponse(ex.getMessage(), false));
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<MessageResponse> handleBadCredentials(BadCredentialsException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new MessageResponse(ex.getMessage(), false));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<MessageResponse> handleValidation(MethodArgumentNotValidException ex) {
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));
        return ResponseEntity.badRequest()
                .body(new MessageResponse(errors, false));
    }

    @ExceptionHandler(org.springframework.web.server.ResponseStatusException.class)
    public ResponseEntity<MessageResponse> handleResponseStatus(org.springframework.web.server.ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode())
                .body(new MessageResponse(ex.getReason(), false));
    }

    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<MessageResponse> handleAccessDenied(org.springframework.security.access.AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new MessageResponse("Access Denied", false));
    }

    @ExceptionHandler(InvalidProposalStateException.class)
    public ResponseEntity<MessageResponse> handleInvalidProposalState(InvalidProposalStateException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new MessageResponse(ex.getMessage(), false));
    }

    @ExceptionHandler(CrawlerBusinessException.class)
    public ResponseEntity<MessageResponse> handleCrawlerBusiness(CrawlerBusinessException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new MessageResponse(ex.getMessage(), false));
    }

    @ExceptionHandler(com.sep490_g47.smosp.auth.exception.AuthBusinessException.class)
    public ResponseEntity<MessageResponse> handleAuthBusiness(com.sep490_g47.smosp.auth.exception.AuthBusinessException ex) {
        return ResponseEntity.badRequest()
                .body(new MessageResponse(ex.getMessage(), false));
    }

    @ExceptionHandler(com.sep490_g47.smosp.auth.exception.AccountLockedException.class)
    public ResponseEntity<MessageResponse> handleAccountLocked(com.sep490_g47.smosp.auth.exception.AccountLockedException ex) {
        return ResponseEntity.status(HttpStatus.LOCKED)
                .body(new MessageResponse(ex.getMessage(), false));
    }

    @ExceptionHandler(com.sep490_g47.smosp.auth.exception.TokenExpiredException.class)
    public ResponseEntity<MessageResponse> handleTokenExpired(com.sep490_g47.smosp.auth.exception.TokenExpiredException ex) {
        return ResponseEntity.status(HttpStatus.GONE)
                .body(new MessageResponse(ex.getMessage(), false));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<MessageResponse> handleGeneral(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new MessageResponse("Internal server error: " + ex.getMessage(), false));
    }
}
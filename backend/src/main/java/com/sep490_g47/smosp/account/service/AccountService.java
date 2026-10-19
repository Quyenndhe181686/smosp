package com.sep490_g47.smosp.account.service;

import com.sep490_g47.smosp.account.dto.response.MeResponse;
import com.sep490_g47.smosp.account.dto.request.UpdatePreferencesRequest;

import java.util.UUID;

public interface AccountService {

    /**
     * Gets the current authenticated user's information.
     *
     * @param userId the ID of the authenticated user
     * @return the user's information as a MeResponse
     */
    MeResponse getMe(UUID userId);

    /**
     * Updates the current authenticated user's preferences.
     *
     * @param userId the ID of the authenticated user
     * @param request the request containing updated preferences
     * @return the updated user's information as a MeResponse
     */
    MeResponse updatePreferences(UUID userId, UpdatePreferencesRequest request);

    /**
     * Saves the FCM token for the authenticated user.
     *
     * @param userId the ID of the authenticated user
     * @param token the FCM token
     */
    void saveFcmToken(UUID userId, String token);
}

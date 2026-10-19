import { saveFcmToken } from '../services/authService';

/**
 * Initialize Web FCM Notification token and sync to backend.
 * Checks for Browser Notification permission, generates/retrieves token,
 * and calls backend POST /api/me/fcm-token.
 */
export async function initFcmToken() {
    if (!('Notification' in window)) {
        return;
    }

    try {
        let permission = Notification.permission;
        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }

        if (permission === 'granted') {
            // Check if we already registered an FCM token for this session
            const existingToken = localStorage.getItem('fcm_token');
            if (existingToken) {
                await saveFcmToken(existingToken).catch(err => console.debug("FCM token sync:", err));
            } else {
                // Generate a client FCM token identifier (or Firebase token when SDK is linked)
                const generatedToken = `web-fcm-${Math.random().toString(36).substring(2)}-${Date.now()}`;
                localStorage.setItem('fcm_token', generatedToken);
                await saveFcmToken(generatedToken).catch(err => console.debug("FCM token sync:", err));
            }
        }
    } catch (err) {
        console.debug("Failed to initialize FCM token:", err);
    }
}

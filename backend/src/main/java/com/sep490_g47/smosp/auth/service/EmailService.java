package com.sep490_g47.smosp.auth.service;

import com.google.api.client.auth.oauth2.Credential;
import com.google.api.client.googleapis.auth.oauth2.GoogleCredential;
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.gmail.Gmail;
import com.google.api.services.gmail.model.Message;
import jakarta.annotation.PostConstruct;
import jakarta.mail.MessagingException;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.Properties;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${spring.gmail.client-id}")
    private String clientId;

    @Value("${spring.gmail.client-secret}")
    private String clientSecret;

    @Value("${spring.gmail.refresh-token}")
    private String refreshToken;

    private Gmail gmailService;
    private static final String APPLICATION_NAME = "SMOSP Application";
    private static final JsonFactory JSON_FACTORY = GsonFactory.getDefaultInstance();

    // Tương đương spring.mail.properties.mail.smtp.{connectiontimeout,timeout,writetimeout}
    // của bản SMTP cũ (commit e177dc8, nhánh fix/test-forgot-password) — không cherry-pick
    // được nguyên si vì nhánh này đã đổi hẳn sang Gmail API (b77f32d), không còn dùng
    // JavaMailSender/spring.mail nữa. Không set timeout thì request treo vô hạn nếu Google
    // API không phản hồi, gây đúng lỗi "không đăng ký được" (register chờ email xác thực
    // gửi xong mới trả response) mà bản fix SMTP kia từng chặn.
    private static final int CONNECT_TIMEOUT_MS = 5000;
    private static final int READ_TIMEOUT_MS = 5000;

    @PostConstruct
    public void init() {
        try {
            NetHttpTransport httpTransport = GoogleNetHttpTransport.newTrustedTransport();

            Credential credential = new GoogleCredential.Builder()
                    .setTransport(httpTransport)
                    .setJsonFactory(JSON_FACTORY)
                    .setClientSecrets(clientId, clientSecret)
                    .build()
                    .setRefreshToken(refreshToken);

            HttpRequestInitializer timeoutInitializer = request -> {
                credential.initialize(request);
                request.setConnectTimeout(CONNECT_TIMEOUT_MS);
                request.setReadTimeout(READ_TIMEOUT_MS);
            };

            gmailService = new Gmail.Builder(httpTransport, JSON_FACTORY, timeoutInitializer)
                    .setApplicationName(APPLICATION_NAME)
                    .build();
        } catch (Exception e) {
            log.error("Failed to initialize Gmail API service", e);
        }
    }

    public void sendVerificationEmail(String toEmail, String token) {
        String link = frontendUrl + "/verify-email?token=" + token;
        String subject = "[SMOSP] Xác minh email đăng ký";
        String htmlContent = "<p>Chào bạn,</p><p>Vui lòng click vào link sau để kích hoạt tài khoản:</p><p><a href=\"" + link + "\">" + link + "</a></p><p>Link có hiệu lực trong 24 giờ.</p><p>SMOSP Team</p>";
        sendEmail(toEmail, subject, htmlContent);
    }

    public void sendPasswordResetEmail(String toEmail, String token) {
        String link = frontendUrl + "/reset-password?token=" + token;
        String subject = "[SMOSP] Đặt lại mật khẩu";
        String htmlContent = "<p>Chào bạn,</p><p>Vui lòng click vào link sau để đặt lại mật khẩu:</p><p><a href=\"" + link + "\">" + link + "</a></p><p>Link có hiệu lực trong 1 giờ.</p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p><p>SMOSP Team</p>";
        sendEmail(toEmail, subject, htmlContent);
    }

    private void sendEmail(String toEmail, String subject, String bodyText) {
        try {
            MimeMessage email = createEmail(toEmail, "me", subject, bodyText);
            Message message = createMessageWithEmail(email);
            gmailService.users().messages().send("me", message).execute();
            log.info("Email sent to {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send email to {}", toEmail, e);
            throw new RuntimeException("Failed to send email via Gmail API: " + e.getMessage());
        }
    }

    private MimeMessage createEmail(String to, String from, String subject, String bodyText) throws MessagingException {
        Properties props = new Properties();
        Session session = Session.getDefaultInstance(props, null);

        MimeMessage email = new MimeMessage(session);
        email.setFrom(new InternetAddress(from));
        email.addRecipient(jakarta.mail.Message.RecipientType.TO, new InternetAddress(to));
        email.setSubject(subject);
        email.setContent(bodyText, "text/html; charset=utf-8");
        return email;
    }

    private Message createMessageWithEmail(MimeMessage emailContent) throws MessagingException, IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        emailContent.writeTo(buffer);
        byte[] bytes = buffer.toByteArray();
        String encodedEmail = Base64.getUrlEncoder().encodeToString(bytes);
        Message message = new Message();
        message.setRaw(encodedEmail);
        return message;
    }
}
package com.sep490_g47.smosp.specialization.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.sep490_g47.smosp.specialization.repository.SpecializationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class SpecializationImageService {

    private final SpecializationRepository specializationRepository;
    private final SpecializationImagePersistence imagePersistence;
    private final Cloudinary cloudinary;

    /**
     * CỐ Ý không có @Transactional: cloudinary.uploader().upload() là network I/O,
     * upload file vài MB có thể mất hàng chục giây. Bọc transaction ở đây đồng nghĩa
     * giữ 1 DB connection suốt cả quá trình upload — vài CM upload cùng lúc là đủ cạn
     * pool và làm mọi API khác timeout.
     */
    public String uploadAndUpdateSpecializationImage(String code, MultipartFile file) {
        // Kiểm tra tồn tại trước khi tốn công upload. Lời gọi repository lẻ đã tự chạy
        // trong transaction ngắn của Spring Data, connection trả về pool ngay sau đó.
        if (specializationRepository.findByCode(code).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Specialization not found");
        }

        String publicUrl = uploadToCloudinary(code, file);

        // Transaction ngắn, chỉ bọc đúng thao tác ghi.
        // Không cần rollback ảnh nếu bước này fail: public_id là deterministic theo
        // code nên lần upload sau ghi đè đúng object đó, không sinh file rác.
        imagePersistence.updateImageUrl(code, publicUrl);
        return publicUrl;
    }

    private String uploadToCloudinary(String code, MultipartFile file) {
        try {
            Map params = ObjectUtils.asMap(
                    "public_id", code.toUpperCase().trim(),
                    "folder", "specializations"
            );

            Map uploadResult = cloudinary.uploader().upload(file.getBytes(), params);
            return uploadResult.get("secure_url").toString();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to upload to Cloudinary", e);
        }
    }
}

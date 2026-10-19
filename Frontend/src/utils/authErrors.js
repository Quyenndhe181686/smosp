/**
 * Ánh xạ thông điệp lỗi kỹ thuật/tiếng Anh từ backend và Firebase sang chuỗi tiếng Việt
 * cố định theo FDS.
 *
 * Trước đây LoginPage / RegisterPage / VerifyEmailPage / AccountPage đều đổ thẳng
 * `err.response.data.message` ra màn nên người dùng đọc được nguyên văn tiếng Anh
 * (L2_INT_TEST_LAYER2_DEF_16 — 7 tình huống, cùng 1 pattern ở 4 màn).
 */

// Khớp theo chuỗi con để không phụ thuộc dấu câu / hậu tố của backend
const BACKEND_MESSAGE_MAP = [
    [/invalid credentials/i, 'Email hoặc mật khẩu không đúng.'],
    [/account is locked/i, 'Tài khoản đang tạm khoá do đăng nhập sai nhiều lần. Vui lòng thử lại sau ít phút.'],
    [/account has been deactivated/i, 'Tài khoản của bạn đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.'],
    [/account not activated/i, 'Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email để xác thực.'],
    [/incorrect old password/i, 'Mật khẩu hiện tại không đúng.'],
    [/new password must be different/i, 'Mật khẩu mới phải khác mật khẩu hiện tại.'],
    [/token expired/i, 'Liên kết đã hết hạn. Vui lòng yêu cầu gửi lại.'],
    [/token already used/i, 'Liên kết này đã được sử dụng. Vui lòng yêu cầu gửi lại nếu cần.'],
    [/refresh token expired/i, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'],
    [/invalid firebase id token/i, 'Không xác thực được tài khoản Google. Vui lòng thử lại.'],
    [/user not found/i, 'Không tìm thấy tài khoản tương ứng.'],
    [/already exists|duplicate|đã tồn tại/i, 'Email này đã được đăng ký. Vui lòng dùng email khác hoặc đăng nhập.'],
];

const STATUS_FALLBACK = {
    400: 'Thông tin bạn nhập chưa hợp lệ. Vui lòng kiểm tra lại.',
    401: 'Email hoặc mật khẩu không đúng.',
    403: 'Bạn không có quyền thực hiện thao tác này.',
    404: 'Không tìm thấy dữ liệu tương ứng.',
    409: 'Dữ liệu đã tồn tại trên hệ thống.',
    423: 'Tài khoản đang tạm khoá. Vui lòng thử lại sau.',
    429: 'Bạn thao tác quá nhanh. Vui lòng chờ một lát rồi thử lại.',
};

/** Chuỗi có vẻ là tiếng Việt thì giữ nguyên; tiếng Anh/kỹ thuật thì phải map. */
function looksVietnamese(text) {
    return /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(text);
}

export function mapAuthError(err, fallback = 'Có lỗi xảy ra. Vui lòng thử lại.') {
    const raw = err?.response?.data?.message || '';
    for (const [pattern, vi] of BACKEND_MESSAGE_MAP) {
        if (pattern.test(raw)) return vi;
    }

    const status = err?.response?.status;
    if (status >= 500) return 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.';

    if (!err?.response) return 'Không kết nối được tới máy chủ. Vui lòng kiểm tra đường truyền.';
    // Chỉ hiện lại message của backend khi nó đã là tiếng Việt
    if (raw && looksVietnamese(raw)) return raw;

    if (STATUS_FALLBACK[status]) return STATUS_FALLBACK[status];
    return fallback;
}

/** Lỗi từ popup Firebase — mã lỗi nằm ở `err.code`, không phải response HTTP. */
export function mapFirebaseError(err, fallback = 'Đăng nhập Google thất bại. Vui lòng thử lại.') {
    switch (err?.code) {
        case 'auth/popup-closed-by-user':
        case 'auth/cancelled-popup-request':
        case 'auth/user-cancelled':
            // Người dùng tự đóng popup: không phải lỗi hệ thống (DEF_25)
            return 'Bạn đã đóng cửa sổ đăng nhập Google nên thao tác bị huỷ. Hãy thử lại nếu muốn tiếp tục.';
        case 'auth/popup-blocked':
            return 'Trình duyệt đã chặn cửa sổ đăng nhập Google. Hãy cho phép popup cho trang này rồi thử lại.';
        case 'auth/network-request-failed':
            return 'Không kết nối được tới Google. Vui lòng kiểm tra đường truyền rồi thử lại.';
        case 'auth/account-exists-with-different-credential':
            return 'Email này đã đăng ký bằng cách khác. Vui lòng đăng nhập bằng mật khẩu.';
        default:
            if (err?.response) return mapAuthError(err, fallback);
            return fallback;
    }
}

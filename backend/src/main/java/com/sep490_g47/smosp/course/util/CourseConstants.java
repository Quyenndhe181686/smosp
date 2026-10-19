package com.sep490_g47.smosp.course.util;

public final class CourseConstants {
    private CourseConstants() {}
    public static final String ERR_COURSE_NOT_FOUND = "Course not found";
    public static final String ERR_CODE_UNIQUE = "Course code already exists";
    public static final String ERR_COURSE_IN_USE = "Course is currently in use and cannot be deleted";
    public static final String ERR_CIRCULAR_DEPENDENCY = "Adding these prerequisites creates a circular dependency";
    public static final String ERR_INVALID_FILE_FORMAT = "Invalid file format. Only ZIP, RAR, PDF, Word, and Excel files are allowed.";
    public static final String ERR_CLOUDINARY_UPLOAD = "Failed to upload file to Cloudinary";
}

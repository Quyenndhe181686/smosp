package com.sep490_g47.smosp.narrowspec.util;

public final class NarrowSpecConstants {
    private NarrowSpecConstants() {}

    public static final String ERROR_CODE_UNIQUE = "Code must be globally unique";
    public static final String ERROR_SPEC_NOT_FOUND = "Specialization not found";
    public static final String ERROR_MAX_LIMIT_REACHED = "A Specialization can have a maximum of 15 NarrowSpecializations";
    public static final String ERROR_NARROW_SPEC_NOT_FOUND = "Narrow Specialization not found";
    public static final String ERROR_NAME_UNIQUE = "Name already exists within this specialization";
    
    public static final String VALIDATION_SPEC_ID_REQUIRED = "Specialization ID is required";
    public static final String VALIDATION_CODE_REQUIRED = "Code is required";
    public static final String VALIDATION_NAME_REQUIRED = "Name is required";
    public static final String VALIDATION_IS_PUBLISHED_REQUIRED = "isPublished field is required";

    public static final int MAX_NARROW_SPECS_PER_SPEC = 15;
}

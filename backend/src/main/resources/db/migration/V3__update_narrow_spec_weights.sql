
-- Migration script V3__update_narrow_spec_weights.sql
-- ly_thuyet
UPDATE narrow_spec_weight_config
SET w_gpa = 0.04, w_skill = 0.28, w_int = 0.68
WHERE narrow_spec_id IN (
    SELECT id FROM narrow_spec WHERE code IN ('FT_COM3', 'IF_COM1', 'SF_COM1', 'BEN_COM1', 'BEN_COM5A', 'AI17_COM1', 'AI17_COM3', 'AI17_COM2.1', 'AI17_COM5', 'AI17_COM4', 'AS_COM1', 'AS_COM2', 'AS_COM3', 'DS_COM1', 'DS_COM2', 'DX_COM2', 'IA_COM1', 'IA_COM3', 'IC_COM1', 'IC_COM2', 'IC_COM4', 'IS_COM4', 'IS_COM5', 'IT_COM1', 'IT_COM3', 'IO_COM1', 'IO_COM2', 'RA_COM1', 'RA_COM2', 'RA_COM3', 'RA_COM4', 'SE_COM7.1', 'SE_COM11', 'SE_COM14', 'LLB_EL_COM1')
);

-- thuc_hanh
UPDATE narrow_spec_weight_config
SET w_gpa = 0.01, w_skill = 0.19, w_int = 0.80
WHERE narrow_spec_id IN (
    SELECT id FROM narrow_spec WHERE code IN ('BA_COM1', 'BA_COM2', 'BA_COM3', 'BA_COM4', 'BSA_COM1', 'BSA_COM2', 'BSA_COM4', 'CF_COM1', 'CF_COM2', 'CF_COM3', 'CF_COM5', 'CX_COM2', 'EC_COM1', 'EC_COM2', 'FT_COM1', 'FT_COM2', 'GL_COM1.1', 'GL_COM2.1', 'GL_COM4', 'HM_COM1', 'HM_COM2', 'HM_COM3', 'HM_COM4', 'HM_COM5', 'IB_COM1', 'IB_COM2', 'IB_COM4', 'IB_COM5', 'IF_COM2', 'IF_COM3', 'MKT_COM3', 'MKT_COM4', 'MKT_COM5', 'PM_COM1', 'PM_COM2', 'PM_COM3', 'SF_COM2', 'SF_COM3', 'TM_COM1.1', 'TM_COM2.2', 'TM_COM3.1', 'BCH_BC _COM1', 'BCH_BC _COM2', 'BCH_CL_ COM1', 'BCH_CL_ COM2', 'BCH_EN_ COM1', 'BCH_EN_ COM2', 'BEN_COM2', 'BEN_COM4B', 'BEN_COM3', 'BEN_COM4', 'BEN_COM4A', 'DX_COM1', 'DX_COM3', 'IA_COM2', 'IC_COM3', 'IS_COM2.1', 'IS_COM3', 'IS_COM1.2', 'IT_COM2', 'SE_COM5.2', 'SE_COM6', 'SE_COM5.1.1', 'SE_COM4.1', 'SE_COM10.2', 'SE_COM12', 'SE_COM3.3', 'BJP_EN COM2.1', 'BJP_EN COM3.1', 'BJP_EN COM2', 'BKR_BK_COM2', 'BKR_EN_COM1', 'BKR_EN_COM2', 'BKR_COM1.3', 'BKR_COM2.3', 'BKR_COM3', 'LLB_EL_COM2')
);

-- sang_tao (Note: w_int adjusted to 0.455 to make sum exactly 1.0)
UPDATE narrow_spec_weight_config
SET w_gpa = 0.18, w_skill = 0.37, w_int = 0.45
WHERE narrow_spec_id IN (
    SELECT id FROM narrow_spec WHERE code IN ('BSA_COM3', 'CF_COM4', 'CX_COM1', 'CX_COM3', 'EC_COM3', 'EE_COM1', 'EE_COM2', 'EE_COM3', 'GL_COM3', 'GL_COM5', 'IB_COM3.2', 'IB_COM6.1', 'MC_COM2.3', 'MC_COM3.2', 'MC_COM4.2', 'MC_COM1.4', 'MKT_COM1', 'MKT_COM6.1', 'MKT_COM2.2', 'BCT_BC_COM1', 'BCT_BC_COM2', 'BCT_IMC_COM1', 'BCT_IMC_COM2', 'BCT_MC_COM1', 'BCT_MC_COM2', 'BCT_PR_COM1', 'BCT_PR_COM2', 'BEN_COM3B', 'BEN_COM5', 'BEN_COM3A', 'GD_COM1.1', 'GD_COM2.1', 'GD_COM3.1', 'GD_COM4.1', 'GD_COM5.3', 'GD_COM6', 'BKR_BK_COM1')
);

-- _pooled_fallback (for any new or unknown codes)
UPDATE narrow_spec_weight_config
SET w_gpa = 0.04, w_skill = 0.28, w_int = 0.68
WHERE narrow_spec_id IN (
    SELECT id FROM narrow_spec WHERE code NOT IN (
        'BA_COM1', 'BA_COM2', 'BA_COM3', 'BA_COM4', 'BSA_COM1', 'BSA_COM2', 'BSA_COM3', 'BSA_COM4', 'CF_COM1', 'CF_COM2', 'CF_COM3', 'CF_COM4', 'CF_COM5', 'CX_COM1', 'CX_COM2', 'CX_COM3', 'EC_COM1', 'EC_COM2', 'EC_COM3', 'EE_COM1', 'EE_COM2', 'EE_COM3', 'FT_COM1', 'FT_COM2', 'FT_COM3', 'GL_COM1.1', 'GL_COM2.1', 'GL_COM3', 'GL_COM4', 'GL_COM5', 'HM_COM1', 'HM_COM2', 'HM_COM3', 'HM_COM4', 'HM_COM5', 'IB_COM1', 'IB_COM2', 'IB_COM4', 'IB_COM5', 'IB_COM3.2', 'IB_COM6.1', 'IF_COM1', 'IF_COM2', 'IF_COM3', 'MC_COM2.3', 'MC_COM3.2', 'MC_COM4.2', 'MC_COM1.4', 'MKT_COM1', 'MKT_COM3', 'MKT_COM4', 'MKT_COM5', 'MKT_COM6.1', 'MKT_COM2.2', 'PM_COM1', 'PM_COM2', 'PM_COM3', 'SF_COM1', 'SF_COM2', 'SF_COM3', 'TM_COM1.1', 'TM_COM2.2', 'TM_COM3.1', 'BCH_BC _COM1', 'BCH_BC _COM2', 'BCH_CL_ COM1', 'BCH_CL_ COM2', 'BCH_EN_ COM1', 'BCH_EN_ COM2', 'BCT_BC_COM1', 'BCT_BC_COM2', 'BCT_IMC_COM1', 'BCT_IMC_COM2', 'BCT_MC_COM1', 'BCT_MC_COM2', 'BCT_PR_COM1', 'BCT_PR_COM2', 'BEN_COM1', 'BEN_COM2', 'BEN_COM3B', 'BEN_COM4B', 'BEN_COM3', 'BEN_COM4', 'BEN_COM5', 'BEN_COM3A', 'BEN_COM4A', 'BEN_COM5A', 'AI17_COM1', 'AI17_COM3', 'AI17_COM2.1', 'AI17_COM5', 'AI17_COM4', 'AS_COM1', 'AS_COM2', 'AS_COM3', 'DS_COM1', 'DS_COM2', 'DX_COM1', 'DX_COM2', 'DX_COM3', 'GD_COM1.1', 'GD_COM2.1', 'GD_COM3.1', 'GD_COM4.1', 'GD_COM5.3', 'GD_COM6', 'IA_COM1', 'IA_COM2', 'IA_COM3', 'IC_COM1', 'IC_COM2', 'IC_COM3', 'IC_COM4', 'IS_COM2.1', 'IS_COM3', 'IS_COM4', 'IS_COM5', 'IS_COM1.2', 'IT_COM1', 'IT_COM2', 'IT_COM3', 'IO_COM1', 'IO_COM2', 'RA_COM1', 'RA_COM2', 'RA_COM3', 'RA_COM4', 'SE_COM5.2', 'SE_COM6', 'SE_COM5.1.1', 'SE_COM7.1', 'SE_COM4.1', 'SE_COM11', 'SE_COM10.2', 'SE_COM12', 'SE_COM14', 'SE_COM3.3', 'BJP_EN COM2.1', 'BJP_EN COM3.1', 'BJP_EN COM2', 'BKR_BK_COM1', 'BKR_BK_COM2', 'BKR_EN_COM1', 'BKR_EN_COM2', 'BKR_COM1.3', 'BKR_COM2.3', 'BKR_COM3', 'LLB_EL_COM1', 'LLB_EL_COM2'
    )
);

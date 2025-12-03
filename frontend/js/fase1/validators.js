/**
 * CAMPS PDF Manager v2.0 - FASE 1 Validators
 * Validation logic for Decreto 10.278/2020 compliance
 */

/**
 * Validate CPF or CNPJ format
 * Note: Full validation with check digits is done on backend
 */
export function validateCPF_CNPJ(value) {
    if (!value) return { valid: false, message: 'CPF/CNPJ é obrigatório' };
    
    const cleaned = value.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
        return { valid: true, message: 'CPF válido (formato)' };
    } else if (cleaned.length === 14) {
        return { valid: true, message: 'CNPJ válido (formato)' };
    }
    
    return { valid: false, message: 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos' };
}

/**
 * Validate Resolution DPI
 * Minimum 150 DPI required by law
 */
export function validateDPI(value) {
    const dpi = parseInt(value);
    
    if (isNaN(dpi)) {
        return { valid: false, message: 'DPI deve ser um número' };
    }
    
    if (dpi < 150) {
        return { valid: false, message: 'DPI mínimo: 150 (conformidade legal)' };
    }
    
    if (dpi > 1200) {
        return { valid: false, message: 'DPI máximo: 1200' };
    }
    
    return { valid: true, message: 'DPI válido' };
}

/**
 * Validate all FASE 1 required fields
 */
export function validateFASE1Fields(data) {
    const errors = [];
    
    // Digitizer Name
    if (!data.digitizer_name || !data.digitizer_name.trim()) {
        errors.push('Nome do digitalizador é obrigatório');
    }
    
    // CPF/CNPJ
    const cpfValidation = validateCPF_CNPJ(data.digitizer_cpf_cnpj);
    if (!cpfValidation.valid) {
        errors.push(cpfValidation.message);
    }
    
    // DPI
    const dpiValidation = validateDPI(data.resolution_dpi);
    if (!dpiValidation.valid) {
        errors.push(dpiValidation.message);
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

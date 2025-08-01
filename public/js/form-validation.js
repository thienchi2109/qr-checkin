/**
 * Form Validation Module
 * Handles client-side form validation for the check-in form
 */

class FormValidator {
    constructor(formElement) {
        this.form = formElement;
        this.fields = new Map();
        this.isValid = false;
        this.onValidationChange = null;
        
        this.initializeFields();
        this.bindEvents();
    }
    
    /**
     * Initialize form fields
     */
    initializeFields() {
        const inputs = this.form.querySelectorAll('input[required], input[data-validate]');
        
        inputs.forEach(input => {
            const fieldName = input.name || input.id;
            const rules = this.getValidationRules(input);
            
            this.fields.set(fieldName, {
                element: input,
                rules: rules,
                isValid: false,
                errors: []
            });
        });
    }
    
    /**
     * Get validation rules for a field
     */
    getValidationRules(input) {
        const rules = [];
        
        // Required validation
        if (input.hasAttribute('required')) {
            rules.push({
                type: 'required',
                message: 'Trường này là bắt buộc'
            });
        }

        // Email validation
        if (input.type === 'email') {
            rules.push({
                type: 'email',
                message: 'Vui lòng nhập địa chỉ email hợp lệ'
            });
        }
        
        // Custom validation rules
        const customRules = input.dataset.validate;
        if (customRules) {
            try {
                const parsed = JSON.parse(customRules);
                rules.push(...parsed);
            } catch (e) {
                console.warn('Invalid validation rules for field:', input.name);
            }
        }
        
        // Field-specific rules
        switch (input.name) {
            case 'fullName':
                rules.push({
                    type: 'minLength',
                    value: 2,
                    message: 'Tên phải có ít nhất 2 ký tự'
                });
                rules.push({
                    type: 'pattern',
                    value: /^[a-zA-ZÀ-ỹ\s]+$/,
                    message: 'Tên chỉ được chứa chữ cái và khoảng trắng'
                });
                break;

            case 'email':
                rules.push({
                    type: 'maxLength',
                    value: 254,
                    message: 'Địa chỉ email quá dài'
                });
                break;

            case 'idNumber':
                if (input.value.trim()) { // Only validate if not empty (optional field)
                    rules.push({
                        type: 'pattern',
                        value: /^[a-zA-Z0-9\-]+$/,
                        message: 'Số CMND/CCCD chỉ được chứa chữ cái, số và dấu gạch ngang'
                    });
                }
                break;
        }
        
        return rules;
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Real-time validation on input
        this.fields.forEach((field, fieldName) => {
            field.element.addEventListener('input', () => {
                this.validateField(fieldName);
                this.updateFormValidation();
            });
            
            field.element.addEventListener('blur', () => {
                this.validateField(fieldName);
                this.updateFormValidation();
            });
        });
        
        // Form submission validation
        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.validateForm();
        });
    }
    
    /**
     * Validate a single field
     */
    validateField(fieldName) {
        const field = this.fields.get(fieldName);
        if (!field) return false;
        
        const value = field.element.value.trim();
        const errors = [];
        
        // Run validation rules
        for (const rule of field.rules) {
            const error = this.validateRule(value, rule, field.element);
            if (error) {
                errors.push(error);
            }
        }
        
        // Update field state
        field.errors = errors;
        field.isValid = errors.length === 0;
        
        // Update UI
        this.updateFieldUI(fieldName, field);
        
        return field.isValid;
    }
    
    /**
     * Validate a single rule
     */
    validateRule(value, rule, element) {
        switch (rule.type) {
            case 'required':
                if (!value) {
                    return rule.message;
                }
                break;
                
            case 'email':
                if (value && !this.isValidEmail(value)) {
                    return rule.message;
                }
                break;
                
            case 'minLength':
                if (value && value.length < rule.value) {
                    return rule.message;
                }
                break;
                
            case 'maxLength':
                if (value && value.length > rule.value) {
                    return rule.message;
                }
                break;
                
            case 'pattern':
                if (value && !rule.value.test(value)) {
                    return rule.message;
                }
                break;
                
            case 'custom':
                if (rule.validator && typeof rule.validator === 'function') {
                    const result = rule.validator(value, element);
                    if (result !== true) {
                        return result || rule.message;
                    }
                }
                break;
        }
        
        return null;
    }
    
    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    /**
     * Update field UI
     */
    updateFieldUI(fieldName, field) {
        const element = field.element;
        const errorElement = document.getElementById(`${fieldName}-error`);
        
        // Update input styling
        if (field.isValid) {
            element.classList.remove('error');
            element.classList.add('valid');
        } else {
            element.classList.remove('valid');
            if (field.errors.length > 0) {
                element.classList.add('error');
            }
        }
        
        // Update error message
        if (errorElement) {
            if (field.errors.length > 0) {
                errorElement.textContent = field.errors[0]; // Show first error
                errorElement.classList.add('show');
            } else {
                errorElement.textContent = '';
                errorElement.classList.remove('show');
            }
        }
    }
    
    /**
     * Validate entire form
     */
    validateForm() {
        let isFormValid = true;
        
        // Validate all fields
        this.fields.forEach((field, fieldName) => {
            const fieldValid = this.validateField(fieldName);
            if (!fieldValid) {
                isFormValid = false;
            }
        });
        
        this.isValid = isFormValid;
        this.updateFormValidation();
        
        return isFormValid;
    }
    
    /**
     * Update form validation state
     */
    updateFormValidation() {
        // Check if all fields are valid
        let allValid = true;
        this.fields.forEach(field => {
            if (!field.isValid) {
                allValid = false;
            }
        });
        
        this.isValid = allValid;
        
        // Update submit button
        const submitButton = this.form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = !this.isValid;
        }
        
        // Trigger callback
        if (this.onValidationChange) {
            this.onValidationChange(this.isValid, this.getFormData());
        }
    }
    
    /**
     * Get form data
     */
    getFormData() {
        const data = {};
        
        this.fields.forEach((field, fieldName) => {
            data[fieldName] = field.element.value.trim();
        });
        
        return data;
    }
    
    /**
     * Get validation errors
     */
    getErrors() {
        const errors = {};
        
        this.fields.forEach((field, fieldName) => {
            if (field.errors.length > 0) {
                errors[fieldName] = field.errors;
            }
        });
        
        return errors;
    }
    
    /**
     * Clear all validation errors
     */
    clearErrors() {
        this.fields.forEach((field, fieldName) => {
            field.errors = [];
            field.isValid = true;
            this.updateFieldUI(fieldName, field);
        });
        
        this.updateFormValidation();
    }
    
    /**
     * Set field error manually
     */
    setFieldError(fieldName, error) {
        const field = this.fields.get(fieldName);
        if (field) {
            field.errors = [error];
            field.isValid = false;
            this.updateFieldUI(fieldName, field);
            this.updateFormValidation();
        }
    }
    
    /**
     * Set validation change callback
     */
    onChange(callback) {
        this.onValidationChange = callback;
        return this;
    }
    
    /**
     * Reset form validation
     */
    reset() {
        this.fields.forEach((field, fieldName) => {
            field.element.value = '';
            field.element.classList.remove('valid', 'error');
            field.errors = [];
            field.isValid = false;
            
            const errorElement = document.getElementById(`${fieldName}-error`);
            if (errorElement) {
                errorElement.textContent = '';
                errorElement.classList.remove('show');
            }
        });
        
        this.isValid = false;
        this.updateFormValidation();
    }
}

/**
 * Form Helper Utilities
 */
class FormHelpers {
    /**
     * Sanitize input value
     */
    static sanitizeInput(value) {
        return value.trim().replace(/[<>]/g, '');
    }
    
    /**
     * Format name (capitalize first letter of each word)
     */
    static formatName(name) {
        return name.trim()
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Validate ID number format
     */
    static validateIdNumber(idNumber) {
        // Remove spaces and convert to uppercase
        const cleaned = idNumber.replace(/\s/g, '').toUpperCase();
        
        // Basic validation - adjust based on your requirements
        if (cleaned.length < 3 || cleaned.length > 20) {
            return false;
        }
        
        return /^[A-Z0-9\-]+$/.test(cleaned);
    }
    
    /**
     * Auto-format input as user types
     */
    static setupAutoFormat() {
        // Format name fields
        document.querySelectorAll('input[name="fullName"]').forEach(input => {
            input.addEventListener('blur', (e) => {
                e.target.value = FormHelpers.formatName(e.target.value);
            });
        });
        
        // Format email fields
        document.querySelectorAll('input[type="email"]').forEach(input => {
            input.addEventListener('blur', (e) => {
                e.target.value = e.target.value.trim().toLowerCase();
            });
        });
        
        // Format ID number fields
        document.querySelectorAll('input[name="idNumber"]').forEach(input => {
            input.addEventListener('input', (e) => {
                // Remove invalid characters as user types
                e.target.value = e.target.value.replace(/[^a-zA-Z0-9\-]/g, '');
            });
        });
    }
}

// Auto-setup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    FormHelpers.setupAutoFormat();
});

// Export for use in other modules
window.FormValidator = FormValidator;
window.FormHelpers = FormHelpers;

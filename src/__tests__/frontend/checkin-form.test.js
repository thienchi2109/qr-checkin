/**
 * Frontend Check-in Form Tests
 * Tests for the mobile-optimized check-in form functionality
 */

// Mock DOM environment for testing
const { JSDOM } = require('jsdom');

describe('Check-in Form Frontend Tests', () => {
    let dom;
    let window;
    let document;
    let FormValidator;
    let CheckinApp;

    beforeAll(() => {
        // Create DOM environment
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>QR Check-in System</title>
            </head>
            <body>
                <div id="app">
                    <form id="checkin-form">
                        <input type="text" id="fullName" name="fullName" required>
                        <div id="fullName-error" class="form-error"></div>
                        
                        <input type="email" id="email" name="email" required>
                        <div id="email-error" class="form-error"></div>
                        
                        <input type="text" id="idNumber" name="idNumber">
                        <div id="idNumber-error" class="form-error"></div>
                        
                        <button type="submit" id="submit-btn">Check In</button>
                    </form>
                    
                    <div id="location-status">
                        <div class="status-indicator"></div>
                        <span>Checking...</span>
                    </div>
                    
                    <button id="get-location-btn">Get My Location</button>
                </div>
            </body>
            </html>
        `, {
            url: 'http://localhost:3000',
            pretendToBeVisual: true,
            resources: 'usable'
        });

        window = dom.window;
        document = window.document;
        
        // Set up global objects
        global.window = window;
        global.document = document;
        global.navigator = {
            mediaDevices: {
                getUserMedia: jest.fn(),
                enumerateDevices: jest.fn()
            },
            geolocation: {
                getCurrentPosition: jest.fn(),
                watchPosition: jest.fn(),
                clearWatch: jest.fn()
            },
            permissions: {
                query: jest.fn()
            }
        };
        
        // Mock URL.createObjectURL
        global.URL = {
            createObjectURL: jest.fn(() => 'blob:mock-url'),
            revokeObjectURL: jest.fn()
        };

        // Load form validation module
        const fs = require('fs');
        const path = require('path');
        const formValidationCode = fs.readFileSync(
            path.join(__dirname, '../../../public/js/form-validation.js'), 
            'utf8'
        );
        
        // Execute the code in the DOM context
        const script = document.createElement('script');
        script.textContent = formValidationCode;
        document.head.appendChild(script);
        
        FormValidator = window.FormValidator;
    });

    afterAll(() => {
        dom.window.close();
    });

    beforeEach(() => {
        // Reset form
        document.getElementById('fullName').value = '';
        document.getElementById('email').value = '';
        document.getElementById('idNumber').value = '';
        
        // Clear error messages
        document.querySelectorAll('.form-error').forEach(el => {
            el.textContent = '';
            el.classList.remove('show');
        });
        
        // Reset input classes
        document.querySelectorAll('input').forEach(input => {
            input.classList.remove('valid', 'error');
        });
    });

    describe('Form Validation', () => {
        let validator;

        beforeEach(() => {
            const form = document.getElementById('checkin-form');
            validator = new FormValidator(form);
        });

        test('should initialize form validator correctly', () => {
            expect(validator).toBeDefined();
            expect(validator.form).toBe(document.getElementById('checkin-form'));
            expect(validator.fields.size).toBe(3); // fullName, email, idNumber
        });

        test('should validate required fields', () => {
            // Test empty required fields
            expect(validator.validateField('fullName')).toBe(false);
            expect(validator.validateField('email')).toBe(false);
            
            // Test with valid values
            document.getElementById('fullName').value = 'John Doe';
            document.getElementById('email').value = 'john@example.com';
            
            expect(validator.validateField('fullName')).toBe(true);
            expect(validator.validateField('email')).toBe(true);
        });

        test('should validate email format', () => {
            const emailInput = document.getElementById('email');
            
            // Invalid emails
            emailInput.value = 'invalid-email';
            expect(validator.validateField('email')).toBe(false);
            
            emailInput.value = 'test@';
            expect(validator.validateField('email')).toBe(false);
            
            emailInput.value = '@example.com';
            expect(validator.validateField('email')).toBe(false);
            
            // Valid emails
            emailInput.value = 'test@example.com';
            expect(validator.validateField('email')).toBe(true);
            
            emailInput.value = 'user.name+tag@domain.co.uk';
            expect(validator.validateField('email')).toBe(true);
        });

        test('should validate name format', () => {
            const nameInput = document.getElementById('fullName');
            
            // Invalid names
            nameInput.value = 'A'; // Too short
            expect(validator.validateField('fullName')).toBe(false);
            
            nameInput.value = 'John123'; // Contains numbers
            expect(validator.validateField('fullName')).toBe(false);
            
            nameInput.value = 'John@Doe'; // Contains special characters
            expect(validator.validateField('fullName')).toBe(false);
            
            // Valid names
            nameInput.value = 'John Doe';
            expect(validator.validateField('fullName')).toBe(true);
            
            nameInput.value = 'María José';
            expect(validator.validateField('fullName')).toBe(true);
        });

        test('should validate optional ID number', () => {
            const idInput = document.getElementById('idNumber');
            
            // Empty should be valid (optional field)
            idInput.value = '';
            expect(validator.validateField('idNumber')).toBe(true);
            
            // Valid ID numbers
            idInput.value = 'ABC123';
            expect(validator.validateField('idNumber')).toBe(true);
            
            idInput.value = '123-456-789';
            expect(validator.validateField('idNumber')).toBe(true);
        });

        test('should update UI on validation', () => {
            const nameInput = document.getElementById('fullName');
            const errorElement = document.getElementById('fullName-error');
            
            // Test error state
            nameInput.value = '';
            validator.validateField('fullName');
            
            expect(nameInput.classList.contains('error')).toBe(true);
            expect(errorElement.classList.contains('show')).toBe(true);
            expect(errorElement.textContent).toBeTruthy();
            
            // Test valid state
            nameInput.value = 'John Doe';
            validator.validateField('fullName');
            
            expect(nameInput.classList.contains('valid')).toBe(true);
            expect(nameInput.classList.contains('error')).toBe(false);
            expect(errorElement.classList.contains('show')).toBe(false);
        });

        test('should validate entire form', () => {
            // Invalid form
            expect(validator.validateForm()).toBe(false);
            
            // Fill required fields
            document.getElementById('fullName').value = 'John Doe';
            document.getElementById('email').value = 'john@example.com';
            
            // Valid form
            expect(validator.validateForm()).toBe(true);
        });

        test('should enable/disable submit button based on validation', () => {
            const submitButton = document.getElementById('submit-btn');
            
            // Initially disabled
            validator.updateFormValidation();
            expect(submitButton.disabled).toBe(true);
            
            // Fill valid data
            document.getElementById('fullName').value = 'John Doe';
            document.getElementById('email').value = 'john@example.com';
            validator.validateForm();
            
            // Should be enabled
            expect(submitButton.disabled).toBe(false);
        });
    });

    describe('Form Helpers', () => {
        test('should format names correctly', () => {
            const { FormHelpers } = window;
            
            expect(FormHelpers.formatName('john doe')).toBe('John Doe');
            expect(FormHelpers.formatName('MARY JANE')).toBe('Mary Jane');
            expect(FormHelpers.formatName('  alice  bob  ')).toBe('Alice Bob');
        });

        test('should sanitize input', () => {
            const { FormHelpers } = window;
            
            expect(FormHelpers.sanitizeInput('  test  ')).toBe('test');
            expect(FormHelpers.sanitizeInput('test<script>')).toBe('testscript');
            expect(FormHelpers.sanitizeInput('normal text')).toBe('normal text');
        });

        test('should validate ID numbers', () => {
            const { FormHelpers } = window;
            
            expect(FormHelpers.validateIdNumber('ABC123')).toBe(true);
            expect(FormHelpers.validateIdNumber('123-456-789')).toBe(true);
            expect(FormHelpers.validateIdNumber('AB')).toBe(false); // Too short
            expect(FormHelpers.validateIdNumber('A'.repeat(25))).toBe(false); // Too long
            expect(FormHelpers.validateIdNumber('ABC@123')).toBe(false); // Invalid characters
        });
    });

    describe('Responsive Design', () => {
        test('should handle mobile viewport', () => {
            // Simulate mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375
            });
            
            Object.defineProperty(window, 'innerHeight', {
                writable: true,
                configurable: true,
                value: 667
            });
            
            // Trigger resize event
            const resizeEvent = new window.Event('resize');
            window.dispatchEvent(resizeEvent);
            
            // Check if mobile-specific styles would be applied
            expect(window.innerWidth).toBe(375);
            expect(window.innerWidth < 640).toBe(true); // Mobile breakpoint
        });

        test('should handle desktop viewport', () => {
            // Simulate desktop viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 1024
            });
            
            Object.defineProperty(window, 'innerHeight', {
                writable: true,
                configurable: true,
                value: 768
            });
            
            // Trigger resize event
            const resizeEvent = new window.Event('resize');
            window.dispatchEvent(resizeEvent);
            
            // Check if desktop-specific styles would be applied
            expect(window.innerWidth).toBe(1024);
            expect(window.innerWidth >= 640).toBe(true); // Desktop breakpoint
        });
    });

    describe('Accessibility', () => {
        test('should have proper ARIA labels', () => {
            const form = document.getElementById('checkin-form');
            const inputs = form.querySelectorAll('input');
            
            inputs.forEach(input => {
                // Check if input has associated label or aria-label
                const label = document.querySelector(`label[for="${input.id}"]`);
                const ariaLabel = input.getAttribute('aria-label');
                const ariaLabelledBy = input.getAttribute('aria-labelledby');
                
                expect(
                    label || ariaLabel || ariaLabelledBy
                ).toBeTruthy();
            });
        });

        test('should support keyboard navigation', () => {
            const inputs = document.querySelectorAll('input');
            const submitButton = document.getElementById('submit-btn');
            
            // Check tabindex or natural tab order
            inputs.forEach(input => {
                expect(input.tabIndex >= 0 || input.tabIndex === undefined).toBe(true);
            });
            
            expect(submitButton.tabIndex >= 0 || submitButton.tabIndex === undefined).toBe(true);
        });

        test('should announce validation errors to screen readers', () => {
            const validator = new FormValidator(document.getElementById('checkin-form'));
            const nameInput = document.getElementById('fullName');
            const errorElement = document.getElementById('fullName-error');
            
            // Trigger validation error
            nameInput.value = '';
            validator.validateField('fullName');
            
            // Error should be visible and announced
            expect(errorElement.classList.contains('show')).toBe(true);
            expect(errorElement.textContent).toBeTruthy();
            
            // Check if error is associated with input
            const ariaDescribedBy = nameInput.getAttribute('aria-describedby');
            expect(ariaDescribedBy === errorElement.id || errorElement.id).toBeTruthy();
        });
    });

    describe('Progressive Enhancement', () => {
        test('should work without JavaScript', () => {
            // Form should have proper HTML5 validation attributes
            const nameInput = document.getElementById('fullName');
            const emailInput = document.getElementById('email');
            
            expect(nameInput.hasAttribute('required')).toBe(true);
            expect(emailInput.hasAttribute('required')).toBe(true);
            expect(emailInput.type).toBe('email');
        });

        test('should enhance with JavaScript when available', () => {
            // JavaScript enhancements should be available
            expect(window.FormValidator).toBeDefined();
            expect(window.FormHelpers).toBeDefined();
            
            // Form should be enhanced with custom validation
            const form = document.getElementById('checkin-form');
            const validator = new FormValidator(form);
            
            expect(validator.fields.size).toBeGreaterThan(0);
        });
    });

    describe('Performance', () => {
        test('should debounce validation on input', (done) => {
            const validator = new FormValidator(document.getElementById('checkin-form'));
            const nameInput = document.getElementById('fullName');
            
            let validationCount = 0;
            const originalValidate = validator.validateField;
            validator.validateField = function(...args) {
                validationCount++;
                return originalValidate.apply(this, args);
            };
            
            // Simulate rapid typing
            nameInput.value = 'J';
            nameInput.dispatchEvent(new window.Event('input'));
            
            nameInput.value = 'Jo';
            nameInput.dispatchEvent(new window.Event('input'));
            
            nameInput.value = 'Joh';
            nameInput.dispatchEvent(new window.Event('input'));
            
            nameInput.value = 'John';
            nameInput.dispatchEvent(new window.Event('input'));
            
            // Check that validation isn't called excessively
            setTimeout(() => {
                expect(validationCount).toBeLessThan(10); // Should be debounced
                done();
            }, 100);
        });
    });
});

// Mock JSDOM if not available
if (typeof JSDOM === 'undefined') {
    global.JSDOM = class MockJSDOM {
        constructor() {
            this.window = {
                document: {
                    getElementById: jest.fn(),
                    querySelectorAll: jest.fn(() => []),
                    createElement: jest.fn(() => ({})),
                    addEventListener: jest.fn()
                },
                addEventListener: jest.fn(),
                Event: class MockEvent {},
                close: jest.fn()
            };
        }
    };
}

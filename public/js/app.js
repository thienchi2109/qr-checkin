/**
 * Main Application
 * Coordinates all modules and handles app flow
 */

class CheckinApp {
    constructor() {
        this.currentScreen = 'welcome';
        this.qrScanner = null;
        this.camera = null;
        this.photoUpload = null;
        this.locationService = null;
        this.locationUI = null;
        this.formValidator = null;
        this.currentEventData = null;
        this.currentPhoto = null;
        
        // Initialize app
        this.init();
    }
    
    /**
     * Initialize the application
     */
    async init() {
        try {
            // Show loading screen
            this.showLoadingScreen();
            
            // Initialize services
            await this.initializeServices();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup form validation
            this.setupFormValidation();
            
            // Hide loading screen and show welcome
            this.hideLoadingScreen();
            this.showScreen('welcome');
            
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showError('Không thể khởi tạo ứng dụng', error.message);
        }
    }
    
    /**
     * Initialize services
     */
    async initializeServices() {
        // Initialize QR Scanner
        this.qrScanner = new QRScanner()
            .onSuccess((qrData) => this.handleQRScanSuccess(qrData))
            .onError((error, message) => this.handleQRScanError(error, message));
        
        // Initialize Camera
        this.camera = new Camera()
            .onPhoto((photo) => this.handlePhotoTaken(photo))
            .onCameraError((error, message) => this.handleCameraError(error, message));
        
        // Initialize Photo Upload
        this.photoUpload = new PhotoUpload()
            .onPhoto((photo) => this.handlePhotoSelected(photo))
            .onUploadError((error, message) => this.handleUploadError(error, message));
        
        // Initialize Location Service
        this.locationService = new LocationService()
            .onUpdate((position) => this.handleLocationUpdate(position))
            .onError((error) => this.handleLocationError(error));
        
        // Initialize Location UI
        this.locationUI = new LocationUI(this.locationService);
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Welcome screen buttons
        document.getElementById('scan-qr-btn')?.addEventListener('click', () => {
            this.startQRScanning();
        });
        
        document.getElementById('manual-entry-btn')?.addEventListener('click', () => {
            this.showManualEntry();
        });
        
        // Scanner screen buttons
        document.getElementById('back-from-scanner')?.addEventListener('click', () => {
            this.showScreen('welcome');
        });
        
        document.getElementById('toggle-flash')?.addEventListener('click', () => {
            this.toggleFlash();
        });
        
        // Check-in form buttons
        document.getElementById('back-from-checkin')?.addEventListener('click', () => {
            this.showScreen('welcome');
        });
        
        // Photo buttons
        document.getElementById('take-photo-btn')?.addEventListener('click', () => {
            this.openCameraModal();
        });
        
        document.getElementById('upload-photo-btn')?.addEventListener('click', () => {
            this.openFileUpload();
        });
        
        document.getElementById('retake-photo-btn')?.addEventListener('click', () => {
            this.openCameraModal();
        });
        
        document.getElementById('remove-photo-btn')?.addEventListener('click', () => {
            this.removePhoto();
        });
        
        // Camera modal buttons
        document.getElementById('close-camera-modal')?.addEventListener('click', () => {
            this.closeCameraModal();
        });
        
        document.getElementById('capture-photo-btn')?.addEventListener('click', () => {
            this.capturePhoto();
        });
        
        // File input
        document.getElementById('photo-input')?.addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });
        
        // Success/Error screen buttons
        document.getElementById('new-checkin-btn')?.addEventListener('click', () => {
            this.resetApp();
        });
        
        document.getElementById('retry-btn')?.addEventListener('click', () => {
            this.retryLastAction();
        });
        
        document.getElementById('back-to-home-btn')?.addEventListener('click', () => {
            this.showScreen('welcome');
        });
        
        // Help modal
        document.getElementById('help-btn')?.addEventListener('click', () => {
            this.showHelpModal();
        });
        
        document.getElementById('close-help-modal')?.addEventListener('click', () => {
            this.closeHelpModal();
        });
        
        // Modal backdrop clicks
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal);
                }
            });
        });
    }
    
    /**
     * Setup form validation
     */
    setupFormValidation() {
        const form = document.getElementById('checkin-form');
        if (form) {
            this.formValidator = new FormValidator(form)
                .onChange((isValid, formData) => {
                    this.handleFormValidationChange(isValid, formData);
                });
            
            // Handle form submission
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitCheckin();
            });
        }
    }
    
    /**
     * Show loading screen
     */
    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (loadingScreen) loadingScreen.style.display = 'flex';
        if (app) app.style.display = 'none';
    }
    
    /**
     * Hide loading screen
     */
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        const app = document.getElementById('app');
        
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 300);
        }
        
        if (app) app.style.display = 'flex';
    }
    
    /**
     * Show a specific screen
     */
    showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenName;
        }
        
        // Cleanup based on screen
        this.handleScreenChange(screenName);
    }
    
    /**
     * Handle screen changes
     */
    handleScreenChange(screenName) {
        switch (screenName) {
            case 'welcome':
                this.qrScanner?.stopScanning();
                this.camera?.stopCamera();
                break;
            case 'scanner':
                // Scanner will be started separately
                break;
            case 'checkin':
                this.qrScanner?.stopScanning();
                break;
        }
    }
    
    /**
     * Start QR scanning
     */
    async startQRScanning() {
        try {
            this.showScreen('scanner');
            await this.qrScanner.startScanning();
        } catch (error) {
            console.error('Error starting QR scanner:', error);
            this.showError('Lỗi máy quét', 'Không thể khởi động máy quét QR. Vui lòng thử lại.');
        }
    }
    
    /**
     * Show manual entry (demo mode)
     */
    showManualEntry() {
        // For demo purposes, simulate QR scan with demo data
        const demoData = {
            eventId: 'demo-event-123',
            token: 'demo-token-456',
            timestamp: Date.now(),
            type: 'checkin'
        };
        
        this.handleQRScanSuccess(demoData);
    }
    
    /**
     * Handle QR scan success
     */
    async handleQRScanSuccess(qrData) {
        try {
            this.showToast('success', 'Đã quét mã QR', 'Đang tải thông tin sự kiện...');

            // Fetch event data
            const eventData = await this.fetchEventData(qrData.eventId, qrData.token);
            this.currentEventData = { ...qrData, ...eventData };

            // Show check-in form
            this.showCheckinForm();

        } catch (error) {
            console.error('Error handling QR scan:', error);
            this.showError('Lỗi sự kiện', 'Không thể tải thông tin sự kiện. Vui lòng thử lại.');
        }
    }
    
    /**
     * Handle QR scan error
     */
    handleQRScanError(error, message) {
        console.error('QR scan error:', error);
        this.showError('Scanner Error', message);
    }
    
    /**
     * Fetch event data from API
     */
    async fetchEventData(eventId, token) {
        try {
            // For demo purposes, return mock data
            // In real implementation, make API call to validate QR token and get event data
            
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({
                        name: 'Hội nghị Công nghệ 2024',
                        description: 'Hội nghị công nghệ thường niên giới thiệu những đổi mới mới nhất',
                        startTime: '2024-03-15T09:00:00Z',
                        endTime: '2024-03-15T17:00:00Z',
                        location: 'Trung tâm Hội nghị, Hội trường chính',
                        isActive: true,
                        requiresLocation: true,
                        allowedRadius: 100, // meters
                        eventLocation: {
                            latitude: 40.7128,
                            longitude: -74.0060
                        }
                    });
                }, 1000);
            });
            
        } catch (error) {
            console.error('Error fetching event data:', error);
            throw new Error('Không thể tải thông tin sự kiện');
        }
    }
    
    /**
     * Show check-in form
     */
    showCheckinForm() {
        if (!this.currentEventData) return;
        
        // Update event information
        document.getElementById('event-title').textContent = this.currentEventData.name;
        document.getElementById('event-description').textContent = this.currentEventData.description;
        
        // Format and display event time
        const startTime = new Date(this.currentEventData.startTime);
        const endTime = new Date(this.currentEventData.endTime);
        document.getElementById('event-time-text').textContent = 
            `${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`;
        
        document.getElementById('event-location-text').textContent = this.currentEventData.location;
        
        // Update event status
        const statusBadge = document.querySelector('.status-badge');
        if (this.currentEventData.isActive) {
            statusBadge.classList.add('active');
            statusBadge.classList.remove('inactive');
            statusBadge.querySelector('span').textContent = 'Đang hoạt động';
        } else {
            statusBadge.classList.add('inactive');
            statusBadge.classList.remove('active');
            statusBadge.querySelector('span').textContent = 'Không hoạt động';
        }
        
        // Show the form
        this.showScreen('checkin');
        
        // Auto-request location if required
        if (this.currentEventData.requiresLocation) {
            setTimeout(() => {
                this.locationUI.requestLocation();
            }, 500);
        }
    }
    
    /**
     * Handle form validation changes
     */
    handleFormValidationChange(isValid, formData) {
        // Form validation is handled by FormValidator
        // Additional logic can be added here if needed
    }
    
    /**
     * Submit check-in
     */
    async submitCheckin() {
        try {
            if (!this.formValidator.validateForm()) {
                this.showToast('error', 'Lỗi xác thực', 'Vui lòng sửa các lỗi trong form');
                return;
            }
            
            // Show loading state
            this.setSubmitButtonLoading(true);
            
            // Prepare submission data
            const formData = this.formValidator.getFormData();
            const submissionData = {
                eventId: this.currentEventData.eventId,
                token: this.currentEventData.token,
                userData: {
                    name: formData.fullName,
                    email: formData.email,
                    idNumber: formData.idNumber || null
                },
                location: this.locationService.getLocationData(),
                photo: this.currentPhoto,
                timestamp: Date.now()
            };
            
            // Submit to API
            const result = await this.submitToAPI(submissionData);
            
            // Show success
            this.showSuccess(result);
            
        } catch (error) {
            console.error('Error submitting check-in:', error);
            this.showError('Lỗi gửi dữ liệu', error.message || 'Không thể gửi check-in. Vui lòng thử lại.');
        } finally {
            this.setSubmitButtonLoading(false);
        }
    }
    
    /**
     * Submit data to API
     */
    async submitToAPI(data) {
        // For demo purposes, simulate API call
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate success/failure
                if (Math.random() > 0.1) { // 90% success rate
                    resolve({
                        success: true,
                        checkinId: 'checkin-' + Date.now(),
                        message: 'Check-in thành công!',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    reject(new Error('Đã xảy ra lỗi máy chủ'));
                }
            }, 2000);
        });
    }
    
    /**
     * Set submit button loading state
     */
    setSubmitButtonLoading(loading) {
        const submitBtn = document.getElementById('submit-btn');
        if (!submitBtn) return;
        
        if (loading) {
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
        } else {
            submitBtn.classList.remove('loading');
            submitBtn.disabled = !this.formValidator?.isValid;
        }
    }
    
    /**
     * Show success screen
     */
    showSuccess(result) {
        document.getElementById('success-message').textContent = result.message;
        
        // Show success details
        const detailsElement = document.getElementById('success-details');
        detailsElement.innerHTML = `
            <div><strong>Mã Check-in:</strong> ${result.checkinId}</div>
            <div><strong>Sự kiện:</strong> ${this.currentEventData.name}</div>
            <div><strong>Thời gian:</strong> ${new Date(result.timestamp).toLocaleString('vi-VN')}</div>
        `;
        
        this.showScreen('success');
    }
    
    /**
     * Show error screen
     */
    showError(title, message, details = null) {
        document.getElementById('error-title').textContent = title;
        document.getElementById('error-message').textContent = message;
        
        const detailsElement = document.getElementById('error-details');
        if (details) {
            detailsElement.textContent = details;
            detailsElement.style.display = 'block';
        } else {
            detailsElement.style.display = 'none';
        }
        
        this.showScreen('error');
    }
    
    /**
     * Show toast notification
     */
    showToast(type, title, message) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = this.getToastIcon(type);
        
        toast.innerHTML = `
            ${icon}
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        
        // Add close functionality
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.closeToast(toast);
        });
        
        // Add to container
        container.appendChild(toast);
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto-close after 5 seconds
        setTimeout(() => this.closeToast(toast), 5000);
    }
    
    /**
     * Get toast icon SVG
     */
    getToastIcon(type) {
        const icons = {
            success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 12l2 2 4-4"/>
                <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>
            </svg>`,
            error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>`,
            warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>`,
            info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>`
        };
        
        return icons[type] || icons.info;
    }
    
    /**
     * Close toast notification
     */
    closeToast(toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }
    
    /**
     * Reset app to initial state
     */
    resetApp() {
        // Reset data
        this.currentEventData = null;
        this.currentPhoto = null;
        
        // Reset form
        this.formValidator?.reset();
        
        // Reset photo UI
        this.removePhoto();
        
        // Reset location
        this.locationService?.stopWatching();
        
        // Show welcome screen
        this.showScreen('welcome');
    }
    
    /**
     * Handle location updates
     */
    handleLocationUpdate(position) {
        // Location UI will handle the display updates
        // Additional logic can be added here if needed
    }
    
    /**
     * Handle location errors
     */
    handleLocationError(error) {
        this.showToast('error', 'Lỗi vị trí', error.message);
    }
    
    /**
     * Open camera modal
     */
    async openCameraModal() {
        const modal = document.getElementById('camera-modal');
        if (!modal) return;
        
        try {
            modal.classList.add('show');
            await this.camera.startCamera();
        } catch (error) {
            this.closeCameraModal();
            this.showToast('error', 'Camera Error', 'Failed to start camera');
        }
    }
    
    /**
     * Close camera modal
     */
    closeCameraModal() {
        const modal = document.getElementById('camera-modal');
        if (modal) {
            modal.classList.remove('show');
        }
        this.camera.stopCamera();
    }
    
    /**
     * Capture photo from camera
     */
    async capturePhoto() {
        try {
            await this.camera.capturePhoto();
            this.closeCameraModal();
        } catch (error) {
            this.showToast('error', 'Capture Error', 'Failed to capture photo');
        }
    }
    
    /**
     * Handle photo taken from camera
     */
    handlePhotoTaken(photo) {
        this.currentPhoto = photo;
        this.showPhotoPreview(photo);
        this.showToast('success', 'Đã chụp ảnh', 'Ảnh đã được chụp thành công');
    }

    /**
     * Handle camera errors
     */
    handleCameraError(error, message) {
        this.showToast('error', 'Lỗi camera', message);
    }
    
    /**
     * Open file upload
     */
    openFileUpload() {
        const fileInput = document.getElementById('photo-input');
        if (fileInput) {
            fileInput.click();
        }
    }
    
    /**
     * Handle file selection
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            try {
                const photo = this.photoUpload.handleFileSelect(file);
                // Photo will be handled by the callback
            } catch (error) {
                this.showToast('error', 'Lỗi tải lên', error.message);
            }
        }
    }
    
    /**
     * Handle photo selected from upload
     */
    handlePhotoSelected(photo) {
        this.currentPhoto = photo;
        this.showPhotoPreview(photo);
        this.showToast('success', 'Đã chọn ảnh', 'Ảnh đã được tải lên thành công');
    }

    /**
     * Handle upload errors
     */
    handleUploadError(error, message) {
        this.showToast('error', 'Lỗi tải lên', message);
    }
    
    /**
     * Show photo preview
     */
    showPhotoPreview(photo) {
        const uploadArea = document.getElementById('photo-upload-area');
        const previewArea = document.getElementById('photo-preview');
        const previewImage = document.getElementById('preview-image');
        
        if (uploadArea) uploadArea.style.display = 'none';
        if (previewArea) previewArea.style.display = 'block';
        if (previewImage) previewImage.src = photo.previewUrl;
    }
    
    /**
     * Remove photo
     */
    removePhoto() {
        const uploadArea = document.getElementById('photo-upload-area');
        const previewArea = document.getElementById('photo-preview');
        const previewImage = document.getElementById('preview-image');
        const fileInput = document.getElementById('photo-input');
        
        // Clean up current photo
        if (this.currentPhoto && this.currentPhoto.previewUrl) {
            URL.revokeObjectURL(this.currentPhoto.previewUrl);
        }
        
        this.currentPhoto = null;
        
        // Reset UI
        if (uploadArea) uploadArea.style.display = 'block';
        if (previewArea) previewArea.style.display = 'none';
        if (previewImage) previewImage.src = '';
        if (fileInput) fileInput.value = '';
    }
    
    /**
     * Toggle camera flash
     */
    async toggleFlash() {
        try {
            const flashOn = await this.qrScanner.toggleFlash();
            const flashBtn = document.getElementById('toggle-flash');
            
            if (flashBtn) {
                flashBtn.classList.toggle('active', flashOn);
            }
        } catch (error) {
            this.showToast('warning', 'Đèn flash', 'Đèn flash không khả dụng trên thiết bị này');
        }
    }
    
    /**
     * Show help modal
     */
    showHelpModal() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    /**
     * Close help modal
     */
    closeHelpModal() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    /**
     * Close any modal
     */
    closeModal(modal) {
        modal.classList.remove('show');
        
        // Stop camera if it's the camera modal
        if (modal.id === 'camera-modal') {
            this.camera.stopCamera();
        }
    }
    
    /**
     * Retry last action
     */
    retryLastAction() {
        // For now, just go back to welcome screen
        // In a more complex app, you'd track the last action and retry it
        this.showScreen('welcome');
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.qrScanner?.destroy();
        this.camera?.destroy();
        this.locationService?.destroy();
        
        // Clean up photo URLs
        if (this.currentPhoto && this.currentPhoto.previewUrl) {
            URL.revokeObjectURL(this.currentPhoto.previewUrl);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.checkinApp = new CheckinApp();
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    if (window.checkinApp) {
        window.checkinApp.destroy();
    }
});

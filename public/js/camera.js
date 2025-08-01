/**
 * Camera Module
 * Handles camera functionality for taking selfies
 */

class Camera {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.stream = null;
        this.isActive = false;
        this.onPhotoTaken = null;
        this.onError = null;
        
        // Initialize camera elements
        this.initializeElements();
        
        // Bind methods
        this.startCamera = this.startCamera.bind(this);
        this.stopCamera = this.stopCamera.bind(this);
        this.capturePhoto = this.capturePhoto.bind(this);
    }
    
    initializeElements() {
        this.video = document.getElementById('camera-video');
        this.canvas = document.getElementById('camera-canvas');
        
        if (this.canvas) {
            this.context = this.canvas.getContext('2d');
        }
    }
    
    /**
     * Check if camera is supported
     */
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
    
    /**
     * Start the camera
     */
    async startCamera(options = {}) {
        try {
            if (!Camera.isSupported()) {
                throw new Error('Truy cập camera không được hỗ trợ trên trình duyệt này');
            }
            
            if (this.isActive) {
                return;
            }
            
            // Request camera permission with front camera for selfies
            const constraints = {
                video: {
                    facingMode: options.facingMode || 'user', // Front camera for selfies
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            if (this.video) {
                this.video.srcObject = this.stream;
                this.video.setAttribute('playsinline', true);
                
                // Wait for video to be ready
                await new Promise((resolve, reject) => {
                    this.video.onloadedmetadata = () => resolve();
                    this.video.onerror = reject;
                    
                    // Timeout after 10 seconds
                    setTimeout(() => reject(new Error('Camera đã hết thời gian chờ')), 10000);
                });
                
                await this.video.play();
                
                // Set up canvas dimensions
                if (this.canvas) {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                }
                
                this.isActive = true;
            }
            
        } catch (error) {
            console.error('Error starting camera:', error);
            this.handleError(error);
        }
    }
    
    /**
     * Stop the camera
     */
    stopCamera() {
        this.isActive = false;
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.video) {
            this.video.srcObject = null;
        }
    }
    
    /**
     * Capture a photo from the video stream
     */
    capturePhoto() {
        if (!this.isActive || !this.video || !this.canvas || !this.context) {
            throw new Error('Camera không hoạt động');
        }
        
        try {
            // Set canvas dimensions to match video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Draw video frame to canvas
            this.context.drawImage(this.video, 0, 0);
            
            // Convert to blob
            return new Promise((resolve, reject) => {
                this.canvas.toBlob((blob) => {
                    if (blob) {
                        // Create file object
                        const file = new File([blob], `selfie-${Date.now()}.jpg`, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        
                        // Create preview URL
                        const previewUrl = URL.createObjectURL(blob);
                        
                        const result = {
                            file: file,
                            blob: blob,
                            previewUrl: previewUrl,
                            width: this.canvas.width,
                            height: this.canvas.height
                        };
                        
                        if (this.onPhotoTaken) {
                            this.onPhotoTaken(result);
                        }
                        
                        resolve(result);
                    } else {
                        const error = new Error('Không thể chụp ảnh');
                        this.handleError(error);
                        reject(error);
                    }
                }, 'image/jpeg', 0.8); // 80% quality
            });
            
        } catch (error) {
            console.error('Error capturing photo:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * Handle camera errors
     */
    handleError(error) {
        this.stopCamera();

        let errorMessage = 'Đã xảy ra lỗi camera';

        if (error.name === 'NotAllowedError') {
            errorMessage = 'Quyền truy cập camera bị từ chối. Vui lòng cho phép truy cập camera và thử lại.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'Không tìm thấy camera trên thiết bị này.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Camera không được hỗ trợ trên trình duyệt này.';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'Camera đang được sử dụng bởi ứng dụng khác.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        if (this.onError) {
            this.onError(error, errorMessage);
        }
    }
    
    /**
     * Get available cameras
     */
    static async getAvailableCameras() {
        try {
            if (!Camera.isSupported()) {
                return [];
            }
            
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
            
        } catch (error) {
            console.error('Error getting available cameras:', error);
            return [];
        }
    }
    
    /**
     * Check if device has multiple cameras
     */
    static async hasMultipleCameras() {
        const cameras = await Camera.getAvailableCameras();
        return cameras.length > 1;
    }
    
    /**
     * Switch between front and back camera
     */
    async switchCamera() {
        if (!this.isActive) return;
        
        try {
            const currentTrack = this.stream.getVideoTracks()[0];
            const currentSettings = currentTrack.getSettings();
            const currentFacingMode = currentSettings.facingMode;
            
            // Determine new facing mode
            let newFacingMode;
            if (currentFacingMode === 'user') {
                newFacingMode = 'environment';
            } else {
                newFacingMode = 'user';
            }
            
            // Stop current camera and start with new facing mode
            this.stopCamera();
            await this.startCamera({ facingMode: newFacingMode });
            
        } catch (error) {
            console.error('Error switching camera:', error);
            this.handleError(error);
        }
    }
    
    /**
     * Set photo taken callback
     */
    onPhoto(callback) {
        this.onPhotoTaken = callback;
        return this;
    }
    
    /**
     * Set error callback
     */
    onCameraError(callback) {
        this.onError = callback;
        return this;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.stopCamera();
        this.onPhotoTaken = null;
        this.onError = null;
    }
}

/**
 * Photo Upload Handler
 * Handles file upload functionality
 */
class PhotoUpload {
    constructor() {
        this.onPhotoSelected = null;
        this.onError = null;
        this.maxFileSize = 5 * 1024 * 1024; // 5MB
        this.allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    }
    
    /**
     * Handle file selection
     */
    handleFileSelect(file) {
        try {
            // Validate file
            this.validateFile(file);
            
            // Create preview
            const previewUrl = URL.createObjectURL(file);
            
            const result = {
                file: file,
                previewUrl: previewUrl,
                name: file.name,
                size: file.size,
                type: file.type
            };
            
            if (this.onPhotoSelected) {
                this.onPhotoSelected(result);
            }
            
            return result;
            
        } catch (error) {
            console.error('Error handling file select:', error);
            this.handleError(error);
            throw error;
        }
    }
    
    /**
     * Validate uploaded file
     */
    validateFile(file) {
        if (!file) {
            throw new Error('Không có file nào được chọn');
        }

        if (!this.allowedTypes.includes(file.type)) {
            throw new Error('Loại file không hợp lệ. Vui lòng chọn ảnh JPEG, PNG hoặc WebP.');
        }

        if (file.size > this.maxFileSize) {
            throw new Error(`Kích thước file quá lớn. Kích thước tối đa là ${this.maxFileSize / 1024 / 1024}MB.`);
        }
    }
    
    /**
     * Compress image if needed
     */
    async compressImage(file, maxWidth = 800, maxHeight = 600, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                // Set canvas dimensions
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error('Không thể nén ảnh'));
                    }
                }, 'image/jpeg', quality);
            };
            
            img.onerror = () => reject(new Error('Không thể tải ảnh'));
            img.src = URL.createObjectURL(file);
        });
    }
    
    /**
     * Handle upload errors
     */
    handleError(error) {
        if (this.onError) {
            this.onError(error, error.message);
        }
    }
    
    /**
     * Set photo selected callback
     */
    onPhoto(callback) {
        this.onPhotoSelected = callback;
        return this;
    }
    
    /**
     * Set error callback
     */
    onUploadError(callback) {
        this.onError = callback;
        return this;
    }
}

// Export for use in other modules
window.Camera = Camera;
window.PhotoUpload = PhotoUpload;

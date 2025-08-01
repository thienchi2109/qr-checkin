/**
 * QR Scanner Module
 * Handles QR code scanning functionality using device camera
 */

class QRScanner {
    constructor() {
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.stream = null;
        this.isScanning = false;
        this.scanInterval = null;
        this.onScanSuccess = null;
        this.onScanError = null;
        
        // Initialize scanner elements
        this.initializeElements();
        
        // Bind methods
        this.startScanning = this.startScanning.bind(this);
        this.stopScanning = this.stopScanning.bind(this);
        this.scanFrame = this.scanFrame.bind(this);
    }
    
    initializeElements() {
        this.video = document.getElementById('scanner-video');
        this.canvas = document.getElementById('scanner-canvas');
        
        if (this.canvas) {
            this.context = this.canvas.getContext('2d');
        }
    }
    
    /**
     * Check if the browser supports camera access
     */
    static isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }
    
    /**
     * Start the QR scanner
     */
    async startScanning(options = {}) {
        try {
            if (!QRScanner.isSupported()) {
                throw new Error('Truy cập camera không được hỗ trợ trên trình duyệt này');
            }
            
            if (this.isScanning) {
                return;
            }
            
            // Request camera permission
            const constraints = {
                video: {
                    facingMode: options.facingMode || 'environment', // Use back camera by default
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            if (this.video) {
                this.video.srcObject = this.stream;
                this.video.setAttribute('playsinline', true);
                
                // Wait for video to be ready
                await new Promise((resolve) => {
                    this.video.onloadedmetadata = () => {
                        resolve();
                    };
                });
                
                await this.video.play();
                
                // Set up canvas dimensions
                if (this.canvas) {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                }
                
                this.isScanning = true;
                this.startScanLoop();
                
                // Update UI
                this.updateScannerStatus('Đang quét mã QR...', 'scanning');
            }
            
        } catch (error) {
            console.error('Error starting QR scanner:', error);
            this.handleScanError(error);
        }
    }
    
    /**
     * Stop the QR scanner
     */
    stopScanning() {
        this.isScanning = false;
        
        if (this.scanInterval) {
            clearInterval(this.scanInterval);
            this.scanInterval = null;
        }
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.video) {
            this.video.srcObject = null;
        }
        
        this.updateScannerStatus('Máy quét đã dừng', 'stopped');
    }
    
    /**
     * Start the scanning loop
     */
    startScanLoop() {
        if (!this.isScanning) return;
        
        this.scanInterval = setInterval(() => {
            if (this.isScanning && this.video && this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
                this.scanFrame();
            }
        }, 100); // Scan every 100ms
    }
    
    /**
     * Scan a single frame for QR codes
     */
    scanFrame() {
        if (!this.context || !this.video || !this.canvas) return;
        
        try {
            // Draw video frame to canvas
            this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Get image data
            const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
            
            // Try to decode QR code
            const qrCode = this.decodeQRCode(imageData);
            
            if (qrCode) {
                this.handleScanSuccess(qrCode);
            }
            
        } catch (error) {
            console.error('Error scanning frame:', error);
        }
    }
    
    /**
     * Decode QR code from image data
     * This is a simplified implementation - in a real app, you'd use a library like jsQR
     */
    decodeQRCode(imageData) {
        // For demo purposes, we'll simulate QR code detection
        // In a real implementation, you would use a library like jsQR:
        // return jsQR(imageData.data, imageData.width, imageData.height);
        
        // Simulate finding a QR code occasionally for demo
        if (Math.random() < 0.01) { // 1% chance per frame
            return {
                data: this.generateDemoQRData(),
                location: {
                    topLeftCorner: { x: 100, y: 100 },
                    topRightCorner: { x: 200, y: 100 },
                    bottomLeftCorner: { x: 100, y: 200 },
                    bottomRightCorner: { x: 200, y: 200 }
                }
            };
        }
        
        return null;
    }
    
    /**
     * Generate demo QR data for testing
     */
    generateDemoQRData() {
        const eventId = 'demo-event-' + Date.now();
        const token = 'qr-token-' + Math.random().toString(36).substr(2, 9);
        
        return JSON.stringify({
            eventId: eventId,
            token: token,
            timestamp: Date.now(),
            type: 'checkin'
        });
    }
    
    /**
     * Handle successful QR code scan
     */
    handleScanSuccess(qrCode) {
        this.stopScanning();
        this.updateScannerStatus('Đã phát hiện mã QR!', 'success');
        
        try {
            // Parse QR code data
            let qrData;
            try {
                qrData = JSON.parse(qrCode.data);
            } catch (e) {
                // If not JSON, treat as plain text
                qrData = { data: qrCode.data };
            }
            
            if (this.onScanSuccess) {
                this.onScanSuccess(qrData);
            }
            
        } catch (error) {
            console.error('Error processing QR code:', error);
            this.handleScanError(new Error('Định dạng mã QR không hợp lệ'));
        }
    }
    
    /**
     * Handle scan error
     */
    handleScanError(error) {
        this.stopScanning();

        let errorMessage = 'Không thể quét mã QR';

        if (error.name === 'NotAllowedError') {
            errorMessage = 'Quyền truy cập camera bị từ chối. Vui lòng cho phép truy cập camera và thử lại.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'Không tìm thấy camera trên thiết bị này.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage = 'Camera không được hỗ trợ trên trình duyệt này.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        
        this.updateScannerStatus(errorMessage, 'error');
        
        if (this.onScanError) {
            this.onScanError(error, errorMessage);
        }
    }
    
    /**
     * Update scanner status UI
     */
    updateScannerStatus(message, status) {
        const statusElement = document.getElementById('scanner-status');
        if (!statusElement) return;
        
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('span');
        
        if (text) {
            text.textContent = message;
        }
        
        if (indicator) {
            // Remove all status classes
            indicator.classList.remove('pending', 'success', 'error', 'scanning');
            
            // Add current status class
            if (status) {
                indicator.classList.add(status);
            }
        }
    }
    
    /**
     * Toggle camera flash (if supported)
     */
    async toggleFlash() {
        if (!this.stream) return;
        
        try {
            const track = this.stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            if (capabilities.torch) {
                const settings = track.getSettings();
                const newTorchState = !settings.torch;
                
                await track.applyConstraints({
                    advanced: [{ torch: newTorchState }]
                });
                
                return newTorchState;
            }
        } catch (error) {
            console.error('Error toggling flash:', error);
        }
        
        return false;
    }
    
    /**
     * Switch camera (front/back)
     */
    async switchCamera() {
        if (!this.isScanning) return;
        
        try {
            const currentTrack = this.stream.getVideoTracks()[0];
            const currentFacingMode = currentTrack.getSettings().facingMode;
            const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
            
            this.stopScanning();
            await this.startScanning({ facingMode: newFacingMode });
            
        } catch (error) {
            console.error('Error switching camera:', error);
            this.handleScanError(error);
        }
    }
    
    /**
     * Set scan success callback
     */
    onSuccess(callback) {
        this.onScanSuccess = callback;
        return this;
    }
    
    /**
     * Set scan error callback
     */
    onError(callback) {
        this.onScanError = callback;
        return this;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.stopScanning();
        this.onScanSuccess = null;
        this.onScanError = null;
    }
}

// Export for use in other modules
window.QRScanner = QRScanner;

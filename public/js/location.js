/**
 * Location Module
 * Handles geolocation functionality for check-in verification
 */

class LocationService {
    constructor() {
        this.currentPosition = null;
        this.watchId = null;
        this.onLocationUpdate = null;
        this.onLocationError = null;
        this.isWatching = false;
        
        // Default options for geolocation
        this.defaultOptions = {
            enableHighAccuracy: true,
            timeout: 10000, // 10 seconds
            maximumAge: 60000 // 1 minute
        };
    }
    
    /**
     * Check if geolocation is supported
     */
    static isSupported() {
        return 'geolocation' in navigator;
    }
    
    /**
     * Get current position once
     */
    async getCurrentPosition(options = {}) {
        return new Promise((resolve, reject) => {
            if (!LocationService.isSupported()) {
                const error = new Error('Định vị không được hỗ trợ trên trình duyệt này');
                this.handleError(error);
                reject(error);
                return;
            }
            
            const finalOptions = { ...this.defaultOptions, ...options };
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    this.currentPosition = this.formatPosition(position);
                    
                    if (this.onLocationUpdate) {
                        this.onLocationUpdate(this.currentPosition);
                    }
                    
                    resolve(this.currentPosition);
                },
                (error) => {
                    this.handleError(error);
                    reject(error);
                },
                finalOptions
            );
        });
    }
    
    /**
     * Start watching position changes
     */
    startWatching(options = {}) {
        if (!LocationService.isSupported()) {
            const error = new Error('Định vị không được hỗ trợ trên trình duyệt này');
            this.handleError(error);
            return;
        }
        
        if (this.isWatching) {
            return;
        }
        
        const finalOptions = { ...this.defaultOptions, ...options };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.currentPosition = this.formatPosition(position);
                
                if (this.onLocationUpdate) {
                    this.onLocationUpdate(this.currentPosition);
                }
            },
            (error) => {
                this.handleError(error);
            },
            finalOptions
        );
        
        this.isWatching = true;
    }
    
    /**
     * Stop watching position changes
     */
    stopWatching() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
            this.isWatching = false;
        }
    }
    
    /**
     * Format position object
     */
    formatPosition(position) {
        return {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp
        };
    }
    
    /**
     * Calculate distance between two points using Haversine formula
     */
    static calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return R * c; // Distance in meters
    }
    
    /**
     * Check if user is within allowed radius of event location
     */
    isWithinRadius(eventLat, eventLon, allowedRadius = 100) {
        if (!this.currentPosition) {
            return false;
        }
        
        const distance = LocationService.calculateDistance(
            this.currentPosition.latitude,
            this.currentPosition.longitude,
            eventLat,
            eventLon
        );
        
        return distance <= allowedRadius;
    }
    
    /**
     * Get location accuracy status
     */
    getAccuracyStatus() {
        if (!this.currentPosition || !this.currentPosition.accuracy) {
            return 'unknown';
        }
        
        const accuracy = this.currentPosition.accuracy;
        
        if (accuracy <= 10) {
            return 'excellent'; // Very accurate
        } else if (accuracy <= 50) {
            return 'good'; // Good accuracy
        } else if (accuracy <= 100) {
            return 'fair'; // Fair accuracy
        } else {
            return 'poor'; // Poor accuracy
        }
    }
    
    /**
     * Handle geolocation errors
     */
    handleError(error) {
        let errorMessage = 'Location error occurred';
        let errorCode = 'UNKNOWN_ERROR';
        
        switch (error.code) {
            case error.PERMISSION_DENIED:
                errorMessage = 'Quyền truy cập vị trí bị từ chối. Vui lòng cho phép truy cập vị trí và thử lại.';
                errorCode = 'PERMISSION_DENIED';
                break;
            case error.POSITION_UNAVAILABLE:
                errorMessage = 'Thông tin vị trí không khả dụng. Vui lòng kiểm tra cài đặt GPS.';
                errorCode = 'POSITION_UNAVAILABLE';
                break;
            case error.TIMEOUT:
                errorMessage = 'Yêu cầu vị trí đã hết thời gian chờ. Vui lòng thử lại.';
                errorCode = 'TIMEOUT';
                break;
            default:
                if (error.message) {
                    errorMessage = error.message;
                }
                break;
        }
        
        const locationError = {
            code: errorCode,
            message: errorMessage,
            originalError: error
        };
        
        if (this.onLocationError) {
            this.onLocationError(locationError);
        }
    }
    
    /**
     * Request location permission
     */
    async requestPermission() {
        try {
            if (!LocationService.isSupported()) {
                throw new Error('Định vị không được hỗ trợ');
            }
            
            // Try to get position to trigger permission request
            await this.getCurrentPosition({ timeout: 5000 });
            return true;
            
        } catch (error) {
            console.error('Location permission error:', error);
            return false;
        }
    }
    
    /**
     * Get location permission status
     */
    async getPermissionStatus() {
        try {
            if ('permissions' in navigator) {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                return permission.state; // 'granted', 'denied', or 'prompt'
            }
            
            // Fallback: try to get location
            try {
                await this.getCurrentPosition({ timeout: 1000 });
                return 'granted';
            } catch (error) {
                if (error.code === 1) { // PERMISSION_DENIED
                    return 'denied';
                }
                return 'prompt';
            }
            
        } catch (error) {
            console.error('Error checking location permission:', error);
            return 'unknown';
        }
    }
    
    /**
     * Format location for display
     */
    formatLocationForDisplay() {
        if (!this.currentPosition) {
            return 'Vị trí không khả dụng';
        }
        
        const lat = this.currentPosition.latitude.toFixed(6);
        const lon = this.currentPosition.longitude.toFixed(6);
        const accuracy = Math.round(this.currentPosition.accuracy);
        
        return `${lat}, ${lon} (±${accuracy}m)`;
    }
    
    /**
     * Get location data for API submission
     */
    getLocationData() {
        if (!this.currentPosition) {
            return null;
        }
        
        return {
            latitude: this.currentPosition.latitude,
            longitude: this.currentPosition.longitude,
            accuracy: this.currentPosition.accuracy,
            timestamp: this.currentPosition.timestamp
        };
    }
    
    /**
     * Set location update callback
     */
    onUpdate(callback) {
        this.onLocationUpdate = callback;
        return this;
    }
    
    /**
     * Set location error callback
     */
    onError(callback) {
        this.onLocationError = callback;
        return this;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.stopWatching();
        this.onLocationUpdate = null;
        this.onLocationError = null;
        this.currentPosition = null;
    }
}

/**
 * Location UI Helper
 * Handles location-related UI updates
 */
class LocationUI {
    constructor(locationService) {
        this.locationService = locationService;
        this.statusElement = null;
        this.buttonElement = null;
        
        this.initializeElements();
        this.bindEvents();
    }
    
    initializeElements() {
        this.statusElement = document.getElementById('location-status');
        this.buttonElement = document.getElementById('get-location-btn');
    }
    
    bindEvents() {
        if (this.buttonElement) {
            this.buttonElement.addEventListener('click', () => {
                this.requestLocation();
            });
        }
        
        // Listen for location updates
        this.locationService.onUpdate((position) => {
            this.updateLocationStatus('success', 'Vị trí đã được xác minh');
            this.updateButton('success');
        });

        this.locationService.onError((error) => {
            this.updateLocationStatus('error', error.message);
            this.updateButton('error');
        });
    }
    
    async requestLocation() {
        this.updateLocationStatus('pending', 'Đang lấy vị trí...');
        this.updateButton('loading');

        try {
            await this.locationService.getCurrentPosition();
        } catch (error) {
            // Error handling is done in the service
        }
    }
    
    updateLocationStatus(status, message) {
        if (!this.statusElement) return;
        
        const indicator = this.statusElement.querySelector('.status-indicator');
        const text = this.statusElement.querySelector('span');
        
        if (indicator) {
            indicator.classList.remove('pending', 'success', 'error');
            indicator.classList.add(status);
        }
        
        if (text) {
            text.textContent = message;
        }
    }
    
    updateButton(status) {
        if (!this.buttonElement) return;
        
        const icon = this.buttonElement.querySelector('.btn-icon');
        const text = this.buttonElement.querySelector('span') || this.buttonElement;
        
        switch (status) {
            case 'loading':
                this.buttonElement.disabled = true;
                if (text) text.textContent = 'Đang lấy vị trí...';
                break;
            case 'success':
                this.buttonElement.disabled = false;
                if (text) text.textContent = 'Vị trí đã xác minh';
                this.buttonElement.classList.add('btn-success');
                break;
            case 'error':
                this.buttonElement.disabled = false;
                if (text) text.textContent = 'Thử lại vị trí';
                this.buttonElement.classList.remove('btn-success');
                break;
            default:
                this.buttonElement.disabled = false;
                if (text) text.textContent = 'Lấy vị trí của tôi';
                this.buttonElement.classList.remove('btn-success');
                break;
        }
    }
}

// Export for use in other modules
window.LocationService = LocationService;
window.LocationUI = LocationUI;

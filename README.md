# 🎯 Hệ thống Check-in QR

Hệ thống check-in sự kiện nhanh chóng và bảo mật sử dụng mã QR, được thiết kế đặc biệt cho người dùng Việt Nam.

## ✨ Tính năng chính

### 🔍 **QR Code Scanning**
- Quét mã QR nhanh chóng bằng camera thiết bị
- Hỗ trợ đèn flash và chuyển đổi camera
- Xử lý lỗi thông minh với thông báo tiếng Việt

### 📱 **Mobile-First Design**
- Giao diện responsive tối ưu cho mobile
- Progressive Web App (PWA) support
- Touch-friendly với các nút bấm lớn
- Hoạt động mượt mà trên mọi thiết bị

### 📍 **Location Verification**
- Xác minh vị trí GPS tự động
- Kiểm tra khoảng cách đến địa điểm sự kiện
- Xử lý lỗi định vị thông minh

### 📸 **Photo Capture**
- Chụp ảnh selfie tùy chọn
- Hỗ trợ upload ảnh từ thư viện
- Nén ảnh tự động để tối ưu dung lượng

### 🛡️ **Security & Validation**
- JWT authentication cho admin
- QR token validation với thời gian hết hạn
- Input sanitization và validation
- Rate limiting và security headers

### 📊 **Admin Dashboard**
- Quản lý sự kiện và người tham gia
- Theo dõi check-in real-time
- Analytics và báo cáo chi tiết
- Export dữ liệu CSV/Excel

## 🚀 Cài đặt và Chạy

### Yêu cầu hệ thống
- Node.js 16+ 
- MongoDB 4.4+
- Redis (tùy chọn, cho caching)

### Cài đặt
```bash
# Clone repository
git clone https://github.com/thienchi2109/qr-checkin.git
cd qr-checkin

# Cài đặt dependencies
npm install

# Tạo file môi trường
cp .env.example .env

# Chỉnh sửa cấu hình trong .env
# DATABASE_URL=mongodb://localhost:27017/qr-checkin
# JWT_SECRET=your-secret-key
# PORT=3000
```

### Chạy ứng dụng
```bash
# Development mode
npm run dev

# Production mode
npm start

# Chạy tests
npm test
```

## 🏗️ Kiến trúc hệ thống

### Backend (Node.js + Express)
```
src/
├── controllers/     # Business logic
├── models/         # Database models (MongoDB)
├── routes/         # API routes
├── middleware/     # Authentication, validation
├── utils/          # Helper functions
├── config/         # Configuration
└── __tests__/      # Unit tests
```

### Frontend (Vanilla JS + Modern CSS)
```
public/
├── index.html      # Main HTML file
├── css/
│   └── styles.css  # Modern responsive CSS
├── js/
│   ├── app.js           # Main application
│   ├── qr-scanner.js    # QR scanning logic
│   ├── camera.js        # Camera functionality
│   ├── location.js      # GPS services
│   └── form-validation.js # Form validation
└── manifest.json   # PWA manifest
```

## 🎨 Thiết kế UI/UX

### Design System
- **Colors**: Modern gradient với primary color #4F46E5
- **Typography**: System fonts với perfect readability
- **Spacing**: Consistent spacing scale (4px base)
- **Components**: Reusable button, form, modal components

### Responsive Breakpoints
- **Mobile**: < 640px (primary focus)
- **Tablet**: 640px - 1024px
- **Desktop**: > 1024px

### Accessibility
- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support

## 🔧 API Documentation

### Authentication
```bash
POST /api/auth/login
POST /api/auth/register
POST /api/auth/refresh
```

### Events Management
```bash
GET    /api/events          # List events
POST   /api/events          # Create event
GET    /api/events/:id      # Get event details
PUT    /api/events/:id      # Update event
DELETE /api/events/:id      # Delete event
```

### Check-in System
```bash
GET  /api/checkin/form/:eventId/:token    # Get check-in form
POST /api/checkin/submit                  # Submit check-in
GET  /api/checkin/status/:checkinId       # Check status
```

### Admin Dashboard
```bash
GET  /api/admin/checkins/:eventId     # Get check-ins
GET  /api/admin/analytics/:eventId    # Get analytics
POST /api/admin/export/:eventId       # Export data
```

## 🧪 Testing

### Test Coverage
- **Unit Tests**: Controllers, models, utilities
- **Integration Tests**: API endpoints
- **Frontend Tests**: Form validation, UI components

```bash
# Chạy tất cả tests
npm test

# Test với coverage
npm run test:coverage

# Test specific file
npm test -- --testPathPattern=checkin
```

## 🌍 Internationalization

Ứng dụng được thiết kế đặc biệt cho người dùng Việt Nam:
- ✅ Giao diện hoàn toàn tiếng Việt
- ✅ Hỗ trợ ký tự có dấu (À-ỹ)
- ✅ Định dạng ngày tháng theo chuẩn VN
- ✅ Thuật ngữ phù hợp (CMND/CCCD)

## 📱 Progressive Web App

### PWA Features
- ✅ Offline support
- ✅ Add to home screen
- ✅ Push notifications (planned)
- ✅ Background sync (planned)

### Performance
- ✅ Lighthouse score 90+
- ✅ First Contentful Paint < 2s
- ✅ Largest Contentful Paint < 2.5s
- ✅ Cumulative Layout Shift < 0.1

## 🔒 Security

### Implemented Security Measures
- JWT authentication với refresh tokens
- Input validation và sanitization
- Rate limiting cho API endpoints
- CORS configuration
- Security headers (helmet.js)
- File upload validation
- SQL injection prevention
- XSS protection

## 🚀 Deployment

### Docker Support
```bash
# Build image
docker build -t qr-checkin .

# Run container
docker run -p 3000:3000 qr-checkin
```

### Environment Variables
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=mongodb://localhost:27017/qr-checkin
JWT_SECRET=your-super-secret-key
REDIS_URL=redis://localhost:6379
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=5242880
```

## 🤝 Contributing

1. Fork repository
2. Tạo feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Tạo Pull Request

## 📄 License

Dự án này được phân phối dưới giấy phép MIT. Xem file `LICENSE` để biết thêm chi tiết.

## 👥 Team

- **Developer**: Thiện Chi
- **GitHub**: [@thienchi2109](https://github.com/thienchi2109)

## 📞 Support

Nếu bạn gặp vấn đề hoặc có câu hỏi:
- 🐛 [Báo cáo bug](https://github.com/thienchi2109/qr-checkin/issues)
- 💡 [Đề xuất tính năng](https://github.com/thienchi2109/qr-checkin/issues)
- 📧 Email: support@qr-checkin.com

---

⭐ **Nếu dự án này hữu ích, hãy cho chúng tôi một star!** ⭐

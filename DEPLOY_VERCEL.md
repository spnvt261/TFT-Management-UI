# Deploy TFT2 UI lên Vercel bằng GitHub

## 1) Điều kiện cần

- Source code đã được đẩy lên GitHub.
- Backend API đã public qua HTTPS (ví dụ: `https://api.your-domain.com`).
- Build local chạy ổn:

```bash
pnpm build
```

## 2) Cấu hình đã có sẵn trong repo

File `vercel.json` ở root đã cấu hình:
- Build monorepo bằng `pnpm --filter @tft2/web build`
- Output static ở `apps/web/dist`
- Rewrite SPA về `index.html` để refresh các route như `/dashboard` không bị 404

## 3) Deploy qua GitHub Integration (khuyến nghị)

1. Vào Vercel, chọn `Add New...` -> `Project`.
2. Chọn `Import Git Repository` và kết nối tài khoản GitHub.
3. Chọn đúng repo này.
4. Ở bước cấu hình project:
   - Không cần đổi `Root Directory` (đã dùng `vercel.json` ở root).
5. Thêm Environment Variables:
   - `VITE_API_BASE_URL`: URL backend gốc, không kèm `/api/v1`
   - `VITE_APP_TIMEZONE` (tùy chọn), ví dụ `Asia/Ho_Chi_Minh`
6. Nhấn `Deploy`.

## 4) Cơ chế deploy sau khi đã kết nối GitHub

- Mỗi lần `push` lên nhánh production (thường là `main`), Vercel tự tạo Production Deployment.
- Mỗi Pull Request sẽ có Preview Deployment tự động.

## 5) Quy trình đẩy code lên GitHub để kích hoạt deploy

```bash
git add .
git commit -m "chore: setup vercel deployment"
git push origin main
```

Nếu team dùng nhánh khác làm production, thay `main` bằng tên nhánh tương ứng.

## 6) Checklist sau deploy

- Mở domain Vercel và kiểm tra:
  - Đăng nhập
  - Điều hướng các trang: `/dashboard`, `/players`, `/rules`
  - Refresh tại route con không bị 404
- Mở tab Network:
  - API gọi đúng domain từ `VITE_API_BASE_URL`

## 7) Lỗi thường gặp

- App gọi sai API (về localhost hoặc IP LAN):
  - Chưa set `VITE_API_BASE_URL` trong Vercel (Production/Preview/Development).
- Route refresh bị 404:
  - Đảm bảo `vercel.json` nằm ở root repo và deployment đang dùng commit mới nhất.

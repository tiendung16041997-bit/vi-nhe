# Dua Vi Nhe len internet va dong bo du lieu

## 1. Tao Supabase

1. Tao tai khoan tai [supabase.com](https://supabase.com/) va tao mot project.
2. Trong SQL Editor, mo file `supabase-schema.sql`, dan noi dung va chay mot lan. Cac bang co Row Level Security: moi tai khoan chi doc va sua duoc giao dich, ngan sach cua chinh minh.
3. Trong **Project Settings > API**, sao chep **Project URL** va **publishable key** (hoac anon/public key cu).
4. Dien hai gia tri do vao `config.js`. Day la khoa public danh cho trinh duyet; tuyet doi khong dat `service_role` key vao file nay.

## 2. Dua giao dien len Vercel

1. Dua cac file cua ung dung len mot repository GitHub. Khong dua thu muc `.venv` hoac `.idea` len repository.
2. Dang nhap vao [vercel.com](https://vercel.com/) bang GitHub, chon **Add New > Project**, roi import repository.
3. Chon framework **Other**; de trong Build Command va Output Directory mac dinh cua Vercel cho static site. Bam **Deploy**.
4. Mo dia chi HTTPS do Vercel cap va tao tai khoan bang email. Neu Supabase bat buoc xac nhan email, hay mo email de xac nhan truoc khi dang nhap.
5. Trong Supabase **Authentication > URL Configuration**, dat Site URL la dia chi Vercel va them dia chi do vao Redirect URLs. Neu dung domain tuy chinh, cap nhat ca hai gia tri nay.

Sau khi dang nhap cung mot tai khoan tren may tinh va dien thoai, giao dich va ngan sach duoc luu tren Supabase; cac thay doi tu thiet bi khac se dong bo truc tiep. De nhap du lieu cu tren mot trinh duyet, bam **Nhap du lieu tren thiet bi nay** va xac nhan. Hay kiem tra truoc vi danh sach co the gom ca giao dich mau.

## Chay thu tren may

Mo `index.html` de xem ban chi-luu-tren-thiet-bi. De thu dang nhap Supabase, chay web server tinh (vi du Live Server trong VS Code) va mo dia chi `http://localhost`; khong mo truc tiep bang `file://`.

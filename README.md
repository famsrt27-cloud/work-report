# Work Management & Reporting System

ระบบบันทึกงานและสร้างรายงานตาม `work_reporting_system_spec_nextjs_supabase_v4.md` พัฒนาด้วย Next.js App Router, TypeScript และ Supabase

## เริ่มต้นใช้งาน

1. ติดตั้งแพ็กเกจด้วย `npm install`
2. คัดลอก `.env.example` เป็น `.env.local` และกรอกค่า Supabase
3. รัน Supabase migration ใน `supabase/migrations`
4. ปิด public sign-up ใน Supabase Auth
5. กำหนดค่า `BOOTSTRAP_ADMIN_*` ชั่วคราวและรัน `npm run bootstrap:admin` หนึ่งครั้ง จากนั้นลบค่ารหัสผ่านออกจาก environment
6. รัน `npm run bootstrap:storage` เพื่อสร้าง private buckets พร้อม MIME/size limits
7. รัน `npm run dev`

## ฟอนต์ PDF

รายงาน PDF ใช้ **Sarabun จาก Google Fonts** (OFL-1.1) เท่านั้น แนะนำให้นำ `Sarabun-Regular.ttf` จาก repository `google/fonts` มาวางที่ `public/fonts/Sarabun-Regular.ttf` หรือกำหนด `PDF_SARABUN_FONT_PATH` เพื่อให้ production สร้าง PDF ได้โดยไม่ต้องดาวน์โหลดฟอนต์ตอน cold start หากไม่พบไฟล์ ระบบจะโหลดจาก URL คงที่ของ Google Fonts เป็น fallback

ตรวจสอบโค้ดด้วย `npm run typecheck`, `npm test` และ `npm run build`

## หลักความปลอดภัย

- Username เก็บเป็น `text` และต้องเป็นเลข 7 หลัก
- `SUPABASE_SERVICE_ROLE_KEY` ใช้เฉพาะ server และทุก operation ที่ใช้ key นี้ต้องตรวจสิทธิ์ก่อน
- ทุกตารางใน `public` เปิด RLS; ไฟล์หลักฐานอยู่ใน private bucket
- PDF รายงานสร้างใหม่เมื่อดาวน์โหลดและไม่ถูกบันทึกกลับเข้า Storage

# 📘 คู่มือ Deploy — ระบบเช็คชื่อเข้าสอน + เก็บคะแนน

## สถาปัตยกรรมระบบ

```
GitHub Pages (Frontend) ──fetch──► Google Apps Script (Backend) ──► Google Sheets (Database)
```

---

## ขั้นตอนที่ 1: สร้าง Google Sheets

1. เปิด [Google Sheets](https://sheets.google.com)
2. สร้าง Spreadsheet ใหม่ ตั้งชื่อ: `ระบบเช็คชื่อเข้าสอน`
3. **คัดลอก Spreadsheet ID** จาก URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

   - ตัวอย่าง: `1AbCdEfGhIjKlMnOpQrStUvWxYz`

---

## ขั้นตอนที่ 2: สร้าง Google Apps Script

1. เปิด [Google Apps Script](https://script.google.com)
2. กดสร้างโปรเจกต์ใหม่ ตั้งชื่อ: `ระบบเช็คชื่อ API`
3. ลบโค้ดเดิมในไฟล์ `Code.gs`
4. **คัดลอกไฟล์ Backend ทั้งหมด** ไปยัง Apps Script:

   | ไฟล์ในโฟลเดอร์`backend/` | สร้างไฟล์ใน Apps Script                      |
   | ---------------------------------------- | ------------------------------------------------------- |
   | `Code.gs`                              | แก้ไขไฟล์`Code.gs` ที่มีอยู่        |
   | `Auth.gs`                              | กด `+` → Script → ตั้งชื่อ `Auth`       |
   | `Schedule.gs`                          | กด `+` → Script → ตั้งชื่อ `Schedule`   |
   | `Attendance.gs`                        | กด `+` → Script → ตั้งชื่อ `Attendance` |
   | `Score.gs`                             | กด `+` → Script → ตั้งชื่อ `Score`      |
   | `Report.gs`                            | กด `+` → Script → ตั้งชื่อ `Report`     |
   | `SheetSetup.gs`                        | กด `+` → Script → ตั้งชื่อ `SheetSetup` |
   | `Utils.gs`                             | กด `+` → Script → ตั้งชื่อ `Utils`      |
5. **เปลี่ยน `SPREADSHEET_ID`** ในไฟล์ `Code.gs`:

   ```javascript
   const SPREADSHEET_ID = 'ใส่_ID_ของ_Google_Sheets_คุณที่นี่';
   ```

---

## ขั้นตอนที่ 3: Setup Sheets อัตโนมัติ

1. ใน Apps Script → เลือกฟังก์ชัน `setupAllSheets` จาก dropdown
2. กดปุ่ม ▶️ Run
3. ให้สิทธิ์การเข้าถึง Google Sheets (ครั้งแรก)
4. ตรวจสอบ Google Sheets → จะมี 6 Sheets:
   - Teachers, Students, Schedule, Attendance, Scores, Settings

---

## ขั้นตอนที่ 4: Deploy Google Apps Script

1. กด **Deploy** → **New Deployment**
2. กด ⚙️ เลือก **Web app**
3. ตั้งค่า:
   - **Description**: `v1.0.0`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. กด **Deploy**
5. **คัดลอก Web App URL**
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

---

## ขั้นตอนที่ 5: ตั้งค่า Frontend

1. เปิดไฟล์ `frontend/js/api.js`
2. **เปลี่ยน `API_URL`**:
   ```javascript
   const API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
   ```

---

## ขั้นตอนที่ 6: Deploy Frontend บน GitHub Pages

1. สร้าง Repository ใหม่บน GitHub
2. Push เฉพาะโฟลเดอร์ `frontend/` ไปยัง Repository:
   ```bash
   cd frontend
   git init
   git add .
   git commit -m "Initial deploy"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. ไปที่ **Settings** → **Pages**
4. ตั้งค่า Source: **Deploy from a branch** → `main` → `/root`
5. กด Save
6. รอ 1-2 นาที → เว็บจะอยู่ที่: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

---

## ขั้นตอนที่ 7: เพิ่มข้อมูล

### 7.1 เพิ่มครู (Teachers Sheet)

| teacher_id | username | password | full_name                   | role    | status |
| ---------- | -------- | -------- | --------------------------- | ------- | ------ |
| (auto)     | admin    | 1234     | ผู้ดูแลระบบ      | admin   | active |
| (UUID)     | somchai  | 5678     | นายสมชาย ดีมาก | teacher | active |

### 7.2 เพิ่มนักเรียน (Students Sheet)

| student_id | prefix | first_name       | last_name    | class_room | status |
| ---------- | ------ | ---------------- | ------------ | ---------- | ------ |
| (UUID)     | ด.ช. | สมศักดิ์ | มั่นคง | ม.1/1     | active |

### 7.3 เพิ่มตารางสอน (Schedule Sheet)

| schedule_id | teacher_id                | class_name | subject_name         | day_of_week  | period | start_time | end_time |
| ----------- | ------------------------- | ---------- | -------------------- | ------------ | ------ | ---------- | -------- |
| (UUID)      | (teacher_id ของครู) | ม.1/1     | คณิตศาสตร์ | จันทร์ | 1      | 09:00      | 09:50    |

### 7.4 ตั้งค่าโรงเรียน (Settings Sheet)

| key           | value                                            |
| ------------- | ------------------------------------------------ |
| school_name   | โรงเรียนตัวอย่างวิทยา       |
| logo_url      | (Google Drive URL ของโลโก้)              |
| footer_credit | พัฒนาโดยทีมงาน IT โรงเรียน |

---

## ขั้นตอนที่ 8: ทดสอบ

1. เปิดเว็บ GitHub Pages
2. Login ด้วย username/password ที่ตั้งไว้
3. ตรวจสอบ:
   - ✅ ตารางสอนแสดงถูกต้อง
   - ✅ เช็คชื่อได้
   - ✅ เก็บคะแนนได้
   - ✅ ดูรายงานได้
   - ✅ Export CSV/Excel/Print ได้

---

## หมายเหตุสำคัญ

⚠️ **เมื่ออัปเดตโค้ด Backend**: ต้อง Deploy ใหม่ (**New Deployment**) ทุกครั้ง

⚠️ **teacher_id**: ใน Schedule Sheet ต้องตรงกับ teacher_id ใน Teachers Sheet

⚠️ **class_name vs class_room**:

- `class_name` ใน Schedule Sheet = ชื่อห้อง (เช่น ม.1/1)
- `class_room` ใน Students Sheet = ชื่อห้อง (ต้องตรงกัน)

⚠️ **Logo URL**: ใส่ Google Drive sharing link ได้เลย ระบบจะแปลงเป็น direct link อัตโนมัติ

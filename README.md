# iPlay Workspace — Digital Agency OS


ระบบบริหารงานสไตล์ ERP สำหรับ **iPlay Digital** — ปฏิทินเต็มจอ, Kanban, **ทีมงาน AI ที่ทำงานเหมือนคน**, แชททีม + Google Drive, HR (เช็คอิน/ลา/จองห้อง) และเชื่อมจอ LED **Playwall Park Silom**

สร้างด้วย **Next.js 15 (App Router) + TypeScript + Tailwind v4** และ **MariaDB** เป็นฐานข้อมูลหลัก
ดีไซน์ **Light Mode** โทนสี/ฟอนต์อ้างอิงจาก [mng.uarea.in](https://mng.uarea.in) (MNG ERP) — purple/blue พาสเทล บนพื้นขาว ฟอนต์ Prompt
แรงบันดาลใจฟีเจอร์ปฏิทิน/Work Tracking จาก [ProAke/mng-erp](https://github.com/ProAke/mng-erp) แล้วต่อยอดเป็น Workspace ที่มี AI เป็นสมาชิกทีมจริง ๆ

> โหมด demo ใช้งานได้ทันทีโดยไม่ต้องมีฐานข้อมูล (เก็บที่ `.data/store.json`)
> ตั้งค่า `DB_HOST` แล้วระบบสลับไปบันทึกทุกอย่างลง **MariaDB** อัตโนมัติ

---

## ✨ ฟีเจอร์

### 📅 ปฏิทินเต็มจอ (ตัวเด่นของระบบ)
- **4 มุมมอง**: เดือน / สัปดาห์ / วัน / กำหนดการ (Agenda) — สลับได้ทันที ไม่โหลดใหม่
- **ลากย้ายอีเวนต์ข้ามวัน** (Drag & Drop) ทั้งในมุมมองเดือน, สัปดาห์, วัน และ agenda
- **เดดไลน์ของงานทุกชิ้นขึ้นปฏิทินอัตโนมัติ** — สร้างงานใหม่ = มีอีเวนต์เดดไลน์ทันที และลากเดดไลน์เพื่อเลื่อน `due date` ของงานได้โดยตรง
- **หมวดอีเวนต์ 6 สี**: งาน/เดดไลน์ · ประชุม · ส่งมอบ · การเงิน · วันหยุด · ส่วนตัว (กรองได้ทีละหมวด)
- **Mini calendar** + ตัวกรองหมวด + รายการ "กำลังจะมาถึง"
- ปุ่ม **Fullscreen** (Fullscreen API จริง) + แถบเวลาปัจจุบัน (now line) ในมุมมองวัน/สัปดาห์
- **วันที่ภาษาไทย + พ.ศ.** ทุกจุด (เช่น "พุธ 21 ตุลาคม 2569")
- คลิกช่องว่างเพื่อเพิ่มนัด, คลิกอีเวนต์เพื่อแก้ไข/ลบ, คลิกเดดไลน์เพื่อเปิดงาน

### ✅ งาน & Kanban
- บอร์ดลากวาง **4 สถานะ**: รอดำเนินการ → กำลังทำ → ตรวจแก้ → เสร็จแล้ว + มุมมองตาราง
- รายละเอียดสไตล์ ERP: รหัสงาน (`ERP-1041`), ผู้รับผิดชอบ (คน **หรือ AI**), ความสำคัญ, ชั่วโมงประเมิน,
  งานย่อยแบบเช็กบ็อกซ์, แท็ก, คอมเมนต์, AI run log, ความคืบหน้า, สถานะ blocker
- ตัวกรอง: โปรเจกต์ / ความสำคัญ / งานของฉัน / AI รับผิดชอบ + ค้นหา
- สร้าง/แก้/ลบงาน, เพิ่มงานย่อย, คอมเมนต์ได้ทันที (ทุก mutation บันทึกลง DB + activity log)

### 🤖 AI Workforce (AI ทำงานเหมือนคน)
- **5 เอเจนต์** พร้อมบทบาทจริง: `NOVA` (Project Coordinator) · `BYTE` (Full-stack Engineer) · `PIXEL` (Creative) · `ECHO` (Comms/QA) · `ORBIT` (Data Analyst)
- แต่ละเอเจนต์มี: โมเดล, ระดับ autonomy, งานในมือ, จำนวน run, อัตราความสำเร็จ, **โควตา token รายวัน**
- **มอบงานให้ AI** จากหน้ารายละเอียดงาน / Kanban / AI Workforce → AI เริ่มทำงาน, เปลี่ยนสถานะงาน, บันทึก run log
- **AI Console**: log แบบ terminal, กรอง running/success/queued, ระยะเวลา + token ที่ใช้ต่อ run
- **AI ตอบในแชท** ผ่าน `@nova @byte @pixel @echo @orbit` — ใช้ข้อมูลจริง (งานค้าง, ห้องว่าง, ใบลา, ไฟล์ Drive) ในการตอบ
- พัก/ปลุกเอเจนต์ได้ทันที (pause switch) และตั้งค่าเปิด-ปิด AI ทั้งระบบ
- พร้อมต่อ LLM จริงผ่าน `AI_GATEWAY_URL` (ถ้าไม่ตั้งจะใช้ context engine ในตัว)

### 💬 บอร์ดแชทด้านขวา (ทุกหน้า) + Google Drive
- **Dock ขวา** เปิดได้ทุกหน้า: แชท / ไฟล์ / AI (ย่อ-ขยายได้)
- **กลุ่มงาน + DM + DM กับ AI** สร้างกลุ่มใหม่ได้, unread badge, ซ่อน/เปิด
- **ปักหมุดข้อความ** (pin) + แถบ pinned ด้านบนห้อง + หน้ารวมข้อความสำคัญ
- **แชร์เอกสาร Google Drive**: วางลิงก์ หรือเลือกไฟล์ใน Workspace → แสดงเป็นการ์ดไฟล์พร้อมเปิด Drive
- รีแอ็กชันอิโมจิ, ไฟล์ล่าสุด, สมาชิก, โฟลเดอร์กลางทีม
- หน้าแชทแบบเต็ม (3 คอลัมน์) สำหรับงานละเอียด
- **MCP bridge**: ตั้ง `GOOGLE_MCP_URL` → `/api/drive` proxy ไป MCP server (GDrive) โดยตรง

### 🕒 HR: เช็คอิน · ลา · จองห้องประชุม
- **เช็คอิน / ลงเวลา**: ดึงพิกัดจริงจากเบราว์เซอร์, คำนวณระยะห่างจาก Park Silom ตามรัศมีที่ตั้งไว้,
  รองรับ **ออฟฟิศ / WFH / นอกสถานที่**, แนบ **Google Maps** ทุกครั้ง, แสดงแผนที่ฝังในหน้า
- **ระบบลา**: ลาพักร้อน/ป่วย/กิจ/WFH/ไปพบลูกค้า, นับวันอัตโนมัติ, อนุมัติ–ปฏิเสธ,
  **อนุมัติแล้วสร้างอีเวนต์วันลาเข้าปฏิทินทีมทันที**
- **จองห้องประชุม**: timeline 08:00–20:00 ต่อห้อง, การ์ดห้อง + สิ่งอำนวยความสะดวก,
  จองแล้วสร้างอีเวนต์หมวด "ประชุม" ลงปฏิทิน, ยกเลิกได้
- สรุปภาระงาน + การเข้างานรายสัปดาห์

### 📊 แดชบอร์ด
- KPI cards (โปรเจกต์, งานคงค้าง, ใกล้เดดไลน์, AI agents)
- แถบ AI กำลังทำงาน (live waveform), โปรเจกต์เด่นแบบ gradient cards, งานเร่งด่วน
- **กราฟ SVG ล้วน ไม่มี dependency**: line / bar / donut / workload bars / sparkline
- ปฏิทินสัปดาห์ย่อ + ฟีดกิจกรรมล่าสุด + สรุป AI utilization

### 🖥️ LED Wall × Playwall Park Silom
- ฝัง **live preview** จาก `https://playwall-parksilom.pages.dev/` (16:9) พร้อมสถานะการเชื่อมต่อ
- **`GET /api/led`** — payload พร้อมฉาย (เปิด CORS `*`, ไม่ cache): ประกาศวิ่ง, คิววันนี้, งานด่วน, สถานะ AI, สถิติ
- **`/led`** — จอสำรอง 1920×1080 (นาฬิกาเรียลไทม์ + คิวฉาย + งานด่วน + AI) ใช้กับ TV/kiosk ได้
- คัดลอก API / เปิดจอจริงได้จากหน้าเดียว

### ⚙️ อื่น ๆ
- ค้นหารวมทั้งระบบ (งาน/อีเวนต์/โปรเจกต์) — `⌘K` / `Ctrl+K`
- ทุก mutation ผ่าน API กลาง `POST /api/action` + activity log
- ธีม dark premium, ภาษาไทยทั้งระบบ, responsive (dock/แถบข้างปรับตามความกว้าง)
- นำเข้า/ส่งออก: JSON ทั้งระบบ, CSV งาน, รีเซ็ตข้อมูลตัวอย่าง

### 🧭 เทียบกับ mng-erp (ต้นแบบ)
| ความสามารถ | mng-erp | iPlay Workspace |
|---|---|---|
| ปฏิทิน 4 มุมมอง + drag & drop | ✅ | ✅ (+ now line, fullscreen, deadline → task) |
| Kanban 4 สถานะ + ตาราง | ✅ | ✅ (+ AI assignee, run log) |
| เดดไลน์ขึ้นปฏิทินอัตโนมัติ | ✅ | ✅ (สร้าง/ลากอีเวนต์ = อัปเดต `due_date`) |
| แชทบอร์ดด้านขวา + ปักหมุด + Drive | — | ✅ (dock ทุกหน้า + MCP) |
| AI agents ทำงานเหมือนคน | — | ✅ (5 เอเจนต์ + console + token) |
| เช็คอินนอกสถานที่ + Google Maps | — | ✅ (geolocation + รัศมี) |
| จองห้องประชุม / ลาออนไลน์ | — | ✅ (ผูกปฏิทินทีม) |
| เชื่อมจอ LED Playwall | — | ✅ (preview + `/api/led` + `/led`) |
| Stack | Vanilla JS + Express | **Next.js 15 + MariaDB** |

---

## 🎨 ธีม Light Mode (พาเลตต์ MNG)

ระบบเป็น **Light Mode ทั้งหมด** — พื้นหลังไล่เฉดฟ้า–ม่วงพาสเทล (แบบหน้า login ของ MNG), การ์ดสีขาว, เส้นขอบบาง `#E9EBF6`

| บทบาท | สี | ใช้ที่ |
|---|---|---|
| Primary | `#6C5CE7` (soft `#EFEDFD`) | nav active, ปุ่มหลัก, ลิงก์, งาน/เดดไลน์ |
| Blue | `#3BA7FF` → `#2F7BF0` | กำลังทำ, ประชุม, ไฟล์ Drive |
| Mint | `#22C793` | เสร็จแล้ว, ส่งมอบ, AI, อนุมัติ |
| Amber | `#FFB020` (`#D98A00` สำหรับข้อความ) | ตรวจแก้, การเงิน, รออนุมัติ |
| Pink | `#FF6B9D` | วันหยุด, now-line, personal |
| Red | `#FF5C7A` | ด่วนมาก, เลยกำหนด, error |
| Ink / Muted | `#23264D` / `#8A8FB1` | ข้อความหลัก / รอง |
| Surface | `#FFFFFF` · `#F6F7FC` · `#F1F2FA` | การ์ด · พื้นหลัง · ชิป |
| Font | **Prompt** (+ IBM Plex Sans Thai fallback) | ทั้งระบบ |

- สีของสมาชิก/โปรเจกต์/ห้องประชุมที่บันทึกไว้ในฐานข้อมูลชุดเก่าจะถูก **remap อัตโนมัติ** (`lib/utils.ts → remapColor`) — ไม่ต้อง reseed
- ข้อความบนพื้นสีจะเลือกสีขาว/เข้มอัตโนมัติด้วย `textOn()` เพื่อให้คอนทราสต์ผ่าน
- จุดที่ยังเข้มอยู่คือ **หน้าตัวอย่างจอ LED** (`/led` frame) เท่านั้น เพราะเป็นพรีวิววิดีโอ

---

## 🚀 เริ่มใช้งาน

### 1) โหมด demo (ไม่ต้องมี DB)
```bash
npm install
npm run dev          # http://localhost:3000
```
ข้อมูลตัวอย่างจะถูกสร้างที่ `.data/store.json` โดยอัตโนมัติ (แก้ไข/ลากงานได้จริงและถูกบันทึก)

### 2) โหมด MariaDB (แนะนำสำหรับใช้งานจริง)
```bash
# มี MariaDB อยู่แล้ว
cp .env.example .env
# แก้ DB_HOST / DB_USER / DB_PASSWORD / DB_NAME
npm install
npm run db:init      # สร้าง schema ws_* + seed ครั้งแรก
npm run dev
```
หรือใช้ Docker:
```bash
docker compose up -d
cp .env.example .env
# DB_USER=iplay  DB_PASSWORD=iplaypass  DB_NAME=iplay_workspace
npm run db:init
npm run dev
```

เมื่อมี `DB_HOST` ระบบจะใช้ MariaDB ทุกเส้นทาง (`/api/bootstrap`, `/api/action`) โดยอัตโนมัติ
และแสดงสถานะ `MariaDB` ที่ top bar

```bash
npm run db:seed      # ล้าง + seed ใหม่
npm run build        # production build
npm start            # production server
```

### ตัวเลือก credentials ของ MariaDB
รองรับทั้ง 2 ชุด (ทั้งคู่เป็น user บนเซิร์ฟเวอร์เดียวกับเว็บ → `.env` ใช้ `DB_HOST=127.0.0.1`)

| แบบ | DB_USER | DB_PASSWORD | DB_NAME |
|---|---|---|---|
| 1 (แนะนำ) | `iplay` | รหัสของทีม (เก็บใน `.env` บนเซิร์ฟเวอร์เท่านั้น) | `agency_os` |
| 2 | `agency_os` | รหัสของทีม (อีกชุด) | `agency_os` |

> รหัสผ่านจริง **ไม่ถูกเก็บใน git** — `.env.example` ใช้ placeholder และ `.env` อยู่ใน `.gitignore`

```bash
# เขียน .env ด้วย heredoc เสมอ (รหัสมี $ และ ! ซึ่ง bash จะตีความ)
cat > .env <<'ENVEOF'
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=iplay
DB_PASSWORD=__รหัสผ่านของทีม__
DB_NAME=agency_os
NEXT_PUBLIC_LED_URL=https://playwall-parksilom.pages.dev/
NEXT_PUBLIC_DRIVE_FOLDER=https://drive.google.com/drive/folders/1iPlayDigitalWorkspace
ENVEOF
chmod 600 .env
npm run db:doctor -- --init   # ตรวจ + สร้างตาราง ws_*
pm2 restart <name> --update-env
```
> ใน `.env.example` มีทั้งสองชุด (ชุดที่ 2 ถูกคอมเมนต์ไว้) — สลับได้ตามสิทธิ์ที่มีจริง

### Environment variables
| ตัวแปร | จำเป็น | คำอธิบาย |
|---|---|---|
| `DB_HOST` / `DB_PORT` | ใช้ MariaDB | ที่อยู่ฐานข้อมูล (ถ้าไม่ตั้ง = demo store) — ใช้ `127.0.0.1` เมื่อเว็บกับ DB เครื่องเดียวกัน |
| `DB_REQUIRED` | ไม่ | `1` = ห้าม fallback (คืน 503 พร้อมสาเหตุ แทนการสลับไปข้อมูลสำรอง) |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | ใช้ MariaDB | ข้อมูลเชื่อมต่อ + ชื่อฐานข้อมูล |
| `NEXT_PUBLIC_LED_URL` | ไม่ | URL จอ LED (ค่าเริ่มต้น `https://playwall-parksilom.pages.dev/`) |
| `NEXT_PUBLIC_DRIVE_FOLDER` | ไม่ | โฟลเดอร์กลาง Google Drive ของทีม |
| `GOOGLE_MCP_URL` | ไม่ | MCP server ของ Google Drive (เช่น `http://localhost:8787`) |
| `AI_GATEWAY_URL` / `AI_GATEWAY_KEY` | ไม่ | LLM gateway (ถ้าไม่ตั้งใช้ engine ในตัว) |
| `AI_MODEL` | ไม่ | ชื่อโมเดลเริ่มต้นของ gateway |

---

## 🩺 แก้ปัญหาการเชื่อมต่อฐานข้อมูล

ระบบออกแบบให้ **ไม่ล่มทั้งเว็บ** เมื่อ DB มีปัญหา:

| สถานะ | พฤติกรรม |
|---|---|
| `mariadb` | ต่อฐานข้อมูลได้ — บันทึกทุกอย่างลง MariaDB |
| `demo` | ยังไม่ได้ตั้ง `DB_HOST` — ใช้ `.data/store.json` |
| `fallback` | ตั้งค่าแล้วแต่ **ต่อไม่ได้** — แสดงข้อมูลสำรอง + **แบนเนอร์เตือน** พร้อมรหัสข้อผิดพลาดและปุ่ม "ตรวจสอบอีกครั้ง" (ถ้าตั้ง `DB_REQUIRED=1` จะคืน 503 แทน) |

**ขั้นตอนวินิจฉัย (บนเซิร์ฟเวอร์):**
```bash
cd /path/to/iplaydigital

# 1) ตรวจทีละขั้น: env → TCP → login → สิทธิ์ → schema (มีคำแนะนำภาษาไทย)
npm run db:doctor

# 2) สร้าง schema + seed ถ้ายังว่าง
npm run db:doctor -- --init

# 3) ดูสถานะจาก API (ไม่ต้องเปิดเบราว์เซอร์)
curl -s https://i.playdigital.co.th/api/health | jq '.db'

# 4) แก้ .env แล้ว restart เสมอ (ค่า env อ่านตอนบูต)
pm2 restart <name> --update-env     # หรือ systemctl restart <service>
```

หน้า **ตั้งค่า → วินิจฉัยฐานข้อมูล** แสดง host/user/database/เวลาเชื่อมต่อ/จำนวนตาราง `ws_*` และ
คำสั่งที่ใช้แก้ (คัดลอกได้) โดยไม่เปิดเผยรหัสผ่าน

**สาเหตุที่พบบ่อย**

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `ER_ACCESS_DENIED_ERROR (1045)` | user/รหัสไม่ตรง หรือ user ถูกสร้างเป็น `unix_socket` → `ALTER USER … IDENTIFIED VIA mysql_native_password USING PASSWORD('…')` |
| `ER_BAD_DB_ERROR (1049)` | ยังไม่สร้าง database → `CREATE DATABASE … CHARACTER SET utf8mb4` |
| `ER_DBACCESS_DENIED_ERROR (1044)` | ไม่มีสิทธิ์บน DB → `GRANT ALL PRIVILEGES ON db.* TO user@host` |
| `ECONNREFUSED` | MariaDB ไม่รัน / พอร์ตผิด → `systemctl status mariadb` |
| `PROTOCOL_CONNECTION_LOST` | ไฟร์วอลล์ตัด → ถ้าเครื่องเดียวกันใช้ `DB_HOST=127.0.0.1` |
| ต่อได้แต่ค่าไม่เปลี่ยนหลังแก้ `.env` | ยังไม่ restart แอป (PM2 ต้องใช้ `--update-env`) |

> ⚠️ รหัสผ่านที่มี `! $ # " '` หรือช่องว่าง: เขียน `.env` ด้วย heredoc `cat > .env <<'ENVEOF' … ENVEOF`
> เพราะ `#` ที่ไม่ใส่ quote จะถูกตัดเป็นคอมเมนต์ และ `$` จะถูกตีความเป็นตัวแปร

---

## 🗄️ สถาปัตยกรรม

```
┌───────────────────────────────┐
│  Next.js App Router (client)  │
│  Dashboard · Calendar · Kanban│
│  AI Workforce · Chat Dock     │
│  HR · LED · Settings          │
└───────────────┬───────────────┘
                │ fetch (JSON)
     ┌──────────▼───────────┐        ┌──────────────────────┐
     │ /api/bootstrap (GET) │───────▶│  lib/store.ts        │
     │ /api/action   (POST) │        │  ├ demo store (.data)│
     │ /api/ai       (POST) │        │  └ DB adapter        │
     │ /api/drive    (GET)  │        └──────────┬───────────┘
     │ /api/led      (GET)  │                   │ mysql2 pool
     └──────────────────────┘        ┌──────────▼───────────┐
                                     │ MariaDB  ws_* tables │
                                     │ utf8mb4 · InnoDB     │
                                     └──────────────────────┘
```

### ตาราง MariaDB (prefix `ws_`)
`ws_members` · `ws_projects` · `ws_tasks` · `ws_task_subtasks` · `ws_task_comments` ·
`ws_events` · `ws_channels` · `ws_messages` · `ws_files` · `ws_rooms` · `ws_bookings` ·
`ws_leaves` · `ws_checkins` · `ws_ai_runs` · `ws_activity` · `ws_settings`

- ทุกตารางเป็น **additive / idempotent** (`CREATE TABLE IF NOT EXISTS`) ไม่แตะของเดิม
- index พร้อมสำหรับ query ปฏิทิน (`event_date`, `due_date`, `status`)
- ดูสคีมาทั้งหมดที่ [`db/schema.sql`](db/schema.sql)

### API
| Method | Endpoint | คำอธิบาย |
|---|---|---|
| GET | `/api/bootstrap` | ข้อมูลทั้งระบบครั้งเดียว (hydrate SPA) |
| POST | `/api/action` | ทุก mutation (ย้ายงาน, ลากอีเวนต์, แชท, AI, HR…) → คืน bootstrap ล่าสุด |
| POST | `/api/ai` | AI agent ตอบโดยอ่านข้อมูลจริง (หรือ proxy ไป gateway) |
| GET | `/api/drive` | รายการไฟล์ Drive (ผ่าน MCP ถ้าตั้งค่า) |
| GET | `/api/led` | payload สำหรับจอ LED (CORS `*`) |
| GET | `/api/health` | **ping MariaDB จริง** — คืน host/user/database/latency/จำนวนตาราง และสาเหตุ+วิธีแก้เมื่อ fail |

`Action` ที่รองรับ: `task.move/update/create/delete/comment/subtask`, `event.move/create/update/delete`,
`chat.send/pin/react/channel/read`, `agent.toggle/run`, `hr.checkin/leave/leave.decide/booking/booking.cancel`,
`settings.update`, `activity.add`, `reset`

---

## 🤖 AI ออกแบบอย่างไร

1. **AI เป็น member ในฐานข้อมูล** เหมือนพนักงาน (`kind='ai'`) → มีงาน, หัวหน้า, run log, โควตา token
2. **การมอบงาน** = `agent.run` → เปลี่ยนสถานะงานเป็น *กำลังทำ*, ผูก `current_task_id`, เขียน `ws_ai_runs`
3. **การตอบแชท** = `POST /api/ai` → context engine อ่านข้อมูลจริง (งานค้าง/ห้องว่าง/ใบลา/ไฟล์) แล้วสร้างคำตอบภาษาไทย
   หรือส่งต่อไป LLM gateway ถ้าตั้งค่า (มี fallback อัตโนมัติเมื่อ gateway ล่ม)
4. **ทุก run ตรวจย้อนหลังได้** — ระยะเวลา, token, สถานะ, งานที่เกี่ยวข้อง

---

## 🖥️ เชื่อมจอ LED (Playwall Park Silom)

1. ตั้ง `NEXT_PUBLIC_LED_URL=https://playwall-parksilom.pages.dev/`
2. ฝั่ง Playwall เรียก `GET {workspace}/api/led` ทุก 30 วินาที (CORS เปิดให้แล้ว)
3. payload:
```json
{
  "screen": "iPlay Digital · Park Silom LED",
  "announce": "โฟกัสสัปดาห์นี้: ปิดงาน Playwall + Deploy เว็บใหม่ 🚀",
  "todayEvents": [{ "title": "Daily Stand-up", "time": "09:30", "cat": "meeting" }],
  "urgentTasks": [{ "code": "PLW-2104", "title": "ส่งมอบคอนเทนต์รอบที่ 2", "due": "2026-10-21" }],
  "aiAgents": [{ "name": "NOVA", "state": "working", "paused": false, "task": "t_02" }],
  "stats": { "open": 23, "done": 5, "todayDone": 5 }
}
```
4. เปิด `/led` บนทีวีในออฟฟิศ (kiosk): `chromium --kiosk http://<host>/led`

---

## 📁 โครงสร้างโปรเจกต์

```
iplaydigital/
├── app/
│   ├── layout.tsx              # shell + ฟอนต์ไทย + metadata
│   ├── page.tsx                # SPA entry (AppProvider + Shell)
│   ├── led/page.tsx            # จอ LED 1920×1080
│   ├── globals.css             # design system (dark premium)
│   └── api/
│       ├── bootstrap/ route.ts
│       ├── action/ route.ts
│       ├── ai/ route.ts
│       ├── drive/ route.ts
│       ├── led/ route.ts
│       └── health/ route.ts
├── components/
│   ├── providers.tsx           # state, API client, toasts, AI chat hook
│   ├── shell.tsx               # sidebar + topbar + dock + modals
│   ├── dashboard.tsx           # KPI, AI strip, charts, mini calendar
│   ├── calendar-view.tsx       # 4 views + drag & drop + fullscreen
│   ├── tasks-view.tsx          # kanban + table + filters
│   ├── task-ui.tsx             # task drawer, new task, event modal, search
│   ├── ai-workforce.tsx        # AI cards, console, assignment
│   ├── chat-panel.tsx          # dock + full chat + pins + Drive sharing
│   ├── hr-view.tsx             # check-in, leave, rooms, team
│   ├── led-view.tsx            # LED preview/payload + full screen
│   ├── settings-view.tsx       # org, office, integrations, export
│   ├── charts.tsx              # SVG charts (no deps)
│   └── ui.tsx                  # primitives
├── lib/
│   ├── types.ts                # domain types + Action union
│   ├── seed.ts                 # demo workspace (ทีม + AI + งาน + แชท)
│   ├── store.ts                # demo store + dispatcher
│   ├── db-maria.ts             # MariaDB adapter (schema, fetchAll, apply)
│   ├── ai.ts                   # context engine ของ AI agents
│   └── utils.ts                # วันที่ไทย/พ.ศ., สี, สถานะ
├── db/schema.sql               # MariaDB schema (ws_*)
├── lib/db-diag.ts              # แปลง error DB เป็นคำแนะนำ + ping จริง
├── scripts/db-init.ts          # npm run db:init
├── scripts/db-seed.ts          # npm run db:seed
├── scripts/db-doctor.ts        # npm run db:doctor (ตรวจ env → TCP → login → schema)
├── docker-compose.yml          # MariaDB 11 + utf8mb4
└── .env.example
```

---

## ⌨️ คีย์ลัด
| ปุ่ม | การทำงาน |
|---|---|
| `⌘K` / `Ctrl+K` | โฟกัสค้นหารวม |
| `Esc` | ปิด drawer / modal / search |
| `Enter` | ส่งข้อความแชท (Shift+Enter ขึ้นบรรทัด) |
| ลากการ์ด / อีเวนต์ | ย้ายสถานะ / ย้ายวัน |

---

## 🗺️ Roadmap
- [ ] auth จริง (SSO Google Workspace / LINE Login) + RBAC ตามบทบาท
- [ ] Google Calendar two-way sync และ Drive picker ฝั่ง client
- [ ] AI ทำงานเบื้องหลังด้วย worker queue + streaming token usage
- [ ] ใบเสนอราคา/ใบแจ้งหนี้ + VAT (ต่อยอดจาก mng-erp)
- [ ] รายงานผู้บริหาร + export PDF
- [ ] push notification (LINE Notify / Web Push) และ native mobile

## License
MIT © iPlay Digital

---

## 🔐 ระบบ Login & สิทธิ์การใช้งาน

### วิธีเข้าใช้งาน
1. เปิดเว็บ → ระบบพาไปหน้า `/login` อัตโนมัติ (ทุกหน้าถูกป้องกันด้วย session cookie)
2. เข้าได้ 3 ทาง
   - **อีเมล + รหัสผ่าน** (สร้างบัญชีในหน้า ตั้งค่า → พนักงาน & สิทธิ์)
   - **Google Workspace / Gmail** (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`)
   - **LINE** (`AUTH_LINE_ID` / `AUTH_LINE_SECRET`, ต้องเปิด scope `profile openid email`)

### บัญชีเริ่มต้น (seed)
| อีเมล | สิทธิ์ | ใช้ทำอะไร |
|---|---|---|
| `oak@iplaydigital.co` | Admin | ตั้งค่าทั้งหมด + จัดการสิทธิ์ Admin |
| `ploy@iplaydigital.co` | Support | ดูแลพนักงาน (ยกเว้น Admin) + รายงาน |
| `nan@iplaydigital.co` | Member | ใช้งานงาน/ปฏิทิน/แชท + รายงานของตนเอง |

รหัสผ่านเริ่มต้นมาจาก `ADMIN_INITIAL_PASSWORD` (ค่าเริ่มต้น `iplay@2026`) — **เปลี่ยนทันที** ผ่านเมนูมุมขวาบน → เปลี่ยนรหัสผ่าน

### กติกาสิทธิ์
| ความสามารถ | Admin | Support | Member |
|---|:--:|:--:|:--:|
| ใช้งานงาน / ปฏิทิน / แชท / HR | ✅ | ✅ | ✅ |
| สร้าง & แก้รายงานของตนเอง | ✅ | ✅ | ✅ |
| อนุมัติ / แก้ / ลบรายงานของผู้อื่น | ✅ | ✅ | — |
| หน้าตั้งค่า และจัดการพนักงาน | ✅ | ✅ | — (เห็นหน้าแจ้งสิทธิ์) |
| ตั้ง/ถอดสิทธิ์ Admin, รีเซ็ตข้อมูล | ✅ | — | — |

### ความปลอดภัย
- รหัสผ่านเก็บเป็น **scrypt hash** (`scrypt$salt$hash`) ไม่เก็บ plain text
- session เป็น **HMAC-SHA256 signed cookie** (`ipw_session`, HttpOnly, SameSite=Lax, 7 วัน, `Secure` ใน production)
- ตรวจโดเมนอีเมลจาก `ALLOWED_EMAIL_DOMAIN` ทั้งตอนล็อกอินปกติและ OAuth
- ระงับบัญชี (`active = 0`) = ตัด session ทันทีในคำขอถัดไป

## 📄 รายงาน + Google Drive
- เมนู **รายงาน & Drive**: สร้าง/แก้ไข/อนุมัติ/ลบรายงาน (รหัส `RPT-xxxx`), งวดเดือน, โปรเจกต์, สรุป, ไฟล์แนบ
- แนบไฟล์ 2 ทาง: **วางลิงก์ Drive/Docs** หรือ **อัปโหลดไฟล์จริง** (≤ 20 MB) เข้าโฟลเดอร์กลาง
- โหมดการเชื่อมต่อ (`lib/drive.ts`)
  | โหมด | เงื่อนไข | พฤติกรรม |
  |---|---|---|
  | `oauth` | มี `GOOGLE_DRIVE_CLIENT_ID/SECRET/REFRESH_TOKEN` | อัปโหลดเข้า Drive จริง (`drive.file` scope) |
  | `link` | ยังไม่ตั้งค่า | เก็บเป็นลิงก์ไฟล์ — ระบบยังใช้งานได้ครบ |
- รายงานเก็บในตาราง `ws_reports` (MariaDB) หรือ `.data/reports.json` เมื่อ DB ไม่พร้อม

## ⚙️ หน้าตั้งค่า (Split ตามงาน)
`ตั้งค่า` แบ่งเป็น 5 แท็บ — ทั้งหน้าเห็นเฉพาะ Admin/Support
1. **องค์กร** — ชื่อระบบ สาขา เวลาทำงาน ประกาศ LED พิกัดออฟฟิศ (แผนที่)
2. **พนักงาน & สิทธิ์** — เพิ่ม/แก้/ระงับ/ลบพนักงาน, ตั้งสิทธิ์, ดูภาระงาน & การเข้าใช้ล่าสุด
3. **รายงาน & Drive** — สถานะ Drive, โฟลเดอร์กลาง, รายงานล่าสุด
4. **การเชื่อมต่อ & AI** — จอ LED, MCP/AI Gateway, เปิด-พัก AI agents
5. **ข้อมูล & ความปลอดภัย** — สถานะ DB, diagnostics, export JSON/CSV, รีเซ็ต (Admin)

# ตรวจงานหลัง deploy production (Final Recheck)

> ทุกครั้งที่ขึ้น production **ต้องกลับมา recheck อีกรอบให้เป็น final** และ **ต้องรัน pentest ทุกครั้ง**
> เอกสารนี้คือลำดับขั้นตอนมาตรฐาน (ใช้ได้ทั้งจากเครื่อง dev และบน VPS)

## 0) เตรียมค่าใน `.env` (ครั้งเดียว)
```bash
PROD_URL=https://i.playdigital.co.th
# บัญชี ops สำหรับตรวจส่วนที่ต้องล็อกอิน
PROD_USER=it@playdigital.co.th
PROD_PASSWORD=********
# (ทางเลือก) token สำหรับ monitoring โดยไม่ต้องล็อกอิน
# HEALTH_TOKEN=<openssl rand -hex 24>
# บัญชีพนักงานสำหรับทดสอบสิทธิ์ (ห้ามใช้บัญชีจริง)
PENTEST_MEMBER_USER=nan@playdigital.co.th
PENTEST_MEMBER_PASSWORD=********
```

## 1) deploy
```bash
git pull && npm install && npm run build && pm2 restart <name> --update-env
```
`npm run build` จะฝัง commit/branch/เวลาที่ build ลงในแอป (ดูได้ที่ `/api/health` → `build`)

## 2) prod:check — โค้ดล่าสุดขึ้นหรือยัง + ระบบทำงานครบไหม
```bash
npm run prod:check
```
ตรวจให้: เข้าถึงเว็บได้, **commit บน production ตรงกับ HEAD ในเครื่องหรือไม่**, นาฬิกาเซิร์ฟเวอร์,
เขตเวลา Asia/Bangkok, endpoint ที่ต้องล็อกอินถูกปฏิเสธเมื่อไม่ล็อกอิน, security headers,
MariaDB/schema, และ round-trip ของเวลา (เขียน→อ่าน→แสดง)
- exit code ≠ 0 = ยังไม่ final
- ถ้าเห็น `production <commit> ≠ local <commit>` แปลว่า **ยัง migrate ไม่ครบ** ให้ deploy ก่อน

## 3) pentest — ต้องรันทุกครั้งก่อนถือว่า final
```bash
npm run pentest
# ตรวจสิทธิ์ระดับพนักงานด้วย (แนะนำ)
npm run pentest -- --member-user nan@playdigital.co.th --member-password '********'
# ทดสอบ rate limit (ยิง login ผิดสูงสุด 30 ครั้ง — ทำเมื่อจำเป็น)
npm run pentest -- --brute-force
```
รายงานจะถูกเขียนที่ `reports/pentest-<วันเวลา>.md` (โฟลเดอร์นี้อยู่ใน `.gitignore`)

## 4) รวมในคำสั่งเดียว
```bash
npm run verify:prod     # prod:check แล้วต่อด้วย pentest
```

## 5) ตรวจเวลา/ข้อมูลลงเวลา (ถ้ามีข้อมูลเก่า)
```bash
curl -s -H "x-health-token: $HEALTH_TOKEN" https://i.playdigital.co.th/api/health/time | jq '.roundTrip, .database'
npm run db:time
```

## เกณฑ์ “final”
- [ ] `npm run prod:check` ผ่านทุกข้อ (ไม่มี ❌)
- [ ] `npm run pentest` ไม่มี ❌ (⚠️ ที่เหลือต้องมีเหตุผลรับความเสี่ยงได้)
- [ ] `/api/health` → `build.commit` = commit ที่ต้องการปล่อย
- [ ] `/api/health/time` → `roundTrip.matches = true`
- [ ] เปิดหน้า HR/ลงเวลา แล้วเวลาเป็นเวลาไทยจริง

## หมายเหตุการเชื่อม Arena ⇄ production
- Arena แก้โค้ดบน branch ของ session → เปิด PR → merge เข้า `main`
- production ต้อง `git pull` จาก `main` แล้ว build ใหม่ (Arena ไม่ได้ deploy ให้อัตโนมัติ)
- หลัง deploy ให้รัน `prod:check` + `pentest` ตามด้านบน แล้วแนบผล (`reports/pentest-*.md`) ไว้กับรอบปล่อยงาน

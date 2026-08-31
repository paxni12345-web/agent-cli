# 🚀 Deploy ไป Render ใน 3 นาที

## ขั้นตอน (3 คลิกเดียว):

### 1. เปิด Render Dashboard
```
https://dashboard.render.com/
```

### 2. สร้าง Service ใหม่
- คลิก **"New +"** (ปุ่มขวาบน)
- เลือก **"Blueprint"**

### 3. เชื่อม GitHub Repo
- เลือก repo: **paxni12345-web/agent-cli**
- Render เจอ `render.yaml` อัตโนมัติ
- คลิก **"Apply"**

### 4. เพิ่ม Environment Variable (สำคัญ!)
- ไปที่ service ที่สร้าง
- คลิก "Environment"
- Add: `ANTHROPIC_API_KEY` = (คีย์ของคุณ)
- Save

### 5. รอ Deploy (5 นาที)
- Render จะ build จาก Dockerfile
- รอจน status เป็น "Live"
- เสร็จ!

---

## 🌐 หลัง Deploy สำเร็จ:

URL ของคุณจะเป็น:
```
https://agent-cli-xxxx.onrender.com
```

---

## ✅ ตรวจสอบว่า Deploy สำเร็จ:

```bash
curl https://agent-cli-xxxx.onrender.com/api/health
```

ถ้าได้ `{"status":"healthy"}` = สำเร็จ!

---

## 🆘 ถ้าติดปัญหา:

1. เช็ค Logs ใน Render dashboard
2. ตรวจสอบ ANTHROPIC_API_KEY ถูกต้อง
3. Dockerfile ทำงานได้ (มีอยู่แล้ว)
4. render.yaml ครบถ้วน (มีอยู่แล้ว)

---

**🎊 ทุกอย่างพร้อมแล้ว แค่ไปกดที่ Dashboard!**

ไป: https://dashboard.render.com/

# ✅ ตั้งค่า MaxPlus AI เรียบร้อยแล้ว!

## 🎉 Default Settings

ตอนนี้ระบบถูกตั้งค่าเริ่มต้นแล้วเป็น:

```
API Provider: MaxPlus AI (Custom)
API Endpoint: https://api.maxplus-ai.cc/claude-native/v1/messages
API Key: ccsk-66f2c55f1df186fb9431fb4270b7cf969f657772606b7b211f6d6733ddaccd36
Model: claude-opus-5
Theme: Pink White
```

---

## 🚀 วิธีใช้งาน:

### 1. เปิดเบราว์เซอร์
```
http://localhost:3000
```

### 2. เริ่มแชทได้เลย!
- ระบบจะเชื่อมต่อกับ MaxPlus AI โดยอัตโนมัติ
- ใช้ API key ที่คุณให้มา
- Model: claude-opus-5

### 3. ดูหรือแก้ไข Settings
- คลิกปุ่ม ⚙️ ที่มุมขวาบน
- จะเห็นค่าที่ตั้งไว้แล้ว
- แก้ไขได้ทุกเมื่อ

---

## 🎨 Features ที่เพิ่ม:

### ✅ Custom API Endpoint
- สามารถใส่ endpoint เองได้
- รองรับ API ที่เป็น Claude-compatible

### ✅ MaxPlus AI Provider
- เพิ่มตัวเลือก "MaxPlus AI (Custom)"
- ตั้งเป็นค่าเริ่มต้น

### ✅ Real API Integration
- Server จะส่งคำขอไปยัง API จริง
- ใช้ HTTPS
- ส่ง API key ใน header

---

## 🔧 Settings Panel:

เมื่อคลิก ⚙️ จะเห็น:

```
╔═══════════════════════════════════════╗
║  ⚙️ Settings                    [×]  ║
╠═══════════════════════════════════════╣
║                                       ║
║  API Provider:                        ║
║  [MaxPlus AI (Custom) ▼]             ║
║                                       ║
║  API Endpoint:                        ║
║  [https://api.maxplus-ai.cc/...]     ║
║                                       ║
║  API Key:                             ║
║  [ccsk-66f2c55f1df186fb...]          ║
║                                       ║
║  Model Name:                          ║
║  [claude-opus-5]                      ║
║                                       ║
║  System Prompt:                       ║
║  [(optional)]                         ║
║                                       ║
║  Theme:                               ║
║  [Pink White ▼]                       ║
║                                       ║
║  [💾 Save Settings]  [Cancel]        ║
╚═══════════════════════════════════════╝
```

---

## 📡 API Request Format:

Server จะส่งไปยัง MaxPlus AI แบบนี้:

```json
POST https://api.maxplus-ai.cc/claude-native/v1/messages
Headers:
  Content-Type: application/json
  x-api-key: ccsk-66f2c55f1df186fb...
  anthropic-version: 2023-06-01

Body:
{
  "model": "claude-opus-5",
  "messages": [
    {
      "role": "user",
      "content": "Your message here"
    }
  ],
  "max_tokens": 4096
}
```

---

## ✨ การทำงาน:

### 1. User พิมพ์ข้อความ
```
User: สวัสดีครับ
```

### 2. Frontend ส่งไป Backend
```
POST /api/chat
{
  "message": "สวัสดีครับ",
  "provider": "maxplus",
  "apiEndpoint": "https://api.maxplus-ai.cc/...",
  "apiKey": "ccsk-...",
  "modelName": "claude-opus-5"
}
```

### 3. Backend ส่งต่อไป MaxPlus AI
```
HTTPS POST → api.maxplus-ai.cc
```

### 4. MaxPlus AI ตอบกลับ
```
{
  "content": [
    {
      "text": "สวัสดีครับ! มีอะไรให้ช่วยไหมครับ?"
    }
  ]
}
```

### 5. แสดงผลใน UI
```
🤖 Agent: สวัสดีครับ! มีอะไรให้ช่วยไหมครับ?
```

---

## 🎯 ทดสอบเลย:

```
1. เปิด: http://localhost:3000
2. พิมพ์: "สวัสดีครับ"
3. กด Enter
4. ดู AI ตอบกลับจริงๆ จาก claude-opus-5!
```

---

## 💡 Tips:

### แก้ไข Settings:
```
1. คลิก ⚙️
2. แก้ค่าที่ต้องการ
3. Save
4. Settings บันทึกใน browser
```

### เปลี่ยน Model:
```
1. เปิด Settings
2. Model Name: claude-sonnet-5 (หรืออื่นๆ)
3. Save
```

### เพิ่ม System Prompt:
```
1. เปิด Settings
2. System Prompt: "คุณเป็นผู้ช่วยเขียนโค้ด"
3. Save
```

### เปลี่ยนสี:
```
1. เปิด Settings
2. Theme: Blue White / Green / Purple
3. Save
```

---

## 🎊 สรุป:

### ✅ ตั้งค่าเสร็จแล้ว:
- API Provider: MaxPlus AI
- Endpoint: api.maxplus-ai.cc
- API Key: ccsk-66f2c55f...
- Model: claude-opus-5
- Theme: Pink White

### ✅ พร้อมใช้งาน:
- เปิด http://localhost:3000
- แชทได้เลย
- เชื่อมกับ AI จริง
- ตอบกลับจาก claude-opus-5

---

**🚀 เปิดเบราว์เซอร์แล้วลองแชทได้เลย!**

**ระบบพร้อมใช้งาน MaxPlus AI แล้วครับ! 💕✨**

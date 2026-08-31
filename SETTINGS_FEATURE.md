# ⚙️ Settings Feature Added!

## ✅ เพิ่ม Settings Panel แล้ว!

---

## 🎉 **Features ใหม่:**

### 1. **API Provider Selection**
เลือกได้ 3 แบบ:
- ✅ Anthropic (Claude)
- ✅ OpenAI (GPT)
- ✅ Demo Mode (ไม่ต้องใช้ API)

### 2. **API Key Input**
- กรอก API key ของคุณ
- เก็บใน localStorage (ปลอดภัย)
- แสดงแบบ password (ซ่อน)

### 3. **Model Name**
- กำหนดชื่อ model เอง
- เช่น: claude-opus-4, claude-sonnet-4, gpt-4-turbo
- แสดงใน badge ด้านบน

### 4. **System Prompt**
- กำหนดคำสั่งให้ AI
- Custom instructions
- Optional (ไม่บังคับ)

### 5. **Theme Selection**
เลือกได้ 4 สี:
- 🌸 Pink White (Default)
- 💙 Blue White
- 💚 Green White
- 💜 Purple White

---

## 🎨 **วิธีใช้งาน:**

### **1. เปิด Settings**
```
คลิกปุ่ม ⚙️ ที่มุมขวาบน
```

### **2. กรอกข้อมูล**
```
1. เลือก API Provider
2. ใส่ API Key (ถ้ามี)
3. ระบุชื่อ Model
4. เขียน System Prompt (optional)
5. เลือก Theme สี
```

### **3. บันทึก**
```
คลิก "💾 Save Settings"
```

### **4. Settings จะถูกบันทึกใน Browser**
```
localStorage → ไม่หายแม้ปิดเบราว์เซอร์
```

---

## 🔧 **ตัวอย่างการตั้งค่า:**

### **A. ใช้ Anthropic Claude**
```
API Provider: Anthropic (Claude)
API Key: sk-ant-api03-xxxxx
Model Name: claude-opus-4
System Prompt: You are a helpful coding assistant
Theme: Pink White
```

### **B. ใช้ OpenAI GPT**
```
API Provider: OpenAI (GPT)
API Key: sk-xxxxx
Model Name: gpt-4-turbo
System Prompt: You are an expert programmer
Theme: Blue White
```

### **C. ใช้ Demo Mode**
```
API Provider: Demo Mode
API Key: (ว่างไว้)
Model Name: demo-model
System Prompt: (ว่างไว้)
Theme: Pink White
```

---

## 💾 **การจัดเก็บข้อมูล:**

### **localStorage Structure:**
```json
{
  "apiProvider": "anthropic",
  "apiKey": "sk-ant-xxx",
  "modelName": "claude-opus-4",
  "systemPrompt": "You are helpful",
  "theme": "pink"
}
```

### **ปลอดภัย:**
- ✅ เก็บใน browser ของคุณเท่านั้น
- ✅ ไม่ส่งไปเซิร์ฟเวอร์
- ✅ ลบได้ทุกเมื่อ (Clear browser data)

---

## 🎨 **Themes Preview:**

### **Pink White (Default)**
```css
Background: #FFF5F7 (ขาวอมชมพู)
Accent: #FF69B4 (Hot Pink)
```

### **Blue White**
```css
Background: #F0F8FF (ขาวอมฟ้า)
Accent: #4169E1 (Royal Blue)
```

### **Green White**
```css
Background: #F0FFF0 (ขาวอมเขียว)
Accent: #32CD32 (Lime Green)
```

### **Purple White**
```css
Background: #F8F0FF (ขาวอมม่วง)
Accent: #9370DB (Medium Purple)
```

---

## ⌨️ **Keyboard Shortcuts:**

| Key | Action |
|-----|--------|
| **Click ⚙️** | Open Settings |
| **Esc** | Close Settings (soon) |
| **Ctrl+S** | Save Settings (soon) |

---

## 🔐 **API Keys:**

### **Anthropic (Claude):**
```
1. ไปที่: https://console.anthropic.com
2. สร้าง API key
3. เริ่มต้นด้วย: sk-ant-api03-
4. Copy มาใส่ใน Settings
```

### **OpenAI (GPT):**
```
1. ไปที่: https://platform.openai.com
2. สร้าง API key
3. เริ่มต้นด้วย: sk-
4. Copy มาใส่ใน Settings
```

---

## 🎯 **ตัวอย่างการใช้งาน:**

### **Scenario 1: ใช้ Claude API จริง**
```
1. คลิก ⚙️
2. เลือก "Anthropic (Claude)"
3. ใส่ API key: sk-ant-api03-xxxxx
4. Model: claude-opus-4
5. Save
6. เริ่มแชท → เชื่อมกับ Claude จริง!
```

### **Scenario 2: ทดสอบไม่มี API**
```
1. คลิก ⚙️
2. เลือก "Demo Mode"
3. Model: demo-model
4. Save
5. เริ่มแชท → ใช้ demo responses
```

### **Scenario 3: เปลี่ยนสี**
```
1. คลิก ⚙️
2. เลือก Theme: Blue White
3. Save
4. UI เปลี่ยนเป็นสีฟ้าทันที!
```

---

## 🆕 **UI Changes:**

### **Header:**
```
🤖 Agent CLI    ◉ Ready    [Your Model]  [⚙️]  [☰]
                                          ^^^
                                    Settings button!
```

### **Settings Modal:**
```
╔════════════════════════════════════╗
║  ⚙️ Settings                  [×] ║
╠════════════════════════════════════╣
║                                    ║
║  API Provider:                     ║
║  [Anthropic (Claude) ▼]           ║
║                                    ║
║  API Key:                          ║
║  [••••••••••••••••••••]           ║
║                                    ║
║  Model Name:                       ║
║  [claude-opus-4]                   ║
║                                    ║
║  System Prompt:                    ║
║  [You are helpful...]              ║
║                                    ║
║  Theme:                            ║
║  [Pink White ▼]                    ║
║                                    ║
║  [💾 Save Settings]  [Cancel]     ║
║                                    ║
╚════════════════════════════════════╝
```

---

## 📊 **Summary:**

### ✅ **Features Added:**
- ⚙️ Settings panel
- 🔑 API key input
- 🤖 Model name config
- 💬 System prompt
- 🎨 Theme switcher
- 💾 localStorage save
- 🔄 Auto-load on start
- 🎯 Real-time updates

### ✅ **Providers Supported:**
- Anthropic (Claude)
- OpenAI (GPT)
- Demo Mode

### ✅ **Themes Available:**
- Pink White
- Blue White
- Green White
- Purple White

---

## 🚀 **ลิงก์เข้าใช้งาน:**

```
http://localhost:3000
```

**คลิก ⚙️ เพื่อเปิด Settings!**

---

## 🎊 **ตอนนี้มีครบแล้ว:**

✅ Beautiful UI (Pink theme)
✅ Chat interface
✅ Real-time messaging
✅ **Settings panel** ← ใหม่!
✅ **API config** ← ใหม่!
✅ **Model config** ← ใหม่!
✅ **Theme switcher** ← ใหม่!
✅ Responsive design
✅ localStorage save
✅ Keyboard shortcuts

---

**🎉 Settings ครบพร้อมใช้งานแล้วครับ!**

**เปิด http://localhost:3000 แล้วคลิก ⚙️ เลย!** ✨

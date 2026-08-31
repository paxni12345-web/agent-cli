# 🎨 UI Design - Claude Code Style

## สรุป UI ใหม่

ผมได้สร้าง UI แบบ Claude Code CLI ที่สวยงามและใช้งานง่ายสำหรับ Termux แล้ว!

---

## 📁 ไฟล์ที่สร้าง

### Main Application
- **src/cli-ui.ts** - Entry point พร้อม banner สวยงาม
- **src/ui/App.tsx** - Main application layout

### Components
- **src/ui/components/Header.tsx** - Header พร้อม logo, status, model info
- **src/ui/components/ChatView.tsx** - แสดงข้อความแบบสวยงาม
- **src/ui/components/InputBox.tsx** - Input field พร้อม history
- **src/ui/components/StatusBar.tsx** - แสดง tokens, tasks, model
- **src/ui/components/Spinner.tsx** - Loading indicator หลายแบบ
- **src/ui/components/LogView.tsx** - แสดง tool executions
- **src/ui/components/Footer.tsx** - แสดง shortcuts และ tips

### Types
- **src/ui/types.ts** - Type definitions สำหรับ UI

---

## ✨ Features

### 1. **Beautiful Header**
```
╔═══════════════════════════════════════════════════════╗
║ ╔═══╗ Agent CLI │ v0.1.0                    ◉ Ready ║
║                                                       ║
║ Model: claude-opus-4    📁 /root    ⚡ ULTRA MODE   ║
╚═══════════════════════════════════════════════════════╝
```

### 2. **Message Display**
```
┌─ 👤 You ────────────────────── 14:30:25 ─┐
│ Help me fix this bug                      │
└───────────────────────────────────────────┘

┌─ 🤖 Agent ──────────────────── 14:30:28 ─┐
│ I'll help you fix that bug.               │
│                                           │
│ First, let me check the error...         │
│                                           │
│ 🔢 150 tokens │ ⏱ 2500ms                │
└───────────────────────────────────────────┘
```

### 3. **Input Box**
```
╭─ ▶ Message ──────────────── Enter to send ─╮
│ Type your message...                        │
│                                             │
│ 💡 /help for commands │ ↑↓ for history     │
╰─────────────────────────────────────────────╯
```

### 4. **Status Bar**
```
╭─────────────────────────────────────────────╮
│ ✓ Tasks: 5  │  Tokens: [████░░░] 45K/200K │
╰─────────────────────────────────────────────╯
```

### 5. **Loading Indicators**
- ⠋ Thinking... (animated spinner)
- ⚙ Executing... (animated dots)

---

## 🚀 วิธีใช้งาน

### วิธีที่ 1: ติดตั้งและรัน (เมื่อ npm install สำเร็จ)

```bash
cd /root/agent-cli

# Compile TypeScript
npm run build

# เริ่ม UI
npm run start:ui

# หรือใช้คำสั่งตรง
node dist/cli-ui.js
```

### วิธีที่ 2: Development Mode

```bash
# รัน dev mode (ไม่ต้อง compile)
npm run ui:dev
```

### วิธีที่ 3: ติดตั้งเป็น Command

```bash
# Link globally
npm link

# จากนั้นรันได้ทุกที่
agent-ui
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Enter** | ส่งข้อความ |
| **↑ / ↓** | เลื่อนดู history |
| **Tab** | Auto-complete (coming soon) |
| **Ctrl+L** | Clear screen |
| **Ctrl+C** | ออกจากโปรแกรม |
| **F1** | แสดง/ซ่อน help |

---

## 🎨 UI Components Details

### Header Component
- แสดง logo และชื่อแอพ
- Status indicator (Ready, Thinking, Executing)
- Model name และ version
- Working directory (ย่อถ้ายาวเกิน 30 ตัวอักษร)
- Mode badge (NORMAL/FAST/ULTRA) พร้อมสีสันสวยงาม

### ChatView Component
- แสดงข้อความทั้งหมด
- แยกสีตาม role (User=cyan, Agent=magenta, System=gray)
- แสดง timestamp แต่ละข้อความ
- แสดง metadata (tokens used, duration)
- Scrollable ดูย้อนหลังได้

### InputBox Component
- Input field แบบ interactive
- แสดง placeholder เมื่อว่าง
- Command history (↑↓)
- Disable เมื่อ AI กำลังคิด
- แสดง hints และ shortcuts

### StatusBar Component
- แสดงจำนวน tasks ที่เสร็จ
- Token usage แบบ progress bar สีสวยงาม
- เปอร์เซ็นต์การใช้ tokens
- Model name แบบย่อ

### Spinner Component
- 5 แบบ: dots, line, arc, bounce, pulse
- Animated ด้วย useEffect
- สีปรับได้: cyan, magenta, yellow, green

---

## 🎭 Color Scheme

### Status Colors
- **Idle/Ready**: Gray
- **Thinking**: Yellow
- **Executing**: Blue  
- **Completed**: Green
- **Error**: Red

### Mode Colors
- **NORMAL**: Gray background
- **FAST**: Cyan background
- **ULTRA**: Magenta background

### Role Colors
- **User**: Cyan
- **Assistant**: Magenta
- **System**: Gray

---

## 💡 Slash Commands

```bash
/help          # แสดงคำสั่งทั้งหมด
/clear         # ล้างหน้าจอ
/status        # แสดงสถานะปัจจุบัน
/model <name>  # เปลี่ยน model
/mode <mode>   # เปลี่ยน mode (normal/fast/ultra)
/exit          # ออกจากโปรแกรม
```

---

## 🔧 การปรับแต่ง

### เปลี่ยนสี Theme
แก้ไขใน `src/ui/components/*.tsx`:

```typescript
// Header.tsx - เปลี่ยนสีหลัก
borderColor="cyan"  // เปลี่ยนเป็น "magenta", "yellow", etc.

// ChatView.tsx - เปลี่ยนสี message
borderColor={message.role === 'user' ? 'cyan' : 'magenta'}
```

### เปลี่ยน Spinner
```typescript
<Spinner type="dots" color="cyan" />
// type: dots, line, arc, bounce, pulse
// color: cyan, magenta, yellow, green
```

### ปรับความเร็ว Animation
```typescript
// Spinner.tsx
const interval = setInterval(() => {
  setFrame((prev) => (prev + 1) % currentFrames.length);
}, 80);  // เปลี่ยน 80 เป็นค่าอื่น (ms)
```

---

## 📱 Termux Optimization

UI นี้ออกแบบมาเพื่อ Termux โดยเฉพาะ:
- ใช้ Box layout ที่ responsive
- ไม่มี dependencies ที่ต้องการ native modules
- ใช้ Ink (React for CLI) ที่ทำงานได้ดีบน Termux
- Text wrapping อัตโนมัติ
- Support keyboard shortcuts ของ Termux

---

## 🐛 Troubleshooting

### ปัญหา: UI ไม่แสดง
```bash
# ตรวจสอบ terminal size
echo $COLUMNS $LINES

# ควรมากกว่า 80x24
# ถ้าน้อยกว่า ขยาย Termux window
```

### ปัญหา: สีไม่แสดง
```bash
# เช็ค color support
echo $COLORTERM
echo $TERM

# ตั้งค่า
export COLORTERM=truecolor
export TERM=xterm-256color
```

### ปัญหา: Ink error
```bash
# ติดตั้ง dependencies
npm install ink react ink-text-input
```

---

## 🎯 ตัวอย่างหน้าจอเต็ม

```
╔═══════════════════════════════════════════════════════╗
║ ╔═══╗ Agent CLI │ v0.1.0                    ◉ Ready ║
║                                                       ║
║ Model: claude-opus-4    📁 /root    ⚡ ULTRA MODE   ║
╚═══════════════════════════════════════════════════════╝

┌─ 🤖 Agent ──────────────────── 14:25:10 ─┐
│ Welcome to Agent CLI! 🎉                  │
│                                           │
│ Working directory: /root                  │
│ Model: claude-opus-4                      │
│ Mode: ultra                               │
│                                           │
│ Type your request or /help for commands. │
└───────────────────────────────────────────┘

┌─ 👤 You ────────────────────── 14:26:15 ─┐
│ Help me create a React component         │
└───────────────────────────────────────────┘

⠋ Thinking...

╭─ ▶ Message ──────────────── Enter to send ─╮
│ │                                           │
│                                             │
│ 💡 /help │ ↑↓ history │ Ctrl+C exit       │
╰─────────────────────────────────────────────╯

╭─────────────────────────────────────────────╮
│ ✓ Tasks: 0  │  Tokens: [░░░░░] 0/200K (0%)│
╰─────────────────────────────────────────────╯
```

---

## 🎊 สรุป

### ✅ สิ่งที่ได้:
- UI สวยงามแบบ Claude Code
- Interactive components ครบถ้วน
- Keyboard shortcuts
- Command history
- Real-time status updates
- Token usage tracking
- Beautiful colors and borders
- Responsive layout
- Optimized for Termux

### 📝 ขั้นตอนต่อไป:
1. รอ `npm install` สำเร็จ
2. รัน `npm run build`
3. รัน `npm run start:ui`
4. เพลิดเพลินกับ UI สุดสวย! 🎨

---

**Created**: 2026-08-31  
**Style**: Claude Code CLI  
**Framework**: React + Ink  
**Status**: ✅ Ready to use (รอ npm install)

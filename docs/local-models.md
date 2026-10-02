# Local Router Models (xLAM + Laya)

`src/agent/ToolRouter.ts` รองรับการเลือก tool ด้วยโมเดล local 2 ตัว (ไม่ต้องใช้ API key ไม่ต้องจ่ายเงิน):

| โมเดล | หน้าที่ | Endpoint เริ่มต้น |
|---|---|---|
| [xLAM 1B](https://huggingface.co/Salesforce/xLAM-1B-fc-r) (Salesforce) | เสนอ shortlist ของ tool ที่เกี่ยวข้อง (native tool calling แบบ [OI]) | `http://127.0.0.1:11434/v1/chat/completions` (Ollama) |
| [Laya](https://huggingface.co/convaiinnovations/laya) (convaiinnovations) | ตรวจว่า tool ที่เลือกมาตรงกับคำถามผู้ใช้จริงไหม (noul scoring) | `http://127.0.0.1:8000/v1/systemone` |

## เริ่มใช้งาน

```bash
bash scripts/start-local-models.sh
```

Script จะ:

1. ติดตั้ง + สตาร์ท [Ollama](https://ollama.com) ถ้ายังไม่มี
2. ดึงโมเดล xLAM **รุ่น 4-bit** (official GGUF `Q4_K_S` ~776MB จาก [Salesforce/xLAM-1b-fc-r-gguf](https://huggingface.co/Salesforce/xLAM-1b-fc-r-gguf) — เปลี่ยน quant ได้ด้วย `XLAM_GGUF_URL`)
3. สร้าง venv ที่ `~/.agent-cli/laya-server` ติดตั้ง torch + transformers + bitsandbytes แล้วสตาร์ท FastAPI server ที่แปลง Laya เป็น endpoint `/v1/systemone` (คืนค่า `{"answers": {tool: {"noul": 0..1}}}`) — โหลด Laya เป็น **4-bit NF4** อัตโนมัติเมื่อมี GPU (ลด RAM/VRAM เหลือ ~1/4 ของ fp16, CPU ใช้ fp32 เพราะ bitsandbytes 4-bit ใช้ได้บน GPU เท่านั้น)
4. Keep-alive ทั้งสองโมเดลไว้ (ไม่โหลดใหม่ทุก request)

## เปิดใช้ใน agent

```bash
export AGENT_TOOL_ROUTER=chain     # xLAM เสนอ → Laya ตรวจ
# หรือ AGENT_TOOL_ROUTER=xlam (default) / off
# โมเดลล่ม/หมดเวลา = ส่ง tool ทั้งหมดให้โมเดลหลักเลือกเอง (ไม่มี keyword เดาแล้ว)
```

ตัวแปรเพิ่มเติม:

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `XLAM_ROUTER_URL` | `http://127.0.0.1:11434/v1/chat/completions` | endpoint xLAM |
| `XLAM_ROUTER_MODEL` | `xlam` | ชื่อโมเดลใน Ollama |
| `LAYA_ROUTER_URL` | `http://127.0.0.1:8000/v1/systemone` | endpoint Laya |
| `AGENT_TOOL_ROUTER_TIMEOUT_MS` | `1500` | timeout ต่อการเรียกโมเดล |
| `AGENT_TOOL_ROUTER_VERIFY` | `on` | ปิดด้วย `off` เพื่อข้าม Laya |

## Fail-safe

โมเดล local เป็น **ของแถม ไม่ใช่ข้อบังคับ** — ถ้า endpoint ไหนล่ม/ช้า/ตอบมั่ว router จะส่ง tool ทั้งหมดผ่านไปให้โมเดลหลักเลือกเองตามปกติ (native tool calling) ไม่มีการเดาด้วย keyword อีกต่อไป

## สเปกเครื่องที่แนะนำ (ใช้ quant 4-bit ทั้งคู่แล้ว)

- xLAM 1B **Q4_K_S 4-bit** ~776MB ดาวน์โหลด, รันใช้ RAM ~600MB-1GB
- Laya **4-bit NF4** (ต้องมี GPU) ~0.5-1GB VRAM / ถ้า CPU-only จะใช้ fp32 ~2GB RAM
- รวมแนะนำ RAM ว่างอย่างน้อย 2.5GB (มี GPU) หรือ 4GB (CPU-only)

> หมายเหตุ: ถ้าเครื่องจำกัด RAM (เช่น < 2GB ว่าง) แนะนำรันเฉพาะ xLAM แล้วปิด verify ด้วย `AGENT_TOOL_ROUTER_VERIFY=off`

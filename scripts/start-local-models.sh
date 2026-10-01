#!/usr/bin/env bash
# Start the two local router models used by src/agent/ToolRouter.ts:
#   1. xLAM 1B  — tool shortlisting via [OI]-compatible tool calling (Ollama, port 11434)
#   2. Laya     — tool verification via noul questions (convaiinnovations/laya, port 8000)
# Both are optional: when either endpoint is down the router degrades to keywords.
set -euo pipefail

XLAM_MODEL="${XLAM_MODEL:-xlam}"
LAYA_PORT="${LAYA_PORT:-8000}"
LAYA_DIR="${LAYA_DIR:-$HOME/.agent-cli/laya-server}"

echo "==> Checking Ollama (xLAM host)…"
if ! command -v ollama >/dev/null 2>&1; then
  echo "    Installing Ollama…"
  curl -fsSL https://ollama.com/install.sh | sh
fi

if ! curl -fsS -m 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  echo "    Starting Ollama server…"
  nohup ollama serve >/tmp/agent-cli-ollama.log 2>&1 &
  for _ in $(seq 1 30); do
    curl -fsS -m 2 http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
    sleep 1
  done
fi

if curl -fsS -m 2 "http://127.0.0.1:11434/api/tags" | grep -q "\"name\":\"$XLAM_MODEL"; then
  echo "    xLAM model '$XLAM_MODEL' already present."
else
  echo "    Pulling xLAM (4-bit)…"
  # Official Salesforce GGUF: Q4_K_S 4-bit (~776MB, runs in well under 1GB RAM).
  # Override the quant file with XLAM_GGUF_URL if wanted.
  if ! ollama pull "$XLAM_MODEL" 2>/dev/null; then
    echo "    Registry pull failed, importing official 4-bit GGUF from HuggingFace…"
    tmp=$(mktemp -d)
    curl -fL "${XLAM_GGUF_URL:-https://huggingface.co/Salesforce/xLAM-1b-fc-r-gguf/resolve/main/xLAM-1b-fc-r.Q4_K_S.gguf}" -o "$tmp/xlam.gguf"
    cat > "$tmp/Modelfile" <<EOF
FROM $tmp/xlam.gguf
PARAMETER num_ctx 4096
EOF
    ollama create "$XLAM_MODEL" -f "$tmp/Modelfile"
    rm -rf "$tmp"
  fi
fi
echo "    Keep model warm: ollama run $XLAM_MODEL --keepalive 24h"
ollama run "$XLAM_MODEL" --keepalive 24h >/dev/null 2>&1 || true

echo "==> Checking Laya server (port $LAYA_PORT)…"
if curl -fsS -m 2 "http://127.0.0.1:$LAYA_PORT/v1/systemone" -X POST -H 'Content-Type: application/json' \
     -d '{"state":{"document":"ping"},"questions":{"q":{"type":"noul","instructions":"ping"}}}' >/dev/null 2>&1; then
  echo "    Laya already running."
else
  echo "    Setting up Laya noul server (first run downloads ~2GB)…"
  python3 -m venv "$LAYA_DIR/venv"
  # shellcheck disable=SC1091
  source "$LAYA_DIR/venv/bin/activate"
  pip install --quiet "torch>=2.2" transformers fastapi uvicorn "bitsandbytes>=0.43" accelerate
  if [ ! -f "$LAYA_DIR/server.py" ]; then
    cat > "$LAYA_DIR/server.py" <<'PY'
"""Minimal noul endpoint for convaiinnovations/laya.

POST /v1/systemone {"state":{"document": "..."}, "questions": {name: {"type":"noul","instructions":"..."}, ...}}
-> {"answers": {name: {"noul": <score 0..1>}, ...}}

One forward pass per question: each instruction is scored as yes/no against the
document, and noul is the yes-probability. Answers are sequential so keep tool
counts modest (the router caps at maxTools anyway).

Model is loaded in 4-bit (NF4 via bitsandbytes) when bitsandbytes is importable,
which cuts VRAM/RAM use to roughly a quarter of fp16.
"""
import os
from typing import Any, Dict

import torch
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = os.environ.get("LAYA_MODEL_ID", "convaiinnovations/laya")
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

app = FastAPI()
tok = AutoTokenizer.from_pretrained(MODEL_ID)
try:
    from bitsandbytes import __version__ as _bnb  # noqa: F401
    from transformers import BitsAndBytesConfig
    if DEVICE == "cuda":
        bnb = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.float16, bnb_4bit_quant_type="nf4")
        model = AutoModelForCausalLM.from_pretrained(MODEL_ID, device_map="auto", quantization_config=bnb).eval()
    else:
        # 4-bit NF4 needs a GPU; on CPU fall back to float32 (small model, still light).
        model = AutoModelForCausalLM.from_pretrained(MODEL_ID).eval()
except ImportError:
    model = AutoModelForCausalLM.from_pretrained(MODEL_ID).to(DEVICE).eval()
YES_ID = tok.encode("yes", add_special_tokens=False)[0]
NO_ID = tok.encode("no", add_special_tokens=False)[0]


class Question(BaseModel):
    type: str = "noul"
    instructions: str


class Body(BaseModel):
    state: Dict[str, Any]
    questions: Dict[str, Question]


def score(instruction: str, document: str) -> float:
    prompt = f"Context:\n{document}\n\nQuestion: {instruction}\nAnswer (yes/no):"
    inputs = tok(prompt, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        logits = model(**inputs).logits[0, -1]
    yes_no = torch.tensor([logits[YES_ID], logits[NO_ID]])
    return torch.softmax(yes_no, dim=0)[0].item()


@app.post("/v1/systemone")
def systemone(body: Body) -> Dict[str, Any]:
    document = str(body.state.get("document", ""))
    answers: Dict[str, Dict[str, Any]] = {}
    for name, q in body.questions.items():
        value = score(q.instructions, document)
        answers[name] = {"noul": value, "choice": "yes" if value >= 0.5 else "no", "confidence": value}
    return {"answers": answers}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("LAYA_PORT", "8000")))
PY
  fi
  echo "    Starting Laya server on :$LAYA_PORT…"
  LAYA_PORT="$LAYA_PORT" nohup python3 "$LAYA_DIR/server.py" >/tmp/agent-cli-laya.log 2>&1 &
  deactivate
fi

echo "==> Done. Endpoints:"
echo "    xLAM : http://127.0.0.1:11434/v1/chat/completions (model: $XLAM_MODEL)"
echo "    Laya : http://127.0.0.1:$LAYA_PORT/v1/systemone"
echo "    Router picks these up automatically; override with XLAM_ROUTER_URL / LAYA_ROUTER_URL / XLAM_ROUTER_MODEL."

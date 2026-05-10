import io
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional
from contextlib import asynccontextmanager

import aiosqlite
from openai import AsyncOpenAI
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

load_dotenv()

SKILL_PATH = Path(__file__).parent / "skill.md"
SYSTEM_PROMPT = SKILL_PATH.read_text(encoding="utf-8")
DB_PATH = Path(__file__).parent / "interviews.db"

REPORT_PROMPT = """\
你是专业的面试报告生成助手。根据面试对话，生成结构化报告。

只返回如下JSON，不要有任何额外文字：
{
  "role": "面试岗位（从对话提取）",
  "level": "经验层级",
  "overall_score": 7.5,
  "verdict": "Hire",
  "questions": [
    {
      "question": "面试题目完整表述",
      "user_answer": "候选人回答摘要（2-3句）",
      "standard_answer": "完整标准答案，覆盖所有关键知识点，不少于200字",
      "score": 8,
      "feedback": "对本次回答的具体点评（1-2句）"
    }
  ],
  "strengths": ["优势1", "优势2", "优势3"],
  "improvements": ["改进点1", "改进点2", "改进点3"],
  "recommended_topics": ["建议深入学习的主题1", "主题2", "主题3"]
}

注意：
- questions 只含真正的面试题，不含开场白和结束语
- verdict 只能是：Strong Hire / Hire / Lean Hire / Lean No Hire / No Hire
- overall_score 为 0-10 小数"""

# ── Default AI client (from .env) ───────────────
_default_ai = AsyncOpenAI(
    api_key=__import__("os").getenv("DEEPSEEK_API_KEY", ""),
    base_url="https://api.deepseek.com",
)
_default_model = "deepseek-chat"


# ── DB ───────────────────────────────────────────
async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id          TEXT    PRIMARY KEY,
                title       TEXT    NOT NULL DEFAULT '新面试',
                turn_count  INTEGER NOT NULL DEFAULT 0,
                duration_s  INTEGER NOT NULL DEFAULT 0,
                report_json TEXT,
                created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime')),
                updated_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT    NOT NULL,
                role        TEXT    NOT NULL,
                content     TEXT    NOT NULL,
                created_at  TEXT    NOT NULL DEFAULT (datetime('now','localtime'))
            )
        """)
        await db.execute(
            "CREATE INDEX IF NOT EXISTS idx_msg_session ON messages(session_id)"
        )
        # migration: add report_json if upgrading from older schema
        try:
            await db.execute("ALTER TABLE sessions ADD COLUMN report_json TEXT")
        except Exception:
            pass
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Interview Simulator", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic models ──────────────────────────────
class LLMConfig(BaseModel):
    api_key: str
    base_url: str
    model: str


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    llm: Optional[LLMConfig] = None


class TurnSave(BaseModel):
    session_id: str
    user_content: str
    assistant_content: str
    turn_count: int
    duration_s: int
    title: Optional[str] = None


class ReportRequest(BaseModel):
    llm: Optional[LLMConfig] = None


# ── Helpers ──────────────────────────────────────
def make_client(cfg: Optional[LLMConfig]):
    """Return (AsyncOpenAI client, model_name) for the given config or defaults."""
    if cfg and cfg.api_key and cfg.base_url and cfg.model:
        return AsyncOpenAI(api_key=cfg.api_key, base_url=cfg.base_url), cfg.model
    return _default_ai, _default_model


def build_docx(report: dict) -> io.BytesIO:
    doc = Document()
    for sec in doc.sections:
        sec.top_margin = sec.bottom_margin = Cm(2.5)
        sec.left_margin = sec.right_margin = Cm(3)

    # Title
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("面  试  报  告")
    r.font.size = Pt(22)
    r.font.bold = True

    doc.add_paragraph()

    # Meta
    for line in [
        f"生成时间：{datetime.now().strftime('%Y年%m月%d日 %H:%M')}",
        f"面试岗位：{report.get('role','—')}    经验层级：{report.get('level','—')}",
        f"综合评分：{report.get('overall_score','—')}/10    面试结论：{report.get('verdict','—')}",
    ]:
        doc.add_paragraph(line).runs[0].font.size = Pt(11)

    doc.add_paragraph()

    # Questions
    doc.add_heading("详细题目分析", 1)
    for i, q in enumerate(report.get("questions", []), 1):
        doc.add_heading(f"Q{i}.  {q.get('question','')}", 2)

        # Score
        p = doc.add_paragraph()
        r = p.add_run(f"得分：{q.get('score','—')}/10")
        r.font.bold = True
        r.font.color.rgb = RGBColor(0x21, 0x7D, 0xBB)

        # User answer
        p = doc.add_paragraph()
        r = p.add_run("候选人回答：\n")
        r.font.bold = True
        r.font.color.rgb = RGBColor(0x6B, 0x6B, 0x6B)
        p.add_run(q.get("user_answer", "未作答")).font.size = Pt(10.5)

        # Standard answer
        p = doc.add_paragraph()
        r = p.add_run("标准答案：\n")
        r.font.bold = True
        r.font.color.rgb = RGBColor(0x27, 0x9E, 0x6E)
        p.add_run(q.get("standard_answer", "")).font.size = Pt(10.5)

        # Feedback
        if q.get("feedback"):
            p = doc.add_paragraph()
            r = p.add_run("评价：")
            r.font.bold = True
            r.font.color.rgb = RGBColor(0x8B, 0x5C, 0xF6)
            p.add_run(q["feedback"]).font.size = Pt(10.5)

        doc.add_paragraph()

    # Summary
    doc.add_heading("综合评价", 1)
    for label, key in [
        ("主要优势", "strengths"),
        ("改进方向", "improvements"),
        ("建议学习", "recommended_topics"),
    ]:
        items = report.get(key, [])
        if items:
            doc.add_heading(label, 2)
            for item in items:
                doc.add_paragraph(item, style="List Bullet").runs[0].font.size = Pt(10.5)

    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf


# ── Health ───────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ── Sessions ─────────────────────────────────────
@app.post("/api/sessions")
async def create_session():
    sid = str(uuid.uuid4())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("INSERT INTO sessions (id) VALUES (?)", (sid,))
        await db.commit()
    return {"id": sid}


@app.get("/api/sessions")
async def list_sessions():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT id, title, turn_count, duration_s, created_at FROM sessions "
            "ORDER BY updated_at DESC LIMIT 60"
        ) as cur:
            rows = await cur.fetchall()
    return [dict(r) for r in rows]


@app.get("/api/sessions/{sid}/messages")
async def get_session_messages(sid: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT id FROM sessions WHERE id=?", (sid,)) as cur:
            if not await cur.fetchone():
                raise HTTPException(404, "Session not found")
        async with db.execute(
            "SELECT role, content FROM messages WHERE session_id=? ORDER BY id", (sid,)
        ) as cur:
            rows = await cur.fetchall()
    return {"messages": [dict(r) for r in rows]}


@app.post("/api/sessions/save-turn")
async def save_turn(data: TurnSave):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO messages (session_id, role, content) VALUES (?,?,?)",
            (data.session_id, "user", data.user_content),
        )
        await db.execute(
            "INSERT INTO messages (session_id, role, content) VALUES (?,?,?)",
            (data.session_id, "assistant", data.assistant_content),
        )
        if data.title:
            await db.execute(
                "UPDATE sessions SET title=?,turn_count=?,duration_s=?,"
                "updated_at=datetime('now','localtime') WHERE id=?",
                (data.title, data.turn_count, data.duration_s, data.session_id),
            )
        else:
            await db.execute(
                "UPDATE sessions SET turn_count=?,duration_s=?,"
                "updated_at=datetime('now','localtime') WHERE id=?",
                (data.turn_count, data.duration_s, data.session_id),
            )
        await db.commit()
    return {"ok": True}


@app.delete("/api/sessions/{sid}")
async def delete_session(sid: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM messages WHERE session_id=?", (sid,))
        await db.execute("DELETE FROM sessions WHERE id=?", (sid,))
        await db.commit()
    return {"ok": True}


# ── Report ───────────────────────────────────────
@app.post("/api/sessions/{sid}/report")
async def generate_report(sid: str, body: ReportRequest = None):
    # Load conversation
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT role, content FROM messages WHERE session_id=? ORDER BY id", (sid,)
        ) as cur:
            rows = await cur.fetchall()

    msgs = [dict(r) for r in rows]
    if len(msgs) < 4:
        raise HTTPException(400, "对话内容不足，无法生成报告")

    conv = "\n\n".join(
        f"{'面试官' if m['role']=='assistant' else '候选人'}：{m['content']}"
        for m in msgs
    )

    client, model = make_client(body.llm if body else None)

    resp = await client.chat.completions.create(
        model=model,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": REPORT_PROMPT},
            {"role": "user", "content": f"面试对话如下：\n\n{conv}"},
        ],
        response_format={"type": "json_object"},
    )

    report = json.loads(resp.choices[0].message.content)

    # Persist so download doesn't need to regenerate
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE sessions SET report_json=? WHERE id=?",
            (json.dumps(report, ensure_ascii=False), sid),
        )
        await db.commit()

    return report


@app.get("/api/sessions/{sid}/report/download")
async def download_report(sid: str):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT report_json FROM sessions WHERE id=?", (sid,)
        ) as cur:
            row = await cur.fetchone()

    if not row or not row["report_json"]:
        raise HTTPException(404, "请先生成报告")

    report = json.loads(row["report_json"])
    buf = build_docx(report)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": "attachment; filename*=UTF-8''interview_report.docx"},
    )


# ── Chat ─────────────────────────────────────────
@app.post("/api/chat")
async def chat(request: ChatRequest):
    client, model = make_client(request.llm)

    async def generate():
        try:
            stream = await client.chat.completions.create(
                model=model,
                max_tokens=2048,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    *[{"role": m.role, "content": m.content} for m in request.messages],
                ],
                stream=True,
            )
            async for chunk in stream:
                text = chunk.choices[0].delta.content
                if text:
                    yield f"data: {json.dumps({'type':'text','content':text}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'type':'done'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type':'error','content':str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# Must be last
frontend_dir = Path(__file__).parent.parent / "frontend"
app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="static")

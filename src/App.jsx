import { useState, useRef } from "react";

const SYSTEM_KO_JP = `당신은 한국인을 위한 일본어 선생님입니다. 사용자가 한국어(단어·문장·상황)를 입력하면 반드시 아래 JSON만 반환하세요. 다른 텍스트 절대 금지.
{
  "japanese": "일본어 문장",
  "pronunciation": "전체 한글 발음",
  "meaning": "한국어 의미",
  "parts": [{"word":"어소","reading":"히라가나","pronunciation":"한글발음","meaning":"한국어뜻","type":"품사","note":"문법포인트"}],
  "tip": "한 줄 사용 팁"
}
규칙: 상황이면 자연스러운 일본어 문장 1개 생성. parts는 모든 어소 순서대로. pronunciation은 반드시 한글.`;

const SYSTEM_JP_KO = `당신은 한국인을 위한 일본어 선생님입니다. 사용자가 일본어를 입력하면 반드시 아래 JSON만 반환하세요. 다른 텍스트 절대 금지.
{
  "japanese": "입력된 일본어",
  "pronunciation": "전체 한글 발음",
  "meaning": "한국어 의미",
  "parts": [{"word":"어소","reading":"히라가나","pronunciation":"한글발음","meaning":"한국어뜻","type":"품사","note":"문법포인트"}],
  "tip": "한 줄 사용 팁"
}`;

const SYSTEM_PHOTO = `당신은 한국인을 위한 일본어 선생님입니다. 이미지에서 일본어를 찾아 핵심 표현을 선택하고 반드시 아래 JSON만 반환하세요. 다른 텍스트 절대 금지.
{
  "found_text": "이미지의 원본 일본어 전체",
  "japanese": "분석할 핵심 일본어 표현",
  "pronunciation": "전체 한글 발음",
  "meaning": "한국어 의미",
  "parts": [{"word":"어소","reading":"히라가나","pronunciation":"한글발음","meaning":"한국어뜻","type":"품사","note":"문법포인트"}],
  "tip": "한 줄 사용 팁"
}
규칙: 이미지에 일본어가 없으면 found_text에 '일본어를 찾을 수 없습니다' 라고 쓰고 나머지는 빈 값.`;

const TYPE_STYLE = {
  명사:   { bg: "#E8F0FE", color: "#1a3d8f" },
  대명사: { bg: "#E8F0FE", color: "#1a3d8f" },
  조사:   { bg: "#E6F4EA", color: "#1e5e34" },
  동사:   { bg: "#FEF7E0", color: "#7a5200" },
  형용사: { bg: "#FCE8F3", color: "#6b1f5e" },
  부사:   { bg: "#FFF0E0", color: "#7a3800" },
  어미:   { bg: "#FDECEA", color: "#8b1a1a" },
  접속사: { bg: "#E8F5F9", color: "#0e4d6b" },
  감탄사: { bg: "#F0EEF8", color: "#4a3080" },
};

function badge(type) {
  const s = TYPE_STYLE[type] || { bg: "#F0F0EE", color: "#555" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
      background: s.bg, color: s.color, letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>{type}</span>
  );
}

export default function App() {
  const [mode, setMode] = useState(0);
  const [text, setText] = useState("");
  const [imgData, setImgData] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const camRef = useRef(null);

  function switchMode(i) {
    setMode(i); setResult(null); setError("");
    setText(""); setImgData(null); setImgPreview(null);
  }

  function handleImageFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setImgPreview(e.target.result);
      setImgData({ base64: e.target.result.split(",")[1], type: file.type || "image/jpeg" });
      setResult(null); setError("");
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (mode < 2 && !text.trim()) return;
    if (mode === 2 && !imgData) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

      let systemPrompt, userParts;
      if (mode === 0) {
        systemPrompt = SYSTEM_KO_JP;
        userParts = [{ text: text.trim() }];
      } else if (mode === 1) {
        systemPrompt = SYSTEM_JP_KO;
        userParts = [{ text: text.trim() }];
      } else {
        systemPrompt = SYSTEM_PHOTO;
        userParts = [
          { inline_data: { mime_type: imgData.type, data: imgData.base64 } },
          { text: "이 이미지의 일본어를 분석해주세요." },
        ];
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: userParts }],
          generationConfig: { maxOutputTokens: 1500 },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw = data.candidates[0].content.parts[0].text.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(raw));
    } catch (e) {
      setError(`오류: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function onKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  const modeLabels = ["한 → 일", "일 → 한", "사진 번역"];
  const placeholders = [
    "한국어를 입력하세요\n예) 여기서 면세 혜택을 받을 수 있나요?",
    "일본어를 입력하세요\n예) ここで免税を受けられますか？",
  ];
  const emptyIcons = ["🇰🇷", "🇯🇵", "📷"];
  const emptyTexts = [
    "한국어를 입력하면 일본어로 분석해드립니다",
    "일본어를 입력하면 한국어로 분석해드립니다",
    "사진을 올리면 일본어를 분석해드립니다",
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F7F7F5", fontFamily: "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif" }}>

      <div style={{ background: "#fff", borderBottom: "1px solid #EBEBEB", padding: "18px 20px 14px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 580, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#111", letterSpacing: "-0.02em" }}>日本語</span>
            <span style={{ fontSize: 12, color: "#BBB" }}>나만의 학습 노트</span>
          </div>
          <div style={{ display: "inline-flex", background: "#F0F0EE", borderRadius: 10, padding: 3, gap: 2 }}>
            {modeLabels.map((lbl, i) => (
              <button key={i} onClick={() => switchMode(i)} style={{
                padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: mode === i ? 600 : 400,
                color: mode === i ? "#111" : "#999",
                background: mode === i ? "#fff" : "transparent",
                boxShadow: mode === i ? "0 1px 4px rgba(0,0,0,0.10)" : "none",
                transition: "all 0.15s",
              }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: "0 auto", padding: "18px 16px 40px" }}>

        <div style={{ background: "#fff", border: "1px solid #E5E5E3", borderRadius: 14, overflow: "hidden", marginBottom: 14 }}>
          {mode < 2 ? (
            <>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={onKey}
                placeholder={placeholders[mode]}
                rows={3}
                style={{
                  width: "100%", padding: "16px", border: "none", outline: "none",
                  resize: "none", fontSize: 15, lineHeight: 1.65, color: "#111",
                  background: "transparent", fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderTop: "1px solid #F2F2F0" }}>
                <span style={{ fontSize: 11, color: "#D0D0D0" }}>Enter로 분석 · Shift+Enter 줄바꿈</span>
                <button onClick={submit} disabled={loading || !text.trim()} style={{
                  padding: "8px 22px", borderRadius: 8, border: "none", cursor: loading || !text.trim() ? "default" : "pointer",
                  fontSize: 13, fontWeight: 600,
                  background: loading || !text.trim() ? "#EBEBEB" : "#111",
                  color: loading || !text.trim() ? "#BBB" : "#fff",
                  transition: "all 0.15s",
                }}>
                  {loading ? "분석 중..." : "분석"}
                </button>
              </div>
            </>
          ) : (
            <div style={{ padding: 16 }}>
              {imgPreview ? (
                <>
                  <div style={{ position: "relative", marginBottom: 12 }}>
                    <img src={imgPreview} alt="업로드 이미지" style={{
                      width: "100%", maxHeight: 280, objectFit: "contain",
                      borderRadius: 10, background: "#F8F8F6", display: "block",
                    }} />
                    <button onClick={() => { setImgData(null); setImgPreview(null); setResult(null); }} style={{
                      position: "absolute", top: 8, right: 8, width: 28, height: 28,
                      borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none",
                      color: "#fff", fontSize: 12, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>✕</button>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => camRef.current?.click()} style={{
                      flex: 1, padding: 9, background: "#fff", color: "#555",
                      border: "1px solid #E0E0E0", borderRadius: 8, fontSize: 13, cursor: "pointer",
                    }}>다시 찍기</button>
                    <button onClick={submit} disabled={loading} style={{
                      flex: 2, padding: 9, borderRadius: 8, border: "none", cursor: loading ? "default" : "pointer",
                      fontSize: 13, fontWeight: 600,
                      background: loading ? "#EBEBEB" : "#111",
                      color: loading ? "#BBB" : "#fff",
                    }}>{loading ? "분석 중..." : "번역 & 분석"}</button>
                  </div>
                </>
              ) : (
                <div style={{ border: "1.5px dashed #D8D8D5", borderRadius: 12, padding: "36px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 8 }}>📷</div>
                  <p style={{ fontSize: 14, color: "#888", margin: "0 0 20px", lineHeight: 1.5 }}>
                    메뉴판, 간판, 안내문을<br />찍거나 갤러리에서 선택하세요
                  </p>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button onClick={() => camRef.current?.click()} style={{
                      padding: "10px 24px", background: "#111", color: "#fff",
                      border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}>카메라</button>
                    <button onClick={() => fileRef.current?.click()} style={{
                      padding: "10px 24px", background: "#fff", color: "#444",
                      border: "1px solid #D8D8D5", borderRadius: 8, fontSize: 13, cursor: "pointer",
                    }}>갤러리</button>
                  </div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={e => handleImageFile(e.target.files[0])} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                onChange={e => handleImageFile(e.target.files[0])} />
            </div>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "44px 0", color: "#BBB" }}>
            <style>{`@keyframes rot{to{transform:rotate(360deg)}}`}</style>
            <div style={{
              width: 22, height: 22, border: "2.5px solid #EEE", borderTopColor: "#555",
              borderRadius: "50%", animation: "rot 0.7s linear infinite", margin: "0 auto 12px",
            }} />
            <div style={{ fontSize: 13 }}>AI가 분석하고 있습니다</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ background: "#FFF2F2", border: "1px solid #FFCDD2", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#C0392B" }}>
            {error}
          </div>
        )}

        {result && !loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {result.found_text && (
              <div style={{
                background: "#FFFBEE", border: "1px solid #F0E0A0",
                borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#7a5f00",
                display: "flex", gap: 8, alignItems: "flex-start",
              }}>
                <span style={{ fontWeight: 700, whiteSpace: "nowrap" }}>발견:</span>
                <span style={{ lineHeight: 1.5 }}>{result.found_text}</span>
              </div>
            )}

            <div style={{ background: "#fff", border: "1px solid #E5E5E3", borderRadius: 14, overflow: "hidden" }}>

              <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #F2F2F0" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: "#111", letterSpacing: "0.03em", marginBottom: 8, lineHeight: 1.4 }}>
                  {result.japanese}
                </div>
                <div style={{ fontSize: 13, color: "#ABABAB", marginBottom: 6, fontStyle: "italic" }}>
                  [{result.pronunciation}]
                </div>
                <div style={{ fontSize: 15, color: "#444", lineHeight: 1.5 }}>
                  {result.meaning}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#C8C8C5", letterSpacing: "0.12em", padding: "12px 20px 6px", textTransform: "uppercase" }}>
                  문장 분해
                </div>
                {result.parts?.map((p, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "11px 20px",
                    borderTop: i === 0 ? "1px solid #F2F2F0" : "1px solid #F8F8F7",
                  }}>
                    <div style={{ minWidth: 62, textAlign: "center", paddingTop: 2 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#111", lineHeight: 1 }}>
                        {p.word}
                      </div>
                      <div style={{ fontSize: 10, color: "#C0C0BD", marginTop: 3 }}>{p.pronunciation}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: p.note ? 4 : 0, flexWrap: "wrap" }}>
                        {badge(p.type)}
                        <span style={{ fontSize: 14, color: "#222", fontWeight: 500 }}>{p.meaning}</span>
                      </div>
                      {p.reading && p.reading !== p.word && (
                        <div style={{ fontSize: 11, color: "#C0C0BD", marginBottom: p.note ? 3 : 0 }}>{p.reading}</div>
                      )}
                      {p.note && (
                        <div style={{ fontSize: 12, color: "#999", lineHeight: 1.5 }}>{p.note}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {result.tip && (
                <div style={{ margin: "0 16px 16px", padding: "10px 14px", background: "#F7F7F5", borderRadius: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#888", marginRight: 6 }}>TIP</span>
                  <span style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>{result.tip}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {!result && !loading && !error && (
          <div style={{ textAlign: "center", padding: "52px 0", color: "#D0D0CE" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>{emptyIcons[mode]}</div>
            <div style={{ fontSize: 13 }}>{emptyTexts[mode]}</div>
          </div>
        )}
      </div>
    </div>
  );
}

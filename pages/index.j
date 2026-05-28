import { useState, useRef } from "react";
import Head from "next/head";

const ACCENT = "#E8C547";
const BG = "#0D0D0D";
const CARD = "#141414";
const CARD2 = "#1C1C1C";
const TEXT = "#F0EDE6";
const MUTED = "#7A7570";

const SUGGESTIONS = ["Atenas", "Tokio", "Lisboa", "Nueva York", "Marrakech", "Dubrovnik"];

async function callClaude(messages) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, max_tokens: 1000 }),
  });
  const data = await res.json();
  return data.content?.find((b) => b.type === "text")?.text || "";
}

async function generateItinerary(city) {
  return callClaude([{
    role: "user",
    content: `Create a 3-day travel itinerary for ${city}. Format it EXACTLY like this:

DAY 1:
- Place Name: Brief one-sentence description of what to do/see there.
- Place Name: Brief one-sentence description.
- Place Name: Brief one-sentence description.
- Place Name: Brief one-sentence description.

DAY 2:
- Place Name: Brief one-sentence description.
- Place Name: Brief one-sentence description.
- Place Name: Brief one-sentence description.

DAY 3:
- Place Name: Brief one-sentence description.
- Place Name: Brief one-sentence description.
- Place Name: Brief one-sentence description.

Include 3-5 places per day. Mix monuments, neighborhoods, restaurants, and hidden gems. Keep descriptions under 15 words each. Use the original local place names.`,
  }]);
}

async function generateHistory(placeName, city) {
  return callClaude([{
    role: "user",
    content: `Write a short, fascinating 3-4 sentence historical/cultural summary about "${placeName}" in ${city}. Make it engaging and educational — things a curious traveler would love to know before visiting. Be concise but vivid. No bullet points, just flowing prose.`,
  }]);
}

function parseItinerary(text) {
  const days = [];
  const dayBlocks = text.split(/DAY\s*\d+[:\-]?/i).filter(Boolean);
  dayBlocks.forEach((block, i) => {
    const places = [];
    block.split("\n").filter((l) => l.trim()).forEach((line) => {
      const clean = line.replace(/^[-*•\d.]+\s*/, "").trim();
      if (!clean || clean.length < 3) return;
      const match = clean.match(/^([^:(]+)[:(]\s*(.+)/);
      if (match) {
        places.push({ name: match[1].trim(), description: match[2].trim(), type: guessType(match[1]) });
      } else if (clean.length > 5 && clean.length < 60) {
        places.push({ name: clean, description: "", type: "Lugar de interés" });
      }
    });
    if (places.length > 0) days.push({ day: i + 1, places });
  });
  return days.length > 0 ? days : null;
}

function guessType(name) {
  const n = name.toLowerCase();
  if (n.includes("museo") || n.includes("museum") || n.includes("galería")) return "Museo";
  if (n.includes("iglesia") || n.includes("catedral") || n.includes("templo") || n.includes("mezquita")) return "Templo / Iglesia";
  if (n.includes("plaza") || n.includes("parque") || n.includes("jardín")) return "Plaza / Parque";
  if (n.includes("restaurante") || n.includes("café") || n.includes("mercado")) return "Gastronomía";
  if (n.includes("castillo") || n.includes("palacio") || n.includes("fortaleza")) return "Monumento histórico";
  return "Punto de interés";
}

function PlaceCard({ place, index, city }) {
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const toggle = async () => {
    if (!expanded && !history) {
      setExpanded(true);
      setLoadingHistory(true);
      const h = await generateHistory(place.name, city);
      setHistory(h);
      setLoadingHistory(false);
    } else {
      setExpanded(!expanded);
    }
  };

  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(place.name + " " + city)}`;

  return (
    <div style={{
      background: CARD, borderRadius: 16, overflow: "hidden",
      border: `1px solid ${expanded ? "#2E2E2E" : "#1E1E1E"}`,
      animation: `fadeIn 0.4s ease forwards`, animationDelay: `${index * 0.06}s`, opacity: 0,
    }}>
      <div style={{ padding: "16px 16px 14px", cursor: "pointer", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
          background: index < 2 ? `${ACCENT}22` : "#1E1E1E",
          color: index < 2 ? ACCENT : MUTED,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 500,
        }}>{index + 1}</div>

        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: TEXT, lineHeight: 1.2, marginBottom: 4 }}>
            {place.name}
          </div>
          <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "1.2px" }}>{place.type}</div>
          {place.description && <div style={{ fontSize: 13, color: "#9A9590", lineHeight: 1.5, marginTop: 4 }}>{place.description}</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <a href={mapsUrl} target="_blank" rel="noreferrer" style={{
            background: "#1E1E1E", border: "none", borderRadius: 8, padding: "6px 10px",
            display: "flex", alignItems: "center", gap: 5, textDecoration: "none",
            fontSize: 11, color: MUTED, fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap",
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            Maps
          </a>
          <button onClick={toggle} style={{
            background: "none", border: "none", cursor: "pointer", padding: 2,
            color: expanded ? ACCENT : MUTED,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.2s, color 0.15s",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #1E1E1E", background: CARD2, padding: 16 }}>
          <div style={{ fontSize: 10, color: ACCENT, textTransform: "uppercase", letterSpacing: 2, fontWeight: 500, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            ✦ Historia & Curiosidades
          </div>
          {loadingHistory ? (
            <div style={{ fontSize: 13, color: MUTED }}>Buscando historia...</div>
          ) : (
            <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "#B0ABA5" }}>{history}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState(null);
  const [days, setDays] = useState([]);
  const [activeDay, setActiveDay] = useState(0);
  const inputRef = useRef();

  const handleSearch = async (q) => {
    const target = q || query;
    if (!target.trim()) return;
    setLoading(true);
    setCity(null);
    setDays([]);
    try {
      const text = await generateItinerary(target.trim());
      const parsed = parseItinerary(text);
      setCity(target.trim());
      setDays(parsed || [{ day: 1, places: [{ name: "Error generando itinerario", description: "Inténtalo de nuevo.", type: "" }] }]);
      setActiveDay(0);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const reset = () => { setCity(null); setDays([]); setQuery(""); setTimeout(() => inputRef.current?.focus(), 100); };
  const currentPlaces = days[activeDay]?.places || [];

  return (
    <>
      <Head>
        <title>Three Days In</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="theme-color" content="#0D0D0D" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />
      </Head>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: ${BG}; color: ${TEXT}; font-family: 'DM Sans', sans-serif; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        input::placeholder { color: ${MUTED}; }
        input:focus { outline: none; border-color: ${ACCENT} !important; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: BG }}>
        {/* Header */}
        <div style={{ padding: "52px 24px 20px" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4 }}>
            Three <span style={{ color: ACCENT }}>Days</span> In
          </div>
          <div style={{ fontSize: 11, color: MUTED, letterSpacing: 2, textTransform: "uppercase", marginBottom: 24 }}>
            Itinerarios con alma
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", margin: "0 24px 32px" }}>
          <input
            ref={inputRef}
            style={{ width: "100%", background: CARD, border: `1px solid #2A2A2A`, borderRadius: 14, padding: "16px 56px 16px 20px", color: TEXT, fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 300, WebkitAppearance: "none" }}
            placeholder="Ciudad o país..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button onClick={() => handleSearch()} disabled={loading || !query.trim()} style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            background: ACCENT, border: "none", borderRadius: 10, width: 40, height: 40,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            opacity: loading || !query.trim() ? 0.4 : 1,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontStyle: "italic", marginBottom: 8 }}>{query}</div>
            <div style={{ fontSize: 13, color: MUTED }}>Preparando tu itinerario</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
              {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:ACCENT, animation:"fadeIn 1.2s ease infinite", animationDelay:`${i*0.2}s` }}/>)}
            </div>
          </div>
        )}

        {/* Welcome */}
        {!loading && !city && (
          <div style={{ padding: "0 24px 60px", textAlign: "center", animation: "fadeIn 0.4s ease" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontStyle: "italic", marginBottom: 8 }}>¿A dónde vas?</div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>
              Escribe una ciudad o país y generaremos un itinerario de 3 días con historia incluida.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 24 }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setQuery(s); handleSearch(s); }} style={{
                  background: CARD, border: "1px solid #222", borderRadius: 20, padding: "7px 14px",
                  fontSize: 13, color: MUTED, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {!loading && city && days.length > 0 && (
          <>
            <div style={{ padding: "0 24px 24px", animation: "fadeIn 0.4s ease" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 700, letterSpacing: -1, lineHeight: 1.1 }}>{city}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: MUTED, letterSpacing: "1.5px", textTransform: "uppercase" }}>3 días</span>
                <div style={{ width:3, height:3, background:MUTED, borderRadius:"50%" }}/>
                <span style={{ fontSize: 11, color: ACCENT, letterSpacing: 1, textTransform: "uppercase", fontWeight: 500 }}>Itinerario IA</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, padding: "0 24px 24px", overflowX: "auto" }}>
              {days.map((d, i) => (
                <button key={i} onClick={() => setActiveDay(i)} style={{
                  flexShrink: 0, padding: "8px 18px", borderRadius: 20, cursor: "pointer",
                  border: `1px solid ${activeDay === i ? ACCENT : "#2A2A2A"}`,
                  background: activeDay === i ? ACCENT : "transparent",
                  color: activeDay === i ? "#000" : MUTED,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                  fontWeight: activeDay === i ? 500 : 400,
                }}>Día {d.day}</button>
              ))}
            </div>

            <div style={{ padding: "0 24px 80px", display: "flex", flexDirection: "column", gap: 12 }}>
              {currentPlaces.map((place, i) => (
                <PlaceCard key={`${activeDay}-${i}`} place={place} index={i} city={city} />
              ))}
            </div>

            <button onClick={reset} style={{
              display: "block", margin: "0 24px 32px",
              background: "none", border: "1px solid #2A2A2A", borderRadius: 10,
              padding: "10px 20px", color: MUTED, fontFamily: "'DM Sans', sans-serif",
              fontSize: 13, cursor: "pointer", width: "calc(100% - 48px)",
            }}>← Cambiar destino</button>
          </>
        )}
      </div>
    </>
  );
}

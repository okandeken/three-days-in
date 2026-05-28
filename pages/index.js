import { useState, useRef, useEffect } from "react";
import Head from "next/head";

const ACCENT = "#E8C547";
const BG = "#0D0D0D";
const CARD = "#141414";
const CARD2 = "#1C1C1C";
const TEXT = "#F0EDE6";
const MUTED = "#7A7570";

const T = {
  es: {
    tagline: "Itinerarios con alma",
    placeholder: "Ciudad o país...",
    loadingText: "Preparando tu itinerario",
    welcomeTitle: "¿A dónde vas?",
    welcomeSub: "Escribe una ciudad o país y generaremos un itinerario de 3 días con historia incluida.",
    changeDestination: "← Cambiar destino",
    historyLabel: "Historia & Curiosidades",
    historyLoading: "Buscando historia...",
    days: "días",
    day: "Día",
    aiTag: "Itinerario IA",
    suggestions: ["Atenas", "Tokio", "Lisboa", "Nueva York", "Marrakech", "Dubrovnik"],
    type: {
      museum: "Museo", temple: "Templo / Iglesia", square: "Plaza / Parque",
      food: "Gastronomía", monument: "Monumento histórico", default: "Punto de interés",
    },
  },
  en: {
    tagline: "Itineraries with soul",
    placeholder: "City or country...",
    loadingText: "Preparing your itinerary",
    welcomeTitle: "Where are you going?",
    welcomeSub: "Type a city or country and we'll generate a 3-day itinerary with history included.",
    changeDestination: "← Change destination",
    historyLabel: "History & Curiosities",
    historyLoading: "Loading history...",
    days: "days",
    day: "Day",
    aiTag: "AI Itinerary",
    suggestions: ["Athens", "Tokyo", "Lisbon", "New York", "Marrakech", "Dubrovnik"],
    type: {
      museum: "Museum", temple: "Temple / Church", square: "Square / Park",
      food: "Food & Drink", monument: "Historic monument", default: "Point of interest",
    },
  },
  gl: {
    tagline: "Itinerarios con alma",
    placeholder: "Cidade ou país...",
    loadingText: "Preparando o teu itinerario",
    welcomeTitle: "A onde vas?",
    welcomeSub: "Escribe unha cidade ou país e crearemos un itinerario de 3 días con historia incluída.",
    changeDestination: "← Cambiar destino",
    historyLabel: "Historia & Curiosidades",
    historyLoading: "Buscando historia...",
    days: "días",
    day: "Día",
    aiTag: "Itinerario IA",
    suggestions: ["Atenas", "Tokio", "Lisboa", "Nova York", "Marrakech", "Dubrovnik"],
    type: {
      museum: "Museo", temple: "Templo / Igrexa", square: "Praza / Parque",
      food: "Gastronomía", monument: "Monumento histórico", default: "Punto de interese",
    },
  },
};

function guessType(name, lang) {
  const n = name.toLowerCase();
  const t = T[lang].type;
  if (n.includes("museo") || n.includes("museum") || n.includes("galería") || n.includes("gallery")) return t.museum;
  if (n.includes("iglesia") || n.includes("catedral") || n.includes("templo") || n.includes("church") || n.includes("cathedral") || n.includes("igrexa")) return t.temple;
  if (n.includes("plaza") || n.includes("parque") || n.includes("jardín") || n.includes("park") || n.includes("square") || n.includes("praza")) return t.square;
  if (n.includes("restaurante") || n.includes("café") || n.includes("mercado") || n.includes("market") || n.includes("restaurant")) return t.food;
  if (n.includes("castillo") || n.includes("palacio") || n.includes("fortaleza") || n.includes("castle") || n.includes("palace")) return t.monument;
  return t.default;
}

const META_WORDS = ["itinerario", "itinerary", "días", "days", "día", "day", "visita", "aquí", "here", "presenta", "siguiente", "following", "bienvenido", "welcome"];

function isMetaPlace(name) {
  const n = name.toLowerCase();
  return META_WORDS.some(w => n.includes(w)) || name.length > 55 || name.split(" ").length > 6;
}

function parseItinerary(text, lang) {
  const days = [];
  // Split on DAY followed by a number
  const dayBlocks = text.split(/\*{0,2}DAY\s*\d+\*{0,2}[:\-]?/i).filter(Boolean);
  dayBlocks.forEach((block, i) => {
    const places = [];
    block.split("\n").filter((l) => l.trim()).forEach((line) => {
      const clean = line.replace(/^[-*•\d.]+\s*/, "").trim();
      if (!clean || clean.length < 3) return;
      const match = clean.match(/^([^:(]+)[:(]\s*(.+)/);
      if (match) {
        const name = match[1].trim();
        if (!isMetaPlace(name)) {
          places.push({ name, description: match[2].trim(), type: guessType(name, lang) });
        }
      } else if (clean.length > 4 && clean.length < 55 && !isMetaPlace(clean)) {
        places.push({ name: clean, description: "", type: T[lang].type.default });
      }
    });
    // Only include blocks that have at least 2 real places (skip preamble blocks)
    if (places.length >= 2) days.push({ day: days.length + 1, places });
  });
  return days.length > 0 ? days : null;
}

async function callAPI(body) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.text || "";
}

const CATEGORY_CONFIG = {
  historia:     { label: { es: "Historia",           en: "History",          gl: "Historia"           }, color: "#9B59B6", bg: "#9B59B620" },
  secretos:     { label: { es: "Secretos",           en: "Secrets",          gl: "Segredos"           }, color: "#FF6830", bg: "#FF683020" },
  curiosidades: { label: { es: "Curiosidades",       en: "Curiosities",      gl: "Curiosidades"       }, color: "#E8C547", bg: "#E8C54720" },
  consejos:     { label: { es: "Consejos prácticos", en: "Practical tips",   gl: "Consellos prácticos"}, color: "#4CAF50", bg: "#4CAF5020" },
  arte:         { label: { es: "Arte & Cultura",     en: "Art & Culture",    gl: "Arte & Cultura"     }, color: "#4A90E2", bg: "#4A90E220" },
  contexto:     { label: { es: "Contexto local",     en: "Local context",    gl: "Contexto local"     }, color: "#E74C3C", bg: "#E74C3C20" },
};

const SOURCES_CONFIG = [
  { key: "wikipedia",    label: "Wikipedia",    icon: "📖", color: "#E8C547", bg: "#E8C54715", tags: { es: "Historia",          en: "History",         gl: "Historia"          } },
  { key: "wikivoyage",   label: "Wikivoyage",   icon: "🗺",  color: "#4CAF50", bg: "#4CAF5015", tags: { es: "Qué ver",           en: "What to see",     gl: "Que ver"           } },
  { key: "atlas_obscura",label: "Atlas Obscura",icon: "🔮", color: "#FF6830", bg: "#FF683015", tags: { es: "Secretos",          en: "Secrets",         gl: "Segredos"          } },
  { key: "reddit",       label: "Reddit",       icon: "👾", color: "#FF4500", bg: "#FF450015", tags: { es: "Viajeros reales",   en: "Real travelers",  gl: "Viaxeiros reais"   } },
  { key: "bbc",          label: "BBC History",  icon: "📰", color: "#BB1919", bg: "#BB191915", tags: { es: "Contexto histórico",en: "Historical context",gl:"Contexto histórico"} },
  { key: "smarthistory", label: "Smarthistory", icon: "🎨", color: "#9B59B6", bg: "#9B59B615", tags: { es: "Arte & Cultura",    en: "Art & Culture",   gl: "Arte & Cultura"    } },
];

function BriefSection({ brief, lang }) {
  if (!brief || brief.length === 0) return null;
  return (
    <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #1E1E1E" }}>
      <div style={{ fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: 2, marginBottom: 10, fontWeight: 600 }}>✦ Resumen</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {brief.map((item, i) => {
          const cfg = CATEGORY_CONFIG[item.category];
          if (!cfg || !item.text) return null;
          return (
            <div key={i} style={{ background: cfg.bg, borderLeft: `2px solid ${cfg.color}`, borderRadius: "0 8px 8px 0", padding: "8px 10px" }}>
              <div style={{ fontSize: 8, color: cfg.color, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 4 }}>
                {cfg.label[lang] || cfg.label.es}
              </div>
              <div style={{ fontSize: 12, color: "#B0ABA5", lineHeight: 1.6 }}>{item.text}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SourceBlock({ config, data, lang, open, onToggle }) {
  if (!data) return null;
  const tag = config.tags[lang] || config.tags.es;
  const hasContent = config.key === "reddit" ? data.posts?.length > 0 : !!data.text;
  if (!hasContent) return null;

  return (
    <div style={{ borderBottom: "1px solid #161616" }}>
      <div onClick={onToggle} style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: config.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{config.icon}</div>
          <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "1px", fontWeight: 600, color: config.color }}>{config.label}</span>
          <span style={{ fontSize: 8, color: "#3A3A3A", border: "1px solid #222", padding: "2px 6px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.8px" }}>{tag}</span>
        </div>
        <span style={{ color: open ? config.color : "#444", fontSize: 10, transition: "transform 0.2s", display: "inline-block", transform: open ? "rotate(180deg)" : "none" }}>▼</span>
      </div>
      {open && (
        <div style={{ padding: "0 16px 12px" }}>
          {config.key === "reddit" && data.posts ? (
            data.posts.map((post, i) => (
              <div key={i} style={{ background: "#111", borderLeft: `2px solid ${config.color}`, padding: "8px 10px", borderRadius: "0 6px 6px 0", marginBottom: i < data.posts.length - 1 ? 6 : 0 }}>
                <div style={{ fontSize: 11, color: "#8A8580", lineHeight: 1.6, fontStyle: "italic" }}>"{post.text.slice(0, 220)}{post.text.length > 220 ? "…" : ""}"</div>
                <div style={{ fontSize: 9, color: "#444", marginTop: 4 }}>u/{post.author} · r/{post.subreddit} · {post.score} pts</div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 11.5, color: "#8A8580", lineHeight: 1.65 }}>{data.text}</div>
          )}
        </div>
      )}
    </div>
  );
}

function PlaceCard({ place, index, city, lang }) {
  const [expanded, setExpanded] = useState(false);
  const [sources, setSources] = useState(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const [openSource, setOpenSource] = useState(null);

  const toggle = async () => {
    if (!expanded && !sources) {
      setExpanded(true);
      setLoadingSources(true);
      try {
        const res = await fetch("/api/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ place: place.name, city, lang }),
        });
        const data = await res.json();
        setSources(data);
      } catch (_) {}
      setLoadingSources(false);
    } else {
      setExpanded(!expanded);
    }
  };

  const toggleSource = (key) => setOpenSource(prev => prev === key ? null : key);
  const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(place.name + " " + city)}`;
  const hasAnySources = sources && SOURCES_CONFIG.some(c => sources[c.key]);

  return (
    <div style={{
      background: CARD, borderRadius: 16, overflow: "hidden",
      border: `1px solid ${expanded ? "#2E2E2E" : "#1E1E1E"}`,
      animation: "fadeIn 0.4s ease forwards",
      animationDelay: `${index * 0.06}s`, opacity: 0,
    }}>
      <div style={{ padding: "16px 16px 14px", display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, flexShrink: 0, marginTop: 2,
          background: index < 2 ? `${ACCENT}22` : "#1E1E1E",
          color: index < 2 ? ACCENT : MUTED,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 500,
        }}>{index + 1}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700, color: TEXT, lineHeight: 1.2, marginBottom: 4 }}>{place.name}</div>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 9l-7 7-7-7"/></svg>
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid #1E1E1E", background: CARD2 }}>
          {loadingSources ? (
            <div style={{ padding: 16, fontSize: 13, color: MUTED }}>Consultando fuentes...</div>
          ) : !hasAnySources ? (
            <div style={{ padding: 16, fontSize: 13, color: MUTED }}>No hay información disponible para este lugar.</div>
          ) : (
            <>
              <BriefSection brief={sources.brief} lang={lang} />
              <div style={{ padding: "10px 16px 6px" }}>
                <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: 2, fontWeight: 600 }}>Fuentes</div>
              </div>
              {SOURCES_CONFIG.map(config => (
                <SourceBlock
                  key={config.key}
                  config={config}
                  data={sources[config.key]}
                  lang={lang}
                  open={openSource === config.key}
                  onToggle={() => toggleSource(config.key)}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [lang, setLang] = useState("en");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [city, setCity] = useState(null);
  const [days, setDays] = useState([]);
  const [activeDay, setActiveDay] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null);
  const [fromCache, setFromCache] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef();
  const debounceRef = useRef(null);
  const tr = T[lang];

  const [dynamicSuggestions, setDynamicSuggestions] = useState([]);

  // Load saved language on mount, default to "en"
  useEffect(() => {
    const saved = typeof window !== "undefined" && localStorage.getItem("tdi_lang");
    if (saved && ["es", "en", "gl"].includes(saved)) setLang(saved);
  }, []);

  // Fetch top searched cities
  useEffect(() => {
    fetch("/api/searches")
      .then(r => r.json())
      .then(d => { if (d.suggestions?.length) setDynamicSuggestions(d.suggestions); })
      .catch(() => {});
  }, []);

  // Save language whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("tdi_lang", lang);
  }, [lang]);

  const fetchSuggestions = (value) => {
    clearTimeout(debounceRef.current);
    if (!value || value.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(value)}&lang=${lang}`);
        const data = await res.json();
        setSuggestions(data.predictions || []);
        setShowSuggestions((data.predictions || []).length > 0);
      } catch (_) {}
    }, 300);
  };

  const selectSuggestion = (s) => {
    setQuery(s.name);
    setSuggestions([]);
    setShowSuggestions(false);
    handleSearch(s.name);
  };

  const handleSearch = async (q) => {
    const target = q || query;
    if (!target.trim()) return;
    setLoading(true);
    setCity(null);
    setDays([]);
    setErrorMsg(null);
    setFromCache(null);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "itinerary", city: target.trim(), lang }),
      });
      const data = await res.json();
      if (data.error) {
        setErrorMsg(`Error de API: ${data.error}`);
        setLoading(false);
        return;
      }
      const text = data.text || "";
      if (!text) {
        setErrorMsg(`La API no devolvió texto. Estado HTTP: ${res.status}`);
        setLoading(false);
        return;
      }
      const parsed = parseItinerary(text, lang);
      if (!parsed) {
        setErrorMsg(`No se pudo parsear la respuesta. Texto recibido: ${text.slice(0, 200)}`);
        setLoading(false);
        return;
      }
      setCity(target.trim());
      setDays(parsed);
      setFromCache(data.fromCache === true);
      setActiveDay(0);
    } catch (e) {
      setErrorMsg(`Error de red: ${e.message}`);
    }
    setLoading(false);
  };

  const reset = () => {
    setCity(null);
    setDays([]);
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

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
        input { -webkit-appearance: none; }
        input::placeholder { color: ${MUTED}; }
        input:focus { outline: none; border-color: ${ACCENT} !important; }
        ::-webkit-scrollbar { display: none; }
        a { transition: opacity 0.15s; }
        a:hover { opacity: 0.8; }
      `}</style>

      <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: BG }}>

        {/* Header */}
        <div style={{ padding: "52px 24px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <button onClick={() => { setCity(null); setDays([]); setQuery(""); setErrorMsg(null); setFromCache(null); }} style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, letterSpacing: -0.5, marginBottom: 4, cursor: "pointer", background: "none", border: "none", padding: 0, color: TEXT, WebkitTapHighlightColor: "transparent", textAlign: "left" }}>
              Three <span style={{ color: ACCENT }}>Days</span> In
            </button>
            <div style={{ fontSize: 11, color: MUTED, letterSpacing: 2, textTransform: "uppercase" }}>
              {tr.tagline}
            </div>
          </div>

          {/* Language selector */}
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            {["es", "en", "gl"].map((l) => (
              <button key={l} onClick={() => setLang(l)} style={{
                padding: "5px 9px", borderRadius: 8, border: "none", cursor: "pointer",
                background: lang === l ? ACCENT : "#1E1E1E",
                color: lang === l ? "#000" : MUTED,
                fontSize: 11, fontWeight: lang === l ? 600 : 400,
                fontFamily: "'DM Sans', sans-serif",
                textTransform: "uppercase", letterSpacing: 0.5,
                transition: "all 0.15s",
              }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", margin: "0 24px 32px" }}>
          <input
            ref={inputRef}
            style={{
              width: "100%", background: CARD, border: `1px solid #2A2A2A`,
              borderRadius: 14, padding: "16px 56px 16px 20px",
              color: TEXT, fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 300,
            }}
            placeholder={tr.placeholder}
            value={query}
            onChange={(e) => { setQuery(e.target.value); fetchSuggestions(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") { setShowSuggestions(false); handleSearch(); } }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          <button onClick={() => { setShowSuggestions(false); handleSearch(); }} disabled={loading || !query.trim()} style={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            background: ACCENT, border: "none", borderRadius: 10, width: 40, height: 40,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            opacity: loading || !query.trim() ? 0.4 : 1, transition: "opacity 0.15s",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12,
              overflow: "hidden", zIndex: 100, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}>
              {suggestions.map((s) => (
                <div key={s.id} onMouseDown={() => selectSuggestion(s)} style={{
                  padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid #222",
                  display: "flex", flexDirection: "column", gap: 2,
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#242424"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <span style={{ fontSize: 14, color: TEXT, fontWeight: 500 }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: MUTED }}>{s.full}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontStyle: "italic", marginBottom: 8 }}>{query}</div>
            <div style={{ fontSize: 13, color: MUTED }}>{tr.loadingText}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 20 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: "50%", background: ACCENT,
                  animation: "fadeIn 1.2s ease infinite", animationDelay: `${i * 0.2}s`,
                }} />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && errorMsg && (
          <div style={{ margin: "0 24px 24px", padding: 16, background: "#1a0a0a", border: "1px solid #5a1a1a", borderRadius: 12, fontSize: 13, color: "#ff8080", lineHeight: 1.6 }}>
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Welcome */}
        {!loading && !city && (
          <div style={{ padding: "0 24px 60px", textAlign: "center", animation: "fadeIn 0.4s ease" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✦</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontStyle: "italic", marginBottom: 8 }}>{tr.welcomeTitle}</div>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: 280, margin: "0 auto" }}>{tr.welcomeSub}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 24 }}>
              {(dynamicSuggestions.length > 0 ? dynamicSuggestions : tr.suggestions).map((s) => (
                <button key={s} onClick={() => { setQuery(s); handleSearch(s); }} style={{
                  background: CARD, border: "1px solid #222", borderRadius: 20,
                  padding: "7px 14px", fontSize: 13, color: MUTED, cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
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
                <span style={{ fontSize: 12, color: MUTED, letterSpacing: "1.5px", textTransform: "uppercase" }}>3 {tr.days}</span>
                <div style={{ width: 3, height: 3, background: MUTED, borderRadius: "50%" }} />
                <span style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", fontWeight: 500,
                  color: fromCache ? "#4CAF50" : ACCENT }}>
                  {fromCache ? "⚡ Caché — sin tokens" : "✦ Generado con IA"}
                </span>
              </div>
            </div>

            {/* Day tabs */}
            <div style={{ display: "flex", gap: 8, padding: "0 24px 24px", overflowX: "auto" }}>
              {days.map((d, i) => (
                <button key={i} onClick={() => setActiveDay(i)} style={{
                  flexShrink: 0, padding: "8px 18px", borderRadius: 20, cursor: "pointer",
                  border: `1px solid ${activeDay === i ? ACCENT : "#2A2A2A"}`,
                  background: activeDay === i ? ACCENT : "transparent",
                  color: activeDay === i ? "#000" : MUTED,
                  fontFamily: "'DM Sans', sans-serif", fontSize: 13,
                  fontWeight: activeDay === i ? 500 : 400, transition: "all 0.15s",
                }}>{tr.day} {d.day}</button>
              ))}
            </div>

            {/* Itinerario button */}
            {(() => {
              const places = days[activeDay]?.places || [];
              if (places.length === 0) return null;
              // Google Maps route with all stops
              const gmUrl = `https://www.google.com/maps/dir/${places.map(p => encodeURIComponent(p.name + " " + city)).join("/")}`;
              // OpenStreetMap search for the city (free, no API key)
              const osmUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(city)}`;
              return (
                <div style={{ padding: "0 24px 12px", display: "flex", gap: 8 }}>
                  <a href={gmUrl} target="_blank" rel="noreferrer" style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12,
                    padding: "10px 12px", textDecoration: "none", color: "#9A9590",
                    fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2.5">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                    </svg>
                    Google Maps
                  </a>
                  <a href={osmUrl} target="_blank" rel="noreferrer" style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 12,
                    padding: "10px 12px", textDecoration: "none", color: "#9A9590",
                    fontSize: 12, fontFamily: "'DM Sans', sans-serif",
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    OpenStreetMap
                  </a>
                </div>
              );
            })()}

            {/* Places */}
            <div style={{ padding: "0 24px 80px", display: "flex", flexDirection: "column", gap: 12 }}>
              {currentPlaces.map((place, i) => (
                <PlaceCard key={`${lang}-${activeDay}-${i}`} place={place} index={i} city={city} lang={lang} />
              ))}
            </div>

            <button onClick={reset} style={{
              display: "block", margin: "0 24px 32px", background: "none",
              border: "1px solid #2A2A2A", borderRadius: 10, padding: "10px 20px",
              color: MUTED, fontFamily: "'DM Sans', sans-serif", fontSize: 13,
              cursor: "pointer", width: "calc(100% - 48px)", transition: "all 0.15s",
            }}>{tr.changeDestination}</button>
          </>
        )}
      </div>
    </>
  );
}

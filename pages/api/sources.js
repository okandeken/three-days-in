import { Redis } from "@upstash/redis";

let redis = null;
try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} catch (_) {}

async function getCached(key) {
  if (!redis) return null;
  try { const v = await redis.get(key); return v; } catch (_) { return null; }
}
async function setCache(key, value) {
  if (!redis) return;
  try { await redis.set(key, JSON.stringify(value)); } catch (_) {}
}

// Normalize text for comparison (remove accents, lowercase)
function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Check if a title/text is actually about the queried place
function isRelevant(returnedTitle, queriedName) {
  const t = normalize(returnedTitle);
  const q = normalize(queriedName);
  if (t.includes(q) || q.includes(t)) return true;
  // Check if any significant word (>3 chars) from query appears in title
  const words = q.split(/\s+/).filter(w => w.length > 3);
  return words.length > 0 && words.some(w => t.includes(w));
}

// Check if content text actually mentions the place
function contentMentionsPlace(text, place, city) {
  if (!text) return false;
  const t = normalize(text);
  return normalize(place).split(/\s+/).filter(w => w.length > 3).some(w => t.includes(w))
    || normalize(city).split(/\s+/).filter(w => w.length > 3).some(w => t.includes(w));
}

const WIKI_LANG  = { es: "es", en: "en", gl: "gl" };
const VOYAGE_LANG = { es: "es", en: "en", gl: "es" };

async function fetchWikipedia(place, city, lang) {
  const wl = WIKI_LANG[lang] || "es";
  try {
    const s = await fetch(`https://${wl}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(place + " " + city)}&format=json&srlimit=3&origin=*`);
    const sd = await s.json();
    // Pick first result whose title is relevant
    const match = (sd.query?.search || []).find(r => isRelevant(r.title, place) || isRelevant(r.title, city));
    if (!match) return null;
    const r = await fetch(`https://${wl}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(match.title)}`);
    const d = await r.json();
    if (!d.extract || !contentMentionsPlace(d.extract, place, city)) return null;
    return { text: d.extract.slice(0, 500), title: d.title };
  } catch (_) { return null; }
}

async function fetchWikivoyage(place, city, lang) {
  const vl = VOYAGE_LANG[lang] || "es";
  try {
    const s = await fetch(`https://${vl}.wikivoyage.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(city)}&format=json&srlimit=3&origin=*`);
    const sd = await s.json();
    // Title must match the city, not just any nearby place
    const match = (sd.query?.search || []).find(r => isRelevant(r.title, city));
    if (!match) return null;
    const r = await fetch(`https://${vl}.wikivoyage.org/w/api.php?action=query&titles=${encodeURIComponent(match.title)}&prop=extracts&exintro=true&exchars=600&format=json&origin=*`);
    const d = await r.json();
    const pages = d.query?.pages;
    const page = pages?.[Object.keys(pages)[0]];
    const raw = page?.extract?.replace(/<[^>]*>/g, "").trim();
    if (!raw || !contentMentionsPlace(raw, city, city)) return null;
    // Remove trivial sentences (province info, coordinates, etc.)
    const sentences = raw.split(/\.\s+/).filter(s => {
      const sl = s.toLowerCase();
      return s.length > 40 &&
        !sl.includes("provincia de") && !sl.includes("province of") &&
        !sl.includes("coordenadas") && !sl.includes("coordinates") &&
        !sl.includes("municipio de") && !sl.includes("municipality of") &&
        !sl.includes("km²") && !sl.includes("habitantes");
    });
    if (sentences.length === 0) return null;
    return { text: sentences.slice(0, 4).join(". ") + ".", title: match.title };
  } catch (_) { return null; }
}

async function fetchReddit(place, city) {
  try {
    const q = encodeURIComponent(`${place} ${city}`);
    const r = await fetch(`https://www.reddit.com/search.json?q=${q}&sort=top&t=year&limit=10&type=link`, {
      headers: { "User-Agent": "ThreeDaysIn/1.0" },
    });
    const d = await r.json();
    const posts = (d.data?.children || [])
      .filter(p => {
        const text = p.data.selftext || "";
        return text.length > 80 &&
          p.data.score > 5 &&
          contentMentionsPlace(text, place, city);
      })
      .slice(0, 2)
      .map(p => ({
        text: p.data.selftext.slice(0, 250),
        author: p.data.author,
        score: p.data.score,
        subreddit: p.data.subreddit,
      }));
    return posts.length > 0 ? { posts } : null;
  } catch (_) { return null; }
}

async function fetchWithClaude(place, city, source, lang) {
  const prompts = {
    atlas_obscura: {
      es: `Escribe 2-3 frases sobre "${place}" en ${city} al estilo Atlas Obscura: curiosidades ocultas, historias extrañas, secretos que los turistas no conocen. Si no tienes información específica y verificada sobre este lugar exacto, responde solo con: NULL. Solo el texto o NULL.`,
      en: `Write 2-3 sentences about "${place}" in ${city} in Atlas Obscura style: hidden curiosities, strange stories, secrets. If you don't have specific verified information about this exact place, respond only with: NULL. Just the text or NULL.`,
      gl: `Escribe 2-3 frases sobre "${place}" en ${city} ao estilo Atlas Obscura. Se non tes información específica verificada, responde só con: NULL.`,
    },
    bbc: {
      es: `Escribe 2-3 frases sobre la historia de "${place}" en ${city} al estilo BBC History Magazine: rigor histórico, contexto amplio, narración dramática. Si no tienes información histórica específica y verificada sobre este lugar exacto, responde solo con: NULL.`,
      en: `Write 2-3 sentences about the history of "${place}" in ${city} in BBC History Magazine style. If you don't have specific verified historical information about this exact place, respond only with: NULL.`,
      gl: `Escribe 2-3 frases sobre a historia de "${place}" en ${city} ao estilo BBC History Magazine. Se non tes información verificada, responde só con: NULL.`,
    },
    smarthistory: {
      es: `Escribe 2-3 frases sobre "${place}" en ${city} al estilo Smarthistory: análisis artístico y cultural accesible. Si no tienes información artística o cultural específica y verificada sobre este lugar exacto, responde solo con: NULL.`,
      en: `Write 2-3 sentences about "${place}" in ${city} in Smarthistory style: accessible art and cultural analysis. If you don't have specific verified information, respond only with: NULL.`,
      gl: `Escribe 2-3 frases sobre "${place}" en ${city} ao estilo Smarthistory. Se non tes información verificada, responde só con: NULL.`,
    },
  };
  try {
    const prompt = prompts[source]?.[lang] || prompts[source]?.es;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const text = data.content?.find(b => b.type === "text")?.text?.trim() || null;
    if (!text || text === "NULL" || text.startsWith("NULL")) return null;
    return { text };
  } catch (_) { return null; }
}

async function generateBrief(place, city, sources, lang) {
  const parts = [];
  if (sources.wikipedia?.text) parts.push(`WIKIPEDIA: ${sources.wikipedia.text}`);
  if (sources.wikivoyage?.text) parts.push(`WIKIVOYAGE: ${sources.wikivoyage.text}`);
  if (sources.atlas_obscura?.text) parts.push(`ATLAS OBSCURA: ${sources.atlas_obscura.text}`);
  if (sources.reddit?.posts?.length) parts.push(`REDDIT: ${sources.reddit.posts.map(p => p.text).join(" | ")}`);
  if (sources.bbc?.text) parts.push(`BBC HISTORY: ${sources.bbc.text}`);
  if (sources.smarthistory?.text) parts.push(`SMARTHISTORY: ${sources.smarthistory.text}`);

  if (parts.length === 0) return null;

  const prompts = {
    es: `Basándote SOLO en esta información sobre "${place}" en ${city}, genera un brief estructurado. Responde ÚNICAMENTE con un array JSON válido, sin texto adicional, sin markdown:
[{"category":"historia","text":"..."},{"category":"secretos","text":"..."}]

Categorías disponibles: historia, secretos, curiosidades, consejos, arte, contexto
Usa solo las categorías donde tengas información real y específica. Máximo 2 frases por categoría. No inventes nada.

INFORMACIÓN:
${parts.join("\n")}`,
    en: `Based ONLY on this information about "${place}" in ${city}, generate a structured brief. Respond ONLY with a valid JSON array, no extra text, no markdown:
[{"category":"historia","text":"..."}]

Available categories: historia, secretos, curiosidades, consejos, arte, contexto
Only use categories with real specific information. Max 2 sentences each. Don't invent anything.

INFORMATION:
${parts.join("\n")}`,
    gl: `Baseándote SÓ nesta información sobre "${place}" en ${city}, xera un brief. Responde ÚNICAMENTE cun array JSON válido:
[{"category":"historia","text":"..."}]

Categorías: historia, secretos, curiosidades, consejos, arte, contexto
So categorías con información real. Máximo 2 frases. Non inventes nada.

INFORMACIÓN:
${parts.join("\n")}`,
  };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompts[lang] || prompts.es }],
      }),
    });
    const data = await res.json();
    const text = data.content?.find(b => b.type === "text")?.text?.trim() || "";
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_) { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { place, city, lang = "es" } = req.body;
  if (!place || !city) return res.status(400).json({ error: "Missing params" });

  const key = `sources2:${lang}:${normalize(city)}:${normalize(place)}`;

  const cached = await getCached(key);
  if (cached) {
    const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
    return res.status(200).json({ ...parsed, fromCache: true });
  }

  const [wikipedia, wikivoyage, reddit, atlas_obscura, bbc, smarthistory] = await Promise.allSettled([
    fetchWikipedia(place, city, lang),
    fetchWikivoyage(place, city, lang),
    fetchReddit(place, city),
    fetchWithClaude(place, city, "atlas_obscura", lang),
    fetchWithClaude(place, city, "bbc", lang),
    fetchWithClaude(place, city, "smarthistory", lang),
  ]);

  const sources = {
    wikipedia:    wikipedia.status    === "fulfilled" ? wikipedia.value    : null,
    wikivoyage:   wikivoyage.status   === "fulfilled" ? wikivoyage.value   : null,
    reddit:       reddit.status       === "fulfilled" ? reddit.value       : null,
    atlas_obscura:atlas_obscura.status=== "fulfilled" ? atlas_obscura.value: null,
    bbc:          bbc.status          === "fulfilled" ? bbc.value          : null,
    smarthistory: smarthistory.status === "fulfilled" ? smarthistory.value : null,
  };

  const brief = await generateBrief(place, city, sources, lang);
  const result = { ...sources, brief };

  await setCache(key, result);
  res.status(200).json({ ...result, fromCache: false });
}

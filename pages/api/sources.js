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

const WIKI_LANG = { es: "es", en: "en", gl: "gl" };
const VOYAGE_LANG = { es: "es", en: "en", gl: "es" };

async function fetchWikipedia(place, city, lang) {
  const wl = WIKI_LANG[lang] || "es";
  try {
    const s = await fetch(`https://${wl}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(place + " " + city)}&format=json&srlimit=1&origin=*`);
    const sd = await s.json();
    const title = sd.query?.search?.[0]?.title;
    if (!title) return null;
    const r = await fetch(`https://${wl}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    const d = await r.json();
    if (!d.extract) return null;
    return { text: d.extract.slice(0, 500), title: d.title };
  } catch (_) { return null; }
}

async function fetchWikivoyage(place, city, lang) {
  const vl = VOYAGE_LANG[lang] || "es";
  try {
    const s = await fetch(`https://${vl}.wikivoyage.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(city)}&format=json&srlimit=1&origin=*`);
    const sd = await s.json();
    const title = sd.query?.search?.[0]?.title;
    if (!title) return null;
    const r = await fetch(`https://${vl}.wikivoyage.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&exintro=true&exchars=500&format=json&origin=*`);
    const d = await r.json();
    const pages = d.query?.pages;
    const page = pages?.[Object.keys(pages)[0]];
    const text = page?.extract?.replace(/<[^>]*>/g, "").trim();
    return text ? { text: text.slice(0, 500), title } : null;
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
      .filter(p => p.data.selftext && p.data.selftext.length > 80 && p.data.score > 5)
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
      es: `2-3 frases sobre "${place}" en ${city} al estilo Atlas Obscura: curiosidades ocultas, historias extrañas, secretos que los turistas no conocen. Solo el texto.`,
      en: `2-3 sentences about "${place}" in ${city} in Atlas Obscura style: hidden curiosities, strange stories, secrets most tourists miss. Just the text.`,
      gl: `2-3 frases sobre "${place}" en ${city} ao estilo Atlas Obscura: curiosidades agochadas, historias estrañas. So o texto.`,
    },
    bbc: {
      es: `2-3 frases sobre la historia de "${place}" en ${city} al estilo BBC History Magazine: rigor histórico, contexto amplio, narración dramática. Solo el texto.`,
      en: `2-3 sentences about the history of "${place}" in ${city} in BBC History Magazine style: historical rigor, dramatic narrative. Just the text.`,
      gl: `2-3 frases sobre a historia de "${place}" en ${city} ao estilo BBC History Magazine: rigor histórico, narración dramática. So o texto.`,
    },
    smarthistory: {
      es: `2-3 frases sobre "${place}" en ${city} al estilo Smarthistory: análisis artístico y cultural accesible, conexiones entre arte, historia y sociedad. Solo el texto.`,
      en: `2-3 sentences about "${place}" in ${city} in Smarthistory style: accessible art and cultural analysis. Just the text.`,
      gl: `2-3 frases sobre "${place}" en ${city} ao estilo Smarthistory: análise artística e cultural accesible. So o texto.`,
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
    const text = data.content?.find(b => b.type === "text")?.text || null;
    return text ? { text } : null;
  } catch (_) { return null; }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { place, city, lang = "es" } = req.body;
  if (!place || !city) return res.status(400).json({ error: "Missing params" });

  const key = `sources:${lang}:${city.toLowerCase().replace(/\s+/g, "-")}:${place.toLowerCase().replace(/\s+/g, "-")}`;

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

  const result = {
    wikipedia: wikipedia.status === "fulfilled" ? wikipedia.value : null,
    wikivoyage: wikivoyage.status === "fulfilled" ? wikivoyage.value : null,
    reddit: reddit.status === "fulfilled" ? reddit.value : null,
    atlas_obscura: atlas_obscura.status === "fulfilled" ? atlas_obscura.value : null,
    bbc: bbc.status === "fulfilled" ? bbc.value : null,
    smarthistory: smarthistory.status === "fulfilled" ? smarthistory.value : null,
  };

  await setCache(key, result);
  res.status(200).json({ ...result, fromCache: false });
}

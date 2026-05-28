import { Redis } from "@upstash/redis";

let redis = null;
try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} catch (_) {}

const PROMPTS = {
  itinerary: {
    es: (city) => `Crea un itinerario de viaje de 3 días para ${city}. Usa EXACTAMENTE este formato:

DAY 1:
- Nombre del lugar: Descripción breve en una frase de qué ver o hacer allí.
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.

DAY 2:
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.

DAY 3:
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.

Incluye 3-5 lugares por día. Mezcla monumentos, barrios, restaurantes y joyas ocultas. Descripciones de menos de 15 palabras. IMPORTANTE: escribe SIEMPRE los nombres de los lugares en caracteres latinos (nunca en griego, árabe, cirílico, chino ni ningún otro alfabeto no latino).`,

    en: (city) => `Create a 3-day travel itinerary for ${city}. Use EXACTLY this format:

DAY 1:
- Place Name: Brief one-sentence description of what to do or see there.
- Place Name: Brief description.
- Place Name: Brief description.
- Place Name: Brief description.

DAY 2:
- Place Name: Brief description.
- Place Name: Brief description.
- Place Name: Brief description.

DAY 3:
- Place Name: Brief description.
- Place Name: Brief description.
- Place Name: Brief description.

Include 3-5 places per day. Mix monuments, neighborhoods, restaurants and hidden gems. Descriptions under 15 words. IMPORTANT: always write place names in Latin characters (never in Greek, Arabic, Cyrillic, Chinese or any other non-Latin script).`,

    gl: (city) => `Crea un itinerario de viaxe de 3 días para ${city} en galego. Usa EXACTAMENTE este formato:

DAY 1:
- Nome do lugar: Descrición breve nunha frase de que ver ou facer alí.
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.

DAY 2:
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.

DAY 3:
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.

Inclúe 3-5 lugares por día. Mestura monumentos, barrios, restaurantes e xoias agochadas. Descricións de menos de 15 palabras. IMPORTANTE: escribe SEMPRE os nomes dos lugares en caracteres latinos (nunca en grego, árabe, cirílico, chinés nin ningún outro alfabeto non latino).`,
  },

  history: {
    es: (place, city) => `Escribe un resumen histórico y cultural breve (3-4 frases) sobre "${place}" en ${city}. Que sea fascinante y educativo, cosas que un viajero curioso adoraría saber antes de visitarlo. Conciso pero vívido. Sin bullet points, solo prosa fluida. Responde en español.`,
    en: (place, city) => `Write a short, fascinating historical and cultural summary (3-4 sentences) about "${place}" in ${city}. Make it engaging and educational — things a curious traveler would love to know before visiting. Concise but vivid. No bullet points, just flowing prose. Respond in English.`,
    gl: (place, city) => `Escribe un resumo histórico e cultural breve (3-4 frases) sobre "${place}" en ${city}. Que sexa fascinante e educativo, cousas que un viaxeiro curioso adoraría saber antes de visitalo. Conciso pero vívido. Sen bullet points, só prosa fluída. Responde en galego.`,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { type, city, placeName, lang = "es" } = req.body;
  if (!type || !city) return res.status(400).json({ error: "Missing params" });

  const safeCity = city.toLowerCase().trim().replace(/\s+/g, "-");
  const safeLang = ["es", "en", "gl"].includes(lang) ? lang : "es";

  const cacheKey =
    type === "itinerary"
      ? `itinerary:${safeLang}:${safeCity}`
      : `history:${safeLang}:${safeCity}:${placeName?.toLowerCase().trim().replace(/\s+/g, "-")}`;

  // Try cache first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        console.log(`[three-days-in] Cache hit: ${cacheKey}`);
        // Track even on cache hit
        if (type === "itinerary" && redis) {
          try { await redis.zincrby("city_searches", 1, city); } catch (_) {}
        }
        return res.status(200).json({ text: cached, fromCache: true });
      }
    } catch (e) {
      console.log(`[three-days-in] Cache read error: ${e.message}`);
    }
  }

  // Build prompt
  const prompt =
    type === "itinerary"
      ? PROMPTS.itinerary[safeLang](city)
      : PROMPTS.history[safeLang](placeName, city);

  console.log(`[three-days-in] Calling Anthropic for ${type}: ${city}`);

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await anthropicRes.json();
  console.log(`[three-days-in] Anthropic status: ${anthropicRes.status}, error: ${data.error?.message || "none"}`);

  const text = data.content?.find((b) => b.type === "text")?.text || "";

  // Save to cache forever
  if (redis && text) {
    try {
      await redis.set(cacheKey, text);
      console.log(`[three-days-in] Cached: ${cacheKey}`);
    } catch (e) {
      console.log(`[three-days-in] Cache write error: ${e.message}`);
    }
  }

  // Track search directly in Redis
  if (type === "itinerary" && text && redis) {
    try { await redis.zincrby("city_searches", 1, city); } catch (_) {}
  }

  res.status(200).json({ text, fromCache: false });
}

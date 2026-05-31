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
    es: (city, isCountry, order) => isCountry ? `Crea un itinerario de viaje de 3 días por ${city}. Selecciona 3 ciudades que formen una ruta geográficamente lógica (conectadas por tren o coche en menos de 3-4 horas entre cada una, sin backtracking innecesario). Cada día = una ciudad. Usa EXACTAMENTE este formato:

DAY 1: [Nombre Ciudad]
- Nombre del lugar: Descripción breve en una frase de qué ver o hacer allí.
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.

DAY 2: [Nombre Ciudad]
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.

DAY 3: [Nombre Ciudad]
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.
- Nombre del lugar: Descripción breve.

Incluye 3-5 lugares por ciudad. ${order === "proximity" ? "Ordena los lugares de cada ciudad por CERCANÍA geográfica entre ellos, para minimizar desplazamientos." : "Ordena los lugares de cada ciudad por CONTEXTO narrativo e histórico: visita primero lo que da contexto para entender mejor lo siguiente."} Mezcla monumentos, barrios, restaurantes y joyas ocultas. Descripciones de menos de 15 palabras. IMPORTANTE: escribe todos los nombres en caracteres latinos. Empieza DIRECTAMENTE con DAY 1: sin ningún texto previo.` :
`Crea un itinerario de viaje de 3 días para ${city}. Usa EXACTAMENTE este formato:

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

Incluye 3-5 lugares por día. ${order === "proximity" ? "Ordena los lugares de cada día por CERCANÍA geográfica entre ellos, para minimizar desplazamientos." : "Ordena los lugares de cada día por CONTEXTO narrativo e histórico: visita primero lo que da contexto para entender mejor lo siguiente."} Mezcla monumentos, barrios, restaurantes y joyas ocultas. Descripciones de menos de 15 palabras. IMPORTANTE: escribe todos los nombres en caracteres latinos. Empieza DIRECTAMENTE con DAY 1: sin ningún texto previo.`,

    en: (city, isCountry, order) => isCountry ? `Create a 3-day travel itinerary across ${city}. Select 3 cities forming a geographically logical route (connected by train or car in under 3-4 hours, no unnecessary backtracking). Each day = one city. Use EXACTLY this format:

DAY 1: [City Name]
- Place Name: Brief one-sentence description of what to do or see there.
- Place Name: Brief description.
- Place Name: Brief description.
- Place Name: Brief description.

DAY 2: [City Name]
- Place Name: Brief description.
- Place Name: Brief description.
- Place Name: Brief description.

DAY 3: [City Name]
- Place Name: Brief description.
- Place Name: Brief description.
- Place Name: Brief description.

Include 3-5 places per city. ${order === "proximity" ? "Order places in each city by GEOGRAPHIC PROXIMITY to minimize walking/travel between them." : "Order places in each city by NARRATIVE CONTEXT: visit first what gives context to understand what follows."} Mix monuments, neighborhoods, restaurants and hidden gems. Descriptions under 15 words. IMPORTANT: always write place names in Latin characters. Start DIRECTLY with DAY 1: with absolutely no introduction.` :
`Create a 3-day travel itinerary for ${city}. Use EXACTLY this format:

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

Include 3-5 places per day. ${order === "proximity" ? "Order places in each day by GEOGRAPHIC PROXIMITY to minimize walking between them." : "Order places in each day by NARRATIVE CONTEXT: visit first what gives context to understand what follows."} Mix monuments, neighborhoods, restaurants and hidden gems. Descriptions under 15 words. IMPORTANT: always write place names in Latin characters. Start DIRECTLY with DAY 1: absolutely no introduction.`,

    gl: (city, isCountry, order) => isCountry ? `Crea un itinerario de viaxe de 3 días por ${city} en galego. Selecciona 3 cidades que formen unha ruta xeograficamente lóxica. Cada día = unha cidade. Usa EXACTAMENTE este formato:

DAY 1: [Nome Cidade]
- Nome do lugar: Descrición breve nunha frase de que ver ou facer alí.
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.

DAY 2: [Nome Cidade]
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.

DAY 3: [Nome Cidade]
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.
- Nome do lugar: Descrición breve.

Inclúe 3-5 lugares por cidade. ${order === "proximity" ? "Ordena os lugares de cada cidade por PROXIMIDADE xeográfica." : "Ordena os lugares de cada cidade por CONTEXTO narrativo e histórico."} Descricións de menos de 15 palabras. IMPORTANTE: caracteres latinos sempre. Comeza DIRECTAMENTE con DAY 1: sen ningún texto previo.` :
`Crea un itinerario de viaxe de 3 días para ${city} en galego. Usa EXACTAMENTE este formato:

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

Inclúe 3-5 lugares por día. ${order === "proximity" ? "Ordena os lugares de cada día por PROXIMIDADE xeográfica." : "Ordena os lugares de cada día por CONTEXTO narrativo e histórico."} Descricións de menos de 15 palabras. IMPORTANTE: caracteres latinos sempre. Comeza DIRECTAMENTE con DAY 1: sen ningún texto previo.`,
  },

  history: {
    es: (place, city) => `Escribe un resumen histórico y cultural breve (3-4 frases) sobre "${place}" en ${city}. Que sea fascinante y educativo, cosas que un viajero curioso adoraría saber antes de visitarlo. Conciso pero vívido. Sin bullet points, solo prosa fluida. Responde en español.`,
    en: (place, city) => `Write a short, fascinating historical and cultural summary (3-4 sentences) about "${place}" in ${city}. Make it engaging and educational — things a curious traveler would love to know before visiting. Concise but vivid. No bullet points, just flowing prose. Respond in English.`,
    gl: (place, city) => `Escribe un resumo histórico e cultural breve (3-4 frases) sobre "${place}" en ${city}. Que sexa fascinante e educativo, cousas que un viaxeiro curioso adoraría saber antes de visitalo. Conciso pero vívido. Sen bullet points, só prosa fluída. Responde en galego.`,
  },
};


export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { type, city, placeName, lang = "es", isCountry = false, order = "context" } = req.body;
  if (!type || !city) return res.status(400).json({ error: "Missing params" });

  const safeCity = city.toLowerCase().trim().replace(/\s+/g, "-");
  const safeLang = ["es", "en", "gl"].includes(lang) ? lang : "es";

  const safeOrder = ["proximity", "context"].includes(order) ? order : "context";
  const cacheKey =
    type === "itinerary"
      ? `itinerary:${safeLang}:${safeCity}:${safeOrder}${isCountry ? ":country" : ""}`
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
      ? PROMPTS.itinerary[safeLang](city, isCountry, safeOrder)
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

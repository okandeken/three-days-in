import { Redis } from "@upstash/redis";

let redis = null;
try {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
} catch (_) {}

const POPULAR_FALLBACK = [
  "New York", "Tokyo", "Paris", "Barcelona", "Rome",
  "London", "Amsterdam", "Lisbon", "Istanbul", "Bali",
];

export default async function handler(req, res) {
  // POST: track a search
  if (req.method === "POST") {
    const { city } = req.body;
    if (!city) return res.status(400).end();
    if (redis) {
      try {
        await redis.zincrby("city_searches", 1, city);
      } catch (_) {}
    }
    return res.status(200).json({ ok: true });
  }

  // GET: return top searched cities
  if (req.method === "GET") {
    let topCities = [];
    if (redis) {
      try {
        // Get top 10 most searched, sorted by score descending
        topCities = await redis.zrange("city_searches", 0, 9, { rev: true }) || [];
      } catch (_) {}
    }

    // Fill remaining slots with popular fallback cities not already in list
    const topLower = topCities.map(c => c.toLowerCase());
    const remaining = POPULAR_FALLBACK.filter(c => !topLower.includes(c.toLowerCase()));
    const suggestions = [...topCities, ...remaining].slice(0, 10);

    return res.status(200).json({ suggestions });
  }

  res.status(405).end();
}

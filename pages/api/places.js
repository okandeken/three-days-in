export default async function handler(req, res) {
  const { input, lang = "es" } = req.query;
  if (!input || input.length < 2) return res.status(200).json({ predictions: [] });

  const langMap = { es: "es,en", en: "en,es", gl: "gl,es,en" };
  const acceptLang = langMap[lang] || "es,en";

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=10&accept-language=${acceptLang}&addressdetails=1&namedetails=1&featuretype=city`;

  const response = await fetch(url, {
    headers: { "User-Agent": "ThreeDaysIn/1.0", "Accept-Language": acceptLang },
  });

  const data = await response.json();
  const seen = new Set();

  const predictions = data
    .filter(p => p.class === "place" || p.class === "boundary")
    .filter(p => {
      const name = p.address?.city || p.address?.town || p.address?.village || p.name;
      if (!name || seen.has(name.toLowerCase())) return false;
      seen.add(name.toLowerCase());
      return true;
    })
    .slice(0, 6)
    .map(p => {
      // Use English name if available and lang is English
      const enName = lang === "en" ? (p.namedetails?.["name:en"] || null) : null;
      const glName = lang === "gl" ? (p.namedetails?.["name:gl"] || p.namedetails?.["name:es"] || null) : null;
      const localName = p.address?.city || p.address?.town || p.address?.village || p.name;
      const displayName = enName || glName || localName;
      const country = p.address?.country || "";
      return { id: p.place_id, name: displayName, full: `${displayName}, ${country}` };
    });

  res.status(200).json({ predictions });
}

export default async function handler(req, res) {
  const { input, lang = "es" } = req.query;
  if (!input || input.length < 2) return res.status(200).json({ predictions: [] });

  const langMap = { es: "es", en: "en", gl: "gl,es" };
  const acceptLang = langMap[lang] || "es";

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=6&featuretype=city&accept-language=${acceptLang}&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ThreeDaysIn/1.0",
      "Accept-Language": acceptLang,
    },
  });

  const data = await response.json();
  console.log(`[places] input: ${input}, results: ${data.length}`);

  const seen = new Set();
  const predictions = data
    .filter((p) => {
      const name = p.address?.city || p.address?.town || p.address?.village || p.name;
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    })
    .map((p) => {
      const city = p.address?.city || p.address?.town || p.address?.village || p.name;
      const country = p.address?.country || "";
      return {
        id: p.place_id,
        name: city,
        full: `${city}, ${country}`,
      };
    });

  res.status(200).json({ predictions });
}

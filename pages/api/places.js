export default async function handler(req, res) {
  const { input, lang = "es" } = req.query;
  if (!input || input.length < 2) return res.status(200).json({ predictions: [] });

  const langMap = { es: "es,en", en: "en", gl: "gl,es,en" };
  const acceptLang = langMap[lang] || "es,en";

  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(input)}&format=json&limit=6&featuretype=city&accept-language=${acceptLang}&addressdetails=1&namedetails=1`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ThreeDaysIn/1.0",
      "Accept-Language": acceptLang,
    },
  });

  const data = await response.json();

  const seen = new Set();
  const predictions = data
    .filter((p) => {
      // Get the best Latin-script name available
      const name =
        p.namedetails?.["name:es"] ||
        p.namedetails?.["name:en"] ||
        p.namedetails?.["name:gl"] ||
        p.address?.city ||
        p.address?.town ||
        p.address?.village ||
        p.name;

      if (!name || seen.has(name)) return false;
      // Skip if name contains non-Latin characters (Greek, Arabic, Cyrillic, Chinese, etc.)
      if (/[^\u0000-\u024F\s]/.test(name)) return false;
      seen.add(name);
      return true;
    })
    .map((p) => {
      const city =
        p.namedetails?.["name:es"] ||
        p.namedetails?.["name:en"] ||
        p.namedetails?.["name:gl"] ||
        p.address?.city ||
        p.address?.town ||
        p.address?.village ||
        p.name;

      const country =
        p.namedetails?.["name:es"] ? p.address?.country :
        p.address?.country || "";

      return {
        id: p.place_id,
        name: city,
        full: `${city}, ${country}`,
      };
    });

  res.status(200).json({ predictions });
}

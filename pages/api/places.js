export default async function handler(req, res) {
  const { input } = req.query;
  if (!input || input.length < 2) return res.status(200).json({ predictions: [] });

  const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&types=(cities)&key=${process.env.GOOGLE_PLACES_API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  console.log(`[places] status: ${data.status}, predictions: ${data.predictions?.length || 0}, error: ${data.error_message || "none"}`);

  const predictions = (data.predictions || []).map((p) => ({
    id: p.place_id,
    name: p.structured_formatting?.main_text || p.description,
    full: p.description,
  }));

  res.status(200).json({ predictions });
}

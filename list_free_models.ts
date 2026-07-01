async function listGeminiModels() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (res.ok) {
      const data = await res.json();
      console.log("All Gemini models on OpenRouter:");
      for (const model of data.data) {
        if (model.id.toLowerCase().includes("gemini")) {
          const isFree = model.id.endsWith(":free") || model.pricing?.prompt === "0";
          console.log(`- ${model.id} | Free: ${isFree} | pricing.prompt: ${model.pricing?.prompt}`);
        }
      }
    } else {
      console.error("Failed to fetch models:", res.status);
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

listGeminiModels();

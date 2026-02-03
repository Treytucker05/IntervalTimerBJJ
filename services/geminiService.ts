import { GoogleGenAI } from "@google/genai";

export const generateThemedBackground = async (promptContext: string): Promise<string | null> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.warn("No API Key found for background generation");
      return null;
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Construct a prompt that aligns with the VOW BJJ aesthetic (Geometric, Dark, Cool)
    const prompt = `
      Create a highly stylized, abstract background image suitable for a Jiu-Jitsu timer app.
      Style: Dark mode, Geometric lines, Vector art, Minimalist.
      Theme: ${promptContext}.
      Colors: Black, Dark Grey, White, with subtle neon accents suitable for a gym.
      Aspect Ratio: 16:9.
      No text.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error("Failed to generate background:", error);
    return null;
  }
};
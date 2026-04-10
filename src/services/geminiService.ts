import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface RecognitionResult {
  insect_id: string;
  confidence: number;
}

export async function recognizeInsect(base64Image: string): Promise<RecognitionResult | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `Identify the insect in this image. 
            Choose from the following list of IDs: 
            'kien' (Ant), 'buom' (Butterfly), 'gian' (Cockroach), 'chuon-chuon' (Dragonfly), 'ruoi' (Fly), 'chau-chau' (Grasshopper), 'ong' (Bee), 'bo-rua' (Ladybug), 'muoi' (Mosquito), 'nhen' (Spider).
            Return the result in JSON format with 'insect_id' and 'confidence' (0-1).
            If no insect from the list is found, return null.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insect_id: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: ["insect_id", "confidence"],
        },
      },
    });

    const result = JSON.parse(response.text);
    if (result && result.insect_id) {
      return result;
    }
    return null;
  } catch (error) {
    console.error("Gemini Recognition Error:", error);
    return null;
  }
}

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface RecognitionResult {
  insect_id: string;
  confidence: number;
}

export async function recognizeInsect(base64Image: string): Promise<RecognitionResult | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
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
            'ant' (Kiến), 'butterfly' (Bướm), 'cockroach' (Gián), 'dragonfly' (Chuồn chuồn), 'fly' (Ruồi), 'grasshopper' (Châu chấu), 'bee' (Ong), 'ladybug' (Bọ rùa), 'mosquito' (Muỗi), 'spider' (Nhện).
            Return the result in JSON format with 'insect_id' and 'confidence' (0-1).
            If you are not sure or no insect from the list is found, return 'unknown' as the insect_id.`,
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
    if (result && result.insect_id && result.insect_id !== 'unknown') {
      return result;
    }
    return null;
  } catch (error) {
    console.error("Gemini Recognition Error:", error);
    throw error;
  }
}

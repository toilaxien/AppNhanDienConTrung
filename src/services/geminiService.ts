import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface RecognitionResult {
  insect_id: string;
  confidence: number;
}

export async function recognizeInsect(base64Image: string): Promise<RecognitionResult | null> {
  try {
    // === HƯỚNG DẪN TÍCH HỢP YOLO11 ===
    // Khi bạn có API cho model YOLO11, hãy bỏ comment đoạn code dưới đây và thay thế URL:
    
    const YOLO_API_URL = 'https://toilaxien-yolo-insect-api.hf.space/predict';
    const response = await fetch(YOLO_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image })
    });
    const data = await response.json();
    
    if (data && data.class_name && data.confidence > 0.3) {
      return { insect_id: data.class_name, confidence: data.confidence };
    } else {
      return { insect_id: 'unknown_insect', confidence: 1.0 };
    }
    
    // ===================================

    /* Tạm thời vẫn dùng Gemini làm fallback
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
    return { insect_id: 'unknown_insect', confidence: 1.0 };
    */
  } catch (error) {
    console.error("Recognition Error:", error);
    return { insect_id: 'unknown_insect', confidence: 1.0 };
  }
}

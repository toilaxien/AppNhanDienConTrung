import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface RecognitionResult {
  insect_id: string;
  confidence: number;
}

export async function evaluateImageWithGemini(base64Image: string, knownInsectIds: string[]): Promise<string> {
  try {
    const listString = JSON.stringify(knownInsectIds);
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `You are an expert insect classifier. Determine if there is any real INSECT, BUG, ARACHNID, or MYRIAPOD visible in this image.
            - IT IS VALID if the bug is seen on a computer screen, photo, or book in the image.
            - IT IS INVALID (false) if the image is just a mammal (like an elephant, dog, cat), a bird, a person, a face, or an inanimate object WITHOUT any bug.
            
            If it is a valid bug, identify its general English name.
            Here is our database of known bug IDs: ${listString}
            
            Return JSON with:
            - reasoning: Briefly explain what you see in the image.
            - contains_bug: true if there is a bug/insect/spider, false if absolutely no bug (e.g., an elephant, a human, a plant).
            - bug_name: If contains_bug is true, try to map the bug to one of the exact IDs from the database list. Use common sense. If contains_bug is false, or the bug is definitely NOT in the database, return "none".`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reasoning: { type: Type.STRING },
            contains_bug: { type: Type.BOOLEAN },
            bug_name: { type: Type.STRING },
          },
          required: ["reasoning", "contains_bug", "bug_name"],
        },
        temperature: 0.1,
      },
    });

    const result = JSON.parse(response.text || '{}');
    console.log("Gemini vision analysis:", result); // Debug log to see why it decided
    
    // Check various ways "false" might be represented
    const noBug = result.contains_bug === false || 
                  result.contains_bug === 'false' || 
                  String(result.contains_bug).toLowerCase() === 'false';
                  
    if (noBug) {
       return 'no_insect';
    }

    let finalId = (result.bug_name || '').toLowerCase().trim();

    // Map common plural/synonyms to known ids just to be ultra safe
    const idMap: Record<string, string> = {
      'butterflies': 'butterfly',
      'moths': 'butterfly',
      'moth': 'butterfly',
      'ants': 'ant',
      'bees': 'honeybee',
      'bee': 'honeybee',
      'wasps': 'honeybee',
      'wasp': 'honeybee',
      'ladybugs': 'ladybug',
      'ladybird': 'ladybug',
      'dragonflies': 'dragonfly',
      'cockroaches': 'cockroach',
      'roach': 'cockroach',
      'roaches': 'cockroach',
      'flies': 'fly',
      'grasshoppers': 'grasshopper',
      'cricket': 'grasshopper',
      'crickets': 'grasshopper',
      'mosquitoes': 'mosquito',
      'spiders': 'spider',
    };
    if (idMap[finalId]) finalId = idMap[finalId];

    // Final safety check to make absolutely sure it maps either to a known class, no_insect, or unknown_insect
    const lowerKnownIds = knownInsectIds.map(i => i.toLowerCase());
    
    // Exact match
    if (lowerKnownIds.includes(finalId) && finalId !== 'unknown_insect') {
      return finalId;
    }
    
    // If not exact match, let's deeply search using word boundaries to prevent "elephant" matching "ant"
    const fullResponseString = (finalId + " " + (result.reasoning || "")).toLowerCase();
      
    // Check if any of our known IDs are inside the reasoning/result string at all!
    for (const knownId of lowerKnownIds) {
      if (knownId !== 'unknown_insect') {
        const regex = new RegExp(`\\b${knownId}\\b`, 'i');
        if (regex.test(fullResponseString)) {
          console.log(`Fuzzy matched ${knownId} using word boundaries from Gemini response`);
          return knownId; // We found a known insect mentioned!
        }
      }
    }
    
    // Also check plurals with word boundaries
    for (const [plural, singular] of Object.entries(idMap)) {
      const regex = new RegExp(`\\b${plural}\\b`, 'i');
      if (regex.test(fullResponseString)) {
        console.log(`Fuzzy matched plural ${plural}->${singular} from Gemini response`);
        return singular;
      }
    }

    // If we looked everywhere and still couldn't find a known insect, but there IS an insect...
    return 'unknown_insect';
  } catch (error) {
    console.error("Gemini check error:", error);
    return 'no_insect'; // Safely assume no insect if error
  }
}

export async function recognizeInsect(base64Image: string, knownInsectIds: string[]): Promise<RecognitionResult | null> {
  try {
    const YOLO_API_URL = 'https://toilaxien-yolo-insect-api.hf.space/predict';
    const response = await fetch(YOLO_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64Image })
    });
    const data = await response.json();
    
    // Yolo has predicted something. Is it highly confident AND is it in our database?
    if (data && data.class_name && data.confidence > 0.45) {
      // make it case insensitive match
      const predictedClassLower = data.class_name.toLowerCase();
      const matchedId = knownInsectIds.find(id => id.toLowerCase() === predictedClassLower);
      
      if (matchedId) {
        return { insect_id: matchedId, confidence: data.confidence };
      }
    }
    
    // Model didn't recognize correctly, OR it recognized something outside our database. 
    // Call Gemini to evaluate if it's ACTUALLY an insect, and which one.
    console.log("Yolo confused, low confidence, or unknown class. Triggering Gemini vision evaluation...");
    const aiResultId = await evaluateImageWithGemini(base64Image, knownInsectIds);
    return { insect_id: aiResultId, confidence: 1.0 };
    
  } catch (error) {
    console.error("Recognition Error:", error);
    // If YOLO fails (e.g., server down), fallback to Gemini
    console.log("Yolo failed. Triggering Gemini vision evaluation...");
    const aiResultId = await evaluateImageWithGemini(base64Image, knownInsectIds);
    return { insect_id: aiResultId, confidence: 1.0 };
  }
}

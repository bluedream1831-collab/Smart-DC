
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { InspectionResult } from '../types';

export const analyzeProductImage = async (base64Images: string[]): Promise<InspectionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    你現在是「台灣食品法規稽查員」。請嚴格依照台灣 TFDA 營養標示格式規範分析圖中標籤。

    任務重點：
    1. 營養標示八大要件檢查：必須包含「熱量、蛋白質、脂肪、飽和脂肪、反式脂肪、碳水化合物、糖、鈉」。
    2. 單位檢核：熱量(kcal)、鈉(mg)、其餘(g)。若圖中單位錯誤(如鈉標示為g)，必須記錄。
    3. 標示方式：檢查是否有「每份」及「每100公克/毫升」。
    4. 內容一致性：成分表中的含糖/含油成分是否與營養標示數據邏輯一致。
    5. 位置與清晰度：評估標示是否位於顯著位置且字體清晰，給予 1-5 分評分。

    請以 JSON 格式回傳：
    - nutrition.facts 必須包含所有八大項目，並註明 found (boolean) 與 unit。
    - nutrition.compliance 記錄缺少的項目 (missingItems) 與 單位錯誤 (unitErrors)。
    - 若八大要件缺一不可，否則 complianceSummary.isPassed 為 false。
    
    使用繁體中文。
  `;

  const imageParts = base64Images.map(base64 => {
    const parts = base64.split(',');
    const data = parts.length > 1 ? parts[1] : base64;
    return { inlineData: { data: data as string, mimeType: 'image/jpeg' } };
  });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ text: prompt }, ...imageParts]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: { type: Type.STRING },
            isDomestic: { type: Type.BOOLEAN },
            hasPorkOrBeef: { type: Type.BOOLEAN },
            meatOrigin: { type: Type.STRING },
            allergens: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  found: { type: Type.BOOLEAN },
                  reason: { type: Type.STRING }
                }
              }
            },
            nutrition: {
              type: Type.OBJECT,
              properties: {
                servingSize: { type: Type.STRING },
                servingsPerPackage: { type: Type.STRING },
                facts: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      item: { type: Type.STRING, description: "熱量/蛋白質/脂肪/飽和脂肪/反式脂肪/碳水化合物/糖/鈉" },
                      perServing: { type: Type.STRING },
                      per100g: { type: Type.STRING },
                      unit: { type: Type.STRING },
                      found: { type: Type.BOOLEAN }
                    }
                  }
                },
                compliance: {
                  type: Type.OBJECT,
                  properties: {
                    hasBigEight: { type: Type.BOOLEAN },
                    missingItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                    unitErrors: { type: Type.ARRAY, items: { type: Type.STRING } },
                    positionScore: { type: Type.NUMBER }
                  }
                }
              }
            },
            manufacturer: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                phone: { type: Type.STRING },
                address: { type: Type.STRING }
              }
            },
            dates: {
              type: Type.OBJECT,
              properties: {
                manufactureDate: { type: Type.STRING },
                expiryDate: { type: Type.STRING },
                totalShelfLifeDays: { type: Type.NUMBER }
              }
            }
          }
        }
      }
    });

    const result = JSON.parse(response.text);
    const reasons: string[] = [];

    // 法規判定：營養標示八大要件檢查
    if (!result.nutrition?.compliance?.hasBigEight) {
      reasons.push(`營養標示不合規：缺少項目 (${result.nutrition?.compliance?.missingItems?.join(', ')})`);
    }
    if (result.nutrition?.compliance?.unitErrors?.length > 0) {
      reasons.push(`單位標示錯誤：${result.nutrition.compliance.unitErrors.join(', ')}`);
    }
    if (result.hasPorkOrBeef && !result.meatOrigin) {
      reasons.push("肉品成分缺少原產地標示");
    }
    if (!result.manufacturer?.name) {
      reasons.push("製造商資訊缺漏");
    }

    return {
      ...result,
      complianceSummary: {
        isPassed: reasons.length === 0,
        reasons
      }
    };
  } catch (error: any) {
    console.error("Analysis Error:", error);
    throw new Error("AI 辨識失敗，請確保照片清晰並包含完整的營養標示表格。");
  }
};

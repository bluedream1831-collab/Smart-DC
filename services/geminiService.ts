
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { InspectionResult } from '../types';

/**
 * 分析食品標籤影像，提取合規資訊
 */
export const analyzeProductImage = async (base64Images: string[]): Promise<InspectionResult> => {
  // 使用環境變數中的 API_KEY 初始化
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `身為台灣食品標籤專家，請從影像提取 JSON。
    規則：
    1. 營養標示：必含八大項數據，並精確提取其標示單位 (kcal, g, mg)。
    2. 過敏原偵測：核對台灣法規強制的11項過敏原（甲殼類、芒果、花生、奶、蛋、堅果、芝麻、麩質穀物、大豆、魚、亞硫酸鹽），回傳發現結果。
    3. 日期：有效與製造日期(YYYY/MM/DD)。
    4. 肉品：豬牛須產地。
    5. 國內/進口：產地歸屬。
    輸出必須為純 JSON，格式必須完整閉合。`;

  const imageParts = base64Images.map(base64 => {
    const parts = base64.split(',');
    const data = parts.length > 1 ? parts[1] : base64;
    return { inlineData: { data: data as string, mimeType: 'image/jpeg' } };
  });

  try {
    // 使用 gemini-3-flash-preview 進行快速提取
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [{ text: "快速提取完整標籤資訊 JSON。" }, ...imageParts]
      },
      config: {
        systemInstruction,
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
                  found: { type: Type.BOOLEAN }
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
                      item: { type: Type.STRING },
                      perServing: { type: Type.STRING },
                      per100g: { type: Type.STRING },
                      unit: { type: Type.STRING }
                    }
                  }
                },
                compliance: {
                  type: Type.OBJECT,
                  properties: {
                    hasBigEight: { type: Type.BOOLEAN },
                    missingItems: { type: Type.ARRAY, items: { type: Type.STRING } },
                    unitErrors: { type: Type.ARRAY, items: { type: Type.STRING } }
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

    // 確保正確獲取 text 屬性
    let jsonText = response.text || "{}";
    jsonText = jsonText.trim();
    
    // 處理可能的 JSON 閉合問題
    if (!jsonText.endsWith('}')) {
      const lastBrace = jsonText.lastIndexOf('}');
      if (lastBrace !== -1) {
        jsonText = jsonText.substring(0, lastBrace + 1);
      }
    }

    const result = JSON.parse(jsonText);
    const reasons: string[] = [];

    // 合規性初步校對
    if (!result.nutrition?.compliance?.hasBigEight) {
      reasons.push("營養標示八大要件不全");
    }
    if (result.hasPorkOrBeef && !result.meatOrigin) {
      reasons.push("肉品成分缺少原產地標示");
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
    if (error.message?.includes('JSON')) {
      throw new Error("數據解析異常：AI 回傳資料格式錯誤，請重新拍攝。");
    }
    throw new Error("辨識異常：請檢查網路連線或影像清晰度。");
  }
};

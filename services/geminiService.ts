
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { InspectionResult } from '../types';

export const analyzeProductImage = async (base64Images: string[]): Promise<InspectionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    請分析這幾張商品標籤圖像，進行專業的食品驗收合規查驗。
    請綜合所有圖片資訊，嚴格遵守台灣食藥署 (TFDA) 食品標示法規：

    1. 基本資訊：識別「商品名稱」。
    2. 製造商資訊：必須提取「製造商/委製商/進口商」的「名稱」、「電話」及「地址」。
    3. 進出口判定（關鍵規則）：
       - 檢查「製造地」、「產地」、「裝箱地」或「組裝地」。
       - 除非明確標示為「臺灣」或「台灣」，否則一律判定為「國外產品 (isDomestic: false)」。
    4. 肉品查驗：若成分包含豬肉、牛肉及其製品，必須識別「肉品原產地」。
    5. 過敏原：檢查是否標示 11 類過敏原（甲殼、芒果、花生、奶、蛋、堅果、芝麻、麩質、大豆、魚、亞硫酸鹽）。
    6. 價格偵測：檢查標籤上是否印有「價格」或「售價」。
    7. 營養標示 (TFDA 八大資訊)：
       - 提取「每一份量」及「本包裝包含份數」。
       - 提取熱量、蛋白質、脂肪、飽和脂肪、反式脂肪、碳水化合物、糖、鈉。
       - 數值請注意法規格式（鈉為整數，其餘可至小數第一位）。

    請以 JSON 格式回傳，且字串內容請使用繁體中文。
  `;

  const imageParts = base64Images.map(base64 => {
    const parts = base64.split(',');
    const data = parts.length > 1 ? parts[1] : base64;
    return { inlineData: { data: data as string, mimeType: 'image/jpeg' } };
  });

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
            priceVisible: { type: Type.BOOLEAN },
            price: { type: Type.STRING },
            allergens: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  found: { type: Type.BOOLEAN }
                },
                required: ["category", "found"]
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
                      per100g: { type: Type.STRING }
                    },
                    required: ["item", "perServing"]
                  }
                }
              },
              required: ["servingSize", "servingsPerPackage", "facts"]
            },
            manufacturer: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                phone: { type: Type.STRING },
                address: { type: Type.STRING }
              },
              required: ["name", "phone", "address"]
            },
            dates: {
              type: Type.OBJECT,
              properties: {
                manufactureDate: { type: Type.STRING },
                expiryDate: { type: Type.STRING },
                totalShelfLifeDays: { type: Type.NUMBER }
              },
              required: ["expiryDate", "totalShelfLifeDays"]
            }
          },
          required: ["productName", "isDomestic", "dates", "allergens", "manufacturer"]
        }
      }
    });

    const text = response.text || '{}';
    const result = JSON.parse(text);
    
    // 合規性邏輯檢查
    const reasons: string[] = [];
    if (result.hasPorkOrBeef && !result.meatOrigin) reasons.push("肉品成分缺少原產地標示");
    if (!result.manufacturer?.name || !result.manufacturer?.phone || !result.manufacturer?.address) {
      reasons.push("製造商資訊缺失 (需含名稱/電話/地址)");
    }
    if (!result.nutrition?.facts || result.nutrition.facts.length < 8) {
      reasons.push("營養標示缺失 (需含完整八大資訊)");
    }
    
    return {
      ...result,
      complianceSummary: {
        isPassed: reasons.length === 0,
        reasons
      }
    };
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

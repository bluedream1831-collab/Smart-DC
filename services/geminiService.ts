
import { GoogleGenAI, Type } from "@google/genai";
import { InspectionResult } from '../types';

export const analyzeProductImage = async (base64Image: string): Promise<InspectionResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    請分析此商品標籤圖像以進行倉庫驗收。
    嚴格遵守以下規則：
    1. 識別 商品名稱。
    2. 檢查是否含 豬肉 (Pork) 或 牛肉 (Beef)。若含肉類，必須找到 產地 (國別)。
    3. 識別 11 類過敏原：甲殼類、芒果、花生、牛奶/羊奶、蛋、堅果類、芝麻、含麩質穀物、大豆、魚類、亞硫酸鹽。
    4. 特別注意：若成分包含「花生油」，必須標記為「花生過敏」。
    5. 提取 製造商名稱、電話、地址。
    6. 判斷是否為「國內產製」(台灣) 或「國外產品」。若組裝或製造地不在台灣，皆視為國外產品。
    7. 檢查是否標示 價格。
    8. 提取 製造日期 (Manufacture Date) 及 有效日期/到期日 (Expiry Date)。
    9. 計算 總保存期限 (天)。若缺製造日期，請從標籤說明估算（例如：有效期間一年 = 365天）。
    
    請以 JSON 格式回傳，且字串內容請使用繁體中文。
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productName: { type: Type.STRING },
          hasPorkOrBeef: { type: Type.BOOLEAN },
          meatOrigin: { type: Type.STRING },
          allergens: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                found: { type: Type.BOOLEAN },
                notes: { type: Type.STRING }
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
          isDomestic: { type: Type.BOOLEAN },
          priceVisible: { type: Type.BOOLEAN },
          price: { type: Type.STRING },
          dates: {
            type: Type.OBJECT,
            properties: {
              manufactureDate: { type: Type.STRING },
              expiryDate: { type: Type.STRING },
              totalShelfLifeDays: { type: Type.NUMBER }
            }
          }
        },
        required: ["productName", "isDomestic", "dates"]
      }
    }
  });

  const result = JSON.parse(response.text || '{}');
  
  // 繁體中文合規性檢查邏輯
  const reasons: string[] = [];
  if (result.hasPorkOrBeef && !result.meatOrigin) reasons.push("肉品成分缺少產地標示");
  if (!result.manufacturer?.name) reasons.push("缺少製造商名稱");
  if (!result.manufacturer?.phone) reasons.push("缺少製造商聯絡電話");
  if (!result.manufacturer?.address) reasons.push("缺少製造商地址");
  if (!result.dates?.expiryDate) reasons.push("無法識別有效日期");

  return {
    ...result,
    complianceSummary: {
      isPassed: reasons.length === 0,
      reasons
    }
  };
};

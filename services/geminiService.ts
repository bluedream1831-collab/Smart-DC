
import { GoogleGenAI, Type } from "@google/genai";
import { InspectionResult } from '../types';

/**
 * 分析產品標籤圖像以進行自動化驗收查驗
 * 使用 Gemini 3 Pro 模型進行複雜的邏輯推理與過敏原辨識
 */
export const analyzeProductImage = async (base64Image: string): Promise<InspectionResult> => {
  // 直接從定義的 process.env 取得金鑰 (Vite define 會在建置時替換它)
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("找不到 API 金鑰，請確認環境變數 API_KEY 已設定。");
  }

  const ai = new GoogleGenAI({ apiKey });
  
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

  // 處理 Base64 數據
  const data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  try {
    const response = await ai.models.generateContent({
      // 商品標籤分析屬於複雜推理任務，使用 gemini-3-pro-preview 模型
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { text: prompt },
          { inlineData: { data, mimeType: 'image/jpeg' } }
        ]
      },
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
                },
                required: ["category", "found"]
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
              },
              required: ["expiryDate", "totalShelfLifeDays"]
            }
          },
          required: ["productName", "isDomestic", "dates", "allergens", "manufacturer"]
        }
      }
    });

    const result = JSON.parse(response.text || '{}');
    
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
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

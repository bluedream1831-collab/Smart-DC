
export enum OriginType {
  DOMESTIC = 'DOMESTIC',
  IMPORTED = 'IMPORTED'
}

export interface AllergenInfo {
  category: string;
  found: boolean;
  reason?: string;
}

export interface NutritionFact {
  item: string;
  perServing: string;
  per100g?: string;
  unit?: string;
  isLegalRequired: boolean;
  found: boolean;
}

export interface InspectionResult {
  productName: string;
  hasPorkOrBeef: boolean;
  meatOrigin?: string;
  allergens: AllergenInfo[];
  nutrition?: {
    servingSize: string;
    servingsPerPackage: string;
    facts: NutritionFact[];
    compliance: {
      hasBigEight: boolean;
      missingItems: string[];
      unitErrors: string[];
      positionScore: number; // 1-5 分，標示位置與清晰度
    };
  };
  manufacturer: {
    name: string;
    phone: string;
    address: string;
  };
  isDomestic: boolean;
  priceVisible: boolean;
  price?: string;
  dates: {
    manufactureDate?: string;
    expiryDate: string;
    totalShelfLifeDays: number;
  };
  complianceSummary: {
    isPassed: boolean;
    reasons: string[];
  };
}

export interface ShelfLifeRule {
  min: number;
  max?: number;
  dc: number;
  store: number;
  dcDisplay: string;
  storeDisplay: string;
  label: string;
  isRelative?: boolean;
}

export interface CalculationResult {
  totalShelfLife: number;
  manufactureDate: Date;
  expiryDate: Date;
  dcAcceptanceDate: Date;
  dcReleaseDate: Date;
  canAccept: boolean;
  canRelease: boolean;
  ruleUsed: string;
  dcFormula: string;
  storeFormula: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  result: InspectionResult;
  calc: CalculationResult;
  images: string[];
}

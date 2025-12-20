
export enum OriginType {
  DOMESTIC = 'DOMESTIC',
  IMPORTED = 'IMPORTED'
}

export interface AllergenInfo {
  category: string;
  found: boolean;
  notes?: string;
}

export interface InspectionResult {
  productName: string;
  hasPorkOrBeef: boolean;
  meatOrigin?: string;
  allergens: AllergenInfo[];
  manufacturer: {
    name: string;
    phone: string;
    address: string;
  };
  isDomestic: boolean;
  priceVisible: boolean;
  price?: string;
  dates: {
    manufactureDate?: string; // YYYY-MM-DD
    expiryDate: string;      // YYYY-MM-DD
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
  label: string;
  isRelative?: boolean;
}

export interface CalculationResult {
  totalShelfLife: number;
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
  image?: string;
}

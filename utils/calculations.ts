
import { DOMESTIC_RULES, IMPORT_RULES } from '../constants';
import { OriginType, CalculationResult, ShelfLifeRule } from '../types';

export const calculateDates = (
  expiryStr: string,
  totalShelfLifeDays: number,
  isDomestic: boolean,
  manufactureDateStr?: string
): CalculationResult => {
  const expiryDate = new Date(expiryStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 計算製造日期 (公式: 有效日 - 保存期限 + 1天)
  const calculatedManufactureDate = new Date(expiryDate);
  calculatedManufactureDate.setDate(expiryDate.getDate() - totalShelfLifeDays + 1);

  const rules: ShelfLifeRule[] = isDomestic ? DOMESTIC_RULES : IMPORT_RULES;
  
  const rule: ShelfLifeRule = rules.find(r => {
    if (r.max !== undefined) {
      return totalShelfLifeDays >= r.min && totalShelfLifeDays < r.max;
    }
    return totalShelfLifeDays >= r.min;
  }) || rules[rules.length - 1];

  let dcLimit = rule.dc;
  let storeLimit = rule.store;

  const dcAcceptanceDate = new Date(expiryDate);
  const dcReleaseDate = new Date(expiryDate);
  
  const formatYMD = (d: Date) => d.toISOString().split('T')[0];
  
  let dcFormula = "";
  let storeFormula = "";

  if (rule.isRelative) {
    // D+N 邏輯 (製造日 + N天)
    const mDate = manufactureDateStr ? new Date(manufactureDateStr) : calculatedManufactureDate;
    dcAcceptanceDate.setTime(mDate.getTime() + (dcLimit * 86400000));
    dcReleaseDate.setTime(mDate.getTime() + (storeLimit * 86400000));
    
    const mStr = formatYMD(mDate);
    dcFormula = `[規則: ${rule.label}] 製造日(${mStr}) + ${rule.dcDisplay} = ${formatYMD(dcAcceptanceDate)}`;
    storeFormula = `[規則: ${rule.label}] 製造日(${mStr}) + ${rule.storeDisplay} = ${formatYMD(dcReleaseDate)}`;
  } else {
    // 標準公式：到期日 - 期限天數 + 1天
    dcAcceptanceDate.setDate(expiryDate.getDate() - dcLimit + 1);
    dcReleaseDate.setDate(expiryDate.getDate() - storeLimit + 1);
    
    dcFormula = `[規則: ${rule.label}] 有效日(${expiryStr}) - ${rule.dcDisplay} + 1天 = ${formatYMD(dcAcceptanceDate)}`;
    storeFormula = `[規則: ${rule.label}] 有效日(${expiryStr}) - ${rule.storeDisplay} + 1天 = ${formatYMD(dcReleaseDate)}`;
  }

  return {
    totalShelfLife: totalShelfLifeDays,
    manufactureDate: calculatedManufactureDate,
    expiryDate: expiryDate,
    dcAcceptanceDate,
    dcReleaseDate,
    canAccept: today <= dcAcceptanceDate,
    canRelease: today <= dcReleaseDate,
    ruleUsed: rule.label,
    dcFormula,
    storeFormula
  };
};

export const parseDate = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

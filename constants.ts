
import { ShelfLifeRule } from './types';

// 效期判定邏輯表 (根據提供之圖片規則)
export const DOMESTIC_RULES: ShelfLifeRule[] = [
  { min: 1080, dc: 750, store: 540, label: '36個月以上' },
  { min: 900, max: 1080, dc: 630, store: 450, label: '30-36個月' },
  { min: 720, max: 900, dc: 510, store: 360, label: '24-30個月' },
  { min: 540, max: 720, dc: 390, store: 270, label: '18-24個月' },
  { min: 450, max: 540, dc: 330, store: 210, label: '15-18個月' },
  { min: 360, max: 450, dc: 270, store: 150, label: '12-15個月' },
  { min: 300, max: 360, dc: 225, store: 135, label: '10-12個月' },
  { min: 270, max: 300, dc: 210, store: 120, label: '9-10個月' },
  { min: 240, max: 270, dc: 180, store: 105, label: '8-9個月' },
  { min: 210, max: 240, dc: 160, store: 90, label: '7-8個月' },
  { min: 180, max: 210, dc: 140, store: 70, label: '6-7個月' },
  { min: 150, max: 180, dc: 120, store: 60, label: '5-6個月' },
  { min: 120, max: 150, dc: 90, store: 45, label: '4-5個月' },
  { min: 90, max: 120, dc: 60, store: 40, label: '3-4個月' },
  { min: 75, max: 90, dc: 50, store: 30, label: '2.5-3個月' },
  { min: 60, max: 75, dc: 45, store: 20, label: '2-2.5個月' },
  { min: 45, max: 60, dc: 35, store: 20, label: '1.5-2個月' },
  { min: 30, max: 45, dc: 25, store: 20, label: '1-1.5個月' },
  { min: 16, max: 30, dc: 4, store: 6, isRelative: true, label: '16-30天' },
  { min: 10, max: 16, dc: 3, store: 4, isRelative: true, label: '10-16天' },
  { min: 6, max: 10, dc: 1, store: 2, isRelative: true, label: '6-10天' },
  { min: 3, max: 6, dc: 1, store: 1.5, isRelative: true, label: '3-6天' },
  { min: 0, max: 3, dc: 0, store: 0, isRelative: true, label: '3天以下' },
];

export const IMPORT_RULES: ShelfLifeRule[] = [
  { min: 1080, dc: 630, store: 540, label: '36個月以上 (進口)' },
  { min: 900, max: 1080, dc: 510, store: 450, label: '30-36個月 (進口)' },
  { min: 720, max: 900, dc: 420, store: 360, label: '24-30個月 (進口)' },
  { min: 540, max: 720, dc: 300, store: 270, label: '18-24個月 (進口)' },
  { min: 450, max: 540, dc: 240, store: 210, label: '15-18個月 (進口)' },
  { min: 360, max: 450, dc: 180, store: 150, label: '12-15個月 (進口)' },
  { min: 300, max: 360, dc: 150, store: 135, label: '10-12個月 (進口)' },
  { min: 270, max: 300, dc: 135, store: 120, label: '9-10個月 (進口)' },
  { min: 240, max: 270, dc: 120, store: 105, label: '8-9個月 (進口)' },
  { min: 210, max: 240, dc: 105, store: 90, label: '7-8個月 (進口)' },
  { min: 180, max: 210, dc: 85, store: 70, label: '6-7個月 (進口)' },
  { min: 150, max: 180, dc: 70, store: 60, label: '5-6個月 (進口)' },
  { min: 120, max: 150, dc: 55, store: 45, label: '4-5個月 (進口)' },
  { min: 90, max: 120, dc: 45, store: 40, label: '3-4個月 (進口)' },
  { min: 75, max: 90, dc: 35, store: 30, label: '2.5-3個月 (進口)' },
  { min: 60, max: 75, dc: 25, store: 20, label: '2-2.5個月 (進口)' },
];

export const ALLERGEN_CATEGORIES = [
  "甲殼類及其製品",
  "芒果及其製品",
  "花生及其製品",
  "牛奶、羊奶及其製品",
  "蛋及其製品",
  "堅果類及其製品",
  "芝麻及其製品",
  "含麩質之穀物及其製品",
  "大豆及其製品",
  "魚類及其製品",
  "亞硫酸鹽類"
];

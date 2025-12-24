
import { ShelfLifeRule } from './types';

// 根據照片：1個月統一以 30 天計算以供程式運行，顯示則照照片文字
export const DOMESTIC_RULES: ShelfLifeRule[] = [
  { min: 1080, dc: 750, store: 540, dcDisplay: "25個月", storeDisplay: "18個月", label: '36個月以上' },
  { min: 900, max: 1080, dc: 630, store: 450, dcDisplay: "21個月", storeDisplay: "15個月", label: '30個月≤T<3年' },
  { min: 720, max: 900, dc: 510, store: 360, dcDisplay: "17個月", storeDisplay: "12個月", label: '24個月≤T<30個月' },
  { min: 540, max: 720, dc: 390, store: 270, dcDisplay: "13個月", storeDisplay: "9個月", label: '18個月≤T<24個月' },
  { min: 450, max: 540, dc: 330, store: 210, dcDisplay: "11個月", storeDisplay: "7個月", label: '15個月≤T<18個月' },
  { min: 360, max: 450, dc: 270, store: 150, dcDisplay: "9個月", storeDisplay: "5個月", label: '12個月≤T<15個月' },
  { min: 300, max: 360, dc: 225, store: 135, dcDisplay: "7.5個月", storeDisplay: "4.5個月", label: '10個月≤T<12個月' },
  { min: 270, max: 300, dc: 210, store: 120, dcDisplay: "7個月", storeDisplay: "4個月", label: '9個月≤T<10個月' },
  { min: 240, max: 270, dc: 180, store: 105, dcDisplay: "6個月", storeDisplay: "105天", label: '8個月≤T<9個月' },
  { min: 210, max: 240, dc: 160, store: 90, dcDisplay: "160天", storeDisplay: "90天", label: '7個月≤T<8個月' },
  { min: 180, max: 210, dc: 140, store: 70, dcDisplay: "140天", storeDisplay: "70天", label: '6個月≤T<7個月' },
  { min: 150, max: 180, dc: 120, store: 60, dcDisplay: "4個月", storeDisplay: "60天", label: '5個月≤T<6個月' },
  { min: 120, max: 150, dc: 90, store: 45, dcDisplay: "3個月", storeDisplay: "45天", label: '4個月≤T<5個月' },
  { min: 90, max: 120, dc: 60, store: 40, dcDisplay: "2個月", storeDisplay: "40天", label: '3個月≤T<4個月' },
  { min: 75, max: 90, dc: 50, store: 30, dcDisplay: "50天", storeDisplay: "30天", label: '2.5個月≤T<3個月' },
  { min: 60, max: 75, dc: 45, store: 20, dcDisplay: "45天", storeDisplay: "20天", label: '2個月≤T<2.5個月' },
  { min: 45, max: 60, dc: 35, store: 20, dcDisplay: "35天", storeDisplay: "20天", label: '1.5個月≤T<2個月' },
  { min: 30, max: 45, dc: 25, store: 20, dcDisplay: "25天", storeDisplay: "20天", label: '1個月≤T<1.5個月' },
  { min: 16, max: 30, dc: 4, store: 6, dcDisplay: "D+4天", storeDisplay: "D+6天", isRelative: true, label: '16天≤T<30天' },
  { min: 10, max: 16, dc: 3, store: 4, dcDisplay: "D+3天", storeDisplay: "D+4天", isRelative: true, label: '10天≤T<16天' },
  { min: 6, max: 10, dc: 1, store: 2, dcDisplay: "D+1天", storeDisplay: "D+2天", isRelative: true, label: '6天≤T<10天' },
  { min: 3, max: 6, dc: 1, store: 1.5, dcDisplay: "D+1天", storeDisplay: "D+1.5天", isRelative: true, label: '3天<T<6天' },
  { min: 0, max: 3, dc: 0, store: 0, dcDisplay: "當天(D)", storeDisplay: "當天(D)", isRelative: true, label: 'T≤3天' },
];

export const IMPORT_RULES: ShelfLifeRule[] = [
  { min: 1080, dc: 630, store: 540, dcDisplay: "21個月", storeDisplay: "18個月", label: '36個月以上' },
  { min: 900, max: 1080, dc: 510, store: 450, dcDisplay: "17個月", storeDisplay: "15個月", label: '30個月≤T<3年' },
  { min: 720, max: 900, dc: 420, store: 360, dcDisplay: "14個月", storeDisplay: "12個月", label: '24個月≤T<30個月' },
  { min: 540, max: 720, dc: 300, store: 270, dcDisplay: "10個月", storeDisplay: "9個月", label: '18個月≤T<24個月' },
  { min: 450, max: 540, dc: 240, store: 210, dcDisplay: "8個月", storeDisplay: "7個月", label: '15個月≤T<18個月' },
  { min: 360, max: 450, dc: 180, store: 150, dcDisplay: "6個月", storeDisplay: "5個月", label: '12個月≤T<15個月' },
  { min: 300, max: 360, dc: 150, store: 135, dcDisplay: "5個月", storeDisplay: "4.5個月", label: '10個月≤T<12個月' },
  { min: 270, max: 300, dc: 135, store: 120, dcDisplay: "4.5個月", storeDisplay: "4個月", label: '9個月≤T<10個月' },
  { min: 240, max: 270, dc: 120, store: 105, dcDisplay: "4個月", storeDisplay: "105天", label: '8個月≤T<9個月' },
  { min: 210, max: 240, dc: 105, store: 90, dcDisplay: "3.5個月", storeDisplay: "90天", label: '7個月≤T<8個月' },
  { min: 180, max: 210, dc: 85, store: 70, dcDisplay: "85天", storeDisplay: "70天", label: '6個月≤T<7個月' },
  { min: 150, max: 180, dc: 70, store: 60, dcDisplay: "70天", storeDisplay: "60天", label: '5個月≤T<6個月' },
  { min: 120, max: 150, dc: 55, store: 45, dcDisplay: "55天", storeDisplay: "45天", label: '4個月≤T<5個月' },
  { min: 90, max: 120, dc: 45, store: 40, dcDisplay: "45天", storeDisplay: "40天", label: '3個月≤T<4個月' },
  { min: 75, max: 90, dc: 35, store: 30, dcDisplay: "35天", storeDisplay: "30天", label: '2.5個月≤T<3個月' },
  { min: 60, max: 75, dc: 25, store: 20, dcDisplay: "25天", storeDisplay: "20天", label: '2個月≤T<2.5個月' },
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

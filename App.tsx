
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeProductImage } from './services/geminiService';
import { calculateDates } from './utils/calculations';
import { InspectionResult, CalculationResult, HistoryEntry } from './types';
import { DOMESTIC_RULES, IMPORT_RULES } from './constants';
import { 
  Camera, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  ShieldCheck, 
  Maximize2, 
  X, 
  Calculator, 
  Search, 
  Trash2, 
  History, 
  Clock, 
  Plus,
  Play,
  Activity,
  BookOpen,
  Globe,
  Home,
  Building2,
  Phone,
  MapPin,
  Tag,
  Truck,
  Store,
  AlertTriangle,
  FileBarChart,
  ClipboardList,
  Info,
  ArrowRight,
  Edit2,
  ChevronRight,
  Filter
} from 'lucide-react';

const STORAGE_KEY = 'inspection_history_v3';

const ANALYSIS_STEPS = [
  "正在上傳至 AI 核心...",
  "辨識商品名稱與產地判定...",
  "精確提取有效日期與過敏原...",
  "掃描製造商與售價標示...",
  "計算 DC 與 門市 雙軌允收期...",
  "生成完整合規報告..."
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'main' | 'history' | 'rules'>('main');
  const [rulesTab, setRulesTab] = useState<'domestic' | 'import' | 'nutrition'>('domestic');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [calc, setCalc] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const [manualExpiryDate, setManualExpiryDate] = useState<string>('');
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPassedOnly, setFilterPassedOnly] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const filteredHistory = useMemo(() => {
    return historyList.filter(item => {
      const matchesSearch = item.result.productName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = !filterPassedOnly || (item.result.complianceSummary.isPassed && item.calc?.canAccept);
      return matchesSearch && matchesFilter;
    });
  }, [historyList, searchTerm, filterPassedOnly]);

  const formatDaysDisplay = (days: number) => {
    if (!days || days === 0) return '0 天';
    if (days < 30) return `${days} 天`;
    const months = days / 30;
    if (days % 30 === 0) return `${months} 個月`;
    if (days % 15 === 0) return `${months.toFixed(1)} 個月`;
    return `${days} 天`;
  };

  useEffect(() => {
    if (result && manualExpiryDate) {
      const newCalc = calculateDates(
        manualExpiryDate,
        result.dates.totalShelfLifeDays,
        result.isDomestic,
        result.dates.manufactureDate
      );
      setCalc(newCalc);
      setResult(prev => prev ? ({
        ...prev,
        dates: { ...prev.dates, expiryDate: manualExpiryDate },
        complianceSummary: {
          ...prev.complianceSummary,
          isPassed: prev.complianceSummary.reasons.filter(r => r !== "無法識別有效日期").length === 0,
          reasons: prev.complianceSummary.reasons.filter(r => r !== "無法識別有效日期")
        }
      }) : null);
    }
  }, [manualExpiryDate]);

  useEffect(() => {
    let interval: any;
    if (loading && loadingStep < ANALYSIS_STEPS.length - 1) {
      interval = setInterval(() => setLoadingStep(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [loading, loadingStep]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hydrated = (parsed as any[]).map((item: any) => ({
          ...item,
          calc: item.calc && item.calc.dcAcceptanceDate ? {
            ...item.calc,
            dcAcceptanceDate: new Date(item.calc.dcAcceptanceDate),
            dcReleaseDate: new Date(item.calc.dcReleaseDate)
          } : null
        }));
        setHistoryList(hydrated);
      } catch (e) { console.error(e); }
    }
  }, []);

  const startCamera = async () => {
    setIsCameraActive(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 } } 
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) { setError('無法啟動相機'); setIsCameraActive(false); }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      setImages(prev => [...prev, canvas.toDataURL('image/jpeg', 0.8)]);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    Array.from(fileList).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => setImages(prev => [...prev, reader.result as string]);
      reader.readAsDataURL(file);
    });
  };

  const startAnalysis = async () => {
    if (images.length === 0) return;
    setLoading(true);
    setLoadingStep(0);
    setError(null);
    try {
      const analysis = await analyzeProductImage(images);
      const expiry = analysis.dates.expiryDate;
      let clc: CalculationResult | null = null;
      if (expiry) clc = calculateDates(expiry, analysis.dates.totalShelfLifeDays, analysis.isDomestic, analysis.dates.manufactureDate);
      
      setResult(analysis);
      setCalc(clc);
      setLoading(false);
      
      const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        result: analysis,
        calc: clc as any,
        images: [...images]
      };
      const updated = [newEntry, ...historyList];
      setHistoryList(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err: any) { setError(err.message || '分析失敗'); setLoading(false); }
  };

  const reset = () => {
    setImages([]); setResult(null); setCalc(null); setError(null);
    setManualExpiryDate(''); stopCamera(); setCurrentView('main');
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = historyList.filter(item => item.id !== id);
    setHistoryList(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const renderResultContent = (res: InspectionResult, clc: CalculationResult | null) => {
    const foundAllergens = res.allergens.filter(a => a.found).map(a => a.category.split('及其')[0]);
    
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-36">
        {/* 主要狀態橫幅 - 縮小高度 */}
        <div className={`mb-4 p-4 rounded-[1.5rem] flex items-center gap-4 shadow-md ${clc ? (res.complianceSummary.isPassed && clc.canAccept ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white') : 'bg-amber-500 text-white shadow-xl'}`}>
          <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shrink-0">
            {!clc ? <AlertTriangle size={28} className="animate-pulse" /> : (res.complianceSummary.isPassed && clc.canAccept ? <CheckCircle size={32} /> : <AlertCircle size={32} />)}
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-black truncate leading-tight">{!clc ? '效期待確認' : (res.complianceSummary.isPassed && clc.canAccept ? '驗收合規' : '拒絕入庫')}</h3>
            <p className="text-white/80 text-[10px] font-bold uppercase tracking-widest mt-0.5">{!clc ? 'Waiting for validation' : (res.complianceSummary.isPassed && clc.canAccept ? 'Passed All Checks' : 'Failed Standards')}</p>
          </div>
        </div>

        {/* AI 智能偵測看板 - 調整為橫向捲動或更緊湊的佈局 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-stone-100 flex flex-col justify-between group">
            <h4 className="font-black text-stone-400 text-[9px] uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div> AI 到期日辨識
            </h4>
            <div className="flex items-center justify-between">
              <p className={`text-2xl font-black tracking-tighter ${res.dates.expiryDate ? 'text-indigo-600' : 'text-stone-300 italic'}`}>
                {res.dates.expiryDate || '未偵測到'}
              </p>
              <div className="bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded text-[8px] font-black uppercase">OCR Verify</div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-stone-100 flex flex-col justify-between group">
            <h4 className="font-black text-stone-400 text-[9px] uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> 過敏原偵測
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {foundAllergens.length > 0 ? (
                foundAllergens.map((alg, i) => (
                  <span key={i} className="bg-rose-50 text-rose-600 px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 border border-rose-100">
                    <AlertTriangle size={10} /> {alg}
                  </span>
                ))
              ) : (
                <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 border border-emerald-100">
                  <CheckCircle size={10} /> 未檢出
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            {/* 雙軌算法 - 緊湊型 */}
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-stone-100">
              <h4 className="font-black text-stone-400 text-[9px] uppercase tracking-widest mb-4 flex items-center gap-2">
                <Calculator size={12} className="text-indigo-500" /> 允收期詳細計算
              </h4>

              {clc ? (
                <div className="space-y-4">
                  <div className="pl-4 border-l-2 border-indigo-500">
                    <span className="text-[9px] font-black text-indigo-400 uppercase mb-1 block">DC 倉儲允收</span>
                    <p className="text-xl font-black text-stone-900">{clc.dcAcceptanceDate.toLocaleDateString('zh-TW')}</p>
                    <p className="text-[10px] text-stone-400 font-mono mt-1 leading-tight">{clc.dcFormula}</p>
                  </div>
                  <div className="pl-4 border-l-2 border-amber-500">
                    <span className="text-[9px] font-black text-amber-400 uppercase mb-1 block">門市 通路允收</span>
                    <p className="text-xl font-black text-stone-900">{clc.dcReleaseDate.toLocaleDateString('zh-TW')}</p>
                    <p className="text-[10px] text-stone-400 font-mono mt-1 leading-tight">{clc.storeFormula}</p>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-stone-300 font-bold italic bg-stone-50 rounded-xl text-sm">請於下方校正日期</div>
              )}
              
              <div className="mt-6 p-4 bg-stone-50 rounded-2xl border border-stone-100">
                <label className="text-[9px] font-black text-stone-400 uppercase mb-2 block flex items-center gap-2">
                  <Edit2 size={10} /> 修正到期日
                </label>
                <input 
                  type="date" 
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-black text-indigo-700 text-sm focus:outline-none" 
                  value={manualExpiryDate} 
                  onChange={(e) => setManualExpiryDate(e.target.value)} 
                />
              </div>
            </div>

            {/* 標籤細節偵測 */}
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-stone-100">
              <h4 className="font-bold text-stone-400 text-[9px] uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info size={12} /> 標籤細節偵測
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-stone-50 rounded-xl">
                  <p className="text-[8px] font-black text-stone-400 uppercase mb-1">產地判定</p>
                  <p className="text-xs font-black text-stone-900">{res.isDomestic ? '台灣' : '國外進口'}</p>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl">
                  <p className="text-[8px] font-black text-stone-400 uppercase mb-1">肉品來源</p>
                  <p className="text-xs font-black text-stone-900 truncate">{res.hasPorkOrBeef ? (res.meatOrigin || '未標示') : '無肉'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 右側：營養標示與製造商 - 使用更緊湊的邊距 */}
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-stone-100">
              <h4 className="font-bold text-stone-400 text-[9px] uppercase tracking-widest mb-4 flex items-center gap-2">
                <FileBarChart size={12} className="text-indigo-500" /> 營養標示 (八大資訊)
              </h4>
              {res.nutrition ? (
                <div className="border-2 border-stone-900 p-4 font-sans text-stone-900 bg-white">
                  <h5 className="text-lg font-black text-center mb-3 tracking-[0.2em]">營 養 標 示</h5>
                  <div className="border-b border-stone-900 pb-2 mb-2 font-bold text-[10px]">
                    <div className="flex justify-between"><span>每一份量</span><span>{res.nutrition.servingSize}</span></div>
                    <div className="flex justify-between"><span>本包裝包含</span><span>{res.nutrition.servingsPerPackage} 份</span></div>
                  </div>
                  <div className="text-[9px] font-bold">
                    <div className="flex border-b border-stone-900 pb-1 mb-2">
                      <div className="flex-1"></div><div className="w-16 text-right">每份</div><div className="w-16 text-right">每100g</div>
                    </div>
                    {res.nutrition.facts.map((f, i) => (
                      <div key={i} className={`flex py-1 border-b border-stone-50 ${['飽和脂肪','反式脂肪','糖'].includes(f.item) ? 'pl-3 text-stone-500' : ''}`}>
                        <div className="flex-1">{f.item}</div><div className="w-16 text-right">{f.perServing}</div><div className="w-16 text-right">{f.per100g || '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : <div className="py-12 text-center text-stone-200 font-black italic bg-stone-50 rounded-xl text-xs">未偵測到營養標示</div>}
            </div>

            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-stone-100">
              <h4 className="font-bold text-stone-400 text-[9px] uppercase tracking-widest mb-4 flex items-center gap-2">
                <Building2 size={12} className="text-indigo-500" /> 製造商資訊
              </h4>
              <div className="space-y-2">
                 <div className="p-3 bg-stone-50 rounded-xl flex items-center gap-3">
                   <Building2 className="text-stone-300" size={16} />
                   <p className="text-xs font-black text-stone-800 truncate">{res.manufacturer.name || '缺失'}</p>
                 </div>
                 <div className="p-3 bg-stone-50 rounded-xl flex items-center gap-3">
                   <Phone className="text-stone-300" size={16} />
                   <p className="text-xs font-black text-stone-800">{res.manufacturer.phone || '缺失'}</p>
                 </div>
                 <div className="p-3 bg-stone-50 rounded-xl flex items-start gap-3">
                   <MapPin className="text-stone-300 mt-0.5" size={16} />
                   <p className="text-[10px] font-bold text-stone-600 leading-tight">{res.manufacturer.address || '缺失'}</p>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* 異常清單 */}
        {res.complianceSummary.reasons.length > 0 && (
          <div className="mt-4 p-5 bg-rose-600 rounded-[1.5rem] text-white shadow-lg">
            <h5 className="font-black flex items-center gap-2 mb-3 text-sm italic">
              <AlertCircle size={18} /> 法規缺失項目
            </h5>
            <div className="space-y-2">
              {res.complianceSummary.reasons.map((r, i) => (
                <div key={i} className="flex items-center gap-3 bg-white/10 p-2.5 rounded-xl border border-white/20">
                  <div className="w-2 h-2 bg-white rounded-full shrink-0"></div>
                  <p className="text-xs font-black">{r}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRulesView = () => (
    <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-40 px-1">
      <h2 className="text-2xl font-black text-stone-900 mb-6 px-2">驗收合規手冊</h2>
      <div className="flex p-1 bg-stone-100 rounded-2xl mb-4 overflow-x-auto scrollbar-hide border border-stone-200">
        <button onClick={() => setRulesTab('domestic')} className={`shrink-0 px-6 py-3 rounded-xl font-black text-xs transition-all ${rulesTab === 'domestic' ? 'bg-white text-indigo-600 shadow-md' : 'text-stone-400'}`}>國內產製</button>
        <button onClick={() => setRulesTab('import')} className={`shrink-0 px-6 py-3 rounded-xl font-black text-xs transition-all ${rulesTab === 'import' ? 'bg-white text-indigo-600 shadow-md' : 'text-stone-400'}`}>國外進口</button>
        <button onClick={() => setRulesTab('nutrition')} className={`shrink-0 px-6 py-3 rounded-xl font-black text-xs transition-all ${rulesTab === 'nutrition' ? 'bg-white text-indigo-600 shadow-md' : 'text-stone-400'}`}>法規規範</button>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-stone-100 p-6">
        {rulesTab === 'nutrition' ? (
          <div className="space-y-8">
            <h3 className="text-lg font-black text-stone-900 border-l-4 border-indigo-600 pl-3">強制標示項目</h3>
            <div className="grid grid-cols-2 gap-2">
              {['熱量', '蛋白質', '脂肪', '飽和脂肪', '反式脂肪', '碳水化合物', '糖', '鈉'].map(i => (
                <div key={i} className="p-3 bg-stone-50 rounded-xl text-center font-black text-stone-600 text-xs border border-stone-100">{i}</div>
              ))}
            </div>
            <div className="p-5 bg-amber-50 rounded-2xl border border-amber-100">
               <h4 className="font-black text-amber-800 flex items-center gap-2 mb-2 text-sm"><Info size={16}/> 判定準則</h4>
               <ul className="text-[10px] font-bold text-amber-700 space-y-2 list-disc pl-5">
                 <li>產地未標示「台灣」即判定為進口。</li>
                 <li>製造商必須含名稱、電話、地址。</li>
               </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-4 px-2 py-2 bg-stone-900 text-white rounded-xl text-[8px] font-black uppercase tracking-widest text-center">
               <div className="col-span-2 text-left pl-2">效期範圍</div>
               <div>DC 允收</div>
               <div>門市 允收</div>
            </div>
            {(rulesTab === 'domestic' ? DOMESTIC_RULES : IMPORT_RULES).map((rule, idx) => (
              <div key={idx} className="grid grid-cols-4 px-2 py-3 border-b border-stone-50 last:border-0 items-center">
                <div className="col-span-2">
                  <p className="font-black text-stone-900 text-xs">{rule.label}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-indigo-600">{formatDaysDisplay(rule.dc)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-amber-600">{formatDaysDisplay(rule.store)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto min-h-screen font-sans text-stone-900 bg-[#FAFAF9] flex flex-col">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-2xl border-b border-stone-100 px-6 py-4 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-xl font-black tracking-tight text-stone-900">Smart-DC <span className="text-indigo-600 text-sm">智能驗收</span></h1>
          <p className="text-[8px] text-stone-400 uppercase tracking-[0.4em] font-black">Warehouse Intelligence</p>
        </div>
        {(images.length > 0 || isCameraActive || currentView !== 'main') && !loading && (
          <button onClick={reset} className="w-10 h-10 flex items-center justify-center bg-stone-100 text-stone-500 rounded-full active:scale-90 transition-transform"><X size={20} /></button>
        )}
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        {currentView === 'rules' ? renderRulesView() : (
          currentView === 'main' ? (
            !result && !isCameraActive ? (
              <div className="space-y-6 pt-2">
                <div className="bg-white rounded-[2.5rem] p-8 text-center space-y-10 shadow-sm border border-stone-100">
                  {images.length > 0 ? (
                    <div className="space-y-8">
                      <div className="flex gap-4 overflow-x-auto pb-4 px-2 snap-x scrollbar-hide">
                        {images.map((img, idx) => (
                          <div key={idx} className="relative shrink-0 snap-center">
                            <img src={img} className="w-32 h-44 object-cover rounded-[1.5rem] border-2 border-white shadow-lg" alt="img" />
                            <button onClick={() => removeImage(idx)} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-2 shadow-xl active:scale-90 transition-transform"><X size={14} /></button>
                          </div>
                        ))}
                        <button onClick={startCamera} className="w-32 h-44 shrink-0 border-2 border-dashed border-stone-200 rounded-[1.5rem] flex flex-col items-center justify-center text-stone-300 transition-all bg-stone-50/50">
                          <Plus size={36} /><span className="text-[9px] font-black mt-3 uppercase tracking-widest">加拍</span>
                        </button>
                      </div>
                      <button onClick={startAnalysis} disabled={loading} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg flex items-center justify-center gap-4 shadow-xl active:scale-[0.98] disabled:opacity-50">
                        {loading ? <Loader2 className="animate-spin" size={24} /> : <Play size={24} fill="currentColor" />}
                        {loading ? '計算中...' : `啟動查驗 (${images.length} 張)`}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative mx-auto w-32 h-32 flex items-center justify-center bg-indigo-50 rounded-[2.5rem] text-indigo-600 shadow-inner">
                        <Maximize2 size={56} />
                      </div>
                      <div className="space-y-3 px-4">
                        <h2 className="text-3xl font-black text-stone-900 tracking-tight">智能標籤驗收</h2>
                        <p className="text-stone-400 font-bold text-sm leading-relaxed">拍攝商品標籤，自動計算 DC 與 門市 雙軌允收期及法規合規性。</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 max-w-xs mx-auto">
                        <button onClick={startCamera} className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-4 shadow-xl active:scale-95 transition-all"><Camera size={28} /> 拍照掃描</button>
                        <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 bg-white text-stone-600 border-2 border-stone-100 rounded-[2rem] font-black text-base flex items-center justify-center gap-3 active:bg-stone-50 transition-all"><Upload size={22} /> 上傳照片</button>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : isCameraActive ? (
              <div className="fixed inset-0 z-50 bg-stone-950 flex flex-col">
                <div className="relative flex-1 overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                    <div className="relative w-full aspect-[4/5] max-w-sm rounded-[2.5rem] border-2 border-white/20 overflow-hidden backdrop-blur-[1px]">
                      <div className="scan-line"></div>
                    </div>
                  </div>
                </div>
                <div className="p-10 pb-20 bg-stone-900/95 flex flex-col items-center gap-10">
                  <div className="flex items-center gap-20">
                    <button onClick={stopCamera} className="text-white/50 text-xs font-black uppercase">Cancel</button>
                    <button onClick={capturePhoto} className="w-24 h-24 rounded-full border-4 border-white/20 flex items-center justify-center active:scale-90 transition-transform">
                      <div className="w-18 h-18 bg-white rounded-full"></div>
                    </button>
                    <div className="w-12"></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 pt-2">
                {loading ? (
                  <div className="bg-white p-12 rounded-[3rem] shadow-xl flex flex-col items-center text-center min-h-[500px] justify-center animate-in zoom-in-95 duration-500">
                    <div className="relative w-40 h-40 mb-12">
                      <div className="absolute inset-0 border-[10px] border-stone-50 rounded-full"></div>
                      <div className="absolute inset-0 border-[10px] border-indigo-500 rounded-full border-t-transparent animate-[spin_1s_linear_infinite]"></div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-indigo-600 font-black text-2xl">
                        {Math.round((loadingStep + 1) / ANALYSIS_STEPS.length * 100)}%
                      </div>
                    </div>
                    <p className="text-xl font-black text-stone-900 mb-2">正在分析標籤...</p>
                    <p className="text-sm text-stone-400 font-bold">{ANALYSIS_STEPS[loadingStep]}</p>
                  </div>
                ) : result ? renderResultContent(result, calc) : null}
              </div>
            )
          ) : (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-40">
              <div className="flex items-center justify-between mb-8 px-2">
                <h2 className="text-2xl font-black text-stone-900 tracking-tight">歷史驗收紀錄</h2>
                <button onClick={() => { if(confirm('清除所有紀錄？')) { setHistoryList([]); localStorage.removeItem(STORAGE_KEY); } }} className="p-3 text-stone-300 hover:text-rose-500"><Trash2 size={24} /></button>
              </div>
              <div className="space-y-4 px-1">
                <div className="relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300" size={20} />
                  <input type="text" placeholder="搜尋..." className="w-full pl-14 pr-6 py-4 bg-white rounded-2xl border-2 border-stone-100 outline-none font-bold text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
              <div className="space-y-4 mt-8">
                {filteredHistory.length > 0 ? filteredHistory.map((item) => (
                  <div key={item.id} onClick={() => { setResult(item.result); setCalc(item.calc); setImages(item.images || []); setCurrentView('main'); }} className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex gap-4 items-center active:bg-stone-50">
                    <div className="w-16 h-20 bg-stone-50 rounded-xl overflow-hidden shrink-0 border border-stone-100 shadow-inner">
                      {item.images?.[0] && <img src={item.images[0]} alt="p" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-stone-900 truncate text-base">{item.result.productName}</h4>
                      <p className="text-[10px] text-stone-300 font-bold mt-1 uppercase tracking-tighter">{new Date(item.timestamp).toLocaleDateString()} • {item.result.isDomestic ? 'Domestic' : 'Import'}</p>
                      <div className={`mt-2 px-3 py-0.5 inline-block rounded-full text-[9px] font-black border ${item.result.complianceSummary.isPassed && item.calc?.canAccept ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                        {item.result.complianceSummary.isPassed && item.calc?.canAccept ? 'Accepted' : 'Rejected'}
                      </div>
                    </div>
                  </div>
                )) : <div className="py-20 text-center text-stone-200 italic font-black">尚無紀錄</div>}
              </div>
            </div>
          )
        )}
      </main>
      
      {!isCameraActive && (
        <nav className="shrink-0 bg-white/95 backdrop-blur-3xl border-t border-stone-100 px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex justify-around shadow-[0_-15px_40px_rgba(0,0,0,0.03)] z-40">
           <button onClick={() => { setCurrentView('main'); reset(); }} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'main' ? 'text-indigo-600' : 'text-stone-300'}`}>
             <Maximize2 size={24} strokeWidth={currentView === 'main' ? 2.5 : 2} />
             <span className="text-[9px] font-black uppercase tracking-widest">驗收</span>
           </button>
           <button onClick={() => setCurrentView('history')} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'history' ? 'text-indigo-600' : 'text-stone-300'}`}>
             <History size={24} strokeWidth={currentView === 'history' ? 2.5 : 2} />
             <span className="text-[9px] font-black uppercase tracking-widest">紀錄庫</span>
           </button>
           <button onClick={() => setCurrentView('rules')} className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${currentView === 'rules' ? 'text-indigo-600' : 'text-stone-300'}`}>
             <BookOpen size={24} strokeWidth={currentView === 'rules' ? 2.5 : 2} />
             <span className="text-[9px] font-black uppercase tracking-widest">手冊</span>
           </button>
        </nav>
      )}
    </div>
  );
};

export default App;

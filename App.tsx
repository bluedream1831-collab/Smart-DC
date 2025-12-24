
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeProductImage } from './services/geminiService';
import { calculateDates } from './utils/calculations';
import { InspectionResult, CalculationResult, HistoryEntry, ShelfLifeRule, NutritionFact } from './types';
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
  AlertTriangle,
  FileBarChart,
  Info,
  Edit2,
  ChevronRight,
  Filter,
  ArrowDownCircle,
  ClipboardCheck,
  Zap,
  Timer
} from 'lucide-react';

const STORAGE_KEY = 'inspection_history_v3';

const ANALYSIS_STEPS = [
  "正在連接 AI 法規核心...",
  "掃描營養標示表格項目...",
  "比對 TFDA 八大要件規格...",
  "核對計量單位與數值邏輯...",
  "計算允收期並生成報告..."
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
    return (historyList || []).filter(item => {
      const productName = item.result?.productName || '';
      const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase());
      const isPassed = item.result?.complianceSummary?.isPassed && item.calc?.canAccept;
      const matchesFilter = !filterPassedOnly || isPassed;
      return matchesSearch && matchesFilter;
    });
  }, [historyList, searchTerm, filterPassedOnly]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    if (result && manualExpiryDate) {
      try {
        const newCalc = calculateDates(
          manualExpiryDate,
          result.dates.totalShelfLifeDays,
          result.isDomestic,
          result.dates.manufactureDate
        );
        setCalc(newCalc);
        setResult(prev => prev ? ({
          ...prev,
          dates: { ...prev.dates, expiryDate: manualExpiryDate }
        }) : null);
      } catch (e) { console.error(e); }
    }
  }, [manualExpiryDate]);

  useEffect(() => {
    let interval: any;
    if (loading && loadingStep < ANALYSIS_STEPS.length - 1) {
      interval = setInterval(() => setLoadingStep(prev => prev + 1), 1500);
    }
    return () => clearInterval(interval);
  }, [loading, loadingStep]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const hydrated = parsed.map((item: any) => ({
            ...item,
            calc: item.calc ? {
              ...item.calc,
              dcAcceptanceDate: new Date(item.calc.dcAcceptanceDate),
              dcReleaseDate: new Date(item.calc.dcReleaseDate)
            } : null
          }));
          setHistoryList(hydrated);
        }
      } catch (e) { localStorage.removeItem(STORAGE_KEY); }
    }
  }, []);

  const startCamera = async () => {
    setIsCameraActive(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) { setError('無法啟動相機：請檢查權限'); setIsCameraActive(false); }
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
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setImages(prev => [...prev, canvas.toDataURL('image/jpeg', 0.8)]);
        stopCamera();
      }
    }
  };

  const startAnalysis = async () => {
    if (images.length === 0) return;
    setLoading(true);
    setLoadingStep(0);
    setError(null);
    setResult(null);
    
    try {
      const analysis = await analyzeProductImage(images);
      const expiry = analysis.dates.expiryDate;
      let clc: CalculationResult | null = null;
      if (expiry) clc = calculateDates(expiry, analysis.dates.totalShelfLifeDays, analysis.isDomestic, analysis.dates.manufactureDate);
      
      setResult(analysis);
      setCalc(clc);
      
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
      setLoading(false);
    } catch (err: any) { 
      console.error(err);
      setError(err.message || 'AI 辨識失敗，請重新拍攝'); 
      setLoading(false); 
    }
  };

  const reset = () => {
    setImages([]); setResult(null); setCalc(null); setError(null);
    setManualExpiryDate(''); stopCamera(); setCurrentView('main');
  };

  const renderRuleTable = (rules: ShelfLifeRule[]) => (
    <div className="overflow-x-auto rounded-2xl border border-stone-100 bg-white shadow-sm">
      <table className="w-full text-left border-collapse">
        <thead className="bg-stone-50 border-b border-stone-100">
          <tr>
            <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-widest">保存天數(含製造日)</th>
            <th className="px-4 py-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest text-center">DC 允收</th>
            <th className="px-4 py-3 text-[10px] font-black text-amber-600 uppercase tracking-widest text-center">門市 允收</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {rules.map((rule, idx) => (
            <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
              <td className="px-4 py-3 font-bold text-stone-700 text-xs">
                {rule.label}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md font-black text-xs min-w-[4rem]">
                  {rule.dcDisplay}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="inline-block px-2 py-1 bg-amber-50 text-amber-700 rounded-md font-black text-xs min-w-[4rem]">
                  {rule.storeDisplay}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const REQUIRED_NUTRIENTS = ["熱量", "蛋白質", "脂肪", "飽和脂肪", "反式脂肪", "碳水化合物", "糖", "鈉"];

  return (
    <div className="max-w-4xl mx-auto min-h-[100dvh] flex flex-col safe-area-pt bg-stone-50">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-stone-100 px-6 py-4 flex justify-between items-center shrink-0">
        <h1 className="text-xl font-black">Smart-DC <span className="text-indigo-600 text-xs">法規驗收系統</span></h1>
        {(images.length > 0 || isCameraActive || currentView !== 'main') && !loading && (
          <button onClick={reset} className="w-10 h-10 flex items-center justify-center bg-stone-50 rounded-full active:scale-90 transition-transform"><X size={20} /></button>
        )}
      </header>

      <main className="flex-1 p-4 overflow-y-auto scrollbar-hide">
        {error && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-xs font-bold flex items-center gap-2 animate-bounce">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {currentView === 'main' ? (
          loading ? (
            <div className="py-20 flex flex-col items-center text-center justify-center">
              <div className="relative mb-10">
                <div className="w-24 h-24 border-8 border-indigo-100 rounded-full"></div>
                <div className="absolute inset-0 w-24 h-24 border-8 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                  <Activity size={32} />
                </div>
              </div>
              <p className="text-2xl font-black text-stone-900 mb-4">{ANALYSIS_STEPS[loadingStep]}</p>
              <p className="text-stone-400 font-bold text-sm">正在進行 TFDA 八大營養要件合規性審查...</p>
            </div>
          ) : result ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-40 space-y-4">
              {/* 總結狀態 */}
              <div className={`p-6 rounded-[2rem] flex flex-col gap-4 shadow-xl ${result.complianceSummary.isPassed && calc?.canAccept ? 'bg-indigo-600 text-white' : 'bg-rose-600 text-white'}`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                    {result.complianceSummary.isPassed && calc?.canAccept ? <CheckCircle size={32} /> : <AlertTriangle size={32} />}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black leading-none">{result.complianceSummary.isPassed && calc?.canAccept ? '符合法規與允收期' : '標示不合規 / 拒收'}</h3>
                    <p className="text-white/70 text-xs font-bold mt-2 truncate">{result.productName}</p>
                  </div>
                </div>
                {result.complianceSummary.reasons.length > 0 && (
                  <div className="bg-black/10 p-4 rounded-xl space-y-1">
                    {result.complianceSummary.reasons.map((r, i) => (
                      <p key={i} className="text-[11px] font-bold flex items-start gap-2">
                        <span className="mt-1 w-1 h-1 bg-white rounded-full shrink-0"></span>
                        {r}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* 辨識到的日期數據區塊 */}
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100">
                <h4 className="text-[10px] font-black text-stone-400 uppercase mb-4 flex items-center gap-2"><Calendar size={14}/> AI 辨識日期原始數據</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <span className="text-[9px] font-black text-indigo-500 uppercase flex items-center gap-1 mb-1">
                      <CheckCircle size={10} /> 有效日期 (辨識)
                    </span>
                    <p className="text-lg font-black text-indigo-700">{result.dates.expiryDate || '未偵測'}</p>
                  </div>
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <span className="text-[9px] font-black text-stone-400 uppercase flex items-center gap-1 mb-1">
                      <Clock size={10} /> 製造日期 (辨識)
                    </span>
                    <p className="text-lg font-black text-stone-700">{result.dates.manufactureDate || '未標示'}</p>
                  </div>
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <span className="text-[9px] font-black text-stone-400 uppercase flex items-center gap-1 mb-1">
                      <Timer size={10} /> 總保存期間
                    </span>
                    <p className="text-lg font-black text-stone-700">{result.dates.totalShelfLifeDays ? `${result.dates.totalShelfLifeDays} 天` : '未辨識'}</p>
                  </div>
                </div>
              </div>

              {/* 營養標示法規檢核卡 */}
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-black text-stone-900 flex items-center gap-2">
                    <ClipboardCheck size={18} className="text-indigo-600" />
                    TFDA 營養標示八大要件檢核
                  </h4>
                  <div className="px-3 py-1 bg-stone-50 rounded-lg text-[10px] font-black text-stone-400 uppercase">
                    位置評分: {result.nutrition?.compliance?.positionScore || 0}/5
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {REQUIRED_NUTRIENTS.map(item => {
                    const foundFact = result.nutrition?.facts.find(f => f.item.includes(item));
                    const isMissing = !foundFact || !foundFact.found;
                    return (
                      <div key={item} className={`p-3 rounded-2xl border flex flex-col gap-1 transition-all ${isMissing ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-stone-50 border-stone-100 text-stone-700'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black">{item}</span>
                          {isMissing ? <X size={12} /> : <CheckCircle size={12} className="text-emerald-500" />}
                        </div>
                        <span className="text-[13px] font-black">{foundFact?.perServing || '--'} <span className="text-[9px] opacity-60">{foundFact?.unit}</span></span>
                      </div>
                    );
                  })}
                </div>
                
                {result.nutrition?.compliance?.unitErrors && result.nutrition.compliance.unitErrors.length > 0 && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-[11px] font-bold text-amber-700">
                    <AlertCircle size={14} /> 單位警告：{result.nutrition.compliance.unitErrors.join(', ')}
                  </div>
                )}
              </div>

              {/* 允收期卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100">
                  <h4 className="text-[10px] font-black text-stone-400 uppercase mb-6 flex items-center gap-2"><Calculator size={14}/> 驗收期試算結果</h4>
                  {calc ? (
                    <div className="space-y-6">
                      <div className="relative pl-6">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-indigo-500 uppercase">DC 允收截止 (D-N)</span>
                        <p className="text-2xl font-black">{calc.dcAcceptanceDate.toLocaleDateString('zh-TW')}</p>
                        <p className="text-[9px] text-stone-400 font-mono mt-1 leading-tight">{calc.dcFormula}</p>
                      </div>
                      <div className="relative pl-6">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 rounded-full"></div>
                        <span className="text-[10px] font-black text-amber-500 uppercase">門市銷售截止</span>
                        <p className="text-2xl font-black">{calc.dcReleaseDate.toLocaleDateString('zh-TW')}</p>
                        <p className="text-[9px] text-stone-400 font-mono mt-1 leading-tight">{calc.storeFormula}</p>
                      </div>
                    </div>
                  ) : <div className="py-10 text-center text-stone-300 italic text-sm">請手動輸入到期日以補全計算</div>}
                  
                  <div className="mt-8 p-5 bg-stone-50 rounded-2xl">
                    <label className="text-[10px] font-black text-stone-400 uppercase mb-2 block">手動修正到期日</label>
                    <input type="date" className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3 font-black text-indigo-700 text-sm focus:ring-2 ring-indigo-500 outline-none" value={manualExpiryDate} onChange={(e) => setManualExpiryDate(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100">
                    <h4 className="text-[10px] font-black text-stone-400 uppercase mb-4 flex items-center gap-2"><Zap size={14}/> 核心標籤資訊</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl">
                        <span className="text-xs font-bold text-stone-400">產地判定</span>
                        <span className="text-xs font-black">{result.isDomestic ? '台灣 (國內品)' : '進口品'}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-stone-50 rounded-xl">
                        <span className="text-xs font-bold text-stone-400">肉品原產地</span>
                        <span className="text-xs font-black">{result.hasPorkOrBeef ? (result.meatOrigin || '未標示') : '不含豬牛'}</span>
                      </div>
                      <div className="p-3 bg-stone-50 rounded-xl">
                        <span className="text-[10px] font-black text-stone-400 block mb-1">製造廠商</span>
                        <p className="text-xs font-black text-stone-800">{result.manufacturer.name || '無法識別'}</p>
                        <p className="text-[10px] font-bold text-stone-400 mt-0.5">{result.manufacturer.phone}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : isCameraActive ? (
            <div className="fixed inset-0 z-50 bg-stone-950 flex flex-col">
              <div className="flex-1 relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                  <div className="w-full aspect-[4/3] max-w-sm rounded-3xl border-2 border-white/50 relative overflow-hidden">
                    <div className="scan-line"></div>
                  </div>
                </div>
                <button onClick={stopCamera} className="absolute top-10 right-6 w-12 h-12 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white"><X size={24}/></button>
              </div>
              <div className="p-12 pb-24 bg-stone-950 flex justify-center">
                <button onClick={capturePhoto} className="w-24 h-24 rounded-full border-8 border-white/20 flex items-center justify-center active:scale-90 transition-transform">
                  <div className="w-16 h-16 bg-white rounded-full shadow-2xl shadow-white/20"></div>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-8 space-y-8 animate-in fade-in duration-700">
              <div className="bg-white rounded-[3rem] p-12 text-center space-y-12 shadow-sm border border-stone-100">
                <div className="relative mx-auto w-32 h-32 flex items-center justify-center bg-indigo-50 rounded-[2.5rem] text-indigo-600 shadow-inner">
                  <Maximize2 size={56} />
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
                    <CheckCircle size={24} />
                  </div>
                </div>
                <div className="space-y-4">
                  <h2 className="text-4xl font-black tracking-tight">智能法規驗收</h2>
                  <p className="text-stone-400 font-bold text-base px-6 leading-relaxed">拍攝標籤照片，AI 將自動對比 TFDA 營養八大要件與 7-11 允收期規則。</p>
                </div>
                <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
                  {images.length > 0 ? (
                    <div className="space-y-6">
                      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide px-2">
                        {images.map((img, i) => (
                          <div key={i} className="relative shrink-0 shadow-lg group">
                            <img src={img} className="w-24 h-32 object-cover rounded-2xl border border-stone-200" />
                            <button onClick={()=>removeImage(i)} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full p-1.5 shadow-md group-active:scale-90"><X size={12}/></button>
                          </div>
                        ))}
                        <button onClick={startCamera} className="w-24 h-32 border-2 border-dashed border-stone-200 rounded-2xl flex items-center justify-center text-stone-300 hover:text-indigo-500 hover:border-indigo-200 transition-all"><Plus/></button>
                      </div>
                      <button onClick={startAnalysis} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all">
                        <Play size={24} fill="currentColor"/> 啟動 AI 法規審查
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={startCamera} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-xl flex items-center justify-center gap-4 shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all"><Camera size={28} /> 拍照掃描標籤</button>
                      <button onClick={() => fileInputRef.current?.click()} className="w-full py-5 bg-white text-stone-600 border-2 border-stone-100 rounded-3xl font-black text-lg flex items-center justify-center gap-3 shadow-sm active:bg-stone-50 transition-all"><Upload size={22} /> 上傳現有照片</button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        ) : currentView === 'history' ? (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-40">
            <div className="flex items-center justify-between mb-8 px-2">
              <h2 className="text-3xl font-black">歷史驗收報告</h2>
              <button onClick={() => { if(confirm('清除所有紀錄？')) { setHistoryList([]); localStorage.removeItem(STORAGE_KEY); } }} className="p-3 text-stone-300 hover:text-rose-500 transition-colors"><Trash2 size={24} /></button>
            </div>
            {filteredHistory.length === 0 ? (
              <div className="py-32 text-center text-stone-300 font-bold italic">尚無歷史報告</div>
            ) : (
              <div className="space-y-4">
                {filteredHistory.map((item) => (
                  <div key={item.id} onClick={() => { setResult(item.result); setCalc(item.calc); setImages(item.images || []); setCurrentView('main'); }} className="bg-white p-5 rounded-[2rem] border border-stone-100 shadow-sm flex gap-5 items-center active:bg-stone-50 transition-all">
                    <div className="w-16 h-20 bg-stone-50 rounded-xl overflow-hidden shrink-0 border border-stone-100">
                      <img src={item.images?.[0]} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-black text-stone-900 truncate text-base">{item.result.productName}</h4>
                      <p className="text-[10px] text-stone-400 font-bold uppercase mt-1">{new Date(item.timestamp).toLocaleString()}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black border ${item.result.complianceSummary.isPassed && item.calc?.canAccept ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                          {item.result.complianceSummary.isPassed && item.calc?.canAccept ? 'PASSED' : 'REJECTED'}
                        </div>
                        {item.result.nutrition?.compliance?.hasBigEight && (
                          <div className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[9px] font-black">法規合規</div>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-stone-300" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-44 px-1">
            <div className="flex items-center gap-4 mb-10">
              <div className="w-16 h-16 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-indigo-100">
                <BookOpen size={32} />
              </div>
              <h2 className="text-3xl font-black">驗收規則手冊</h2>
            </div>

            <div className="flex p-1.5 bg-stone-200/50 rounded-[1.5rem] mb-8 overflow-x-auto border border-stone-200/50 sticky top-0 z-10 backdrop-blur-xl">
              <button onClick={() => setRulesTab('domestic')} className={`flex-1 min-w-[6rem] px-5 py-3 rounded-xl font-black text-xs transition-all ${rulesTab === 'domestic' ? 'bg-white text-indigo-600 shadow-md' : 'text-stone-500'}`}>國內品</button>
              <button onClick={() => setRulesTab('import')} className={`flex-1 min-w-[6rem] px-5 py-3 rounded-xl font-black text-xs transition-all ${rulesTab === 'import' ? 'bg-white text-indigo-600 shadow-md' : 'text-stone-500'}`}>進口品</button>
              <button onClick={() => setRulesTab('nutrition')} className={`flex-1 min-w-[6rem] px-5 py-3 rounded-xl font-black text-xs transition-all ${rulesTab === 'nutrition' ? 'bg-white text-indigo-600 shadow-md' : 'text-stone-500'}`}>法規標示</button>
            </div>

            <div className="space-y-6">
              {rulesTab === 'domestic' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700 text-xs font-bold leading-relaxed">
                    <Info size={20} className="shrink-0" />
                    國內品規則：嚴格對齊 7-11 官方允收表 (21個級距)。
                  </div>
                  {renderRuleTable(DOMESTIC_RULES)}
                </div>
              )}
              
              {rulesTab === 'import' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-700 text-xs font-bold leading-relaxed">
                    <Globe size={20} className="shrink-0" />
                    進口品規則：依照有效日期回推允收天數 (16個級距)。
                  </div>
                  {renderRuleTable(IMPORT_RULES)}
                </div>
              )}

              {rulesTab === 'nutrition' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-[2.5rem] p-8 border border-stone-100 shadow-sm space-y-6">
                    <h3 className="text-xl font-black text-stone-900 flex items-center gap-2"><CheckCircle size={24} className="text-indigo-500"/> 營養標示八大要件</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {REQUIRED_NUTRIENTS.map((item, i) => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl font-black text-sm">
                          <div className="w-6 h-6 bg-white border border-stone-200 rounded-lg flex items-center justify-center text-[11px] text-stone-400">{i+1}</div>
                          {item}
                        </div>
                      ))}
                    </div>
                    <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-2">
                      <p className="text-xs font-black text-rose-700">⚠️ 單位標示要求：</p>
                      <ul className="text-[11px] font-bold text-rose-600/80 list-disc pl-4 space-y-1">
                        <li>熱量：kcal (大卡)</li>
                        <li>鈉：mg (毫克)</li>
                        <li>蛋白質、脂肪、碳水化合物等：g (公克)</li>
                        <li>標示順序與位置應清晰固定</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      
      {!isCameraActive && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-3xl border-t border-stone-100 px-6 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] flex justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-40">
           <button onClick={() => { setCurrentView('main'); reset(); }} className={`flex flex-col items-center gap-2 transition-all ${currentView === 'main' ? 'text-indigo-600 scale-110' : 'text-stone-300'}`}>
             <Maximize2 size={26} strokeWidth={3} />
             <span className="text-[10px] font-black uppercase tracking-widest">驗收</span>
           </button>
           <button onClick={() => setCurrentView('history')} className={`flex flex-col items-center gap-2 transition-all ${currentView === 'history' ? 'text-indigo-600 scale-110' : 'text-stone-300'}`}>
             <History size={26} strokeWidth={3} />
             <span className="text-[10px] font-black uppercase tracking-widest">紀錄</span>
           </button>
           <button onClick={() => setCurrentView('rules')} className={`flex flex-col items-center gap-2 transition-all ${currentView === 'rules' ? 'text-indigo-600 scale-110' : 'text-stone-300'}`}>
             <BookOpen size={26} strokeWidth={3} />
             <span className="text-[10px] font-black uppercase tracking-widest">手冊</span>
           </button>
        </nav>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default App;

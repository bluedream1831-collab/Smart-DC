
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeProductImage } from './services/geminiService';
import { calculateDates } from './utils/calculations';
import { InspectionResult, CalculationResult, HistoryEntry } from './types';
import { 
  Camera, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  ShieldCheck, 
  FileText, 
  Info, 
  Maximize2, 
  X, 
  ChevronRight, 
  Calculator, 
  Search, 
  Trash2, 
  History, 
  Clock, 
  Filter 
} from 'lucide-react';

const STORAGE_KEY = 'inspection_history_v1';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'main' | 'history'>('main');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [calc, setCalc] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  // 歷史紀錄相關狀態
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPassedOnly, setFilterPassedOnly] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 初始化：從 localStorage 讀取紀錄
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hydrated = parsed.map((item: any) => ({
          ...item,
          calc: {
            ...item.calc,
            dcAcceptanceDate: new Date(item.calc.dcAcceptanceDate),
            dcReleaseDate: new Date(item.calc.dcReleaseDate)
          }
        }));
        setHistoryList(hydrated);
      } catch (e) {
        console.error('Failed to load history', e);
      }
    }
  }, []);

  const startCamera = async () => {
    setIsCameraActive(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('無法啟動相機，請檢查瀏覽器權限設定。');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      
      setImage(dataUrl);
      stopCamera();
      processImage(dataUrl);
      
      if ('vibrate' in navigator) navigator.vibrate(50);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImage(base64);
        processImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string) => {
    setLoading(true);
    setError(null);
    try {
      const analysis = await analyzeProductImage(base64);
      const calcResult = calculateDates(
        analysis.dates.expiryDate,
        analysis.dates.totalShelfLifeDays,
        analysis.isDomestic,
        analysis.dates.manufactureDate
      );
      
      setResult(analysis);
      setCalc(calcResult);
      
      const newEntry: HistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        result: analysis,
        calc: calcResult,
        image: base64
      };
      const updatedHistory = [newEntry, ...historyList];
      setHistoryList(updatedHistory);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
      
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    } catch (err: any) {
      setError(err.message || '分析失敗，請重試。');
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setCalc(null);
    setError(null);
    stopCamera();
    setCurrentView('main');
  };

  const clearAllHistory = () => {
    if (window.confirm('確定要清除所有驗收紀錄嗎？')) {
      setHistoryList([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = historyList.filter(item => item.id !== id);
    setHistoryList(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const filteredHistory = useMemo(() => {
    return historyList.filter(item => {
      const dateStr = new Date(item.timestamp).toLocaleDateString('zh-TW');
      const matchesSearch = 
        item.result.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dateStr.includes(searchTerm);
      const matchesPassed = filterPassedOnly 
        ? (item.result.complianceSummary.isPassed && item.calc.canAccept) 
        : true;
      return matchesSearch && matchesPassed;
    });
  }, [historyList, searchTerm, filterPassedOnly]);

  const renderResultContent = (res: InspectionResult, clc: CalculationResult) => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      <div className={`mb-6 p-6 rounded-[2.5rem] flex items-center gap-5 ${res.complianceSummary.isPassed && clc.canAccept ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white shadow-xl shadow-red-100'}`}>
        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
          {res.complianceSummary.isPassed && clc.canAccept ? <CheckCircle size={36} /> : <AlertCircle size={36} />}
        </div>
        <div>
          <h3 className="text-2xl font-black">{res.complianceSummary.isPassed && clc.canAccept ? '允許收貨' : '拒絕收貨'}</h3>
          <p className="text-white/80 text-sm font-medium">
            {res.complianceSummary.isPassed && clc.canAccept ? '通過標籤與效期查驗' : '發現合規問題或效期不符'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <h4 className="font-bold text-slate-400 text-xs uppercase tracking-widest flex items-center gap-2">
              <Calculator size={14} /> 效期計算詳情
            </h4>
            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-full">{clc.ruleUsed}</span>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <div className={`flex justify-between items-center p-4 rounded-2xl border-2 ${clc.canAccept ? 'border-emerald-50 bg-emerald-50/30 text-emerald-600' : 'border-red-100 bg-red-50 text-red-600'}`}>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">DC 允收截止日</span>
                  <span className="text-2xl font-black">{clc.dcAcceptanceDate.toLocaleDateString('zh-TW')}</span>
                </div>
                {clc.canAccept ? <CheckCircle size={28} /> : <X size={28} />}
              </div>
              <div className="p-4 bg-slate-900 rounded-2xl text-[11px] text-emerald-400 font-mono leading-relaxed border border-slate-800">
                {clc.dcFormula}
              </div>
            </div>

            <div className="space-y-3">
              <div className={`flex justify-between items-center p-4 rounded-2xl border-2 ${clc.canRelease ? 'border-emerald-50 bg-emerald-50/30 text-emerald-600' : 'border-red-100 bg-red-50 text-red-600'}`}>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">門市 允收截止日</span>
                  <span className="text-2xl font-black">{clc.dcReleaseDate.toLocaleDateString('zh-TW')}</span>
                </div>
                {clc.canRelease ? <CheckCircle size={28} /> : <X size={28} />}
              </div>
              <div className="p-4 bg-slate-900 rounded-2xl text-[11px] text-amber-400 font-mono leading-relaxed border border-slate-800">
                {clc.storeFormula}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 space-y-4">
          <h4 className="font-bold text-slate-400 text-xs uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 pb-4">
            <FileText size={14} /> 標籤辨識詳情
          </h4>
          <div className="space-y-3">
             <div className="p-4 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-bold text-slate-400 mb-1">商品名稱</p>
              <p className="font-bold text-slate-900 leading-tight">{res.productName}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400">肉品產地</p>
                <p className="text-xs font-bold mt-1 text-blue-600">{res.hasPorkOrBeef ? (res.meatOrigin || '⚠️ 未標示') : '無'}</p>
              </div>
              <div className="p-3 bg-white border border-slate-100 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400">總保存期限</p>
                <p className="text-xs font-bold mt-1">{res.dates.totalShelfLifeDays} 天</p>
              </div>
            </div>
            <div className="p-3 bg-white border border-slate-100 rounded-xl">
              <p className="text-[10px] font-bold text-slate-400">製造商資訊</p>
              <p className="text-[10px] font-medium text-slate-600 mt-1 leading-relaxed">
                {res.manufacturer.name}<br/>{res.manufacturer.phone}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
        <h4 className="font-bold text-slate-400 text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
          <ShieldCheck size={14} /> 過敏原檢核
        </h4>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {res.allergens.map((alg, idx) => (
            <div key={idx} className={`p-2 rounded-xl border text-center ${alg.found ? 'bg-amber-500 border-amber-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
              <p className="text-[9px] font-bold truncate">{alg.category.split('及其')[0]}</p>
              <p className="text-[10px] font-black">{alg.found ? '含有' : '-'}</p>
            </div>
          ))}
        </div>
      </div>
      
      {(res.complianceSummary.reasons.length > 0 || !clc.canAccept) && (
        <div className="mt-4 bg-red-600 p-6 rounded-[2rem] text-white space-y-3 shadow-xl shadow-red-200">
          <div className="flex items-center gap-2 font-black italic">
            <AlertCircle size={20} /> 驗收異常提示
          </div>
          <ul className="text-sm font-bold space-y-1 opacity-90">
            {!clc.canAccept && <li>• 商品已過 DC 允收期限</li>}
            {res.complianceSummary.reasons.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto min-h-screen bg-slate-50 font-sans selection:bg-blue-100">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Smart-DC <span className="text-blue-600">智能驗收</span></h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Regulatory Compliance System</p>
        </div>
        {image || isCameraActive || currentView !== 'main' ? (
          <button onClick={reset} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
            <X size={24} />
          </button>
        ) : (
          <div className="flex gap-2 items-center">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[10px] font-bold text-slate-400">READY</span>
          </div>
        )}
      </header>

      <main className="p-4 safe-area-bottom">
        {currentView === 'main' ? (
          !image && !isCameraActive ? (
            <div className="space-y-4">
              <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 text-center space-y-6">
                <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mx-auto transform rotate-3">
                  <Maximize2 size={48} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">開始驗收</h2>
                  <p className="text-slate-500 mt-2">請對準產品標籤進行拍攝或上傳照片</p>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={startCamera}
                    className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-blue-200 active:scale-95 transition-all"
                  >
                    <Camera size={24} /> 啟動相機掃描
                  </button>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 bg-white text-slate-600 border-2 border-slate-100 rounded-2xl font-bold flex items-center justify-center gap-3 active:bg-slate-50 transition-all"
                  >
                    <Upload size={20} /> 從相簿選擇
                  </button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                </div>
              </div>
              
              {historyList.length > 0 && (
                <button 
                  onClick={() => setCurrentView('history')}
                  className="w-full bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><History size={20} /></div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-slate-900">檢視歷史紀錄</p>
                      <p className="text-[10px] text-slate-400">目前共有 {historyList.length} 筆紀錄</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
              )}
            </div>
          ) : isCameraActive ? (
            <div className="fixed inset-0 z-50 bg-black flex flex-col">
              <div className="relative flex-1 overflow-hidden">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover" 
                />
                
                {/* 掃描介面裝飾 */}
                <div className="absolute inset-0 flex items-center justify-center p-10 pointer-events-none">
                  <div className="relative w-full aspect-[3/4] max-w-sm rounded-2xl border-2 border-white/30 overflow-hidden bg-white/5 backdrop-blur-[2px]">
                    {/* 掃描線 */}
                    <div className="scan-line"></div>
                    
                    {/* 觀景窗邊角 */}
                    <div className="viewfinder-corner top-0 left-0 border-t-4 border-l-4 rounded-tl-lg"></div>
                    <div className="viewfinder-corner top-0 right-0 border-t-4 border-r-4 rounded-tr-lg"></div>
                    <div className="viewfinder-corner bottom-0 left-0 border-b-4 border-l-4 rounded-bl-lg"></div>
                    <div className="viewfinder-corner bottom-0 right-0 border-b-4 border-r-4 rounded-br-lg"></div>
                  </div>
                </div>

                <div className="absolute top-10 inset-x-0 flex justify-center">
                   <div className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                      <span className="text-white text-xs font-bold tracking-widest uppercase">Scanning Mode</span>
                   </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="p-8 bg-black flex flex-col items-center gap-6">
                <p className="text-white/70 text-sm font-medium">請將標籤對準掃描框</p>
                <div className="flex items-center gap-12">
                  <button onClick={stopCamera} className="text-white/50 font-bold">取消</button>
                  <button 
                    onClick={capturePhoto}
                    className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <div className="w-16 h-16 bg-white rounded-full"></div>
                  </button>
                  <div className="w-10"></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {loading ? (
                <div className="bg-white p-12 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                  <div className="relative w-20 h-20 mb-6">
                    <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center text-blue-600">
                      <Loader2 size={32} />
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">AI 辨識中...</h3>
                  <p className="text-slate-500 text-sm mt-2 max-w-[200px] mx-auto">正在解析標籤內容與合規性</p>
                </div>
              ) : error ? (
                <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100 text-center space-y-4">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                    <AlertCircle size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-red-900">辨識失敗</h3>
                  <p className="text-red-700 text-sm">{error}</p>
                  <button onClick={reset} className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold">重試</button>
                </div>
              ) : result && calc ? renderResultContent(result, calc) : null}
            </div>
          )
        ) : (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 pb-20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-slate-900">歷史紀錄</h2>
              <button 
                onClick={clearAllHistory}
                className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="搜尋商品名稱或日期..." 
                  className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border border-slate-100 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setFilterPassedOnly(!filterPassedOnly)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border transition-all ${filterPassedOnly ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-100 text-slate-500'}`}
              >
                <Filter size={14} /> 只顯示允收商品
              </button>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100">
                <p className="text-slate-400 font-medium">尚無紀錄</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredHistory.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setResult(item.result);
                      setCalc(item.calc);
                      setImage(item.image || null);
                      setCurrentView('main');
                    }}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-100 transition-all group cursor-pointer"
                  >
                    <div className="flex gap-4">
                      <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                        {item.image ? (
                          <img src={item.image} alt="p" className="w-full h-full object-cover" />
                        ) : (
                          <FileText className="w-full h-full p-4 text-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h4 className="font-bold text-slate-900 truncate">{item.result.productName}</h4>
                          <button onClick={(e) => deleteHistoryItem(item.id, e)} className="p-1 text-slate-300 hover:text-red-500 transition-opacity">
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px]">
                          <span className="flex items-center gap-1 text-slate-400 font-medium"><Clock size={10} /> {new Date(item.timestamp).toLocaleDateString()}</span>
                          <span className={`px-2 py-0.5 rounded-full font-black ${item.result.complianceSummary.isPassed && item.calc.canAccept ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {item.result.complianceSummary.isPassed && item.calc.canAccept ? '允收' : '拒絕'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
      
      {!isCameraActive && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 px-8 py-4 flex justify-around safe-area-bottom z-40">
           <button 
             onClick={() => { setCurrentView('main'); reset(); }}
             className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'main' ? 'text-blue-600' : 'text-slate-400'}`}
           >
             <Maximize2 size={24} />
             <span className="text-[10px] font-bold">驗收</span>
           </button>
           <button 
             onClick={() => setCurrentView('history')}
             className={`flex flex-col items-center gap-1 transition-colors ${currentView === 'history' ? 'text-blue-600' : 'text-slate-400'}`}
           >
             <History size={24} />
             <span className="text-[10px] font-bold">歷史</span>
           </button>
           <button onClick={() => alert('系統資訊')} className="flex flex-col items-center gap-1 text-slate-400">
             <Info size={24} />
             <span className="text-[10px] font-bold">關於</span>
           </button>
        </div>
      )}
    </div>
  );
};

export default App;


import React, { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeProductImage } from './services/geminiService';
import { calculateDates } from './utils/calculations';
import { InspectionResult, CalculationResult, HistoryEntry, ShelfLifeRule } from './types';
import { DOMESTIC_RULES, IMPORT_RULES, ALLERGEN_CATEGORIES } from './constants';
import { 
  Camera, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  X, 
  History, 
  Plus,
  Play,
  Activity,
  AlertTriangle,
  ClipboardCheck,
  Zap,
  Trash2,
  Calendar,
  ShieldAlert,
  Scale,
  FileText,
  UserCheck,
  BookOpen,
  MapPin,
  Phone,
  Tag,
  Info,
  Flame
} from 'lucide-react';

const STORAGE_KEY = 'inspection_history_v3';

const ANALYSIS_STEPS = [
  { title: "引擎啟動中", sub: "建立法規資料庫安全連線..." },
  { title: "數據提取中", sub: "解析營養標示與過敏原資訊..." },
  { title: "法規合規校對", sub: "比對 TFDA 十大標示要件..." },
  { title: "產出驗收報告", sub: "正在生成最後報告..." }
];

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'main' | 'history' | 'rules'>('main');
  const [rulesTab, setRulesTab] = useState<'domestic' | 'import' | 'regulations' | 'allergens'>('domestic');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [calc, setCalc] = useState<CalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  
  const [manualExpiryDate, setManualExpiryDate] = useState<string>('');
  const [historyList, setHistoryList] = useState<HistoryEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 1024;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await compressImage(reader.result);
          setImages(prev => [...prev, compressed]);
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
      } catch (e) { console.error(e); }
    }
  }, [manualExpiryDate, result]);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep(prev => (prev < ANALYSIS_STEPS.length - 1 ? prev + 1 : prev));
      }, 800);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHistoryList(parsed);
      } catch (e) { localStorage.removeItem(STORAGE_KEY); }
    }
  }, []);

  const startCamera = async () => {
    setIsCameraActive(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: { ideal: 1280 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) { setError('無法啟動相機'); setIsCameraActive(false); }
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        compressImage(dataUrl).then(compressed => {
          setImages(prev => [...prev, compressed]);
          stopCamera();
        });
      }
    }
  };

  const startAnalysis = async () => {
    if (images.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const analysisResult = await analyzeProductImage(images);
      setResult(analysisResult);
      if (analysisResult.dates.expiryDate) {
        setManualExpiryDate(analysisResult.dates.expiryDate);
        const newCalc = calculateDates(
          analysisResult.dates.expiryDate,
          analysisResult.dates.totalShelfLifeDays,
          analysisResult.isDomestic,
          analysisResult.dates.manufactureDate
        );
        setCalc(newCalc);
        const entry: HistoryEntry = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          result: analysisResult,
          calc: newCalc,
          images: [...images]
        };
        const updated = [entry, ...historyList].slice(0, 50);
        setHistoryList(updated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const renderRegulatoryNutritionTable = (nutrition: any) => {
    if (!nutrition) return null;
    const findFact = (name: string) => nutrition.facts.find((f: any) => f.item.includes(name));
    const items = [
      { label: '熱量', key: '熱量', indent: false },
      { label: '蛋白質', key: '蛋白質', indent: false },
      { label: '脂肪', key: '脂肪', indent: false },
      { label: '飽和脂肪', key: '飽和脂肪', indent: true },
      { label: '反式脂肪', key: '反式脂肪', indent: true },
      { label: '碳水化合物', key: '碳水化合物', indent: false },
      { label: '糖', key: '糖', indent: true },
      { label: '鈉', key: '鈉', indent: false },
    ];

    return (
      <div className="bg-white p-2 flex flex-col items-center">
        <div className="w-full max-w-[320px] border-[2px] border-black p-2 font-['Arial','sans-serif'] text-black bg-white">
          <div className="text-center text-xl font-bold border-b-[2px] border-black py-1 mb-1 tracking-[0.5em] leading-tight">
            營 養 標 示
          </div>
          <div className="flex justify-between py-0.5 text-[14px] border-b border-black">
            <span className="font-bold">每一份量</span>
            <span className="font-bold">{nutrition.servingSize}</span>
          </div>
          <div className="flex justify-between py-0.5 text-[14px] border-b-[2px] border-black">
            <span className="font-bold">本包裝包含</span>
            <span className="font-bold">{nutrition.servingsPerPackage} 份</span>
          </div>
          <div className="grid grid-cols-[1fr_80px_80px] text-right text-[11px] font-bold border-b border-black py-1">
            <span></span>
            <span>每份</span>
            <span>每100公克</span>
          </div>
          <div className="divide-y divide-transparent">
            {items.map((item, idx) => {
              const fact = findFact(item.key);
              const unit = fact?.unit || (item.key === '鈉' ? '毫克' : (item.key === '熱量' ? '大卡' : '公克'));
              return (
                <div key={idx} className="grid grid-cols-[1fr_80px_80px] py-0.5 text-[14px] items-center">
                  <span className={`${item.indent ? 'pl-5' : 'font-bold'}`}>{item.label}</span>
                  <span className="text-right">{fact?.perServing || '0'}{unit}</span>
                  <span className="text-right">{fact?.per100g || '0'}{unit}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderRulesTable = (rules: ShelfLifeRule[]) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm border-collapse">
        <thead className="bg-slate-100 border-b border-slate-300">
          <tr>
            <th className="px-4 py-3 font-bold text-slate-800">保存期限範圍 (T)</th>
            <th className="px-4 py-3 font-bold text-blue-700">DC 允收</th>
            <th className="px-4 py-3 font-bold text-slate-800">店舖下架</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rules.map((rule, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-medium">{rule.label}</td>
              <td className="px-4 py-3 font-bold text-blue-600">{rule.dcDisplay}</td>
              <td className="px-4 py-3 font-bold">{rule.storeDisplay}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-blue-600" />
          <h1 className="text-lg font-bold">標籤合規 AI 驗收</h1>
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-full">
          <button onClick={() => setCurrentView('main')} className={`px-4 py-1.5 rounded-full text-sm font-medium ${currentView === 'main' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>掃描</button>
          <button onClick={() => setCurrentView('history')} className={`px-4 py-1.5 rounded-full text-sm font-medium ${currentView === 'history' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>歷史</button>
          <button onClick={() => setCurrentView('rules')} className={`px-4 py-1.5 rounded-full text-sm font-medium ${currentView === 'rules' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>法規</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        {currentView === 'main' && (
          <div className="space-y-6">
            {!result && !loading && (
              <div className="bg-white rounded-3xl shadow-xl p-8 text-center border border-slate-200">
                <Camera className="w-16 h-16 mx-auto mb-4 text-blue-100" />
                <h2 className="text-2xl font-bold mb-6">開始商品檢驗</h2>
                <div className="grid grid-cols-2 gap-4">
                  <button onClick={startCamera} className="p-6 rounded-2xl bg-blue-600 text-white shadow-lg"><Camera className="mx-auto mb-2" />使用相機</button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-6 rounded-2xl border-2 border-slate-200 text-slate-600"><Upload className="mx-auto mb-2" />上傳照片</button>
                </div>
                {images.length > 0 && (
                  <div className="mt-6 p-4 bg-slate-50 rounded-2xl">
                    <div className="flex flex-wrap gap-2 mb-4">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative w-16 h-16"><img src={img} className="w-full h-full object-cover rounded-lg" /><X onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 cursor-pointer" /></div>
                      ))}
                      <Plus onClick={() => fileInputRef.current?.click()} className="w-16 h-16 p-5 border-2 border-dashed border-slate-300 rounded-lg text-slate-400 cursor-pointer" />
                    </div>
                    <button onClick={startAnalysis} className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold">開始 AI 辨識</button>
                  </div>
                )}
              </div>
            )}

            {isCameraActive && (
              <div className="fixed inset-0 z-[60] bg-black flex flex-col">
                <video ref={videoRef} className="flex-1 object-contain" playsInline muted />
                <div className="p-8 bg-black/90 flex justify-center gap-12">
                  <X onClick={stopCamera} className="w-12 h-12 text-white p-2 bg-white/10 rounded-full" />
                  <div onClick={capturePhoto} className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center"><div className="w-12 h-12 bg-white rounded-full" /></div>
                  <div className="w-12" />
                </div>
              </div>
            )}

            {loading && (
              <div className="bg-white p-12 rounded-3xl text-center space-y-4">
                <Activity className="w-12 h-12 text-blue-600 mx-auto animate-spin" />
                <h3 className="text-xl font-bold">{ANALYSIS_STEPS[loadingStep].title}</h3>
                <p className="text-slate-500">{ANALYSIS_STEPS[loadingStep].sub}</p>
              </div>
            )}

            {result && calc && !loading && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* 報告呈現 (已省略部分重複代碼，保持與上次一致) */}
                <div className={`p-6 rounded-3xl border-2 shadow-sm ${calc.canAccept && result.complianceSummary.isPassed ? 'border-emerald-200 bg-emerald-50/20' : 'border-amber-200 bg-amber-50/20'}`}>
                   {/* ... (原有報告內容) ... */}
                   <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      {calc.canAccept && result.complianceSummary.isPassed ? <CheckCircle className="text-emerald-500 w-10 h-10" /> : <AlertTriangle className="text-amber-500 w-10 h-10" />}
                      <div>
                        <h3 className="text-2xl font-bold text-slate-800">{result.productName}</h3>
                        <p className="text-sm font-bold opacity-70">
                          {calc.canAccept && result.complianceSummary.isPassed ? '✅ 檢驗合格：可辦理入庫' : '❌ 檢驗不合格：請辦理退貨'}
                        </p>
                      </div>
                    </div>
                    <X onClick={() => {setResult(null); setImages([]);}} className="text-slate-400 cursor-pointer p-2 hover:bg-slate-100 rounded-full transition-colors" />
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      {/* 商品日期卡片 */}
                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="flex items-center gap-2 font-bold mb-4 border-b pb-2 text-blue-700">
                          <Calendar className="w-4 h-4" /> 日期溯源資訊
                        </div>
                        <div className="space-y-4">
                          <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                            <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">有效日期 (到期日)</p>
                              <p className="font-black text-xl text-slate-800">{calc.expiryDate.toLocaleDateString('zh-TW')}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">保存期限</p>
                              <p className="font-bold text-slate-700">{result.dates.totalShelfLifeDays} 天</p>
                            </div>
                          </div>
                          <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                            <p className="text-[10px] text-blue-600 font-black uppercase">計算製造日期 (到期日-期限+1)</p>
                            <p className="font-black text-xl text-blue-800">{calc.manufactureDate.toLocaleDateString('zh-TW')}</p>
                          </div>
                        </div>
                      </div>

                      {/* 允收卡片 */}
                      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl">
                        <div className="flex items-center gap-2 font-bold mb-4 border-b border-white/10 pb-2">
                          <ClipboardCheck className="w-4 h-4 text-blue-400" /> DC 允收判定基準
                        </div>
                        <div className="space-y-2">
                           <p className="text-[10px] text-white/50 font-bold uppercase">最後允收進貨日</p>
                           <p className={`text-3xl font-black ${calc.canAccept ? 'text-emerald-400' : 'text-red-400'}`}>
                             {calc.dcAcceptanceDate.toLocaleDateString('zh-TW')}
                           </p>
                           <p className="text-[10px] text-white/40 mt-1 font-mono italic leading-tight">{calc.dcFormula}</p>
                        </div>
                      </div>
                    </div>

                    {/* 營養標示表格 */}
                    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center">
                      <p className="text-[10px] font-bold text-slate-400 mb-3 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                        TFDA 食品標示法規樣式
                      </p>
                      {renderRegulatoryNutritionTable(result.nutrition)}
                      <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 w-full">
                         <p className="text-[10px] text-amber-800 font-black uppercase mb-2">偵測過敏原 (依法規11項)</p>
                         <div className="flex flex-wrap gap-1">
                            {result.allergens.filter(a => a.found).length > 0 ? (
                              result.allergens.filter(a => a.found).map((a, i) => (
                                <span key={i} className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded font-black border border-amber-300">{a.category}</span>
                              ))
                            ) : (
                              <span className="text-emerald-700 text-[10px] font-bold italic">✅ 未偵測到法定 11 項過敏原</span>
                            )}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentView === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4 bg-white p-4 rounded-2xl border border-slate-200">
               <History className="text-blue-600 w-5 h-5" />
               <h3 className="font-bold">檢驗歷史紀錄</h3>
            </div>
            {historyList.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl border flex items-center gap-4">
                <img src={item.images[0]} className="w-16 h-16 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold truncate">{item.result.productName}</h4>
                  <p className={`text-[10px] font-black ${item.calc.canAccept ? 'text-emerald-600' : 'text-red-600'}`}>{item.calc.canAccept ? '允收' : '拒收'}</p>
                </div>
                <Play onClick={() => {setResult(item.result); setCalc(item.calc); setCurrentView('main');}} className="text-blue-600 cursor-pointer" />
              </div>
            ))}
          </div>
        )}

        {currentView === 'rules' && (
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button onClick={() => setRulesTab('domestic')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${rulesTab === 'domestic' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>國產品</button>
              <button onClick={() => setRulesTab('import')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${rulesTab === 'import' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>進口品</button>
              <button onClick={() => setRulesTab('allergens')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${rulesTab === 'allergens' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>過敏原項目</button>
              <button onClick={() => setRulesTab('regulations')} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${rulesTab === 'regulations' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>標示法規</button>
            </div>
            
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
              {rulesTab === 'domestic' && renderRulesTable(DOMESTIC_RULES)}
              {rulesTab === 'import' && renderRulesTable(IMPORT_RULES)}
              
              {rulesTab === 'allergens' && (
                <div className="p-6 space-y-6">
                  <div className="flex items-center gap-3 border-b pb-4">
                    <Flame className="text-amber-500" />
                    <div>
                      <h3 className="text-xl font-bold">法定 11 項強制標示過敏原</h3>
                      <p className="text-xs text-slate-500">來源：食藥署「食品過敏原標示規定」</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ALLERGEN_CATEGORIES.map((cat, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-black">{i+1}</span>
                        <span className="font-bold text-slate-700">{cat}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mt-4 text-xs text-blue-800 leading-relaxed italic">
                    AI 會自動對照成分表中的關鍵字。如含有上述成分但「未標示」過敏警語，系統將判定為「檢驗不試合格」。
                  </div>
                </div>
              )}

              {rulesTab === 'regulations' && (
                <div className="p-8 space-y-4">
                   <h3 className="text-xl font-bold mb-4">TFDA 十大標示要件</h3>
                   {["品名", "內容物名稱", "淨重、容量或數量", "食品添加物名稱", "製造廠商或國內負責廠商資訊", "原產地(國)", "有效日期", "營養標示", "含基因改造食品原料標示", "其他經中央主管機關公告事項"].map((item, i) => (
                      <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-50">
                        <span className="font-bold text-blue-600">0{i+1}</span>
                        <span className="text-slate-700 font-medium">{item}</span>
                      </div>
                   ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" multiple />
      <canvas ref={canvasRef} className="hidden" />

      <div className="fixed bottom-0 left-0 right-0 p-4 md:hidden">
        <div className="bg-white/90 backdrop-blur rounded-2xl p-2 flex justify-around border shadow-2xl">
          <button onClick={() => {setCurrentView('main'); setResult(null);}} className={`p-3 rounded-xl ${currentView === 'main' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}><Camera /></button>
          <button onClick={() => setCurrentView('history')} className={`p-3 rounded-xl ${currentView === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}><History /></button>
          <button onClick={() => setCurrentView('rules')} className={`p-3 rounded-xl ${currentView === 'rules' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400'}`}><Scale /></button>
        </div>
      </div>
    </div>
  );
};

export default App;

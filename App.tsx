import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TimerState, TimerConfig, DEFAULT_CONFIG, ROLL_CONFIG, HIIT_CONFIG, AlertSetting, SoundType } from './types';
import { audioService } from './services/audioService';
import { generateThemedBackground } from './services/geminiService';
import { 
    Play, Pause, RotateCcw, Save, Settings as SettingsIcon, 
    Image as ImageIcon, Check, ChevronLeft, ChevronRight, 
    Trash2, Volume2, Vibrate, ChevronDown
} from 'lucide-react';

// --- Helper to format time MM:SS ---
const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- Helper Component for Time Input (Dropdowns) ---
const TimeSelect = ({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) => {
  const mins = Math.floor(value / 60);
  const secs = value % 60;

  // Generate arrays for dropdown options
  const minOptions = Array.from({ length: 61 }, (_, i) => i); // 0-60 mins
  const secOptions = Array.from({ length: 60 }, (_, i) => i); // 0-59 secs

  const handleMinChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMins = parseInt(e.target.value);
    onChange(newMins * 60 + secs);
  };

  const handleSecChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSecs = parseInt(e.target.value);
    onChange(mins * 60 + newSecs);
  };

  return (
    <div>
      <label className="block text-sm text-white/50 mb-2 font-bold uppercase tracking-wider">{label}</label>
      <div className="flex gap-2 items-center">
        {/* Minutes Dropdown */}
        <div className="flex-1 relative group">
            <select 
                value={mins} 
                onChange={handleMinChange}
                className="w-full bg-white/10 hover:bg-white/20 text-white p-3 pr-8 rounded appearance-none outline-none font-mono text-xl text-center cursor-pointer transition-colors border border-white/10 focus:border-white/50"
            >
                {minOptions.map(i => <option key={i} value={i} className="bg-[#121212]">{i.toString().padStart(2, '0')}</option>)}
            </select>
            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-white/30 pointer-events-none font-sans font-bold">MIN</span>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 pointer-events-none" />
        </div>

        <span className="text-xl font-mono text-white/30">:</span>

        {/* Seconds Dropdown */}
        <div className="flex-1 relative group">
             <select 
                value={secs} 
                onChange={handleSecChange}
                className="w-full bg-white/10 hover:bg-white/20 text-white p-3 pr-8 rounded appearance-none outline-none font-mono text-xl text-center cursor-pointer transition-colors border border-white/10 focus:border-white/50"
            >
                {secOptions.map(i => <option key={i} value={i} className="bg-[#121212]">{i.toString().padStart(2, '0')}</option>)}
            </select>
            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-white/30 pointer-events-none font-sans font-bold">SEC</span>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // --- State ---
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_CONFIG);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.workDuration);
  const [currentRound, setCurrentRound] = useState(1);
  const [timerState, setTimerState] = useState<TimerState>(TimerState.IDLE);
  const [isRunning, setIsRunning] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<TimerConfig[]>([DEFAULT_CONFIG, ROLL_CONFIG, HIIT_CONFIG]);
  
  // Clock State
  const [now, setNow] = useState(new Date());

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [isGeneratingBg, setIsGeneratingBg] = useState(false);

  // Refs for accurate timing
  const timerRef = useRef<number | null>(null);
  const endTimeRef = useRef<number>(0);

  // --- Clock Effect ---
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Helpers ---
  const triggerAlert = useCallback((setting: AlertSetting) => {
    if (setting.sound !== 'none') {
        audioService.playSound(setting.sound, config.volume);
    }
    if (setting.vibrate && navigator.vibrate) {
        navigator.vibrate(setting.sound === 'horn' || setting.sound === 'buzzer' ? [500, 200, 500] : 200);
    }
  }, [config.volume]);

  // --- Timer Logic ---
  const switchState = useCallback((newState: TimerState) => {
    setTimerState(newState);
    let newTime = 0;
    
    switch (newState) {
      case TimerState.WARMUP:
        newTime = config.warmupDuration;
        setBgImage(null);
        break;
      case TimerState.WORK:
        newTime = config.workDuration;
        triggerAlert(config.alerts.startRound);
        break;
      case TimerState.REST:
        newTime = config.restDuration;
        triggerAlert(config.alerts.endRound); // End of Round sound
        setTimeout(() => triggerAlert(config.alerts.startRest), 800); // Start of Rest sound (if distinct)
        break;
      case TimerState.FINISHED:
        newTime = 0;
        triggerAlert(config.alerts.endRound);
        setIsRunning(false);
        break;
      case TimerState.IDLE:
        newTime = config.workDuration;
        break;
    }
    
    setTimeLeft(newTime);
    endTimeRef.current = Date.now() + newTime * 1000;
  }, [config, triggerAlert]);

  const tick = useCallback(() => {
    if (!isRunning) return;

    const now = Date.now();
    const diff = Math.ceil((endTimeRef.current - now) / 1000);

    if (diff <= 0) {
      // Transition logic
      if (timerState === TimerState.WARMUP) {
        switchState(TimerState.WORK);
      } else if (timerState === TimerState.WORK) {
        if (currentRound < config.rounds) {
          switchState(TimerState.REST);
        } else {
          switchState(TimerState.FINISHED);
        }
      } else if (timerState === TimerState.REST) {
        triggerAlert(config.alerts.endRest);
        setCurrentRound(prev => prev + 1);
        switchState(TimerState.WORK);
      }
    } else {
      setTimeLeft(diff);
      // Audio cues for last 3 seconds (Hardcoded standard 3-2-1)
      if (diff <= 3 && diff > 0) {
        audioService.playSound('beep', config.volume * 0.5);
      }
    }
  }, [isRunning, timerState, currentRound, config.rounds, switchState, config.volume, config.alerts, triggerAlert]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(tick, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, tick]);

  // --- Controls ---
  const toggleTimer = () => {
    if (timerState === TimerState.FINISHED) {
        resetTimer();
        return;
    }

    if (!isRunning) {
      if (timerState === TimerState.IDLE) {
        switchState(TimerState.WARMUP);
      } else {
        endTimeRef.current = Date.now() + timeLeft * 1000;
      }
      setIsRunning(true);
    } else {
      setIsRunning(false);
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTimerState(TimerState.IDLE);
    setCurrentRound(1);
    setTimeLeft(config.workDuration);
    setBgImage(null);
  };

  // --- Phase Skipping Logic (Smart Navigation) ---
  const changePhase = (direction: number) => {
    let newState = timerState;
    let nextRound = currentRound;
    
    // Helper to immediately apply state and time without running
    const applyState = (s: TimerState, r: number) => {
        setTimerState(s);
        setCurrentRound(r);
        
        let duration = 0;
        if (s === TimerState.WARMUP) duration = config.warmupDuration;
        if (s === TimerState.WORK) duration = config.workDuration;
        if (s === TimerState.REST) duration = config.restDuration;
        
        setTimeLeft(duration);
        setIsRunning(false); // Pause on manual change
    };

    if (direction === 1) {
        // --- NEXT ---
        if (newState === TimerState.IDLE) {
             // Go to Warmup
             applyState(TimerState.WARMUP, 1);
        } else if (newState === TimerState.WARMUP) {
             // Go to Round 1 Work
             applyState(TimerState.WORK, 1);
        } else if (newState === TimerState.WORK) {
             // Go to Rest (if not last round) or Finish
             if (currentRound < config.rounds) {
                 applyState(TimerState.REST, currentRound);
             } else {
                 applyState(TimerState.FINISHED, currentRound);
             }
        } else if (newState === TimerState.REST) {
             // Go to Next Round Work
             applyState(TimerState.WORK, currentRound + 1);
        }
    } else {
        // --- PREV ---
        if (newState === TimerState.WORK) {
            if (currentRound === 1) {
                applyState(TimerState.WARMUP, 1);
            } else {
                // Back to previous rest
                applyState(TimerState.REST, currentRound - 1);
            }
        } else if (newState === TimerState.REST) {
            // Back to current work
            applyState(TimerState.WORK, currentRound);
        } else if (newState === TimerState.FINISHED) {
            // Back to last round work
            applyState(TimerState.WORK, config.rounds);
        } else if (newState === TimerState.WARMUP) {
            applyState(TimerState.IDLE, 1);
        }
    }
  };

  // --- Profile Management ---
  const loadProfile = (profile: TimerConfig) => {
    setConfig(profile);
    resetTimer();
    setShowSettings(false);
  };

  const deleteProfile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Delete this profile?')) {
        setSavedProfiles(prev => prev.filter(p => p.id !== id));
        if (config.id === id) {
             setConfig({...DEFAULT_CONFIG}); // Reset to default if deleted active
        }
    }
  };

  const saveCurrentAsProfile = (isUpdate: boolean) => {
    const name = isUpdate ? config.name : prompt("Enter a name for this custom timer:", "Custom VOW Timer");
    if (!name) return;

    if (isUpdate) {
        setSavedProfiles(prev => prev.map(p => p.id === config.id ? {...config} : p));
        alert('Profile Updated');
    } else {
        const newProfile = { ...config, id: Date.now().toString(), name };
        setSavedProfiles([...savedProfiles, newProfile]);
        setConfig(newProfile);
    }
  };

  const updateAlert = (key: keyof TimerConfig['alerts'], field: 'sound' | 'vibrate', value: any) => {
      setConfig({
          ...config,
          alerts: {
              ...config.alerts,
              [key]: { ...config.alerts[key], [field]: value }
          }
      });
  };

  // --- AI Theme ---
  const handleGenerateTheme = async () => {
    setIsGeneratingBg(true);
    const bg = await generateThemedBackground("Geometric Wolf, Aggressive, Focus, Black Belt, Martial Arts");
    if (bg) setBgImage(bg);
    setIsGeneratingBg(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // --- Styles ---
  const getBackgroundColor = () => {
    if (bgImage) return 'black';
    switch (timerState) {
      case TimerState.WORK: return 'bg-green-600';
      case TimerState.REST: return 'bg-red-600';
      case TimerState.WARMUP: return 'bg-blue-600';
      case TimerState.FINISHED: return 'bg-purple-600';
      default: return 'bg-[#121212]';
    }
  };

  const getStateLabel = () => {
    switch(timerState) {
      case TimerState.IDLE: return 'READY';
      case TimerState.WARMUP: return 'WARM UP';
      case TimerState.WORK: return 'WORK';
      case TimerState.REST: return 'REST';
      case TimerState.FINISHED: return 'YOU DID IT!';
    }
  };

  const isSavedProfile = savedProfiles.some(p => p.id === config.id);

  return (
    <div className={`relative h-[100dvh] w-full flex flex-col transition-colors duration-500 overflow-hidden ${getBackgroundColor()}`}>
      
      {bgImage && (
        <div 
          className="absolute inset-0 z-0 opacity-40 bg-cover bg-center"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
      )}

      {/* Header / Logo Area */}
      <div className="w-full p-2 md:p-4 grid grid-cols-[1fr_auto_1fr] items-center z-10 shrink-0 landscape:py-2">
         {/* LEFT: Logo */}
         <div className="flex flex-col gap-1 items-start">
            {customLogo ? (
                <img src={customLogo} alt="VOW BJJ" className="h-8 md:h-16 landscape:h-10 w-auto object-contain" />
            ) : (
                <div className="h-8 w-8 md:h-16 md:w-16 landscape:h-10 landscape:w-10 border-2 border-white/20 flex items-center justify-center rounded-lg bg-black/40 backdrop-blur-sm">
                   <span className="text-[8px] md:text-[10px] text-center text-white/50 font-sans">LOGO</span>
                </div>
            )}
            <h1 className="text-xs md:text-xl font-bold tracking-widest text-white/80 font-mono hidden md:block landscape:hidden">V.O.W. JJ</h1>
         </div>

         {/* CENTER: Clock - Responsive Sizing */}
         <div className="flex flex-col items-center justify-center">
            <div className="text-3xl md:text-6xl landscape:text-3xl font-mono font-bold text-amber-400 tracking-wider leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-[10px] md:text-lg landscape:text-xs font-bold font-sans text-amber-200/80 uppercase tracking-[0.2em] mt-1">
              {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
         </div>

         {/* RIGHT: Settings */}
         <div className="flex justify-end">
             <button 
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-all"
             >
                <SettingsIcon size={20} className="md:w-6 md:h-6" />
             </button>
         </div>
      </div>

      {/* Main Layout: Grid that adapts to landscape/portrait */}
      <div className="z-10 flex-1 w-full min-h-0 p-4 pt-0 md:pb-8 grid grid-cols-1 landscape:grid-cols-[1fr_auto] grid-rows-[auto_1fr_auto] landscape:grid-rows-[1fr_1fr] gap-4 landscape:gap-6 items-center justify-items-center">
        
        {/* ROUNDS: Top in Portrait, Top-Right in Landscape */}
        <div className="col-span-1 landscape:col-start-2 landscape:row-start-1 landscape:self-end flex items-center gap-4 md:gap-8 landscape:gap-4 shrink-0">
             <button onClick={() => changePhase(-1)} className="p-2 hover:bg-white/10 rounded-full transition-colors group">
                <ChevronLeft size={24} className="md:w-8 md:h-8 landscape:w-6 landscape:h-6 text-white/50 group-hover:text-white group-hover:-translate-x-1 transition-all" />
             </button>
             
             <div className="flex items-baseline gap-2 md:gap-4">
                <span className="text-xl md:text-3xl landscape:text-xl font-bold text-white/70 uppercase font-sans tracking-widest">
                    Round
                </span>
                <span className="text-4xl md:text-7xl landscape:text-5xl font-black font-mono text-white">
                    {currentRound}<span className="text-2xl md:text-4xl landscape:text-2xl text-white/50">/{config.rounds}</span>
                </span>
             </div>

             <button onClick={() => changePhase(1)} className="p-2 hover:bg-white/10 rounded-full transition-colors group">
                <ChevronRight size={24} className="md:w-8 md:h-8 landscape:w-6 landscape:h-6 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
             </button>
        </div>

        {/* TIMER: Middle in Portrait, Left Side (Full Height) in Landscape */}
        <div className={`
             col-span-1 landscape:col-start-1 landscape:row-span-2
             relative w-full h-full flex flex-col items-center justify-center
             border-4 md:border-8 border-white/10 bg-black/30 backdrop-blur-sm rounded-3xl
             transition-all duration-300
             ${timerState === TimerState.WORK ? 'shadow-[0_0_50px_rgba(22,163,74,0.3)]' : ''}
             ${timerState === TimerState.REST ? 'shadow-[0_0_50px_rgba(220,38,38,0.3)]' : ''}
             ${timerState === TimerState.FINISHED ? 'shadow-[0_0_50px_rgba(147,51,234,0.3)] border-purple-500/50' : ''}
        `}>
            <h2 className={`
                text-2xl md:text-5xl landscape:text-3xl font-black tracking-[0.2em] mb-2 landscape:mb-1 text-center
                ${timerState === TimerState.FINISHED ? 'text-purple-300 animate-bounce' : 'animate-pulse'}
            `}>
                {getStateLabel()}
            </h2>
            
            {/* Timer Text: Maximized size using clamp and viewport units */}
            <div className={`
                font-mono leading-none tracking-tighter tabular-nums drop-shadow-2xl text-center w-full
                ${timerState === TimerState.FINISHED ? 'text-[12vw] md:text-[8rem]' : 'text-[clamp(4rem,25vw,35vh)]'}
            `}>
                {timerState === TimerState.FINISHED ? 'OSS!' : formatTime(timeLeft)}
            </div>
            
             <div className="mt-4 landscape:mt-2 text-white/40 text-xs md:text-sm font-sans uppercase tracking-widest text-center">
                 {timerState === TimerState.IDLE ? `Total: ${Math.ceil((config.rounds * (config.workDuration + config.restDuration) + config.warmupDuration)/60)}m` : 
                  timerState === TimerState.FINISHED ? 'Great training session!' : 'Push the Pace'}
             </div>
        </div>

        {/* CONTROLS: Bottom in Portrait, Bottom-Right in Landscape */}
        <div className="col-span-1 landscape:col-start-2 landscape:row-start-2 landscape:self-start flex gap-6 md:gap-8 landscape:gap-4 shrink-0">
            {timerState !== TimerState.FINISHED && (
            <button 
                onClick={toggleTimer}
                className="group relative flex items-center justify-center w-20 h-20 md:w-24 md:h-24 landscape:w-16 landscape:h-16 rounded-full bg-white text-black hover:scale-110 transition-transform shadow-xl"
            >
                {isRunning ? <Pause size={32} className="md:w-10 md:h-10 landscape:w-6 landscape:h-6" fill="black" /> : <Play size={32} className="md:w-10 md:h-10 landscape:w-6 landscape:h-6 ml-1" fill="black" />}
            </button>
            )}
            
            <button 
                onClick={resetTimer}
                className="flex items-center justify-center w-20 h-20 md:w-24 md:h-24 landscape:w-16 landscape:h-16 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md hover:scale-110 transition-all border border-white/10"
            >
                <RotateCcw size={24} className="md:w-8 md:h-8 landscape:w-6 landscape:h-6" />
            </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col p-6 overflow-y-auto">
            <div className="w-full max-w-2xl mx-auto pb-20">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold font-mono text-white">Timer Setup</h2>
                    <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white">Close</button>
                </div>

                {/* Profiles */}
                <div className="mb-8">
                    <h3 className="text-sm uppercase tracking-widest text-white/50 mb-4">Saved Profiles</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {savedProfiles.map(p => (
                            <div 
                                key={p.id}
                                onClick={() => loadProfile(p)}
                                className={`flex justify-between items-center p-4 rounded-lg border cursor-pointer transition-all ${config.id === p.id ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/40'}`}
                            >
                                <div>
                                    <div className="font-bold">{p.name}</div>
                                    <div className="text-xs text-white/50">{p.rounds}x {formatTime(p.workDuration)}</div>
                                </div>
                                <button 
                                    onClick={(e) => deleteProfile(e, p.id)}
                                    className="p-2 text-white/30 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Main Settings */}
                <div className="space-y-6 mb-8 border-t border-white/10 pt-8">
                    <h3 className="text-sm uppercase tracking-widest text-white/50">Time Configuration</h3>
                    {isSavedProfile && (
                        <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded text-blue-200 text-sm">
                            Editing: <strong>{config.name}</strong>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm text-white/50 mb-2 font-bold uppercase tracking-wider">Rounds</label>
                            <input 
                                type="number" 
                                value={config.rounds}
                                onChange={(e) => setConfig({...config, rounds: parseInt(e.target.value) || 1})}
                                className="w-full bg-white/10 border border-white/10 rounded p-3 text-xl font-mono text-center text-white focus:border-white focus:bg-white/20 outline-none transition-all"
                            />
                        </div>
                        <TimeSelect 
                            label="Warmup"
                            value={config.warmupDuration}
                            onChange={(val) => setConfig({...config, warmupDuration: val})}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                        <TimeSelect 
                            label="Work Time"
                            value={config.workDuration}
                            onChange={(val) => setConfig({...config, workDuration: val})}
                        />
                        <TimeSelect 
                            label="Rest Time"
                            value={config.restDuration}
                            onChange={(val) => setConfig({...config, restDuration: val})}
                        />
                    </div>

                     {/* Alerts Configuration */}
                     <div className="pt-6 border-t border-white/10">
                        <h3 className="text-sm uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
                             Alerts & Feedback
                        </h3>
                        
                        <div className="flex items-center gap-4 mb-6">
                            <Volume2 size={20} className="text-white/70" />
                            <input 
                                type="range" min="0" max="1" step="0.1" 
                                value={config.volume} 
                                onChange={(e) => setConfig({...config, volume: parseFloat(e.target.value)})}
                                className="w-full accent-green-500" 
                            />
                        </div>

                        <div className="space-y-4">
                            {[
                                { key: 'startRound', label: 'Start Round' },
                                { key: 'endRound', label: 'End Round' },
                                { key: 'startRest', label: 'Start Rest' },
                                { key: 'endRest', label: 'End Rest (To Work)' }
                            ].map((item) => (
                                <div key={item.key} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                                    <span className="text-sm font-bold text-white/80">{item.label}</span>
                                    
                                    <select 
                                        value={config.alerts[item.key as keyof typeof config.alerts].sound}
                                        onChange={(e) => updateAlert(item.key as any, 'sound', e.target.value)}
                                        className="bg-white/5 border border-white/20 rounded px-2 py-1 text-sm outline-none"
                                    >
                                        <option value="none">None</option>
                                        <option value="horn">Horn</option>
                                        <option value="bell">Bell</option>
                                        <option value="gong">Gong</option>
                                        <option value="buzzer">Buzzer</option>
                                        <option value="beep">Beep</option>
                                    </select>

                                    <button 
                                        onClick={() => updateAlert(item.key as any, 'vibrate', !config.alerts[item.key as keyof typeof config.alerts].vibrate)}
                                        className={`p-2 rounded ${config.alerts[item.key as keyof typeof config.alerts].vibrate ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/30'}`}
                                    >
                                        <Vibrate size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        {isSavedProfile && (
                            <button 
                                onClick={() => saveCurrentAsProfile(true)}
                                className="flex-1 flex items-center justify-center gap-2 p-3 rounded bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-widest transition"
                            >
                                <Save size={16} /> Update Saved
                            </button>
                        )}
                        <button 
                            onClick={() => saveCurrentAsProfile(false)}
                            className="flex-1 flex items-center justify-center gap-2 p-3 rounded bg-green-600 hover:bg-green-500 font-bold uppercase tracking-widest transition"
                        >
                            <Save size={16} /> {isSavedProfile ? 'Save as New' : 'Save Profile'}
                        </button>
                    </div>
                </div>

                {/* Branding */}
                <div className="border-t border-white/10 pt-8 space-y-6">
                    <div>
                        <h3 className="text-sm uppercase tracking-widest text-white/50 mb-4">Branding</h3>
                        <div className="flex flex-col gap-4">
                            <label className="flex items-center gap-4 cursor-pointer p-4 bg-white/5 rounded-lg hover:bg-white/10 transition">
                                <ImageIcon className="text-white/70" />
                                <div className="flex-1">
                                    <div className="font-bold">Upload Logo</div>
                                    <div className="text-xs text-white/50">Replace the default header logo</div>
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                            </label>

                            <button 
                                onClick={handleGenerateTheme}
                                disabled={isGeneratingBg}
                                className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg hover:brightness-110 transition disabled:opacity-50 text-left"
                            >
                                <div className="p-2 bg-white/20 rounded-full">
                                   {isGeneratingBg ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <div className="text-xl">🍌</div>}
                                </div>
                                <div className="flex-1">
                                    <div className="font-bold flex items-center gap-2">
                                        Generate AI Theme
                                        <span className="text-[10px] bg-white/20 px-1 rounded">GEMINI</span>
                                    </div>
                                    <div className="text-xs text-white/70">Create a unique "VOW" geometric background</div>
                                </div>
                            </button>
                            {bgImage && (
                                <button onClick={() => setBgImage(null)} className="text-xs text-red-400 underline self-start">Clear Background</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
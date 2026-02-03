import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TimerState, TimerConfig, DEFAULT_CONFIG, ROLL_CONFIG, HIIT_CONFIG, AlertSetting, SoundType } from './types';
import { audioService } from './services/audioService';
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
    if (!config.name.trim()) {
        alert("Please enter a profile name");
        return;
    }

    if (isUpdate) {
        setSavedProfiles(prev => prev.map(p => p.id === config.id ? {...config} : p));
    } else {
        const newProfile = { ...config, id: Date.now().toString() };
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setCustomLogo(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // --- Styles ---
  const getThemeStyles = () => {
    // Returns classes for Border and Text color
    switch (timerState) {
      case TimerState.WORK: return 'border-green-500 text-green-500 shadow-[0_0_40px_rgba(34,197,94,0.15)]';
      case TimerState.REST: return 'border-red-600 text-red-600 shadow-[0_0_40px_rgba(220,38,38,0.15)]';
      case TimerState.WARMUP: return 'border-blue-500 text-blue-500';
      case TimerState.FINISHED: return 'border-purple-500 text-purple-500 animate-pulse';
      default: return 'border-white/20 text-white';
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
  const themeStyles = getThemeStyles();

  return (
    <div className="relative h-[100dvh] w-full flex flex-col bg-[#121212] overflow-hidden">

      {/* Header / Logo Area */}
      <div className="w-full p-2 md:p-4 grid grid-cols-[1fr_auto_1fr] items-center z-20 shrink-0 landscape:py-1 landscape:px-4 bg-[#121212]">
         {/* LEFT: Logo */}
         <div className="flex flex-col gap-2 items-start">
            {customLogo ? (
                <img src={customLogo} alt="VOW BJJ" className="h-12 md:h-24 landscape:h-8 w-auto object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]" />
            ) : (
                <div className="h-12 w-12 md:h-24 md:w-24 landscape:h-8 landscape:w-8 border-2 border-amber-400/60 flex items-center justify-center rounded-xl landscape:rounded-lg bg-black/60 backdrop-blur-sm shadow-[0_0_25px_rgba(251,191,36,0.3)]">
                   <span className="text-[10px] md:text-sm landscape:text-[6px] text-center text-amber-400/80 font-bold font-sans">LOGO</span>
                </div>
            )}
            <h1 className="text-sm md:text-2xl font-bold tracking-widest text-amber-400 font-mono hidden md:block landscape:hidden drop-shadow-[0_0_10px_rgba(251,191,36,0.4)]">V.O.W. JJ</h1>
         </div>

         {/* CENTER: Clock - Responsive Sizing */}
         <div className="flex flex-col items-center justify-center">
            <div className="text-5xl md:text-8xl landscape:text-2xl font-mono font-bold text-amber-400 tracking-wider leading-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] [text-shadow:_0_0_30px_rgba(251,191,36,0.4)]">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-sm md:text-2xl landscape:text-[10px] font-bold font-sans text-amber-200 uppercase tracking-[0.25em] mt-2 landscape:mt-0">
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

      {/* MAIN CONTENT AREA - Timer takes mostly everything */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full px-4 landscape:px-8 min-h-0 py-2 landscape:py-1">

        {/* TIMER BOX - Centered, Large with colored borders/text */}
        <div className={`
             relative w-full max-w-5xl h-full landscape:h-full aspect-video md:aspect-[2/1] landscape:!aspect-auto flex flex-col items-center justify-center
             border-[6px] md:border-[12px] landscape:border-4 bg-black/40 backdrop-blur-sm rounded-3xl landscape:rounded-2xl
             transition-all duration-300 ${themeStyles}
        `}>
            <h2 className="text-2xl md:text-5xl landscape:text-4xl font-black tracking-[0.2em] mb-0 landscape:mb-2 animate-pulse text-center opacity-90">
                {getStateLabel()}
            </h2>
            
            {/* Timer Text */}
            <div className={`
                font-mono leading-none tracking-tighter tabular-nums drop-shadow-2xl text-center w-full
                ${timerState === TimerState.FINISHED ? 'text-[10vw] md:text-[8rem]' : 'text-[clamp(5rem,28vw,45vh)]'}
            `}>
                {timerState === TimerState.FINISHED ? 'OSS!' : formatTime(timeLeft)}
            </div>
            
             <div className="mt-2 landscape:mt-0 text-white/40 text-xs md:text-sm font-sans uppercase tracking-widest text-center">
                 {timerState === TimerState.IDLE ? `Total: ${Math.ceil((config.rounds * (config.workDuration + config.restDuration) + config.warmupDuration)/60)}m` : 
                  timerState === TimerState.FINISHED ? 'Great training session!' : 'Push the Pace'}
             </div>
        </div>

      </div>

      {/* FOOTER - Rounds and Controls */}
      <div className="z-20 w-full p-4 md:p-6 landscape:p-2 landscape:py-2 bg-[#121212] border-t border-white/5 grid grid-cols-2 items-center shrink-0">
            
            {/* LEFT: Rounds */}
            <div className="flex items-center justify-start gap-4 landscape:gap-2">
                 <button onClick={() => changePhase(-1)} className="p-3 landscape:p-1 hover:bg-white/10 rounded-full transition-colors group">
                    <ChevronLeft size={24} className="md:w-8 md:h-8 landscape:w-5 landscape:h-5 text-white/50 group-hover:text-white transition-all" />
                 </button>

                 <div className="flex flex-col md:flex-row md:items-baseline gap-0 md:gap-3">
                    <span className="text-xs md:text-xl landscape:text-[10px] font-bold text-white/50 uppercase font-sans tracking-widest">
                        Round
                    </span>
                    <span className="text-3xl md:text-5xl landscape:text-2xl font-black font-mono text-white">
                        {currentRound}<span className="text-xl md:text-3xl landscape:text-lg text-white/30">/{config.rounds}</span>
                    </span>
                 </div>

                 <button onClick={() => changePhase(1)} className="p-3 landscape:p-1 hover:bg-white/10 rounded-full transition-colors group">
                    <ChevronRight size={24} className="md:w-8 md:h-8 landscape:w-5 landscape:h-5 text-white/50 group-hover:text-white transition-all" />
                 </button>
            </div>

            {/* RIGHT: Controls */}
            <div className="flex items-center justify-end gap-4 md:gap-8 landscape:gap-3">
                {timerState !== TimerState.FINISHED && (
                <button
                    onClick={toggleTimer}
                    className="group flex items-center justify-center w-16 h-16 md:w-20 md:h-20 landscape:w-12 landscape:h-12 rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg shadow-white/10"
                >
                    {isRunning ? <Pause size={28} className="md:w-8 md:h-8 landscape:w-5 landscape:h-5" fill="black" /> : <Play size={28} className="md:w-8 md:h-8 landscape:w-5 landscape:h-5 ml-1" fill="black" />}
                </button>
                )}

                <button
                    onClick={resetTimer}
                    className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 landscape:w-12 landscape:h-12 rounded-full bg-white/5 text-white hover:bg-white/20 backdrop-blur-md hover:scale-105 transition-all border border-white/10"
                >
                    <RotateCcw size={24} className="md:w-8 md:h-8 landscape:w-5 landscape:h-5" />
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
                    
                    {/* Name Input */}
                    <div className="mb-6">
                        <label className="block text-sm text-white/50 mb-2 font-bold uppercase tracking-wider">Profile Name</label>
                        <input 
                            type="text" 
                            value={config.name}
                            onChange={(e) => setConfig({...config, name: e.target.value})}
                            className="w-full bg-white/10 border border-white/10 rounded p-3 text-lg font-sans text-white focus:border-white focus:bg-white/20 outline-none transition-all placeholder-white/30"
                            placeholder="Enter profile name..."
                        />
                    </div>

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

                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

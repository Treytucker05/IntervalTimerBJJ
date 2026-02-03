import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TimerState, TimerConfig, DEFAULT_CONFIG, ROLL_CONFIG, HIIT_CONFIG, AlertSetting, SoundType } from './types';
import { audioService } from './services/audioService';
import { useAuth } from './src/contexts/AuthContext';
import { useProfiles } from './src/hooks/useProfiles';
import { useLogo } from './src/hooks/useLogo';
import {
    Play, Pause, RotateCcw, Save, Settings as SettingsIcon,
    Image as ImageIcon, Check, ChevronLeft, ChevronRight,
    Trash2, Volume2, Vibrate, ChevronDown, Cloud, CloudOff,
    User as UserIcon, LogOut, Mail, Lock, Loader2
} from 'lucide-react';

// --- Helper to format time MM:SS ---
const formatTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// --- Helper to format total time as "X Minutes Y Seconds" ---
const formatTotalTime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m} Minute${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${s} Second${s !== 1 ? 's' : ''}`;
  return `${m} Min ${s} Sec`;
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
                className="w-full bg-[#1a1a1a] hover:bg-[#252525] text-white p-3 pr-8 rounded appearance-none outline-none font-mono text-xl text-center cursor-pointer transition-colors border border-white/10 focus:border-white/50 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
            >
                {minOptions.map(i => <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>)}
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
                className="w-full bg-[#1a1a1a] hover:bg-[#252525] text-white p-3 pr-8 rounded appearance-none outline-none font-mono text-xl text-center cursor-pointer transition-colors border border-white/10 focus:border-white/50 [&>option]:bg-[#1a1a1a] [&>option]:text-white"
            >
                {secOptions.map(i => <option key={i} value={i}>{i.toString().padStart(2, '0')}</option>)}
            </select>
            <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] text-white/30 pointer-events-none font-sans font-bold">SEC</span>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 w-4 h-4 pointer-events-none" />
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // --- Auth & Data Hooks ---
  const { user, isLoading: authLoading, isConfigured: firebaseConfigured, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useAuth();
  const { profiles: savedProfiles, save: saveProfile, remove: removeProfile, isSyncing, isLoading: profilesLoading } = useProfiles();
  const { logo: customLogo, uploadLogo, isUploading: logoUploading } = useLogo();

  // --- State ---
  const [config, setConfig] = useState<TimerConfig>(DEFAULT_CONFIG);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_CONFIG.workDuration);
  const [currentRound, setCurrentRound] = useState(1);
  const [timerState, setTimerState] = useState<TimerState>(TimerState.IDLE);
  const [isRunning, setIsRunning] = useState(false);

  // Auth UI State
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading2, setAuthLoading2] = useState(false);

  // Clock State
  const [now, setNow] = useState(new Date());

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [showLogos, setShowLogos] = useState(() => {
    try {
      const saved = localStorage.getItem('showLogos');
      return saved !== null ? JSON.parse(saved) : true;
    } catch { return true; }
  });

  // Persist showLogos setting
  useEffect(() => {
    localStorage.setItem('showLogos', JSON.stringify(showLogos));
  }, [showLogos]);

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
        removeProfile(id);
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
        saveProfile({...config});
    } else {
        const newProfile = { ...config, id: Date.now().toString() };
        saveProfile(newProfile);
        setConfig(newProfile);
    }
  };

  // --- Auth Handlers ---
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading2(true);

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      setShowEmailForm(false);
      setEmail('');
      setPassword('');
    } catch (error: any) {
      setAuthError(error.message || 'Authentication failed');
    } finally {
      setAuthLoading2(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setAuthLoading2(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      setAuthError(error.message || 'Google sign-in failed');
    } finally {
      setAuthLoading2(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
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
      uploadLogo(file);
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

  // Logo border color that matches timer state exactly
  const getLogoBorderColor = () => {
    switch (timerState) {
      case TimerState.WORK: return 'border-green-500 shadow-[0_0_25px_rgba(34,197,94,0.4)]';
      case TimerState.REST: return 'border-red-600 shadow-[0_0_25px_rgba(220,38,38,0.4)]';
      case TimerState.WARMUP: return 'border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.4)]';
      case TimerState.FINISHED: return 'border-purple-500 shadow-[0_0_25px_rgba(168,85,247,0.4)]';
      default: return 'border-white/20 shadow-none';
    }
  };

  // Test sound preview
  const playTestSound = (sound: SoundType) => {
    if (sound !== 'none') {
      audioService.playSound(sound, config.volume);
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

      {/* Header - VOW BJJ banner with clock overlay - 152px height */}
      <div
        className="relative w-full h-[130px] z-30 shrink-0"
        style={{
          backgroundImage: `url(${import.meta.env.BASE_URL}vow-header.png)`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
         {/* CENTER: Clock overlay - positioned in the dashed rectangle area */}
         <div className="absolute inset-0 flex items-center justify-center gap-3">
            <span className="text-2xl md:text-4xl landscape:text-xl font-mono font-medium text-white/80 tracking-wide">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-base md:text-lg landscape:text-sm font-sans text-white/50 uppercase tracking-wider">
              {now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
            </span>
         </div>
      </div>

      {/* MAIN CONTENT AREA - Timer box fills remaining space */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full px-3 md:px-4 landscape:px-3 min-h-0 py-2 landscape:py-1">

        {/* TIMER BOX - Clean single border, no footer */}
        <div className={`
             relative w-full max-w-5xl h-full landscape:h-full flex
             border-4 md:border-[6px] landscape:border-3 bg-black/50 rounded-2xl
             transition-all duration-300 ${themeStyles}
        `}>
            {/* LEFT: Custom Logo (conditionally shown) - starts lower, not full height */}
            {showLogos && (
                <div className={`self-end h-[75%] flex items-center justify-center p-2 md:p-4 landscape:p-2 border-r-2 md:border-r-4 transition-all duration-300 ${getLogoBorderColor().split(' ')[0]}`}>
                    {customLogo ? (
                        <img src={customLogo} alt="Custom Logo" className={`max-h-[70%] max-w-[120px] md:max-w-[180px] object-contain border-2 md:border-3 rounded-lg transition-all duration-300 ${getLogoBorderColor()}`} />
                    ) : (
                        <div className={`h-[50%] aspect-square border-2 md:border-3 flex items-center justify-center rounded-lg bg-black/40 transition-all duration-300 ${getLogoBorderColor()}`}>
                           <span className="text-sm md:text-lg landscape:text-xs text-center text-white/40 font-medium font-sans">LOGO</span>
                        </div>
                    )}
                </div>
            )}

            {/* CENTER: Timer content - All stacked vertically */}
            <div className="flex-1 flex flex-col items-center justify-center py-3 md:py-4 landscape:py-2 px-4 md:px-8">
                {/* Round Navigation - NOW AT TOP */}
                <div className="flex items-center justify-center gap-2 landscape:gap-1 mb-2 md:mb-3">
                    <button onClick={() => changePhase(-1)} className="p-2 landscape:p-1 hover:bg-white/10 rounded-lg transition-colors group">
                        <ChevronLeft size={20} className="md:w-6 md:h-6 landscape:w-4 landscape:h-4 text-white/50 group-hover:text-white transition-all" />
                    </button>

                    <div className="flex items-center gap-2">
                        <span className="text-base md:text-xl landscape:text-sm font-bold text-white/70 uppercase font-sans tracking-wider">
                            Round
                        </span>
                        <span className="text-2xl md:text-4xl landscape:text-xl font-bold font-mono text-white">
                            {currentRound}
                        </span>
                        <span className="text-lg md:text-2xl landscape:text-base font-bold font-mono text-white/40">
                            / {config.rounds}
                        </span>
                    </div>

                    <button onClick={() => changePhase(1)} className="p-2 landscape:p-1 hover:bg-white/10 rounded-lg transition-colors group">
                        <ChevronRight size={20} className="md:w-6 md:h-6 landscape:w-4 landscape:h-4 text-white/50 group-hover:text-white transition-all" />
                    </button>
                </div>

                {/* State Label */}
                <h2 className="text-xl md:text-3xl landscape:text-base font-bold tracking-[0.15em] text-white/80 mb-1">
                    {getStateLabel()}
                </h2>

                {/* Total Time - Below state label, formatted as Minutes/Seconds */}
                <div className="text-white/50 text-sm md:text-base landscape:text-xs font-medium font-sans tracking-wider text-center mb-2">
                    {timerState === TimerState.IDLE
                        ? `Total: ${formatTotalTime(config.rounds * (config.workDuration + config.restDuration) + config.warmupDuration)}`
                        : timerState === TimerState.FINISHED
                            ? 'Great training session!'
                            : 'Push the Pace'}
                </div>

                {/* Timer Display - DOMINANT */}
                <div className={`
                    font-mono leading-none tracking-tight tabular-nums text-center
                    ${timerState === TimerState.FINISHED ? 'text-[14vw] md:text-[12rem] landscape:text-[18vh]' : 'text-[clamp(5rem,24vw,32vh)] landscape:text-[clamp(4rem,20vh,28vh)]'}
                `}>
                    {timerState === TimerState.FINISHED ? 'OSS!' : formatTime(timeLeft)}
                </div>

                {/* Controls - NOW BELOW TIMER */}
                <div className="flex items-center justify-center gap-4 md:gap-6 landscape:gap-3 mt-4 md:mt-6 landscape:mt-3">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="flex items-center justify-center w-11 h-11 md:w-14 md:h-14 landscape:w-9 landscape:h-9 rounded-xl bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition-all border border-white/10"
                    >
                        <SettingsIcon size={18} className="md:w-5 md:h-5 landscape:w-4 landscape:h-4" />
                    </button>

                    {timerState !== TimerState.FINISHED && (
                    <button
                        onClick={toggleTimer}
                        className={`flex items-center justify-center w-14 h-14 md:w-20 md:h-20 landscape:w-11 landscape:h-11 rounded-xl hover:scale-105 transition-transform ${isRunning ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}
                    >
                        {isRunning ? <Pause size={24} className="md:w-8 md:h-8 landscape:w-5 landscape:h-5" fill="white" /> : <Play size={24} className="md:w-8 md:h-8 landscape:w-5 landscape:h-5 ml-0.5" fill="white" />}
                    </button>
                    )}

                    <button
                        onClick={resetTimer}
                        className="flex items-center justify-center w-11 h-11 md:w-14 md:h-14 landscape:w-9 landscape:h-9 rounded-xl bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition-all border border-white/10"
                    >
                        <RotateCcw size={18} className="md:w-5 md:h-5 landscape:w-4 landscape:h-4" />
                    </button>
                </div>
            </div>

            {/* RIGHT: Custom Logo (conditionally shown) - starts lower, not full height */}
            {showLogos && (
                <div className={`self-end h-[75%] flex items-center justify-center p-2 md:p-4 landscape:p-2 border-l-2 md:border-l-4 transition-all duration-300 ${getLogoBorderColor().split(' ')[0]}`}>
                    {customLogo ? (
                        <img src={customLogo} alt="Custom Logo" className={`max-h-[70%] max-w-[120px] md:max-w-[180px] object-contain border-2 md:border-3 rounded-lg transition-all duration-300 scale-x-[-1] ${getLogoBorderColor()}`} />
                    ) : (
                        <div className={`h-[50%] aspect-square border-2 md:border-3 flex items-center justify-center rounded-lg bg-black/40 transition-all duration-300 ${getLogoBorderColor()}`}>
                           <span className="text-sm md:text-lg landscape:text-xs text-center text-white/40 font-medium font-sans">LOGO</span>
                        </div>
                    )}
                </div>
            )}
        </div>

      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col p-6 overflow-y-auto">
            <div className="w-full max-w-2xl mx-auto pb-20">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-3xl font-bold font-mono text-white">Timer Setup</h2>
                    <div className="flex items-center gap-4">
                        {/* Sync Status Indicator */}
                        {user && (
                            <div className="flex items-center gap-2 text-sm">
                                {isSyncing ? (
                                    <><Loader2 size={16} className="animate-spin text-blue-400" /><span className="text-blue-400">Syncing...</span></>
                                ) : (
                                    <><Cloud size={16} className="text-green-400" /><span className="text-green-400">Synced</span></>
                                )}
                            </div>
                        )}
                        {!user && firebaseConfigured && (
                            <div className="flex items-center gap-2 text-sm text-white/50">
                                <CloudOff size={16} /><span>Local only</span>
                            </div>
                        )}
                        <button onClick={() => setShowSettings(false)} className="text-white/50 hover:text-white">Close</button>
                    </div>
                </div>

                {/* Account Section */}
                <div className="mb-8 p-4 bg-white/5 rounded-lg border border-white/10">
                    <h3 className="text-sm uppercase tracking-widest text-white/50 mb-4 flex items-center gap-2">
                        <UserIcon size={16} /> Account
                    </h3>

                    {authLoading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="animate-spin" />
                        </div>
                    ) : user ? (
                        // Logged In State
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt="Avatar" className="w-10 h-10 rounded-full" />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                        <UserIcon size={20} />
                                    </div>
                                )}
                                <div>
                                    <div className="font-bold">{user.displayName || 'User'}</div>
                                    <div className="text-sm text-white/50">{user.email}</div>
                                </div>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition"
                            >
                                <LogOut size={16} /> Sign Out
                            </button>
                        </div>
                    ) : firebaseConfigured ? (
                        // Logged Out State (Firebase configured)
                        <div className="space-y-4">
                            {authError && (
                                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm">
                                    {authError}
                                </div>
                            )}

                            {!showEmailForm ? (
                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={handleGoogleSignIn}
                                        disabled={authLoading2}
                                        className="flex items-center justify-center gap-3 w-full p-3 bg-white text-black rounded-lg font-bold hover:bg-white/90 transition disabled:opacity-50"
                                    >
                                        {authLoading2 ? <Loader2 className="animate-spin" size={20} /> : (
                                            <>
                                                <svg viewBox="0 0 24 24" width="20" height="20">
                                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                                                </svg>
                                                Sign in with Google
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setShowEmailForm(true)}
                                        className="flex items-center justify-center gap-2 w-full p-3 bg-white/10 hover:bg-white/20 rounded-lg transition"
                                    >
                                        <Mail size={20} /> Sign in with Email
                                    </button>
                                    <p className="text-center text-white/40 text-sm">
                                        Sign in to sync your profiles across devices
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleEmailAuth} className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-white/50 mb-1">Email</label>
                                        <div className="relative">
                                            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-white/10 border border-white/10 rounded p-3 pl-10 text-white focus:border-white focus:bg-white/20 outline-none transition-all"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-white/50 mb-1">Password</label>
                                        <div className="relative">
                                            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full bg-white/10 border border-white/10 rounded p-3 pl-10 text-white focus:border-white focus:bg-white/20 outline-none transition-all"
                                                required
                                                minLength={6}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            type="submit"
                                            disabled={authLoading2}
                                            className="flex-1 flex items-center justify-center gap-2 p-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold transition disabled:opacity-50"
                                        >
                                            {authLoading2 ? <Loader2 className="animate-spin" size={20} /> : (isSignUp ? 'Create Account' : 'Sign In')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setShowEmailForm(false); setAuthError(null); }}
                                            className="px-4 py-3 bg-white/10 hover:bg-white/20 rounded-lg transition"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsSignUp(!isSignUp)}
                                        className="w-full text-center text-white/50 text-sm hover:text-white transition"
                                    >
                                        {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                                    </button>
                                </form>
                            )}
                        </div>
                    ) : (
                        // Firebase not configured
                        <div className="text-center text-white/50 py-4">
                            <CloudOff size={24} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">Cloud sync not available</p>
                            <p className="text-xs mt-1">Profiles saved locally in browser</p>
                        </div>
                    )}
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
                                <div key={item.key} className="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center">
                                    <span className="text-sm font-bold text-white/80">{item.label}</span>

                                    <select
                                        value={config.alerts[item.key as keyof typeof config.alerts].sound}
                                        onChange={(e) => updateAlert(item.key as any, 'sound', e.target.value)}
                                        className="bg-[#1a1a1a] border border-white/20 rounded px-3 py-2 text-sm outline-none text-white [&>option]:bg-[#1a1a1a] [&>option]:text-white"
                                    >
                                        <option value="none">None</option>
                                        <option value="boxing_bell">🥊 Boxing Bell</option>
                                        <option value="fight">🔥 FIGHT!</option>
                                        <option value="rumble">💪 Rumble</option>
                                        <option value="horn">Horn</option>
                                        <option value="bell">Bell</option>
                                        <option value="gong">Gong</option>
                                        <option value="buzzer">Buzzer</option>
                                        <option value="beep">Beep</option>
                                    </select>

                                    {/* Test Sound Button */}
                                    <button
                                        onClick={() => playTestSound(config.alerts[item.key as keyof typeof config.alerts].sound)}
                                        className="p-2 rounded bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                                        title="Test sound"
                                    >
                                        <Volume2 size={18} />
                                    </button>

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
                            {/* Show/Hide Logos Toggle */}
                            <button
                                onClick={() => setShowLogos(!showLogos)}
                                className={`flex items-center justify-between p-4 rounded-lg border transition-all ${showLogos ? 'bg-green-500/10 border-green-500/50' : 'bg-white/5 border-white/10'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <ImageIcon className={showLogos ? 'text-green-400' : 'text-white/70'} />
                                    <div className="text-left">
                                        <div className="font-bold">Show Logo Panels</div>
                                        <div className="text-xs text-white/50">Display logo sections on left and right of timer</div>
                                    </div>
                                </div>
                                <div className={`w-12 h-6 rounded-full transition-all ${showLogos ? 'bg-green-500' : 'bg-white/20'}`}>
                                    <div className={`w-5 h-5 rounded-full bg-white transition-all mt-0.5 ${showLogos ? 'ml-6' : 'ml-0.5'}`} />
                                </div>
                            </button>

                            <label className="flex items-center gap-4 cursor-pointer p-4 bg-white/5 rounded-lg hover:bg-white/10 transition">
                                <ImageIcon className="text-white/70" />
                                <div className="flex-1">
                                    <div className="font-bold">Upload Logo</div>
                                    <div className="text-xs text-white/50">Replace the default logo placeholder</div>
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

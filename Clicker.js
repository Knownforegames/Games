import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Zap, Rocket, TimerReset, Trophy, RefreshCcw, Plus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// --- Types
type SaveState = {
  score: number;
  perClick: number;
  multiplierLevel: number;
  autoClickers: number;
  critChance: number; // 0..1
  bestCPS: number;
  totalClicks: number;
  startTime: number;
};

const VERSION = "1.0.0";
const STORAGE_KEY = `cyber_clicker_save_${VERSION}`;

// --- Helpers
const format = (n: number) =>
  n >= 1_000_000_000
    ? (n / 1_000_000_000).toFixed(2) + "b"
    : n >= 1_000_000
    ? (n / 1_000_000).toFixed(2) + "m"
    : n >= 1000
    ? (n / 1000).toFixed(2) + "k"
    : Math.floor(n).toString();

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Pricing formulas
const priceForMultiplier = (level: number) => Math.floor(25 * Math.pow(1.35, level));
const priceForAutoClicker = (count: number) => Math.floor(50 * Math.pow(1.45, count));
const priceForCrit = (chance: number) => Math.floor(200 * Math.pow(1.9, Math.round(chance * 100) / 5));

// Particle component for click bursts
function Burst({ x, y, big }: { x: number; y: number; big?: boolean }) {
  const count = big ? 18 : 10;
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);
  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {particles.map((i) => {
        const angle = (i / count) * Math.PI * 2;
        const dx = Math.cos(angle) * (big ? 160 : 110);
        const dy = Math.sin(angle) * (big ? 160 : 110);
        const duration = 0.6 + (i % 4) * 0.05;
        return (
          <motion.span
            key={i}
            initial={{ x, y, opacity: 1, scale: 1 }}
            animate={{ x: x + dx, y: y + dy, opacity: 0, scale: 0.4 }}
            transition={{ duration, ease: "easeOut" }}
            className="absolute h-2 w-2 rounded-full bg-gradient-to-br from-cyan-400 to-fuchsia-500 shadow-md"
          />
        );
      })}
    </div>
  );
}

export default function CyberClicker() {
  // --- State
  const [score, setScore] = useState(0);
  const [perClick, setPerClick] = useState(1);
  const [multiplierLevel, setMultiplierLevel] = useState(0);
  const [autoClickers, setAutoClickers] = useState(0);
  const [critChance, setCritChance] = useState(0.03); // 3%
  const [bestCPS, setBestCPS] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [startTime, setStartTime] = useState<number>(() => Date.now());
  const [floating, setFloating] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number; big?: boolean }[]>([]);

  const idRef = useRef(0);
  const lastTickRef = useRef<number>(Date.now());

  const cps = useMemo(() => autoClickers * (1 + multiplierLevel * 0.1), [autoClickers, multiplierLevel]);
  const nextMultiplierPrice = useMemo(() => priceForMultiplier(multiplierLevel), [multiplierLevel]);
  const nextAutoPrice = useMemo(() => priceForAutoClicker(autoClickers), [autoClickers]);
  const nextCritPrice = useMemo(() => priceForCrit(critChance), [critChance]);

  // --- Load save
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const s: SaveState = JSON.parse(saved);
        setScore(s.score || 0);
        setPerClick(s.perClick || 1);
        setMultiplierLevel(s.multiplierLevel || 0);
        setAutoClickers(s.autoClickers || 0);
        setCritChance(clamp(s.critChance ?? 0.03, 0, 0.5));
        setBestCPS(s.bestCPS || 0);
        setTotalClicks(s.totalClicks || 0);
        setStartTime(s.startTime || Date.now());
      } catch (e) {
        console.warn("Save load failed", e);
      }
    }
  }, []);

  // --- Save periodically
  useEffect(() => {
    const t = setInterval(() => {
      const state: SaveState = {
        score,
        perClick,
        multiplierLevel,
        autoClickers,
        critChance,
        bestCPS,
        totalClicks,
        startTime,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }, 1500);
    return () => clearInterval(t);
  }, [score, perClick, multiplierLevel, autoClickers, critChance, bestCPS, totalClicks, startTime]);

  // --- Passive income loop
  useEffect(() => {
    const loop = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastTickRef.current) / 1000; // seconds
      lastTickRef.current = now;
      const gain = cps * dt;
      if (gain > 0) {
        setScore((s) => s + gain);
        setBestCPS((b) => Math.max(b, cps));
      }
    }, 50);
    return () => clearInterval(loop);
  }, [cps]);

  // --- Click handler with crits & fx
  const handleClick = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left + rect.x;
    const y = e.clientY - rect.top + rect.y;

    const isCrit = Math.random() < critChance;
    const amount = perClick * (isCrit ? 5 : 1);

    setScore((s) => s + amount);
    setTotalClicks((t) => t + 1);

    const id = ++idRef.current;
    setFloating((arr) => [...arr, { id, x, y, text: `+${format(amount)}${isCrit ? " ✨" : ""}` }]);
    setTimeout(() => setFloating((arr) => arr.filter((f) => f.id !== id)), 900);

    // burst particles sometimes
    setBursts((b) => [...b, { id, x, y, big: isCrit }]);
    setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 800);
  };

  // --- Purchases
  const buyMultiplier = () => {
    const price = nextMultiplierPrice;
    if (score >= price) {
      setScore((s) => s - price);
      setMultiplierLevel((l) => l + 1);
      setPerClick((p) => Math.round((p * 1.35 + Number.EPSILON) * 100) / 100);
    }
  };

  const buyAutoClicker = () => {
    const price = nextAutoPrice;
    if (score >= price) {
      setScore((s) => s - price);
      setAutoClickers((c) => c + 1);
    }
  };

  const buyCrit = () => {
    const price = nextCritPrice;
    if (score >= price && critChance < 0.5) {
      setScore((s) => s - price);
      setCritChance((c) => clamp(c + 0.02, 0, 0.5));
    }
  };

  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setScore(0);
    setPerClick(1);
    setMultiplierLevel(0);
    setAutoClickers(0);
    setCritChance(0.03);
    setBestCPS(0);
    setTotalClicks(0);
    setStartTime(Date.now());
  };

  // --- Derived stats
  const elapsed = Math.max(1, (Date.now() - startTime) / 1000);
  const avgCPS = (score / elapsed) || 0;
  const progressToNext = Math.min(100, (score / (nextMultiplierPrice || 1)) * 100);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-7 w-7" /> Cyber Clicker
            </h1>
            <p className="text-slate-300/80">A tiny incremental game with juicy animations and autosave.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={reset} className="gap-2">
              <RefreshCcw className="h-4 w-4" /> Reset Save
            </Button>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-900/70 backdrop-blur border-slate-700/60">
            <CardHeader className="pb-2">
              <CardDescription>Total Energy</CardDescription>
              <CardTitle className="text-4xl font-extrabold">{format(score)}</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="text-sm text-slate-300/80">Click the orb to harvest energy.</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 backdrop-blur border-slate-700/60">
            <CardHeader className="pb-2">
              <CardDescription>Energy / second</CardDescription>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-6 w-6" /> {cps.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="text-sm text-slate-300/80">Best: {bestCPS.toFixed(2)} CPS • Avg: {avgCPS.toFixed(2)} CPS</div>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/70 backdrop-blur border-slate-700/60">
            <CardHeader className="pb-2">
              <CardDescription>Per Click</CardDescription>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-6 w-6" /> {perClick.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
              <Progress value={progressToNext} className="h-2" />
              <div className="mt-2 text-xs text-slate-300/80">Progress to next upgrade cost ({format(nextMultiplierPrice)})</div>
            </CardContent>
          </Card>
        </div>

        {/* Main area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Click zone */}
          <Card className="lg:col-span-2 overflow-hidden bg-slate-900/70 border-slate-700/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-6 w-6" /> Energy Core
              </CardTitle>
              <CardDescription>Tap rapidly. Crits grant 5× energy. Chance: {(critChance * 100).toFixed(0)}%</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative isolate flex items-center justify-center py-8">
                {/* glow */}
                <div className="absolute -z-10 blur-3xl w-[36rem] h-[36rem] rounded-full bg-fuchsia-600/20" />
                <div className="absolute -z-10 blur-3xl w-[28rem] h-[28rem] rounded-full bg-cyan-500/20" />

                <motion.button
                  onClick={handleClick}
                  whileTap={{ scale: 0.94 }}
                  animate={{ boxShadow: ["0 0 40px rgba(56,189,248,0.25)", "0 0 100px rgba(217,70,239,0.35)", "0 0 40px rgba(56,189,248,0.25)"] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="relative inline-flex items-center justify-center rounded-full h-56 w-56 md:h-64 md:w-64 bg-gradient-to-br from-cyan-400 to-fuchsia-500 text-slate-900 font-extrabold text-3xl select-none"
                >
                  CLICK
                  {/* inner pulse */}
                  <motion.span
                    className="absolute inset-3 rounded-full bg-white/20"
                    animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.05, 1] }}
                    transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                  />
                </motion.button>

                {/* Floating numbers */}
                <AnimatePresence>
                  {floating.map((f) => (
                    <motion.div
                      key={f.id}
                      initial={{ x: f.x - 20, y: f.y - 20, opacity: 0, scale: 0.8 }}
                      animate={{ y: f.y - 80, opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                      className="absolute text-white text-xl font-bold drop-shadow"
                    >
                      {f.text}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Particles */}
                <AnimatePresence>
                  {bursts.map((b) => (
                    <Burst key={b.id} x={b.x} y={b.y} big={b.big} />
                  ))}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Shop */}
          <div className="space-y-4">
            <Card className="bg-slate-900/70 border-slate-700/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5"/> Upgrades</CardTitle>
                <CardDescription>Invest energy to grow faster.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Multiplier Lv.{multiplierLevel}</div>
                    <div className="text-xs text-slate-300/80">+35% per click each level</div>
                  </div>
                  <Button onClick={buyMultiplier} disabled={score < nextMultiplierPrice} className="gap-2">
                    <Sparkles className="h-4 w-4"/> Buy {format(nextMultiplierPrice)}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Auto Clicker ×{autoClickers}</div>
                    <div className="text-xs text-slate-300/80">+1 CPS (scaled by multiplier)</div>
                  </div>
                  <Button onClick={buyAutoClicker} disabled={score < nextAutoPrice} className="gap-2">
                    <TimerReset className="h-4 w-4"/> Buy {format(nextAutoPrice)}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">Crit Chance {(critChance * 100).toFixed(0)}%</div>
                    <div className="text-xs text-slate-300/80">+2% per purchase (max 50%)</div>
                  </div>
                  <Button onClick={buyCrit} disabled={score < nextCritPrice || critChance >= 0.5} className="gap-2">
                    <Trophy className="h-4 w-4"/> Buy {format(nextCritPrice)}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/70 border-slate-700/60">
              <CardHeader>
                <CardTitle>Stats</CardTitle>
                <CardDescription>Session performance</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <div className="text-slate-300/80">Total Clicks</div>
                  <div className="text-xl font-bold">{format(totalClicks)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <div className="text-slate-300/80">Best CPS</div>
                  <div className="text-xl font-bold">{bestCPS.toFixed(2)}</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <div className="text-slate-300/80">Session Time</div>
                  <div className="text-xl font-bold">{Math.floor(elapsed/60)}m {Math.floor(elapsed%60)}s</div>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-3">
                  <div className="text-slate-300/80">Version</div>
                  <div className="text-xl font-bold">{VERSION}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <footer className="mt-8 text-center text-xs text-slate-400/80">
          Pro tip: hold your mouse over the orb and spam click. Autosaves every ~1.5s.
        </footer>
      </div>
    </div>
  );
}

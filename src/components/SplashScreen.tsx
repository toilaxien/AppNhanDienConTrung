import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Search } from 'lucide-react';

interface Props {
  onFinish: () => void;
}

export default function SplashScreen({ onFinish }: Props) {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setIsComplete(true);
          setTimeout(onFinish, 1500); // Wait for butterfly animation
          return 100;
        }
        return prev + 1;
      });
    }, 30);

    return () => clearInterval(timer);
  }, [onFinish]);

  return (
    <div className="h-full w-full bg-[#C1E1C1] nature-bg flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Nature Decorations */}
      <div className="absolute top-0 left-0 text-7xl opacity-20 pointer-events-none select-none -rotate-45 translate-x-[-20%] translate-y-[-20%]">🌿</div>
      <div className="absolute top-0 right-0 text-7xl opacity-20 pointer-events-none select-none rotate-45 translate-x-[20%] translate-y-[-20%]">🍃</div>
      <div className="absolute bottom-10 left-10 text-5xl opacity-20 pointer-events-none select-none">🌼</div>
      <div className="absolute bottom-20 right-10 text-5xl opacity-20 pointer-events-none select-none">🌸</div>
      <div className="absolute top-1/2 -left-10 text-6xl opacity-10 pointer-events-none select-none">🌳</div>
      <div className="absolute top-1/3 -right-10 text-6xl opacity-10 pointer-events-none select-none">🎋</div>

      {/* Background patterns */}
      <div className="absolute top-10 left-10 opacity-20">
        <div className="w-20 h-20 bg-green-400 rounded-full blur-xl"></div>
      </div>
      <div className="absolute bottom-20 right-10 opacity-20">
        <div className="w-32 h-32 bg-yellow-400 rounded-full blur-xl"></div>
      </div>

      {/* Magnifying Glass Icon */}
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 12 }}
        className="relative mb-8"
      >
        <div className="w-48 h-48 bg-white rounded-full flex items-center justify-center shadow-2xl border-8 border-green-200 overflow-hidden">
          <div className="relative">
            <Search className="w-32 h-32 text-green-600 opacity-20" />
            {/* Ladybug inside */}
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="w-20 h-20 bg-red-600 rounded-full border-4 border-black relative shadow-inner">
                {/* Spots */}
                <div className="absolute top-3 left-4 w-3 h-3 bg-black rounded-full"></div>
                <div className="absolute top-3 right-4 w-3 h-3 bg-black rounded-full"></div>
                <div className="absolute bottom-4 left-8 w-3 h-3 bg-black rounded-full"></div>
                <div className="absolute top-8 left-3 w-3 h-3 bg-black rounded-full"></div>
                <div className="absolute top-8 right-3 w-3 h-3 bg-black rounded-full"></div>
                {/* Head */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-6 bg-black rounded-t-full"></div>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Sparkles */}
        <motion.div
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute -top-4 -right-4 text-yellow-400 text-4xl"
        >
          ✨
        </motion.div>
      </motion.div>

      <motion.h1
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-3xl font-black text-green-900 text-center mb-16 tracking-tighter uppercase"
        style={{ fontFamily: '"Fredoka One", cursive, sans-serif' }}
      >
        THẾ GIỚI NHỎ KỲ DIỆU
      </motion.h1>

      {/* Branch Progress Bar */}
      <div className="w-full max-w-xs relative mt-8">
        {/* The Branch */}
        <div className="h-4 w-full bg-[#8B4513]/30 rounded-full relative overflow-visible">
          <div className="absolute inset-0 bg-[#8B4513] rounded-full origin-left" style={{ width: `${progress}%` }}></div>
          {/* Branch details */}
          <div className="absolute -top-2 left-1/4 w-4 h-2 bg-[#8B4513] rotate-45 rounded-full"></div>
          <div className="absolute -bottom-2 right-1/4 w-4 h-2 bg-[#8B4513] -rotate-45 rounded-full"></div>
        </div>
        
        {/* Caterpillar / Butterfly mascot */}
        <motion.div
          className="absolute -top-10 text-4xl cursor-pointer"
          animate={isComplete ? { 
            y: [0, -100, -200], 
            x: [0, 50, 100],
            rotate: [0, 20, 0],
            opacity: [1, 1, 0]
          } : {
            x: 0,
            y: [0, -5, 0]
          }}
          transition={isComplete ? { duration: 1.5, ease: "easeOut" } : { repeat: Infinity, duration: 0.5 }}
          style={{ left: `calc(${progress}% - 20px)` }}
        >
          {progress < 25 ? '🥚' : progress < 75 ? '🐛' : '🦋'}
        </motion.div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <p className="text-green-800 font-bold text-sm uppercase tracking-widest z-10 mt-10">
          Đang đi tìm côn trùng...
        </p>
      </div>

    </div>
  );
}

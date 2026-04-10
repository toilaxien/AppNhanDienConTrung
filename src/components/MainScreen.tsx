import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { db, collection, query, where, getDocs, onSnapshot } from '../firebase';
import { Star, ShoppingBag, Trophy, User, Search, Sparkles } from 'lucide-react';

interface Props {
  profile: UserProfile | null;
  onNavigate: (screen: any) => void;
  onToast: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export default function MainScreen({ profile, onNavigate, onToast }: Props) {
  const [collectedCount, setCollectedCount] = useState(0);
  const [mission, setMission] = useState('Bọ rùa');
  const [flowers, setFlowers] = useState<{ id: number; x: number; y: number; scale: number }[]>([]);
  const [isShaking, setIsShaking] = useState(false);

  const handleButterflyTap = () => {
    if (isShaking) return;
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 800);
  };

  useEffect(() => {
    if (!profile) return;

    const q = query(collection(db, 'collections'), where('user_id', '==', profile.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const collectedIds = snapshot.docs.map(doc => doc.data().insect_id);
      const uniqueInsects = new Set(collectedIds);
      setCollectedCount(uniqueInsects.size);

      // Daily mission logic: pick a random insect not collected yet
      const allInsects = ['Kiến', 'Bướm', 'Gián', 'Chuồn chuồn', 'Ruồi', 'Châu chấu', 'Ong rừng', 'Bọ rùa', 'Muỗi', 'Nhện'];
      const uncollected = allInsects.filter(name => !collectedIds.includes(name)); // Simplified for now, should use IDs
      if (uncollected.length > 0) {
        setMission(uncollected[Math.floor(Math.random() * uncollected.length)]);
      }
    }, (error) => {
      console.warn("MainScreen collections snapshot error:", error);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleTouchBackground = (e: React.MouseEvent) => {
    const newFlower = {
      id: Date.now(),
      x: e.clientX,
      y: e.clientY,
      scale: 0
    };
    setFlowers(prev => [...prev.slice(-10), newFlower]);
    setTimeout(() => {
      setFlowers(prev => prev.filter(f => f.id !== newFlower.id));
    }, 2000);
  };

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden" onClick={handleTouchBackground}>
      {/* Nature Decorations (Branches/Leaves) */}
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-green-800/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-0 left-0 text-6xl opacity-20 pointer-events-none select-none -rotate-45 translate-x-[-20%] translate-y-[-20%]">🌿</div>
      <div className="absolute top-0 right-0 text-6xl opacity-20 pointer-events-none select-none rotate-45 translate-x-[20%] translate-y-[-20%]">🍃</div>
      <div className="absolute top-1/2 -left-8 text-4xl opacity-10 pointer-events-none select-none">🌳</div>
      <div className="absolute top-1/4 -right-6 text-4xl opacity-10 pointer-events-none select-none">🌵</div>
      <div className="absolute -top-4 -right-4 text-7xl opacity-10 pointer-events-none select-none rotate-90">🎋</div>
      <div className="absolute -bottom-4 -left-4 text-7xl opacity-10 pointer-events-none select-none -rotate-45">🌴</div>

      {/* Background Flowers */}
      <AnimatePresence>
        {flowers.map(flower => (
          <motion.div
            key={flower.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute pointer-events-none text-2xl z-0"
            style={{ left: flower.x - 15, top: flower.y - 15 }}
          >
            🌸
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Header */}
      <div className="p-4 flex justify-between items-start z-10">
        <div className="flex flex-col gap-2">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-2 shadow-lg border-2 border-yellow-200"
          >
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <span className="font-black text-green-900 text-lg">{profile?.total_points || 0}</span>
          </motion.div>
          
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2 shadow-lg border-2 border-green-200">
            <div className="text-[10px] font-black text-green-800 uppercase tracking-wider mb-1">Bộ sưu tập</div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-24 bg-gray-200 rounded-full overflow-hidden border border-green-100">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(collectedCount / 10) * 100}%` }}
                  className="h-full bg-green-500" 
                />
              </div>
              <span className="text-xs font-black text-green-900">{collectedCount}/10</span>
            </div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onNavigate('profile')}
          className="w-14 h-14 bg-white rounded-full border-4 border-white shadow-xl overflow-hidden"
        >
          <img 
            src={profile?.custom_avatar || `https://picsum.photos/seed/${profile?.avatar_id || 1}/100/100`} 
            alt="Avatar" 
            className="w-full h-full object-cover"
          />
        </motion.button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-xl font-black text-green-900 mb-2 uppercase tracking-tighter">
            Chào <span className="text-orange-600">{profile?.username}</span>!
          </h1>
          <div className="relative inline-block">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-white rounded-2xl p-4 shadow-2xl border-4 border-green-100 relative max-w-[180px]"
            >
              <p className="text-green-800 font-bold text-xs leading-tight">Hôm nay con hãy đi tìm bạn <span className="font-black text-orange-500 uppercase">{mission}</span> nhé!</p>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 bg-white border-b-4 border-r-4 border-green-100 rotate-45"></div>
            </motion.div>
            <motion.div
              animate={{ 
                y: [0, -10, 0],
                rotate: [0, 10, -10, 0]
              }}
              transition={{ repeat: Infinity, duration: 3 }}
              className="absolute -right-12 -top-8 text-4xl"
            >
              🐝
            </motion.div>
          </div>
        </motion.div>

        {/* Scan Button */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            animate={{ 
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 0 0 0px rgba(251, 191, 36, 0.4)",
                "0 0 0 15px rgba(251, 191, 36, 0)",
                "0 0 0 0px rgba(251, 191, 36, 0)"
              ]
            }}
            transition={{ 
              scale: { repeat: Infinity, duration: 2 },
              boxShadow: { repeat: Infinity, duration: 2 }
            }}
            onClick={() => onNavigate('scan')}
            className="w-44 h-44 bg-orange-500 rounded-full border-[8px] border-yellow-400 shadow-2xl flex flex-col items-center justify-center relative z-10"
          >
            <Search className="w-16 h-16 text-white mb-1" />
            <span className="text-white font-black text-xl tracking-tighter uppercase">SOI TÌM</span>
          </motion.button>
          
          <motion.div
            animate={{ 
              x: [0, 100, 0, -100, 0],
              y: [0, -50, -100, -50, 0],
            }}
            transition={{ 
              x: { repeat: Infinity, duration: 8, ease: "easeInOut" },
              y: { repeat: Infinity, duration: 8, ease: "easeInOut" },
            }}
            className="absolute top-0 left-0 z-20"
          >
            <motion.div
              onTap={handleButterflyTap}
              animate={isShaking ? {
                x: [-5, 5, -5, 5, 0],
                scale: [1, 1.3, 1],
                rotate: [0, 15, -15, 15, -15, 0]
              } : { 
                rotate: [0, 45, 90, 45, 0] 
              }}
              transition={isShaking ? {
                duration: 0.8,
                ease: "easeInOut"
              } : { 
                rotate: { repeat: Infinity, duration: 8, ease: "easeInOut" } 
              }}
              className="text-5xl cursor-pointer select-none"
            >
              🦋
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="pb-10 px-6 flex justify-around items-center z-20 bg-gradient-to-t from-[#C1E1C1] via-[#C1E1C1]/80 to-transparent pt-8">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onNavigate('library')}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-16 h-16 bg-white rounded-[1.5rem] shadow-xl flex items-center justify-center border-b-4 border-gray-200 group-active:border-b-0 transition-all">
            <ShoppingBag className="w-8 h-8 text-green-600" />
          </div>
          <span className="text-[10px] font-black text-green-900 uppercase tracking-widest bg-white/80 px-3 py-0.5 rounded-full shadow-sm">Thư viện</span>
        </motion.button>

        <div className="w-20"></div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => onNavigate('rank')}
          className="flex flex-col items-center gap-1 group"
        >
          <div className="w-16 h-16 bg-white rounded-[1.5rem] shadow-xl flex items-center justify-center border-b-4 border-gray-200 group-active:border-b-0 transition-all">
            <Trophy className="w-8 h-8 text-yellow-500" />
          </div>
          <span className="text-[10px] font-black text-green-900 uppercase tracking-widest bg-white/80 px-3 py-0.5 rounded-full shadow-sm">Xếp hạng</span>
        </motion.button>
      </div>

      {/* Background Grass & Flowers */}
      <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none z-0">
        <div className="flex items-end justify-around h-full opacity-40">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ repeat: Infinity, duration: 4 + i % 3, delay: i * 0.3 }}
              className="text-5xl"
            >
              {i % 3 === 0 ? '🌿' : i % 3 === 1 ? '🌼' : '🌱'}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../supabase';
import { RankItem } from '../types';
import { ArrowLeft, Trophy, Star, Crown } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export default function RankScreen({ onBack }: Props) {
  const [ranks, setRanks] = useState<RankItem[]>([]);
  const [myRank, setMyRank] = useState<RankItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: any = null;

    async function loadRanks() {
      const { data } = await supabase.from('users').select('*').order('total_points', { ascending: false }).limit(50);
      if (data) {
        const list: RankItem[] = data.map((doc, index) => ({
          user_id: doc.uid,
          username: doc.username,
          total_points: doc.total_points,
          avatar_id: doc.avatar_id,
          rank: index + 1
        }));
        setRanks(list);

        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const myIdx = list.findIndex(r => r.user_id === session.user.id);
          if (myIdx !== -1) {
            setMyRank(list[myIdx]);
          }
        }
        setLoading(false);
      }
    }

    loadRanks();

    channel = supabase.channel('public:users:rankscreen')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        loadRanks();
      })
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const top3 = ranks.slice(0, 3);
  const others = ranks.slice(3);

  return (
    <div className="flex-1 flex flex-col bg-[#C1E1C1] nature-bg overflow-hidden relative">
      {/* Decorative Elements */}
      <div className="absolute top-20 -left-6 text-5xl opacity-10 pointer-events-none select-none rotate-12">🌿</div>
      <div className="absolute top-40 -right-6 text-5xl opacity-10 pointer-events-none select-none -rotate-12">🍃</div>
      <div className="absolute bottom-1/4 -left-4 text-4xl opacity-10 pointer-events-none select-none">🌸</div>
      <div className="absolute bottom-1/3 -right-4 text-4xl opacity-10 pointer-events-none select-none">🌼</div>
      <div className="absolute top-1/2 left-0 text-6xl opacity-5 pointer-events-none select-none">🎋</div>

      {/* Header */}
      <div className="p-6 flex items-center gap-4">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-green-800"
        >
          <ArrowLeft className="w-6 h-6" />
        </motion.button>
        <h2 className="text-2xl font-black text-green-900 uppercase tracking-tighter">Bảng vàng thám hiểm</h2>
      </div>

      <div className="flex-1 overflow-y-auto pb-24 pt-4">
        {/* Top 3 Champions */}
        <div className="px-6 pt-20 pb-12 flex items-end justify-center gap-2 h-80">
          {/* Rank 2 */}
          {top3[1] && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex flex-col items-center flex-1"
            >
              <div className="relative mb-2">
                <div className="w-14 h-14 rounded-full border-4 border-gray-300 overflow-hidden bg-white shadow-lg">
                  <img src={top3[1].custom_avatar || `https://picsum.photos/seed/${top3[1].avatar_id || 1}/100/100`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-gray-300 rounded-full flex items-center justify-center font-bold text-white border-2 border-white text-xs">2</div>
              </div>
              <div className="bg-white/50 rounded-xl p-2 w-full text-center">
                <p className="text-[10px] font-black text-green-900 truncate">{top3[1].username}</p>
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-bold text-green-900">{top3[1].total_points}</span>
                </div>
              </div>
              <div className="h-12 w-full bg-gray-300/50 rounded-t-2xl mt-2"></div>
            </motion.div>
          )}

          {/* Rank 1 */}
          {top3[0] && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center flex-1 z-10"
            >
              <div className="relative mb-4">
                <Crown className="absolute -top-12 left-1/2 -translate-x-1/2 w-12 h-12 text-yellow-500 fill-yellow-500 drop-shadow-lg" />
                <div className="w-20 h-20 rounded-full border-4 border-yellow-400 overflow-hidden bg-white shadow-2xl">
                  <img src={top3[0].custom_avatar || `https://picsum.photos/seed/${top3[0].avatar_id || 1}/100/100`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-9 h-9 bg-yellow-400 rounded-full flex items-center justify-center font-bold text-white border-4 border-white">1</div>
              </div>
              <div className="bg-white rounded-xl p-2 w-full text-center shadow-lg">
                <p className="text-xs font-black text-green-900 truncate">{top3[0].username}</p>
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-bold text-green-900">{top3[0].total_points}</span>
                </div>
              </div>
              <div className="h-20 w-full bg-yellow-400/50 rounded-t-2xl mt-2"></div>
            </motion.div>
          )}

          {/* Rank 3 */}
          {top3[2] && (
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center flex-1"
            >
              <div className="relative mb-2">
                <div className="w-14 h-14 rounded-full border-4 border-orange-400 overflow-hidden bg-white shadow-lg">
                  <img src={top3[2].custom_avatar || `https://picsum.photos/seed/${top3[2].avatar_id || 1}/100/100`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-orange-400 rounded-full flex items-center justify-center font-bold text-white border-2 border-white text-xs">3</div>
              </div>
              <div className="bg-white/50 rounded-xl p-2 w-full text-center">
                <p className="text-[10px] font-black text-green-900 truncate">{top3[2].username}</p>
                <div className="flex items-center justify-center gap-1">
                  <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                  <span className="text-xs font-bold text-green-900">{top3[2].total_points}</span>
                </div>
              </div>
              <div className="h-8 w-full bg-orange-400/50 rounded-t-2xl mt-2"></div>
            </motion.div>
          )}
        </div>

        {/* List */}
        <div className="px-6 space-y-3">
          {others.map((item) => (
            <motion.div
              key={item.user_id}
              initial={{ x: -20, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              viewport={{ once: true }}
              className="bg-white/80 backdrop-blur-sm rounded-3xl p-3 flex items-center gap-4 shadow-sm border border-white/50"
            >
              <div className="w-8 text-center font-black text-green-800">{item.rank}</div>
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border-2 border-white">
                <img src={item.custom_avatar || `https://picsum.photos/seed/${item.avatar_id || 1}/100/100`} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-green-900">{item.username}</p>
              </div>
              <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-100">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="font-bold text-green-900">{item.total_points}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* My Rank Sticky */}
      {myRank && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white shadow-[0_-10px_20px_rgba(0,0,0,0.05)] z-20">
          <div className="bg-orange-500 rounded-[32px] p-4 flex items-center gap-4 shadow-xl">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center font-black text-orange-600 border-2 border-orange-200">
              {myRank.rank}
            </div>
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white bg-white">
              <img src={myRank.custom_avatar || `https://picsum.photos/seed/${myRank.avatar_id || 1}/100/100`} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <p className="text-white font-black uppercase tracking-tighter">Thứ hạng của con</p>
              <p className="text-orange-100 text-xs font-bold">Cố lên thám hiểm nhí!</p>
            </div>
            <div className="flex items-center gap-1 bg-white/20 px-4 py-2 rounded-full">
              <Star className="w-5 h-5 text-white fill-white" />
              <span className="text-white font-black">{myRank.total_points}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { db, doc, updateDoc, collection, query, where, getDocs, onSnapshot, orderBy } from '../firebase';
import { UserProfile, Insect } from '../types';
import { ArrowLeft, LogOut, Star, ShoppingBag, Trophy, Check, Lock } from 'lucide-react';

interface Props {
  profile: UserProfile | null;
  onBack: () => void;
  onLogout: () => void;
}

export default function ProfileScreen({ profile, onBack, onLogout }: Props) {
  const [insects, setInsects] = useState<Insect[]>([]);
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [rank, setRank] = useState<number | string>('--');

  useEffect(() => {
    let unsubscribeCollections: (() => void) | null = null;
    let unsubscribeRanks: (() => void) | null = null;

    async function loadData() {
      try {
        const insectSnap = await getDocs(collection(db, 'insects'));
        setInsects(insectSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Insect)));

        if (profile) {
          if (profile.uid.startsWith('local_')) {
            // Load local collections
            const localCollectionsStr = localStorage.getItem(`collections_${profile.uid}`);
            if (localCollectionsStr) {
              try {
                const localCollections = JSON.parse(localCollectionsStr);
                setCollectedIds(new Set(localCollections.map((c: any) => c.insect_id)));
              } catch (e) {
                console.error("Local collections parse error", e);
              }
            }
          } else {
            // Fetch collections for this user from Firestore
            const q = query(collection(db, 'collections'), where('user_id', '==', profile.uid));
            unsubscribeCollections = onSnapshot(q, (snapshot) => {
              setCollectedIds(new Set(snapshot.docs.map(doc => doc.data().insect_id)));
            }, (error) => {
              console.warn("Collections snapshot error:", error);
            });

            // Fetch all users to calculate rank
            const usersQ = query(collection(db, 'users'), orderBy('total_points', 'desc'));
            unsubscribeRanks = onSnapshot(usersQ, (snapshot) => {
              const list = snapshot.docs.map(doc => doc.id);
              const myIdx = list.indexOf(profile.uid);
              if (myIdx !== -1) {
                setRank(myIdx + 1);
              }
            }, (error) => {
              console.warn("Ranks snapshot error:", error);
            });
          }
        }
      } catch (err) {
        console.error("Profile data load error:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    return () => {
      if (unsubscribeCollections) unsubscribeCollections();
      if (unsubscribeRanks) unsubscribeRanks();
    };
  }, [profile?.uid]);

  const handleAvatarChange = async (id: number) => {
    if (!profile || saving) return;
    setSaving(true);
    try {
      if (profile.uid.startsWith('local_')) {
        const updatedProfile = { ...profile, avatar_id: id };
        localStorage.setItem('local_user', JSON.stringify(updatedProfile));
        // We need a way to refresh the app state, but for now this works on reload
        window.location.reload(); 
      } else {
        await updateDoc(doc(db, 'users', profile.uid), { avatar_id: id });
      }
    } catch (error) {
      console.error("Avatar update error:", error);
    } finally {
      setSaving(false);
    }
  };

  const getTitle = (count: number) => {
    if (count >= 8) return 'Nhà thám hiểm đại tài';
    if (count >= 4) return 'Chuyên gia thám hiểm';
    return 'Tập sự thám hiểm';
  };

  return (
    <div className="flex-1 flex flex-col bg-[#C1E1C1] nature-bg overflow-hidden relative">
      {/* Decorative Elements */}
      <div className="absolute top-20 -left-6 text-5xl opacity-10 pointer-events-none select-none rotate-12">🌿</div>
      <div className="absolute top-40 -right-6 text-5xl opacity-10 pointer-events-none select-none -rotate-12">🍃</div>
      <div className="absolute bottom-1/4 -left-4 text-4xl opacity-10 pointer-events-none select-none">🌸</div>
      <div className="absolute bottom-1/3 -right-4 text-4xl opacity-10 pointer-events-none select-none">🌼</div>

      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-green-800"
          >
            <ArrowLeft className="w-6 h-6" />
          </motion.button>
          <h2 className="text-2xl font-black text-green-900 uppercase tracking-tighter">Hồ sơ của bé</h2>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onLogout}
          className="w-10 h-10 bg-white/50 rounded-full flex items-center justify-center text-red-600"
        >
          <LogOut className="w-5 h-5" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 20, ease: 'linear' }}
              className="absolute inset-0 border-4 border-dashed border-yellow-400 rounded-full opacity-50"
            />
            <div className="w-32 h-32 bg-white rounded-full border-8 border-white shadow-2xl overflow-hidden relative z-10">
              <img 
                src={profile?.custom_avatar || `https://picsum.photos/seed/${profile?.avatar_id || 1}/200/200`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg border-4 border-white z-20">
              <Star className="w-5 h-5 text-white fill-white" />
            </div>
          </div>

          <div className="mt-6 text-center">
            <h3 className="text-2xl font-black text-green-900 uppercase tracking-tighter">{profile?.username}</h3>
            <div className="bg-green-800 text-white text-[10px] font-bold px-4 py-1 rounded-full uppercase tracking-widest mt-1">
              {getTitle(collectedIds.size)}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="bg-white rounded-3xl p-4 flex flex-col items-center shadow-sm border-b-4 border-gray-100">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500 mb-2" />
            <span className="text-lg font-black text-green-900">{profile?.total_points}</span>
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Điểm</span>
          </div>
          <div className="bg-white rounded-3xl p-4 flex flex-col items-center shadow-sm border-b-4 border-gray-100">
            <ShoppingBag className="w-6 h-6 text-green-600 mb-2" />
            <span className="text-lg font-black text-green-900">{collectedIds.size}/10</span>
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Bộ sưu tập</span>
          </div>
          <div className="bg-white rounded-3xl p-4 flex flex-col items-center shadow-sm border-b-4 border-gray-100">
            <Trophy className="w-6 h-6 text-orange-500 mb-2" />
            <span className="text-lg font-black text-green-900">#{rank}</span>
            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Thứ hạng</span>
          </div>
        </div>

        {/* Avatar Selection */}
        <div className="bg-white/50 rounded-[40px] p-6 border-2 border-green-800/10">
          <h4 className="text-sm font-black text-green-900 uppercase tracking-tighter mb-4">Chọn linh vật đại diện</h4>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {[...Array(10)].map((_, i) => {
              const id = i + 1;
              const isSelected = profile?.avatar_id === id;
              
              // Locking logic:
              // 1-2: Always unlocked
              // 3-4: Unlock at 3 insects
              // 5-6: Unlock at 5 insects
              // 7-8: Unlock at 7 insects
              // 9-10: Unlock at 10 insects
              let isLocked = false;
              if (id > 2 && id <= 4 && collectedIds.size < 3) isLocked = true;
              if (id > 4 && id <= 6 && collectedIds.size < 5) isLocked = true;
              if (id > 6 && id <= 8 && collectedIds.size < 7) isLocked = true;
              if (id > 8 && collectedIds.size < 10) isLocked = true;

              return (
                <motion.button
                  key={id}
                  whileTap={!isLocked ? { scale: 0.9 } : {}}
                  onClick={() => !isLocked && handleAvatarChange(id)}
                  className={`relative w-16 h-16 flex-shrink-0 rounded-2xl overflow-hidden border-4 transition-all ${
                    isSelected ? 'border-yellow-400 bg-white shadow-lg' : 
                    isLocked ? 'border-gray-200 bg-gray-100 grayscale' : 'border-white bg-white/50'
                  }`}
                >
                  <img 
                    src={`https://picsum.photos/seed/${id}/100/100`} 
                    alt="" 
                    className={`w-full h-full object-cover ${isLocked ? 'opacity-30' : ''}`}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-yellow-400/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-yellow-600" />
                    </div>
                  )}
                  {isLocked && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10">
                      <Lock className="w-5 h-5 text-gray-400" />
                      <span className="text-[8px] font-black text-gray-500 mt-0.5">
                        {id <= 4 ? '3' : id <= 6 ? '5' : id <= 8 ? '7' : '10'} 🦋
                      </span>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
          <p className="text-[10px] text-green-800/50 font-bold text-center mt-4">
            Con hãy tìm thêm côn trùng để mở khóa thêm linh vật nhé!
          </p>
        </div>

        {/* Parent Info */}
        <div className="mt-8 px-4">
          <div className="flex items-center gap-2 text-green-800/50">
            <Check className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Tài khoản đã được bảo vệ bởi bố mẹ</span>
          </div>
        </div>
      </div>
    </div>
  );
}

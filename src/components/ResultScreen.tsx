import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { UserProfile, Insect } from '../types';
import { ArrowLeft, Heart, RefreshCw, MapPin, Activity, Info, Star, Camera, Image as ImageIcon } from 'lucide-react';

interface Props {
  profile: UserProfile | null;
  insectId: string;
  photoData: string | null;
  location?: { lat: number; lng: number } | null;
  onBack: () => void;
  onSave: () => void;
}

export default function ResultScreen({ profile, insectId, photoData, location, onBack, onSave }: Props) {
  const [insect, setInsect] = useState<Insect | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showActualPhoto, setShowActualPhoto] = useState(insectId !== 'unknown_insect');
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    async function loadInsect() {
      const { data: insectData } = await supabase
        .from('insects')
        .select(`
          *,
          insect_lifecycles (
            step_order,
            step_name,
            description,
            icon
          )
        `)
        .eq('id', insectId)
        .single();
        
      if (insectData) {
        setInsect(insectData as Insect);

        // Check if new
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id;
        if (uid) {
          const { data: collectionsData } = await supabase
            .from('collections')
            .select('*')
            .eq('user_id', uid)
            .eq('insect_id', insectId);
          setIsNew(!collectionsData || collectionsData.length === 0);
        }
      }
      setLoading(false);
    }
    loadInsect();
  }, [insectId]);

  const handleSave = async () => {
    if (!insect || saving) return;

    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id || profile?.uid;
    if (!uid) return;

    setSaving(true);
    try {
      const pointsToAdd = isNew ? 10 : 5;
      
      if (uid.startsWith('local_')) {
        // Save to local storage
        const localCollectionsStr = localStorage.getItem(`collections_${uid}`);
        const localCollections = localCollectionsStr ? JSON.parse(localCollectionsStr) : [];
        
        const newItem = {
          id: `local_${Date.now()}`,
          user_id: uid,
          insect_id: insectId,
          captured_at: new Date().toISOString(),
          photo_path: photoData || insect.image_cartoon,
          latitude: location?.lat,
          longitude: location?.lng,
        };
        
        localCollections.push(newItem);
        localStorage.setItem(`collections_${uid}`, JSON.stringify(localCollections));

        // Update local user points
        const localUserStr = localStorage.getItem('local_user');
        if (localUserStr) {
          const localUser = JSON.parse(localUserStr);
          localUser.total_points = (localUser.total_points || 0) + pointsToAdd;
          localStorage.setItem('local_user', JSON.stringify(localUser));
        }
      } else {
        // Add to collections in Supabase
        await supabase.from('collections').insert([{
          user_id: uid,
          insect_id: insectId,
          captured_at: new Date().toISOString(),
          photo_path: photoData || insect.image_cartoon,
          latitude: location?.lat,
          longitude: location?.lng,
        }]);

        // Update user points in Supabase
        const { data: userSnap } = await supabase.from('users').select('total_points').eq('uid', uid).single();
        if (userSnap) {
          const currentPoints = userSnap.total_points || 0;
          await supabase.from('users').update({ total_points: currentPoints + pointsToAdd }).eq('uid', uid);
        }
      }

      onSave();
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full bg-black/50 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="text-white text-5xl"
        >
          ✨
        </motion.div>
      </div>
    );
  }

  if (!insect) {
    return (
      <div className="h-full w-full bg-[#C1E1C1] flex flex-col items-center justify-center p-8 text-center">
        <p className="text-green-900 font-black text-xl mb-4">Không tìm thấy thông tin loài này!</p>
        <button onClick={onBack} className="bg-green-600 text-white px-8 py-3 rounded-full font-bold">Quay lại</button>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black/90 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Eureka Glow */}
      <motion.div
        animate={{ opacity: [0.2, 0.4, 0.2], scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 3 }}
        className="absolute inset-0 bg-gradient-to-b from-yellow-400/20 to-transparent pointer-events-none"
      />

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onBack}
        className="absolute top-6 left-6 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white z-20"
      >
        <ArrowLeft className="w-6 h-6" />
      </motion.button>

      <div className="w-full max-w-sm relative perspective-1000">
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.8, type: 'spring', stiffness: 60 }}
          className="w-full h-[520px] relative preserve-3d"
        >
          {/* Front Side */}
          <div 
            className={`absolute inset-0 rounded-[3rem] shadow-2xl overflow-hidden border-[10px] backface-hidden flex flex-col ${insectId === 'unknown_insect' ? 'bg-gray-800' : 'bg-white'}`}
            style={{ borderColor: insectId === 'unknown_insect' ? '#374151' : insect.category_color }}
          >
            <div className="h-1/2 relative bg-gray-100 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.img 
                  key={showActualPhoto ? 'actual' : 'cartoon'}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  src={showActualPhoto && photoData ? photoData : insect.image_cartoon} 
                  alt={insect.name_vi} 
                  className={`w-full h-full object-cover ${insectId === 'unknown_insect' ? 'contrast-125 saturate-50' : ''}`}
                />
              </AnimatePresence>

              {insectId === 'unknown_insect' && (
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent pointer-events-none" />
              )}

              {/* Toggle Photo Button */}
              {photoData && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => { e.stopPropagation(); setShowActualPhoto(!showActualPhoto); }}
                  className="absolute bottom-4 right-4 w-12 h-12 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg text-green-600 border-2 border-green-100 z-10"
                >
                  {showActualPhoto ? <ImageIcon className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                </motion.button>
              )}

              {isNew && (
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-4 left-4 bg-yellow-400 text-white font-black px-3 py-1 rounded-full text-xs shadow-lg uppercase tracking-tighter"
                >
                  Mới!
                </motion.div>
              )}
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-1 shadow-md">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-xs font-black text-green-900">+{isNew ? 10 : 5}</span>
              </div>
            </div>

            <div className="flex-1 p-6 flex flex-col gap-3">
              <div className="text-center">
                <h2 className={`text-2xl font-black uppercase tracking-tighter leading-none mb-1 ${insectId === 'unknown_insect' ? 'text-gray-100' : 'text-green-900'}`}>
                  {insect.name_vi}
                </h2>
                <h3 className={`text-lg font-bold uppercase tracking-tighter leading-none mb-1 ${insectId === 'unknown_insect' ? 'text-gray-400' : 'text-green-700'}`}>
                  {insect.name_en}
                </h3>
                <p className={`text-[10px] italic font-bold ${insectId === 'unknown_insect' ? 'text-gray-500' : 'text-green-600'}`}>{insect.scientific_name}</p>
              </div>

              <p className={`text-xs font-bold leading-tight line-clamp-3 text-center px-2 ${insectId === 'unknown_insect' ? 'text-gray-300' : 'text-green-800'}`}>
                {insect.description}
              </p>

              <div className="grid grid-cols-2 gap-2 mt-auto">
                <div className={`rounded-2xl p-2 flex flex-col items-center justify-center border-2 ${insectId === 'unknown_insect' ? 'bg-gray-700 border-gray-600' : 'bg-green-50 border-green-100'}`}>
                  <span className="text-xl mb-1">{insect.habitat_icon}</span>
                  <span className={`text-[9px] font-black uppercase text-center ${insectId === 'unknown_insect' ? 'text-gray-300' : 'text-green-800'}`}>{insect.habitat}</span>
                </div>
                <div className={`rounded-2xl p-2 flex flex-col items-center justify-center border-2 ${insectId === 'unknown_insect' ? 'bg-gray-700 border-gray-600' : 'bg-green-50 border-green-100'}`}>
                  <span className="text-xl mb-1">{insect.role_icon}</span>
                  <span className={`text-[9px] font-black uppercase text-center ${insectId === 'unknown_insect' ? 'text-gray-300' : 'text-green-800'}`}>{insect.role}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Back Side (Lifecycle) */}
          {insectId !== 'unknown_insect' && (
            <div 
              className="absolute inset-0 bg-white rounded-[3rem] shadow-2xl overflow-hidden border-[10px] backface-hidden flex flex-col rotate-y-180"
              style={{ borderColor: insect.category_color }}
            >
              <div className="p-6 flex flex-col h-full overflow-hidden">
                <h3 className="text-xl font-black text-green-900 mb-4 flex items-center justify-center gap-2 uppercase tracking-tighter shrink-0">
                  <RefreshCw className="w-6 h-6 text-green-600" /> Vòng Đời
                </h3>
                
                <div className="flex-1 flex flex-col gap-2 justify-center overflow-y-auto no-scrollbar py-2">
                  {(insect.insect_lifecycles && insect.insect_lifecycles.length > 0 
                    ? [...insect.insect_lifecycles].sort((a,b) => a.step_order - b.step_order).map(s => ({ step: s.step_name, icon: s.icon, description: s.description }))
                    : (insect.lifecycle_steps && insect.lifecycle_steps.length > 0 ? insect.lifecycle_steps : [
                    { step: 'Trứng', icon: '🥚', description: 'Giai đoạn bắt đầu của sự sống.' },
                    { step: 'Ấu trùng', icon: '🐛', description: 'Bé lớn lên và ăn thật nhiều.' },
                    { step: 'Trưởng thành', icon: '🦋', description: 'Sẵn sàng khám phá thế giới!' }
                  ])).map((step, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ x: 20, opacity: 0 }}
                      animate={isFlipped ? { x: 0, opacity: 1 } : {}}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 bg-green-50 rounded-2xl p-3 border-2 border-green-100 shrink-0"
                    >
                      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm flex-shrink-0">
                        {step.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] font-black text-green-900 uppercase leading-none truncate">{step.step}</div>
                        <div className="text-[9px] font-bold text-green-700 leading-tight line-clamp-2">{step.description}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* Flip Button */}
        {insectId !== 'unknown_insect' && (
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsFlipped(!isFlipped)}
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-green-600 border-4 border-white z-10"
          >
            <RefreshCw className={`w-8 h-8 transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} />
          </motion.button>
        )}
      </div>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleSave}
        disabled={saving}
        className="mt-16 w-full max-w-xs bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-[2rem] shadow-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 uppercase tracking-tighter"
      >
        {saving ? 'Đang chuẩn bị...' : (
          <>
            NHẬN THẺ BÀI <Heart className="w-6 h-6 fill-white" />
          </>
        )}
      </motion.button>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, getDoc, auth, addDoc, collection, updateDoc, Timestamp, handleFirestoreError, OperationType, query, where, getDocs } from '../firebase';
import { UserProfile, Insect } from '../types';
import { ArrowLeft, Heart, RefreshCw, MapPin, Activity, Info, Star, Camera, Image as ImageIcon } from 'lucide-react';

interface Props {
  profile: UserProfile | null;
  insectId: string;
  photoData: string | null;
  onBack: () => void;
  onSave: () => void;
}

export default function ResultScreen({ profile, insectId, photoData, onBack, onSave }: Props) {
  const [insect, setInsect] = useState<Insect | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showActualPhoto, setShowActualPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    async function loadInsect() {
      const docRef = doc(db, 'insects', insectId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Insect;
        setInsect({ id: insectId, ...data } as Insect);

        // Check if new
        const uid = auth.currentUser?.uid;
        if (uid) {
          const q = query(collection(db, 'collections'), where('user_id', '==', uid), where('insect_id', '==', insectId));
          const snap = await getDocs(q);
          setIsNew(snap.empty);
        }
      }
      setLoading(false);
    }
    loadInsect();
  }, [insectId]);

  const handleSave = async () => {
    if (!insect || saving) return;

    const uid = auth.currentUser?.uid || profile?.uid;
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
          captured_at: { seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 }, // Mock Firestore timestamp
          photo_path: photoData || insect.image_cartoon,
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
        // Add to collections in Firestore
        await addDoc(collection(db, 'collections'), {
          user_id: uid,
          insect_id: insectId,
          captured_at: Timestamp.now(),
          photo_path: photoData || insect.image_cartoon,
        });

        // Update user points in Firestore
        const userRef = doc(db, 'users', uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentPoints = userSnap.data().total_points || 0;
          await updateDoc(userRef, { total_points: currentPoints + pointsToAdd });
        }
      }

      onSave();
    } catch (error) {
      console.error("Save error:", error);
      handleFirestoreError(error, OperationType.WRITE, 'collections');
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
            className="absolute inset-0 bg-white rounded-[3rem] shadow-2xl overflow-hidden border-[10px] backface-hidden flex flex-col"
            style={{ borderColor: insect.category_color }}
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
                  className="w-full h-full object-cover"
                />
              </AnimatePresence>

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
                <h2 className="text-2xl font-black text-green-900 uppercase tracking-tighter leading-none mb-1">
                  {insect.name_vi}
                </h2>
                <h3 className="text-lg font-bold text-green-700 uppercase tracking-tighter leading-none mb-1">
                  {insect.name_en}
                </h3>
                <p className="text-[10px] italic text-green-600 font-bold">{insect.scientific_name}</p>
              </div>

              <p className="text-xs text-green-800 font-bold leading-tight line-clamp-3 text-center px-2">
                {insect.description}
              </p>

              <div className="grid grid-cols-2 gap-2 mt-auto">
                <div className="bg-green-50 rounded-2xl p-2 flex flex-col items-center justify-center border-2 border-green-100">
                  <span className="text-xl mb-1">{insect.habitat_icon}</span>
                  <span className="text-[9px] font-black text-green-800 uppercase text-center">{insect.habitat}</span>
                </div>
                <div className="bg-green-50 rounded-2xl p-2 flex flex-col items-center justify-center border-2 border-green-100">
                  <span className="text-xl mb-1">{insect.role_icon}</span>
                  <span className="text-[9px] font-black text-green-800 uppercase text-center">{insect.role}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Back Side (Lifecycle) */}
          <div 
            className="absolute inset-0 bg-white rounded-[3rem] shadow-2xl overflow-hidden border-[10px] backface-hidden flex flex-col rotate-y-180"
            style={{ borderColor: insect.category_color }}
          >
            <div className="p-6 flex flex-col h-full overflow-hidden">
              <h3 className="text-xl font-black text-green-900 mb-4 flex items-center justify-center gap-2 uppercase tracking-tighter shrink-0">
                <RefreshCw className="w-6 h-6 text-green-600" /> Vòng Đời
              </h3>
              
              <div className="flex-1 flex flex-col gap-2 justify-center overflow-y-auto no-scrollbar py-2">
                {(insect.lifecycle_steps && insect.lifecycle_steps.length > 0 ? insect.lifecycle_steps : [
                  { step: 'Trứng', icon: '🥚', description: 'Giai đoạn bắt đầu của sự sống.' },
                  { step: 'Ấu trùng', icon: '🐛', description: 'Bé lớn lên và ăn thật nhiều.' },
                  { step: 'Trưởng thành', icon: '🦋', description: 'Sẵn sàng khám phá thế giới!' }
                ]).map((step, i) => (
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
        </motion.div>

        {/* Flip Button */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsFlipped(!isFlipped)}
          className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 bg-white rounded-full shadow-2xl flex items-center justify-center text-green-600 border-4 border-white z-10"
        >
          <RefreshCw className={`w-8 h-8 transition-transform duration-500 ${isFlipped ? 'rotate-180' : ''}`} />
        </motion.button>
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

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { db, collection, query, where, getDocs, auth, onSnapshot } from '../firebase';
import { Insect, CollectionItem, UserProfile } from '../types';
import { ArrowLeft, Lock, Calendar, X, ChevronLeft, ChevronRight, Star, RefreshCw, Sparkles } from 'lucide-react';

interface Props {
  profile: UserProfile | null;
  onBack: () => void;
}

export default function LibraryScreen({ profile, onBack }: Props) {
  const [insects, setInsects] = useState<Insect[]>([]);
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInsect, setSelectedInsect] = useState<Insect | null>(null);
  const [isPouchOpen, setIsPouchOpen] = useState(false);
  const [isTorn, setIsTorn] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [userPhotos, setUserPhotos] = useState<CollectionItem[]>([]);

  const dragY = useMotionValue(0);
  const topPartY = useTransform(dragY, [0, 150], [0, -40]);
  const topPartRotate = useTransform(dragY, [0, 150], [0, -5]);
  const bottomPartY = useTransform(dragY, [0, 150], [0, 40]);
  const bottomPartRotate = useTransform(dragY, [0, 150], [0, 2]);
  const tearOpacity = useTransform(dragY, [0, 100], [0, 1]);
  const hintOpacity = useTransform(dragY, [0, 50], [1, 0]);

  useEffect(() => {
    async function loadData() {
      const insectSnap = await getDocs(collection(db, 'insects'));
      const insectList = insectSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Insect));
      setInsects(insectList);

      if (profile) {
        const q = query(collection(db, 'collections'), where('user_id', '==', profile.uid));
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const collectionList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CollectionItem));
          setCollections(collectionList);
        }, (error) => {
          console.warn("Library collections snapshot error:", error);
        });
        return () => unsubscribe();
      }
      setLoading(false);
    }
    loadData();
  }, [profile]);

  const isCollected = (insectId: string) => {
    return collections.some(c => c.insect_id === insectId);
  };

  const handleInsectClick = (insect: Insect) => {
    if (!isCollected(insect.id)) return;
    const photos = collections.filter(c => c.insect_id === insect.id).sort((a, b) => b.captured_at.seconds - a.captured_at.seconds);
    setUserPhotos(photos);
    setSelectedInsect(insect);
    setIsPouchOpen(true);
    setIsTorn(false);
    setPhotoIndex(0);
    dragY.set(0);
  };

  const collectedCount = new Set(collections.map(c => c.insect_id)).size;

  return (
    <div className="flex-1 flex flex-col bg-[#C1E1C1] nature-bg overflow-hidden relative">
      {/* Decorative Elements */}
      <div className="absolute top-40 -left-6 text-5xl opacity-10 pointer-events-none select-none rotate-12">🌿</div>
      <div className="absolute top-60 -right-6 text-5xl opacity-10 pointer-events-none select-none -rotate-12">🍃</div>
      <div className="absolute bottom-1/4 -left-4 text-4xl opacity-10 pointer-events-none select-none">🌸</div>
      <div className="absolute bottom-1/3 -right-4 text-4xl opacity-10 pointer-events-none select-none">🌼</div>

      {/* Wooden Ruler Progress */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-4 mb-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onBack}
            className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-green-800"
          >
            <ArrowLeft className="w-6 h-6" />
          </motion.button>
          <h2 className="text-2xl font-black text-green-900 uppercase tracking-tighter">Thư viện</h2>
        </div>

        <div className="relative h-12 bg-[#8B4513] rounded-lg border-4 border-[#5D2E0A] shadow-inner flex items-center px-4 overflow-hidden">
          {/* Ruler Marks */}
          <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-30">
            {[...Array(11)].map((_, i) => (
              <div key={i} className={`h-full w-1 bg-white ${i % 5 === 0 ? 'h-full' : 'h-1/2 mt-auto'}`} />
            ))}
          </div>
          <div className="relative flex-1 h-4 bg-black/20 rounded-full overflow-hidden border-2 border-[#5D2E0A]">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(collectedCount / 10) * 100}%` }}
              className="h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
            />
          </div>
          <span className="ml-4 font-black text-white text-lg drop-shadow-md">{collectedCount}/10</span>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pt-4 pb-24">
        <div className="grid grid-cols-2 gap-6">
          {insects.map((insect) => {
            const collected = isCollected(insect.id);
            return (
              <motion.button
                key={insect.id}
                whileHover={collected ? { scale: 1.05 } : {}}
                whileTap={collected ? { scale: 0.95 } : {}}
                onClick={() => handleInsectClick(insect)}
                className="relative flex flex-col items-center"
              >
                <div 
                  className={`aspect-[3/4] w-full rounded-[2.5rem] overflow-hidden shadow-2xl border-[6px] transition-all duration-500 relative ${
                    collected 
                      ? 'bg-white border-white' 
                      : 'bg-gray-400/30 border-gray-400/20 scale-95'
                  }`}
                  style={collected ? { borderColor: insect.category_color } : {}}
                >
                  <img 
                    src={insect.image_cartoon} 
                    alt={insect.name_vi} 
                    className={`w-full h-full object-cover transition-all duration-700 ${collected ? 'opacity-100' : 'opacity-20 grayscale brightness-50'}`}
                  />
                  {!collected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="w-10 h-10 text-gray-500/30" />
                    </div>
                  )}
                  {collected && (
                    <div className="absolute top-2 right-2 bg-yellow-400 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md">
                      <Star className="w-3 h-3 fill-white" />
                    </div>
                  )}
                </div>
                <p className={`mt-3 text-xs font-black uppercase tracking-tighter ${collected ? 'text-green-900' : 'text-gray-500/50'}`}>
                  {collected ? insect.name_vi : '???'}
                </p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Pouch Opening Modal */}
      <AnimatePresence>
        {isPouchOpen && selectedInsect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6"
          >
            <div className="w-full max-w-sm relative h-[600px] flex items-center justify-center">
              {!isTorn ? (
                <div className="relative w-64 h-96">
                  {/* The Pouch (Tearing Animation) */}
                  <motion.div 
                    drag="y"
                    dragConstraints={{ top: 0, bottom: 300 }}
                    style={{ y: dragY }}
                    onDragEnd={(_, info) => {
                      if (info.offset.y > 150) {
                        setIsTorn(true);
                        dragY.set(0);
                      } else {
                        dragY.set(0);
                      }
                    }}
                    className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
                  >
                    {/* Invisible drag handle */}
                    <div className="absolute inset-0" />
                  </motion.div>

                  {/* Top Half */}
                  <motion.div
                    style={{ y: topPartY, rotate: topPartRotate }}
                    className="absolute top-0 left-0 right-0 h-1/4 bg-gradient-to-br from-orange-400 to-red-500 rounded-t-3xl border-t-8 border-l-8 border-r-8 border-white/20 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    <div className="absolute bottom-0 left-0 right-0 h-4 flex">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className="flex-1 h-full bg-[#C1E1C1] nature-bg" style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }} />
                      ))}
                    </div>
                  </motion.div>

                  {/* Bottom Half */}
                  <motion.div
                    style={{ y: bottomPartY, rotate: bottomPartRotate }}
                    className="absolute top-1/4 left-0 right-0 bottom-0 bg-gradient-to-br from-orange-400 to-red-500 rounded-b-3xl border-b-8 border-l-8 border-r-8 border-white/20 flex flex-col items-center justify-center p-8 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    <div className="absolute top-0 left-0 right-0 h-4 flex">
                      {[...Array(10)].map((_, i) => (
                        <div key={i} className="flex-1 h-full bg-[#C1E1C1] nature-bg" style={{ clipPath: 'polygon(0 0, 50% 100%, 100% 0)' }} />
                      ))}
                    </div>
                    
                    <Sparkles className="w-16 h-16 text-white/50 absolute top-4 animate-pulse" />
                    <div className="text-white font-black text-2xl text-center uppercase tracking-tighter drop-shadow-lg z-10">
                      TÚI THẺ<br/>{selectedInsect.name_vi}
                    </div>
                    <motion.div 
                      style={{ opacity: hintOpacity }}
                      className="mt-8 bg-white/20 backdrop-blur-sm px-6 py-2 rounded-full text-white font-bold text-xs z-10"
                    >
                      Kéo xuống để xé!
                    </motion.div>
                  </motion.div>

                  {/* Tear Effect Glow */}
                  <motion.div 
                    style={{ opacity: tearOpacity }}
                    className="absolute top-1/4 left-0 right-0 h-1 bg-white shadow-[0_0_20px_white] z-10"
                  />
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full flex flex-col items-center justify-center"
                >
                  {/* Card Stack */}
                  <div className="relative w-full h-[450px] perspective-1000">
                    <AnimatePresence mode="popLayout">
                      {userPhotos.map((photo, idx) => {
                        if (idx < photoIndex) return null;
                        const offset = idx - photoIndex;
                        if (offset > 2) return null; // Only show top 3 cards

                        return (
                          <motion.div
                            key={photo.id}
                            initial={{ scale: 0.8, y: 50, opacity: 0 }}
                            animate={{ 
                              scale: 1 - offset * 0.05, 
                              y: offset * -15, 
                              opacity: 1,
                              zIndex: 100 - offset
                            }}
                            exit={{ x: 500, rotate: 20, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            onDragEnd={(_, info) => {
                              if (info.offset.x > 100 || info.offset.x < -100) {
                                if (photoIndex < userPhotos.length - 1) {
                                  setPhotoIndex(prev => prev + 1);
                                } else {
                                  setPhotoIndex(0); // Loop back or just stay
                                }
                              }
                            }}
                            className="absolute inset-0 bg-white rounded-[2.5rem] shadow-2xl border-[10px] overflow-hidden flex flex-col cursor-grab active:cursor-grabbing"
                            style={{ borderColor: selectedInsect.category_color }}
                          >
                            <div className="h-3/4 relative bg-gray-100">
                              <img src={photo.photo_path} className="w-full h-full object-cover" />
                              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-md">
                                <span className="text-[10px] font-black text-green-900 uppercase">Thẻ {idx + 1}/{userPhotos.length}</span>
                              </div>
                            </div>
                            <div className="flex-1 p-4 flex flex-col justify-center items-center text-center bg-white">
                              <h3 className="text-lg font-black text-green-900 uppercase tracking-tighter leading-none mb-1">{selectedInsect.name_vi}</h3>
                              <div className="flex items-center gap-2 text-green-600 font-bold text-[10px] uppercase tracking-widest">
                                <Calendar className="w-3 h-3" />
                                Ngày thu thập: {photo.captured_at.toDate().toLocaleDateString('vi-VN')}
                              </div>
                              <div className="mt-2 flex gap-1">
                                <span className="text-xl">✨</span>
                                <span className="text-xl">🦋</span>
                                <span className="text-xl">✨</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Navigation Hint */}
                  <div className="mt-12 flex flex-col items-center gap-4">
                    <p className="text-white font-bold text-sm uppercase tracking-widest animate-pulse">
                      Lướt sang để xem ảnh khác!
                    </p>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setIsPouchOpen(false)}
                      className="bg-white text-green-900 font-black px-8 py-3 rounded-full shadow-xl uppercase tracking-tighter"
                    >
                      Đóng túi
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Close Button */}
              {!isTorn && (
                <button 
                  onClick={() => setIsPouchOpen(false)}
                  className="absolute -top-10 right-0 text-white/50 hover:text-white"
                >
                  <X className="w-10 h-10" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

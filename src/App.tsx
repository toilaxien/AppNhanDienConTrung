import React, { useState, useEffect } from 'react';
import { auth, onAuthStateChanged, FirebaseUser, db, doc, getDoc, setDoc, handleFirestoreError, OperationType, onSnapshot } from './firebase';
import { UserProfile } from './types';
import SplashScreen from './components/SplashScreen';
import AuthScreen from './components/AuthScreen';
import MainScreen from './components/MainScreen';
import ScanScreen from './components/ScanScreen';
import ResultScreen from './components/ResultScreen';
import LibraryScreen from './components/LibraryScreen';
import RankScreen from './components/RankScreen';
import ProfileScreen from './components/ProfileScreen';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, X } from 'lucide-react';

type Screen = 'main' | 'scan' | 'result' | 'library' | 'rank' | 'profile';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const [selectedInsectId, setSelectedInsectId] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  // Toast system
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  const showToast = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    // Check for local user first
    const localUserStr = localStorage.getItem('local_user');
    if (localUserStr) {
      try {
        const localUser = JSON.parse(localUserStr);
        setProfile(localUser);
        setLoading(false);
        return;
      } catch (e) {
        console.error("Local user parse error", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Real-time profile listener
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const unsubscribeProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile({ uid: firebaseUser.uid, ...docSnap.data() } as UserProfile);
          } else {
            // New user from Google Auth
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              username: firebaseUser.displayName || 'Thám hiểm nhí',
              total_points: 0,
              avatar_id: 1, // Default avatar
              role: 'user'
            };
            setDoc(userDocRef, newProfile);
            setProfile(newProfile);
          }
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });

        return () => unsubscribeProfile();
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#C1E1C1]">
        <div className="animate-bounce text-2xl font-bold text-green-800">Đang tải...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-screen w-screen bg-[#A8D1A8] flex items-center justify-center p-0 sm:p-4 overflow-hidden relative">
        {/* Outer Background Decorations */}
        <div className="absolute top-10 left-10 text-6xl opacity-20 pointer-events-none select-none">🍃</div>
        <div className="absolute bottom-10 right-10 text-6xl opacity-20 pointer-events-none select-none">🌸</div>
        <div className="absolute top-1/2 -left-5 text-6xl opacity-20 pointer-events-none select-none">🌿</div>
        <div className="absolute top-1/4 -right-5 text-6xl opacity-20 pointer-events-none select-none">🌼</div>

        <div className="h-full w-full max-w-[430px] max-h-[932px] bg-[#C1E1C1] nature-bg overflow-hidden flex flex-col font-sans relative shadow-2xl sm:rounded-[3rem] sm:border-[12px] border-green-900/20">
          <AuthScreen onToast={showToast} />
          
          {/* Toast Notification for Auth */}
          <AnimatePresence>
            {toast && (
              <motion.div
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                className="absolute bottom-12 left-6 right-6 z-[100]"
              >
                <div className={`rounded-2xl p-4 shadow-2xl flex items-center gap-3 border-2 ${
                  toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
                  toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
                  'bg-white border-blue-100 text-blue-800'
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    toast.type === 'error' ? 'bg-red-100' : 
                    toast.type === 'success' ? 'bg-green-100' : 
                    'bg-blue-50'
                  }`}>
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="flex-1 font-bold text-sm">{toast.message}</p>
                  <button onClick={() => setToast(null)} className="p-1">
                    <X className="w-4 h-4 opacity-50" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem('local_user');
    auth.signOut();
    setProfile(null);
    setCurrentScreen('main');
    showToast("Đã đăng xuất. Hẹn gặp lại con nhé!", "info");
  };

  return (
    <div className="h-screen w-screen bg-[#A8D1A8] flex items-center justify-center p-0 sm:p-4 overflow-hidden relative">
      {/* Outer Background Decorations */}
      <div className="absolute top-10 left-10 text-6xl opacity-20 pointer-events-none select-none">🍃</div>
      <div className="absolute bottom-10 right-10 text-6xl opacity-20 pointer-events-none select-none">🌸</div>
      <div className="absolute top-1/2 -left-5 text-6xl opacity-20 pointer-events-none select-none">🌿</div>
      <div className="absolute top-1/4 -right-5 text-6xl opacity-20 pointer-events-none select-none">🌼</div>

      {/* Mobile Frame Container */}
      <div className="h-full w-full max-w-[430px] max-h-[932px] bg-[#C1E1C1] nature-bg overflow-hidden flex flex-col font-sans relative shadow-2xl sm:rounded-[3rem] sm:border-[12px] border-green-900/20">
        {/* Floating Nature Elements (Inside Frame) */}
        <div className="absolute top-20 -left-4 text-4xl opacity-10 pointer-events-none select-none rotate-45">🌿</div>
        <div className="absolute bottom-40 -right-4 text-4xl opacity-10 pointer-events-none select-none -rotate-12">🍃</div>
        <div className="absolute top-1/3 -right-2 text-2xl opacity-10 pointer-events-none select-none">🌸</div>
        <div className="absolute bottom-1/4 -left-2 text-2xl opacity-10 pointer-events-none select-none">🌼</div>
        <AnimatePresence mode="wait">
          {currentScreen === 'main' && (
            <MainScreen 
              profile={profile} 
              onNavigate={setCurrentScreen} 
              onToast={showToast}
            />
          )}
          {currentScreen === 'scan' && (
            <ScanScreen 
              onBack={() => setCurrentScreen('main')} 
              onResult={(id, photo) => {
                setSelectedInsectId(id);
                setCapturedPhoto(photo);
                setCurrentScreen('result');
              }} 
              onToast={showToast}
            />
          )}
          {currentScreen === 'result' && selectedInsectId && (
            <ResultScreen 
              profile={profile}
              insectId={selectedInsectId} 
              photoData={capturedPhoto}
              onBack={() => setCurrentScreen('main')} 
              onSave={() => {
                // Refresh profile points
                if (profile) {
                  setProfile({ ...profile, total_points: profile.total_points + 10 });
                }
                setCurrentScreen('main');
                showToast("Chúc mừng! Con đã nhận được 10 điểm!", "success");
              }}
            />
          )}
          {currentScreen === 'library' && (
            <LibraryScreen 
              profile={profile}
              onBack={() => setCurrentScreen('main')} 
            />
          )}
          {currentScreen === 'rank' && (
            <RankScreen 
              onBack={() => setCurrentScreen('main')} 
            />
          )}
          {currentScreen === 'profile' && (
            <ProfileScreen 
              profile={profile}
              onBack={() => setCurrentScreen('main')} 
              onLogout={handleLogout}
            />
          )}
        </AnimatePresence>

        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-24 left-6 right-6 z-[100]"
            >
              <div className={`rounded-2xl p-4 shadow-2xl flex items-center gap-3 border-2 ${
                toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
                toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 
                'bg-white border-blue-100 text-blue-800'
              }`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  toast.type === 'error' ? 'bg-red-100' : 
                  toast.type === 'success' ? 'bg-green-100' : 
                  'bg-blue-50'
                }`}>
                  <Bell className="w-5 h-5" />
                </div>
                <p className="flex-1 font-bold text-sm">{toast.message}</p>
                <button onClick={() => setToast(null)} className="p-1">
                  <X className="w-4 h-4 opacity-50" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

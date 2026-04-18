import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { UserProfile } from './types';
import SplashScreen from './components/SplashScreen';
import AuthScreen from './components/AuthScreen';
import MainScreen from './components/MainScreen';
import ScanScreen from './components/ScanScreen';
import ResultScreen from './components/ResultScreen';
import LibraryScreen from './components/LibraryScreen';
import RankScreen from './components/RankScreen';
import ProfileScreen from './components/ProfileScreen';
import UpdatePasswordScreen from './components/UpdatePasswordScreen';
import MapScreen from './components/MapScreen';
import PermissionScreen from './components/PermissionScreen';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, X } from 'lucide-react';

type Screen = 'main' | 'scan' | 'result' | 'library' | 'rank' | 'profile' | 'update_password' | 'map';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [showPermissions, setShowPermissions] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<Screen>('main');
  const [selectedInsectId, setSelectedInsectId] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [captureLocation, setCaptureLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isRecoveringPassword, setIsRecoveringPassword] = useState(false);

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

    let channel: any = null;
    let currentUserId: string | null = null;

    const ensureUnknownInsectExists = async () => {
      try {
        const { data } = await supabase.from('insects').select('id').eq('id', 'unknown_insect').single();
        if (!data) {
          await supabase.from('insects').insert([{
            id: 'unknown_insect',
            name_vi: 'Côn trùng mới',
            name_en: 'Unknown Insect',
            scientific_name: 'Incognita',
            description: 'Một loài côn trùng mới mà hệ thống chưa nhận diện được. Bé hãy tiếp tục theo dõi nhé!',
            habitat: 'Chưa rõ',
            habitat_icon: '🌍',
            role: 'Bí ẩn',
            role_icon: '❓',
            category_color: '#9ca3af',
            image_cartoon: 'https://cdn-icons-png.flaticon.com/512/1864/1864520.png'
          }]);
        }
      } catch (e) {
        // Ignore if it already exists or fails
      }
    };

    const handleSession = async (session: any) => {
      ensureUnknownInsectExists();
      setUser(session?.user || null);
      
      if (!session?.user) {
        currentUserId = null;
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
        setProfile(null);
        setLoading(false);
        return;
      }

      if (currentUserId === session.user.id) {
        setLoading(false);
        return;
      }

      currentUserId = session.user.id;

      try {
        const { data: existingProfile, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('uid', session.user.id)
          .single();

        if (existingProfile) {
          setProfile(existingProfile as UserProfile);
        } else if (fetchError && fetchError.code === 'PGRST116') {
          // Not found, create new profile
          const newProfile: UserProfile = {
            uid: session.user.id,
            username: session.user.user_metadata?.full_name || 'Thám hiểm nhí',
            total_points: 0,
            avatar_id: 1, // Default avatar
            role: 'user'
          };
          await supabase.from('users').insert([newProfile]);
          setProfile(newProfile);
        } else {
          console.error("Error fetching profile:", fetchError);
        }

        // Real-time profile listener
        if (channel) {
          supabase.removeChannel(channel);
        }
        channel = supabase.channel(`profile_${session.user.id}_${Date.now()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `uid=eq.${session.user.id}` }, (payload) => {
            setProfile(payload.new as UserProfile);
          })
          .subscribe();

      } catch (err) {
        console.error("Session handling error:", err);
      } finally {
        setLoading(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
      // Check if URL has recovery token
      if (window.location.hash.includes('type=recovery')) {
        setIsRecoveringPassword(true);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecoveringPassword(true);
      }
      handleSession(session);
    });

    return () => {
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (showPermissions) {
    return (
      <div className="h-screen w-screen bg-[#A8D1A8] flex items-center justify-center p-0 sm:p-4 overflow-hidden relative">
        <div className="absolute top-10 left-10 text-6xl opacity-20 pointer-events-none select-none">🍃</div>
        <div className="absolute bottom-10 right-10 text-6xl opacity-20 pointer-events-none select-none">🌸</div>
        <div className="absolute top-1/2 -left-5 text-6xl opacity-20 pointer-events-none select-none">🌿</div>
        <div className="absolute top-1/4 -right-5 text-6xl opacity-20 pointer-events-none select-none">🌼</div>

        <div className="h-full w-full max-w-[430px] max-h-[932px] bg-[#C1E1C1] nature-bg overflow-hidden flex flex-col font-sans relative shadow-2xl sm:rounded-[3rem] sm:border-[12px] border-green-900/20">
          <PermissionScreen onComplete={() => {
            localStorage.setItem('permissions_requested', 'true');
            setShowPermissions(false);
          }} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#C1E1C1]">
        <div className="animate-bounce text-2xl font-bold text-green-800">Đang tải...</div>
      </div>
    );
  }

  if (isRecoveringPassword) {
    return (
      <div className="h-screen w-screen bg-[#A8D1A8] flex items-center justify-center p-0 sm:p-4 overflow-hidden relative">
        <div className="absolute top-10 left-10 text-6xl opacity-20 pointer-events-none select-none">🍃</div>
        <div className="absolute bottom-10 right-10 text-6xl opacity-20 pointer-events-none select-none">🌸</div>
        <div className="absolute top-1/2 -left-5 text-6xl opacity-20 pointer-events-none select-none">🌿</div>
        <div className="absolute top-1/4 -right-5 text-6xl opacity-20 pointer-events-none select-none">🌼</div>

        <div className="h-full w-full max-w-[430px] max-h-[932px] bg-[#C1E1C1] nature-bg overflow-hidden flex flex-col font-sans relative shadow-2xl sm:rounded-[3rem] sm:border-[12px] border-green-900/20">
          <UpdatePasswordScreen 
            onBack={() => {
              setIsRecoveringPassword(false);
              window.location.hash = '';
            }} 
            onToast={showToast}
          />
          
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

  const handleLogout = async () => {
    localStorage.removeItem('local_user');
    await supabase.auth.signOut();
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
              onResult={(id, photo, lat, lng) => {
                setSelectedInsectId(id);
                setCapturedPhoto(photo);
                if (lat !== undefined && lng !== undefined) {
                  setCaptureLocation({ lat, lng });
                } else {
                  setCaptureLocation(null);
                }
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
              location={captureLocation}
              onBack={() => setCurrentScreen('scan')} 
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
              onOpenMap={() => setCurrentScreen('map')}
            />
          )}
          {currentScreen === 'map' && (
            <MapScreen 
              profile={profile}
              onBack={() => setCurrentScreen('library')} 
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
              onUpdateProfile={(updatedProfile) => setProfile(updatedProfile)}
            />
          )}
          {currentScreen === 'update_password' && (
            <UpdatePasswordScreen 
              onBack={() => setCurrentScreen('main')} 
              onToast={showToast}
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

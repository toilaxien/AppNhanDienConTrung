import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { auth, googleProvider, signInWithPopup, db, doc, setDoc, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from '../firebase';
import { User, Key, Mail, ArrowRight, LogIn, Camera, Upload, CheckCircle2 } from 'lucide-react';

interface Props {
  onToast: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export default function AuthScreen({ onToast }: Props) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [regAvatar, setRegAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      onToast("Chào mừng con đã quay lại!", "success");
    } catch (error: any) {
      console.error("Login error:", error);
      triggerShake();
      onToast("Ồ, có lỗi rồi. Con thử lại nhé!", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setRegAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualLogin = async () => {
    if (!email || !password) {
      triggerShake();
      onToast("Con hãy điền email và mật khẩu nhé!", "info");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onToast("Chào mừng con đã quay lại!", "success");
    } catch (error: any) {
      console.error("Login error:", error);
      triggerShake();
      onToast("Mật khẩu hoặc email chưa đúng rồi!", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!username || !password || !email) {
      triggerShake();
      onToast("Con hãy điền đầy đủ thông tin nhé!", "info");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userData: UserProfile = {
        uid: user.uid,
        username: username,
        total_points: 0,
        avatar_id: 1, // Default Ladybug
        custom_avatar: regAvatar,
        role: 'user',
        parent_email: email
      };

      await setDoc(doc(db, 'users', user.uid), userData);
      onToast("Đăng ký thành công! Chào mừng thám hiểm nhí " + username, "success");
    } catch (error: any) {
      console.error("Registration error:", error);
      triggerShake();
      if (error.code === 'auth/email-already-in-use') {
        onToast("Email này đã được dùng rồi con ạ!", "error");
      } else {
        onToast("Có lỗi khi đăng ký. Con thử lại nhé!", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      triggerShake();
      onToast("Con hãy nhập email của bố mẹ nhé!", "info");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      onToast("Tín hiệu cứu hộ đã được gửi! Bố mẹ hãy kiểm tra email nhé!", "success");
      setMode('login');
    } catch (error: any) {
      console.error("Forgot password error:", error);
      triggerShake();
      onToast("Không tìm thấy email này trong vườn rồi!", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-[#C1E1C1] nature-bg flex flex-col items-center justify-center p-6 overflow-y-auto relative">
      {/* Decorative Elements */}
      <div className="absolute top-10 left-4 text-4xl opacity-20 pointer-events-none select-none rotate-12">🌿</div>
      <div className="absolute top-40 right-4 text-4xl opacity-20 pointer-events-none select-none -rotate-12">🍃</div>
      <div className="absolute bottom-20 left-6 text-3xl opacity-20 pointer-events-none select-none">🌸</div>
      <div className="absolute bottom-10 right-10 text-3xl opacity-20 pointer-events-none select-none">🌼</div>
      <div className="absolute top-1/2 -left-4 text-5xl opacity-10 pointer-events-none select-none">🌱</div>

      {/* Mascots */}
      <AnimatePresence>
        {mode === 'register' && (
          <motion.div
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            className="absolute left-4 top-20 text-4xl pointer-events-none"
          >
            🐝
          </motion.div>
        )}
        {mode === 'forgot' && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-10 text-4xl pointer-events-none"
          >
            🕷️
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-8 flex flex-col items-center"
      >
        <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-4 border-4 border-green-200 overflow-hidden">
          {regAvatar ? (
            <img src={regAvatar} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-5xl">🐞</span>
          )}
        </div>
        <h2 className="text-2xl font-black text-green-900 uppercase tracking-tighter">Chào bạn nhỏ!</h2>
      </motion.div>

      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ 
          y: 0, 
          opacity: 1,
          x: isShaking ? [0, -10, 10, -10, 10, 0] : 0
        }}
        className="w-full max-w-sm space-y-4"
      >
        {mode === 'login' && (
          <>
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email của con hoặc bố mẹ"
                  className="w-full bg-white border-2 border-green-100 rounded-3xl py-4 pl-12 pr-4 focus:outline-none focus:border-green-400 shadow-sm font-bold"
                />
              </div>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu bí mật"
                  className="w-full bg-white border-2 border-green-100 rounded-3xl py-4 pl-12 pr-4 focus:outline-none focus:border-green-400 shadow-sm font-bold"
                />
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleManualLogin}
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-3xl shadow-lg flex items-center justify-center gap-2 uppercase tracking-tighter disabled:opacity-50"
            >
              {loading ? 'Đang vào vườn...' : 'VÀO VƯỜN THÔI'} <ArrowRight className="w-5 h-5" />
            </motion.button>

            <div className="flex justify-between px-2 text-sm font-black text-green-800 uppercase tracking-tighter">
              <button onClick={() => setMode('forgot')}>Quên mật khẩu?</button>
              <button onClick={() => setMode('register')}>Đăng ký tại đây</button>
            </div>
          </>
        )}

        {mode === 'register' && (
          <>
            <div className="space-y-3">
              <div className="flex justify-center mb-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-white px-4 py-2 rounded-2xl border-2 border-dashed border-green-400 flex items-center gap-2 text-green-800 font-bold text-sm shadow-sm"
                >
                  <Camera className="w-4 h-4" /> {regAvatar ? 'Đổi ảnh' : 'Tải ảnh của con'}
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  className="hidden" 
                />
              </div>

              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 w-5 h-5" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Tên con muốn đặt là gì?" 
                  className="w-full bg-white border-2 border-green-100 rounded-3xl py-3 pl-12 pr-4 focus:outline-none focus:border-green-400 shadow-sm font-bold" 
                />
              </div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 w-5 h-5" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email của bố mẹ" 
                  className="w-full bg-white border-2 border-green-100 rounded-3xl py-3 pl-12 pr-4 focus:outline-none focus:border-green-400 shadow-sm font-bold" 
                />
              </div>
              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 w-5 h-5" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mật khẩu bí mật" 
                  className="w-full bg-white border-2 border-green-100 rounded-3xl py-3 pl-12 pr-4 focus:outline-none focus:border-green-400 shadow-sm font-bold" 
                />
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-black py-4 rounded-3xl shadow-lg uppercase tracking-tighter disabled:opacity-50"
            >
              {loading ? 'Đang chuẩn bị...' : 'BẮT ĐẦU KHÁM PHÁ'}
            </motion.button>

            <button onClick={() => setMode('login')} className="w-full text-center text-sm font-black text-green-800 uppercase tracking-tighter">
              Đã có tài khoản? Đăng nhập
            </button>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <div className="text-center mb-4">
              <p className="text-green-800 font-bold text-sm">Đừng lo nhé! Nhập email của bố mẹ, chú Bướm sẽ gửi mã bí mật đến đó.</p>
            </div>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 w-5 h-5" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email của bố mẹ" 
                className="w-full bg-white border-2 border-green-100 rounded-3xl py-4 pl-12 pr-4 focus:outline-none focus:border-green-400 shadow-sm font-bold" 
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full bg-orange-500 text-white font-black py-4 rounded-3xl shadow-lg uppercase tracking-tighter disabled:opacity-50"
            >
              {loading ? 'Đang gửi...' : 'GỬI TÍN HIỆU CỨU HỘ'}
            </motion.button>
            <button onClick={() => setMode('login')} className="w-full text-center text-sm font-black text-green-800 uppercase tracking-tighter">
              Quay về cổng vườn
            </button>
          </>
        )}

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-green-800/20"></div></div>
          <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-[#C1E1C1] px-2 text-green-800/50 font-black tracking-widest">Hoặc dùng</span></div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full bg-white hover:bg-gray-50 text-gray-700 font-black py-4 rounded-3xl shadow-md border border-gray-200 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-tighter text-sm"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
          {loading ? 'Đang xử lý...' : 'Đăng nhập với Google'}
        </button>

        <p className="text-center text-[10px] text-green-800/50 mt-8 font-black uppercase tracking-widest">
          CON HÃY NHỜ BỐ MẸ GIỮ MẬT KHẨU THẬT KỸ NHÉ!
        </p>
      </motion.div>
    </div>
  );
}


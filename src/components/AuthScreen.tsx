import React, { useState, useRef, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { supabase } from '../supabase';
import { User, Key, Mail, ArrowRight, Camera } from 'lucide-react';

interface Props {
  onToast: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export default function AuthScreen({ onToast }: Props) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [loading, setLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [regAvatar, setRegAvatar] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastProcessedUrl = useRef<string>('');

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const isWebHttp = () => {
    const origin = window.location.origin;
    return origin.startsWith('http://') || origin.startsWith('https://');
  };

  const getRedirectUrl = () => {
    if (Capacitor.isNativePlatform()) {
      return 'appnhandiencontrung://login-callback';
    }

    return `${window.location.origin}/reset-password`;
  };

  const clearAuthParamsFromUrl = () => {
    if (!isWebHttp()) return;
    const cleanUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, document.title, cleanUrl);
  };

  useEffect(() => {
    const pendingReset = sessionStorage.getItem('pending_password_reset');
      if (pendingReset === 'true') {
        setMode('reset');
      }
    const processAuthUrl = async (rawUrl: string) => {
      if (!rawUrl) return;

      if (lastProcessedUrl.current === rawUrl) {
        console.log('Đã xử lý URL này rồi, bỏ qua lần 2');
        return;
      }
      lastProcessedUrl.current = rawUrl;

      try {
        const url = new URL(rawUrl);

        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
        const searchParams = url.searchParams;

        const getParam = (name: string) =>
          searchParams.get(name) || hashParams.get(name);

        const code = getParam('code');
        const type = getParam('type');
        const accessToken = getParam('access_token');
        const refreshToken = getParam('refresh_token');
        const errorCode = getParam('error');
        const errorDescription = getParam('error_description');

        if (errorCode) {
          onToast(errorDescription || 'Link xác thực không hợp lệ hoặc đã hết hạn!', 'error');
          setMode('login');
          return;
        }

        if (!code && !(accessToken && refreshToken)) {
          return;
        }

        setLoading(true);

        // BƯỚC THẦN THÁNH: Cắm cờ báo hiệu Recovery TRƯỚC KHI đổi code
        const isRecovery = type === 'recovery' || rawUrl.includes('type=recovery') || rawUrl.includes('recovery');
        if (isRecovery) {
          sessionStorage.setItem('pending_password_reset', 'true');
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        }

        if (isRecovery) {
          onToast('Link đặt lại mật khẩu hợp lệ. Chuyển sang màn đổi mật khẩu nhé!', 'success');
        } else if (type === 'signup' || rawUrl.includes('type=signup') || rawUrl.includes('signup')) {
          sessionStorage.removeItem('pending_password_reset');
          setMode('login');
          onToast('Xác nhận email thành công! Giờ con đăng nhập được rồi.', 'success');
        } else {
          setMode('login');
        }

        clearAuthParamsFromUrl();
      } catch (err: any) {
        console.error('Lỗi xử lý auth URL:', err);
        onToast(err?.message || 'Link xác thực đã hết hạn hoặc không dùng được nữa.', 'error');
        setMode('login');
      } finally {
        setLoading(false);
      }
    };

    // 1) Xử lý khi mở link trực tiếp trong browser/webview
    processAuthUrl(window.location.href);

    // 2) Xử lý khi app native mở từ deep link
    App.getLaunchUrl().then((launchUrl) => {
      if (launchUrl?.url) {
        processAuthUrl(launchUrl.url);
      }
    });

    const listener = App.addListener('appUrlOpen', async (event) => {
      processAuthUrl(event.url);
    });

    return () => {
      lastProcessedUrl.current = '';
      listener.then((l) => l.remove());
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setRegAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleManualLogin = async () => {
    if (!email || !password) {
      triggerShake();
      onToast('Con hãy điền email và mật khẩu nhé!', 'info');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      onToast('Chào mừng con đã quay lại!', 'success');
    } catch (error: any) {
      console.error('Login error:', error);
      triggerShake();
      onToast(error?.message || 'Mật khẩu hoặc email chưa đúng rồi!', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!password) {
      triggerShake();
      onToast('Con hãy lập mật khẩu mới nhé!', 'info');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      sessionStorage.removeItem('pending_password_reset');

      onToast('Đổi mật khẩu thành công! Giờ con đăng nhập bằng mật khẩu mới nhé!', 'success');
      setMode('login');
      setPassword('');
      await supabase.auth.signOut();
    } catch (error: any) {
      console.error('Update password error:', error);
      triggerShake();
      onToast(error?.message || 'Không đổi được mật khẩu. Con thử lại nhé!', 'error');
    } finally {
      setLoading(false);
    }
  };
  const handleRegister = async () => {
    if (!username || !password || !email) {
      triggerShake();
      onToast('Con hãy điền đầy đủ thông tin nhé!', 'info');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: username,
          },
          emailRedirectTo: getRedirectUrl(),
        },
      });

      if (error) throw error;

      if (data.user) {
        const userData: UserProfile = {
          uid: data.user.id,
          username,
          total_points: 0,
          avatar_id: 1,
          custom_avatar: regAvatar,
          role: 'user',
          parent_email: email,
        };

        const { error: profileError } = await supabase.from('users').insert([userData]);
        if (profileError) {
          console.error('Insert profile error:', profileError);
        }
      }

      await supabase.auth.signOut();
      setMode('login');

      if (data.session) {
        onToast('Đăng ký thành công! Project của bạn hiện không bắt buộc xác nhận email.', 'success');
      } else {
        onToast('Đăng ký thành công! Bố mẹ hãy kiểm tra email để xác nhận tài khoản nhé.', 'success');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      triggerShake();

      if (error?.message?.includes('already registered')) {
        onToast('Email này đã được dùng rồi con ạ!', 'error');
      } else if (error?.message?.includes('rate limit')) {
        onToast('Supabase đang giới hạn gửi email. Chờ một lúc rồi thử lại nhé!', 'error');
      } else {
        onToast(error?.message || 'Có lỗi khi đăng ký. Con thử lại nhé!', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      triggerShake();
      onToast('Con hãy nhập email nhé!', 'info');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl(),
      });
      if (error) throw error;

      onToast('Đã gửi email đặt lại mật khẩu. Kiểm tra hộp thư nhé!', 'success');
      setMode('login');
    } catch (error: any) {
      console.error('Forgot password error:', error);
      triggerShake();
      onToast(error?.message || 'Không gửi được email đặt lại mật khẩu.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-[#C1E1C1] nature-bg flex flex-col items-center justify-center p-6 overflow-y-auto relative">
      <div className="absolute top-10 left-4 text-4xl opacity-20 pointer-events-none select-none rotate-12">🌿</div>
      <div className="absolute top-40 right-4 text-4xl opacity-20 pointer-events-none select-none -rotate-12">🍃</div>
      <div className="absolute bottom-20 left-6 text-3xl opacity-20 pointer-events-none select-none">🌸</div>
      <div className="absolute bottom-10 right-10 text-3xl opacity-20 pointer-events-none select-none">🌼</div>
      <div className="absolute top-1/2 -left-4 text-5xl opacity-10 pointer-events-none select-none">🌱</div>

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
        {(mode === 'forgot' || mode === 'reset') && (
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
        animate={{ y: 0, opacity: 1, x: isShaking ? [0, -10, 10, -10, 10, 0] : 0 }}
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
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-black py-4 rounded-3xl shadow-lg uppercase tracking-tighter disabled:opacity-50"
            >
              {loading ? 'Đang chuẩn bị...' : 'BẮT ĐẦU KHÁM PHÁ'}
            </motion.button>

            <button
              onClick={() => setMode('login')}
              className="w-full text-center text-sm font-black text-green-800 uppercase tracking-tighter"
            >
              Đã có tài khoản? Đăng nhập
            </button>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <div className="text-center mb-4">
              <p className="text-green-800 font-bold text-sm">
                Đừng lo nhé! Nhập email, hệ thống sẽ gửi link đặt lại mật khẩu.
              </p>
            </div>

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 w-5 h-5" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email"
                className="w-full bg-white border-2 border-green-100 rounded-3xl py-4 pl-12 pr-4 focus:outline-none focus:border-green-400 shadow-sm font-bold"
              />
            </div>

            <motion.button
              onClick={handleForgotPassword}
              disabled={loading}
              className="w-full bg-orange-500 text-white font-black py-4 rounded-3xl shadow-lg uppercase tracking-tighter disabled:opacity-50"
            >
              {loading ? 'Đang gửi...' : 'GỬI LINK ĐẶT LẠI MẬT KHẨU'}
            </motion.button>

            <button
              onClick={() => setMode('login')}
              className="w-full text-center text-sm font-black text-green-800 uppercase tracking-tighter"
            >
              Quay về đăng nhập
            </button>
          </>
        )}

        {mode === 'reset' && (
          <>
            <div className="text-center mb-4">
              <p className="text-green-800 font-bold text-sm">
                Link hợp lệ rồi. Nhập mật khẩu mới ở đây nhé.
              </p>
            </div>

            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-600 w-5 h-5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới"
                className="w-full bg-white border-2 border-cyan-200 rounded-3xl py-4 pl-12 pr-4 focus:outline-none focus:border-cyan-400 shadow-sm font-bold"
              />
            </div>

            <motion.button
              onClick={handleUpdatePassword}
              disabled={loading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-black py-4 rounded-3xl shadow-lg uppercase tracking-tighter disabled:opacity-50"
            >
              {loading ? 'Đang lưu...' : 'LƯU MẬT KHẨU MỚI'}
            </motion.button>
          </>
        )}

        <p className="text-center text-[10px] text-green-800/50 mt-8 font-black uppercase tracking-widest">
          CON HÃY NHỜ BỐ MẸ GIỮ MẬT KHẨU THẬT KỸ NHÉ!
        </p>
      </motion.div>
    </div>
  );
}
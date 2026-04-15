import React, { useState } from 'react';
import { motion } from 'motion/react';
import { supabase } from '../supabase';
import { Key, ArrowRight } from 'lucide-react';

interface Props {
  onBack: () => void;
  onToast: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export default function UpdatePasswordScreen({ onBack, onToast }: Props) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    if (!password) {
      onToast("Bố mẹ hãy nhập mật khẩu mới nhé!", "info");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      // Đăng xuất ngay lập tức để không tự động vào app
      await supabase.auth.signOut();
      
      onToast("Đổi mật khẩu thành công! Bố mẹ hãy dùng mật khẩu mới để bé đăng nhập nhé.", "success");
      onBack();
    } catch (error: any) {
      console.error("Update password error:", error);
      onToast("Có lỗi xảy ra, bố mẹ thử lại nhé!", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-[#C1E1C1] nature-bg flex flex-col items-center justify-center p-6 relative">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-sm space-y-4 bg-white/80 p-6 rounded-3xl backdrop-blur-sm shadow-xl"
      >
        <h2 className="text-2xl font-black text-green-900 uppercase tracking-tighter text-center mb-6">Đổi mật khẩu mới</h2>
        
        <div className="relative">
          <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-green-600 w-5 h-5" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu mới của con"
            className="w-full bg-white border-2 border-green-100 rounded-3xl py-4 pl-12 pr-4 focus:outline-none focus:border-green-400 shadow-sm font-bold"
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleUpdatePassword}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-3xl shadow-lg flex items-center justify-center gap-2 uppercase tracking-tighter disabled:opacity-50"
        >
          {loading ? 'Đang lưu...' : 'LƯU MẬT KHẨU'} <ArrowRight className="w-5 h-5" />
        </motion.button>
      </motion.div>
    </div>
  );
}

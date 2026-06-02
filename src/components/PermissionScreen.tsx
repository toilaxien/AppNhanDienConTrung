import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Camera, MapPin, ShieldCheck, AlertCircle } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

export default function PermissionScreen({ onComplete }: Props) {
  const [cameraGranted, setCameraGranted] = useState<boolean>(false);
  const [locationGranted, setLocationGranted] = useState<boolean>(false);
  const [checking, setChecking] = useState(true);
  const [deniedMessage, setDeniedMessage] = useState<string | null>(null);

  useEffect(() => {
    async function checkPermissions() {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const cameraStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const locationStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
          
          setCameraGranted(cameraStatus.state === 'granted');
          setLocationGranted(locationStatus.state === 'granted');

          // Listen for changes if user changes it in browser settings
          cameraStatus.onchange = () => setCameraGranted(cameraStatus.state === 'granted');
          locationStatus.onchange = () => setLocationGranted(locationStatus.state === 'granted');
        }
      } catch (e) {
        console.warn("Permission check error:", e);
      }
      setChecking(false);
    }
    
    checkPermissions();
  }, []);

  const requestCamera = async () => {
    setDeniedMessage(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        setCameraGranted(true);
      }
    } catch (e: any) {
      console.warn("Camera permission error:", e);
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        setDeniedMessage("Trình duyệt đã chặn Camera. Bạn hãy bấm vào biểu tượng Ổ khóa trên thanh địa chỉ để mở lại nhé!");
      }
      setCameraGranted(false);
    }
  };

  const requestLocation = async () => {
    setDeniedMessage(null);
    try {
      if (navigator.geolocation) {
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(),
            (err) => reject(err),
            { timeout: 10000 }
          );
        });
        setLocationGranted(true);
      }
    } catch (e: any) {
      console.warn("Location permission error:", e);
      if (e.code === 1) { // PERMISSION_DENIED
        setDeniedMessage("Trình duyệt đã chặn Vị trí. Bạn hãy bấm vào biểu tượng Ổ khóa trên thanh địa chỉ để mở lại nhé!");
      }
      setLocationGranted(false);
    }
  };

  if (checking) {
    return (
      <div className="h-full w-full bg-[#C1E1C1] flex items-center justify-center">
        <div className="animate-bounce text-green-800 font-bold">Đang kiểm tra...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#C1E1C1] nature-bg flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-6 border-8 border-white relative">
        <ShieldCheck className="w-12 h-12 text-green-600" />
        <div className="absolute -bottom-2 -right-2 text-2xl">🦋</div>
      </div>
      
      <h2 className="text-2xl font-black text-green-900 uppercase tracking-tighter mb-2">Cấp quyền thám hiểm</h2>
      <p className="text-green-800 font-bold mb-6 text-sm">Bật các công tắc dưới đây để chú Bướm có thể giúp con nhé!</p>
      
      {deniedMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-100 border-2 border-red-300 text-red-800 p-3 rounded-2xl mb-4 text-sm font-bold flex items-start gap-2 text-left w-full shadow-sm"
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p>{deniedMessage}</p>
        </motion.div>
      )}

      <div className="flex flex-col gap-4 mb-8 w-full">
        {/* Camera Toggle */}
        <div className="bg-white/90 p-4 rounded-3xl flex items-center justify-between shadow-sm border-2 border-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-500 flex-shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-black text-green-900 leading-tight">Máy ảnh</div>
              <div className="text-xs text-green-800 font-medium">Chụp ảnh côn trùng</div>
            </div>
          </div>
          <button 
            onClick={() => !cameraGranted && requestCamera()}
            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out ${cameraGranted ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <motion.div 
              className="w-6 h-6 bg-white rounded-full shadow-md"
              animate={{ x: cameraGranted ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
        
        {/* Location Toggle */}
        <div className="bg-white/90 p-4 rounded-3xl flex items-center justify-between shadow-sm border-2 border-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-500 flex-shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-black text-green-900 leading-tight">Vị trí</div>
              <div className="text-xs text-green-800 font-medium">Lưu nơi tìm thấy</div>
            </div>
          </div>
          <button 
            onClick={() => !locationGranted && requestLocation()}
            className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ease-in-out ${locationGranted ? 'bg-green-500' : 'bg-gray-300'}`}
          >
            <motion.div 
              className="w-6 h-6 bg-white rounded-full shadow-md"
              animate={{ x: locationGranted ? 24 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </div>

      <motion.button
        whileTap={cameraGranted && locationGranted ? { scale: 0.95 } : {}}
        onClick={() => {
          if (cameraGranted && locationGranted) {
            onComplete();
          }
        }}
        className={`w-full font-black py-4 rounded-3xl shadow-lg uppercase tracking-tighter text-lg transition-colors ${
          cameraGranted && locationGranted 
            ? 'bg-green-600 text-white' 
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
      >
        {cameraGranted && locationGranted ? 'Bắt đầu ngay!' : 'Cấp quyền để tiếp tục'}
      </motion.button>
    </div>
  );
}

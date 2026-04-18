import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Camera, Search, X, Star, RefreshCw, Check } from 'lucide-react';
import { recognizeInsect } from '../services/geminiService';
import { supabase } from '../supabase';

interface Props {
  onBack: () => void;
  onResult: (insectId: string, photoData: string, latitude?: number, longitude?: number) => void;
  onToast: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export default function ScanScreen({ onBack, onResult, onToast }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  useEffect(() => {
    // Request location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (err) => {
          console.warn("Geolocation error:", err);
        }
      );
    }

    async function startCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("Trình duyệt của con không hỗ trợ camera rồi. Hãy thử trên điện thoại nhé!");
        return;
      }

      const constraints = [
        { video: { facingMode: 'environment' } },
        { video: { facingMode: 'user' } },
        { video: true }
      ];

      let lastError: any = null;
      for (const constraint of constraints) {
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia(constraint);
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
          setError(null);
          onToast("Camera đã sẵn sàng! Con hãy tìm côn trùng nhé.", "success");
          return; // Success!
        } catch (err) {
          console.warn(`Failed with constraint:`, constraint, err);
          lastError = err;
        }
      }

      console.error("All camera constraints failed:", lastError);
      if (lastError?.name === 'NotAllowedError' || lastError?.name === 'PermissionDeniedError') {
        setError("Con chưa cho phép chú Bướm dùng camera rồi. Hãy nhấn vào biểu tượng ổ khóa trên thanh địa chỉ để cho phép nhé!");
      } else {
        setError("Không thể mở camera. Con hãy kiểm tra xem có ứng dụng nào khác đang dùng camera không nhé!");
      }
    }

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const fullBase64 = canvas.toDataURL('image/jpeg');
      setCapturedImage(fullBase64);
    }
  };

  const handleAnalyze = async () => {
    if (!capturedImage || scanning) return;

    setScanning(true);
    const base64Image = capturedImage.split(',')[1];
    
    try {
      // First, get the dynamic list of insect IDs from Supabase
      const { data: insects, error: dbError } = await supabase.from('insects').select('id');
      let knownIds = insects ? insects.map(i => i.id) : [];
      
      // Safety Fallback: if offline or database error/empty, use the default known list
      if (knownIds.length === 0) {
        console.warn("Could not fetch insect IDs from Supabase or list is empty. Using fallback.", dbError);
        knownIds = ['ant', 'butterfly', 'cockroach', 'dragonfly', 'fly', 'grasshopper', 'honeybee', 'ladybug', 'mosquito', 'spider', 'unknown_insect'];
      }
      
      const result = await recognizeInsect(base64Image, knownIds);
      if (result && result.insect_id !== 'unknown_insect' && result.insect_id !== 'no_insect' && result.confidence > 0.3) {
        onResult(result.insect_id, capturedImage, location?.lat, location?.lng);
        setScanning(false);
      } else if (result?.insect_id === 'unknown_insect') {
        // Models know there is an insect but don't know which one
        onResult('unknown_insect', capturedImage, location?.lat, location?.lng);
        setScanning(false);
      } else {
        // No insect found at all
        onToast("Côn trùng trốn kỹ quá... chưa thấy được! Thay góc chụp khác nhé.", "info");
        setTimeout(() => {
          setCapturedImage(null);
          setScanning(false);
        }, 3000);
      }
    } catch (err: any) {
      console.error("Recognition error:", err);
      // If complete failure, show error and let user try again
      onToast("Côn trùng trốn kỹ quá... chưa thấy được! Thay góc chụp khác nhé.", "info");
      setTimeout(() => {
        setCapturedImage(null);
        setScanning(false);
      }, 3000);
    }
  };

  if (error) {
    const isIframe = window.self !== window.top;
    
    return (
      <div className="h-full w-full bg-[#C1E1C1] flex flex-col items-center justify-center p-8 text-center relative">
        <button 
          onClick={onBack}
          className="absolute top-6 left-6 p-2 bg-white/80 rounded-full shadow-md text-green-800"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6 border-4 border-white shadow-lg">
          <X className="w-12 h-12 text-red-500" />
        </div>
        
        <h2 className="text-2xl font-black text-green-900 uppercase tracking-tighter mb-4">Ôi, có lỗi rồi!</h2>
        <p className="text-green-800 font-bold mb-6 leading-relaxed">
          {error}
        </p>

        {isIframe && (
          <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-2xl mb-6 text-sm text-orange-800 font-bold shadow-sm">
            <p className="mb-2">⚠️ Chú ý: Con đang dùng ứng dụng trong khung xem trước.</p>
            <p>Hãy nhấn vào nút <span className="text-orange-600">"Mở trong tab mới"</span> ở góc trên bên phải màn hình để Camera hoạt động tốt nhất nhé!</p>
          </div>
        )}

        <div className="flex flex-col w-full gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            className="w-full bg-green-600 text-white font-black py-4 rounded-3xl shadow-lg uppercase tracking-tighter"
          >
            TẢI LẠI TRANG
          </motion.button>
          
          <button 
            onClick={onBack}
            className="text-green-800 font-black uppercase tracking-tighter text-sm py-2"
          >
            QUAY LẠI
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-black relative overflow-hidden flex flex-col">
      {/* Camera Preview or Captured Image */}
      <div className="flex-1 relative">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className={`w-full h-full object-cover ${capturedImage ? 'hidden' : ''}`}
        />
        {capturedImage && (
          <img 
            src={capturedImage} 
            alt="Captured insect" 
            className="w-full h-full object-cover absolute inset-0"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* Overlay UI */}
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
          {/* Magnifying Glass Frame */}
          <div className={`w-64 h-64 border-[12px] rounded-full relative shadow-[0_0_0_1000px_rgba(0,0,0,0.5)] transition-colors duration-500 ${scanning ? 'border-yellow-400' : 'border-white/50'}`}>
            <div className="absolute inset-0 border-4 border-white/30 rounded-full"></div>
            
            {/* Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/50">
              <div className="w-12 h-12 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
                <div className="absolute top-0 w-1 h-3 bg-white"></div>
                <div className="absolute bottom-0 w-1 h-3 bg-white"></div>
                <div className="absolute left-0 w-3 h-1 bg-white"></div>
                <div className="absolute right-0 w-3 h-1 bg-white"></div>
              </div>
            </div>

            {/* Scanning Laser Line */}
            {scanning && (
              <motion.div
                animate={{ top: ['10%', '90%', '10%'] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                className="absolute left-4 right-4 h-1 bg-green-400 shadow-[0_0_15px_#4ade80] z-10"
              />
            )}
          </div>
          
          <div className="absolute top-8 left-0 right-0 text-center z-10">
            <motion.p 
              animate={scanning ? { opacity: [0.5, 1, 0.5] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
              className="mt-8 text-white font-black text-xl drop-shadow-lg uppercase tracking-tighter px-4"
            >
              {scanning ? 'Đang phân tích...' : capturedImage ? 'Ảnh này được chưa nhỉ?' : 'Đưa kính lúp vào bạn côn trùng nào!'}
            </motion.p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black/80 p-8 flex justify-between items-center">
        {!capturedImage ? (
          <>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onBack}
              className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white"
            >
              <ArrowLeft className="w-6 h-6" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleCapture}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center shadow-2xl bg-orange-500"
            >
              <Camera className="w-10 h-10 text-white" />
            </motion.button>

            <div className="w-12"></div>
          </>
        ) : (
          <>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setCapturedImage(null)}
              disabled={scanning}
              className="w-14 h-14 bg-gray-500 rounded-full flex items-center justify-center text-white shadow-lg"
            >
              <RefreshCw className="w-6 h-6" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleAnalyze}
              disabled={scanning}
              className={`flex-1 mx-6 h-14 rounded-full flex items-center justify-center shadow-xl font-black uppercase tracking-tighter text-white ${scanning ? 'bg-gray-500' : 'bg-green-500'}`}
            >
              {scanning ? (
                <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <div className="flex items-center gap-2">
                  <Check className="w-6 h-6" />
                  <span>Nhận diện ngay</span>
                </div>
              )}
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}

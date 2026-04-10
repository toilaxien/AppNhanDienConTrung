import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Camera, Search, X, Star } from 'lucide-react';
import { recognizeInsect } from '../services/geminiService';

interface Props {
  onBack: () => void;
  onResult: (insectId: string, photoData: string) => void;
  onToast: (message: string, type?: 'info' | 'error' | 'success') => void;
}

export default function ScanScreen({ onBack, onResult, onToast }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready) return;

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
  }, [ready]);

  if (!ready) {
    return (
      <div className="h-full w-full bg-[#C1E1C1] flex flex-col items-center justify-center p-8 text-center">
        <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-xl mb-8 border-8 border-white">
          <Camera className="w-16 h-16 text-green-600" />
        </div>
        <h2 className="text-2xl font-black text-green-900 uppercase tracking-tighter mb-4">Sẵn sàng chưa thám hiểm nhí?</h2>
        <p className="text-green-800 font-bold mb-8">Con hãy cho phép chú Bướm dùng camera để soi tìm các bạn côn trùng nhé!</p>
        <div className="flex flex-col w-full gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setReady(true)}
            className="w-full bg-orange-500 text-white font-black py-4 rounded-3xl shadow-lg uppercase tracking-tighter"
          >
            SẴN SÀNG!
          </motion.button>
          <button 
            onClick={onBack}
            className="text-green-800 font-black uppercase tracking-tighter text-sm"
          >
            ĐỂ SAU NHÉ
          </button>
        </div>
      </div>
    );
  }

  const handleScan = async () => {
    if (!videoRef.current || !canvasRef.current || scanning) return;

    setScanning(true);
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const fullBase64 = canvas.toDataURL('image/jpeg');
      const base64Image = fullBase64.split(',')[1];
      
      try {
        const result = await recognizeInsect(base64Image);
        if (result && result.confidence > 0.5) {
          onResult(result.insect_id, fullBase64);
        } else {
          onToast("Bạn này trốn kỹ quá, con thử soi lại gần hơn nhé!", "info");
        }
      } catch (err) {
        console.error("Recognition error:", err);
        onToast("Chú Bướm đang bận một chút, con thử lại sau nhé!", "error");
      }
    }
    setScanning(false);
  };

  return (
    <div className="h-full w-full bg-black relative overflow-hidden flex flex-col">
      {/* Camera Preview */}
      <div className="flex-1 relative">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover"
        />
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
          
          <motion.p 
            animate={scanning ? { opacity: [0.5, 1, 0.5] } : {}}
            transition={{ repeat: Infinity, duration: 1 }}
            className="mt-8 text-white font-black text-xl drop-shadow-lg uppercase tracking-tighter"
          >
            {scanning ? 'Đang phân tích...' : 'Đưa kính lúp vào bạn côn trùng nào!'}
          </motion.p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black/80 p-8 flex justify-between items-center">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleScan}
          disabled={scanning}
          className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center shadow-2xl transition-all ${scanning ? 'bg-gray-500' : 'bg-orange-500'}`}
        >
          {scanning ? (
            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <Camera className="w-10 h-10 text-white" />
          )}
        </motion.button>

        <div className="w-12"></div>
      </div>

      {error && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center p-8 text-center">
          <X className="w-16 h-16 text-red-500 mb-4" />
          <p className="text-white font-bold text-xl mb-4">{error}</p>
          <p className="text-gray-400 text-sm mb-8">
            Nếu vẫn không được, con hãy thử nhấn vào nút <b>"Mở trong tab mới"</b> ở góc trên bên phải màn hình nhé!
          </p>
          <button 
            onClick={onBack}
            className="bg-white text-black font-bold px-8 py-3 rounded-full"
          >
            Quay lại
          </button>
        </div>
      )}
    </div>
  );
}

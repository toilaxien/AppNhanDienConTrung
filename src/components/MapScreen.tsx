import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../supabase';
import { CollectionItem, Insect, UserProfile } from '../types';
import { ArrowLeft, MapPin, Clock, User, X } from 'lucide-react';

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon for user's live location
const userIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/149/149071.png',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  className: 'rounded-full border-2 border-blue-500 bg-white'
});

// Custom icon for insect pins
const insectIcon = new L.Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/1864/1864509.png', // Default ladybug, can be dynamic
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
  className: 'drop-shadow-md'
});

interface Props {
  profile: UserProfile | null;
  onBack: () => void;
}

// Helper to calculate distance between two coordinates in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // in metres
}

// Component to update map center when user location changes
function LocationMarker({ position }: { position: L.LatLngExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom());
    }
  }, [position, map]);

  return position === null ? null : (
    <Marker position={position} icon={userIcon}>
      <Popup>Vị trí của con</Popup>
    </Marker>
  );
}

export default function MapScreen({ profile, onBack }: Props) {
  const [collections, setCollections] = useState<(CollectionItem & { insect?: Insect, user?: UserProfile })[]>([]);
  const [insects, setInsects] = useState<Record<string, Insect>>({});
  const [users, setUsers] = useState<Record<string, UserProfile>>({});
  const [userLocation, setUserLocation] = useState<L.LatLngExpression | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<(CollectionItem & { insect?: Insect, user?: UserProfile })[] | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Fetch all insects
      const { data: insectsData } = await supabase.from('insects').select('*');
      const insectMap: Record<string, Insect> = {};
      if (insectsData) {
        insectsData.forEach(i => insectMap[i.id] = i);
        setInsects(insectMap);
      }

      // Fetch all users
      const { data: usersData } = await supabase.from('users').select('*');
      const userMap: Record<string, UserProfile> = {};
      if (usersData) {
        usersData.forEach(u => userMap[u.uid] = u);
        setUsers(userMap);
      }

      // Fetch all collections with lat/lng
      const { data: collectionsData } = await supabase
        .from('collections')
        .select('*')
        .neq('insect_id', 'unknown_insect')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (collectionsData) {
        const enriched = collectionsData.map(c => ({
          ...c,
          insect: insectMap[c.insect_id],
          user: userMap[c.user_id]
        }));
        setCollections(enriched);
      }
      setLoading(false);
    }
    fetchData();

    // Watch user location
    let watchId: number;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        },
        (err) => console.warn("Location error:", err),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Cluster collections within 70m
  const clusters: ((CollectionItem & { insect?: Insect, user?: UserProfile })[])[] = [];
  const processed = new Set<string>();

  collections.forEach(c1 => {
    if (processed.has(c1.id) || !c1.latitude || !c1.longitude) return;
    
    const cluster = [c1];
    processed.add(c1.id);

    collections.forEach(c2 => {
      if (c1.id === c2.id || processed.has(c2.id) || !c2.latitude || !c2.longitude) return;
      
      const dist = getDistance(c1.latitude!, c1.longitude!, c2.latitude!, c2.longitude!);
      if (dist <= 70) {
        cluster.push(c2);
        processed.add(c2.id);
      }
    });
    clusters.push(cluster);
  });

  return (
    <div className="flex-1 flex flex-col bg-[#C1E1C1] relative overflow-hidden">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-[1000] pointer-events-none flex justify-between items-start">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-green-800 pointer-events-auto"
        >
          <ArrowLeft className="w-6 h-6" />
        </motion.button>
        <div className="bg-white/90 backdrop-blur px-4 py-2 rounded-full shadow-md pointer-events-auto">
          <h2 className="text-lg font-black text-green-900 uppercase tracking-tighter">Bản đồ khám phá</h2>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin text-4xl">🌍</div>
        </div>
      ) : (
        <div className="flex-1 relative z-0">
          <MapContainer 
            center={userLocation || [10.762622, 106.660172]} // Default to HCMC if no location
            zoom={15} 
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            <LocationMarker position={userLocation} />

            {clusters.map((cluster, idx) => {
              const mainItem = cluster[0];
              const avatarUrl = mainItem.user?.custom_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${mainItem.user?.avatar_id || 'default'}`;
              const customIcon = new L.Icon({
                iconUrl: avatarUrl,
                iconSize: [40, 40],
                iconAnchor: [20, 40],
                className: 'drop-shadow-lg bg-white rounded-full border-2 border-green-500 p-1 object-cover'
              });

              return (
                <Marker 
                  key={idx} 
                  position={[mainItem.latitude!, mainItem.longitude!]} 
                  icon={customIcon}
                  eventHandlers={{
                    click: () => setSelectedCluster(cluster)
                  }}
                >
                  {/* We use a custom overlay instead of default popup for better UI */}
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}

      {/* Cluster Details Overlay */}
      <AnimatePresence>
        {selectedCluster && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-[1000] max-h-[60vh] flex flex-col"
          >
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-green-50 rounded-t-3xl">
              <h3 className="font-black text-green-900 uppercase tracking-tighter flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                {selectedCluster.length} bạn côn trùng ở đây
              </h3>
              <button 
                onClick={() => setSelectedCluster(null)}
                className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-500 shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex flex-col gap-4">
              {selectedCluster.map((item) => (
                <div key={item.id} className="bg-gray-50 rounded-2xl p-3 flex gap-4 border border-gray-100">
                  <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-200 flex-shrink-0">
                    <img src={item.photo_path} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 flex flex-col justify-center">
                    <h4 className="font-black text-lg text-green-900" style={{ color: item.insect?.category_color }}>
                      {item.insect?.name_vi}
                    </h4>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1 font-bold">
                      <User className="w-3 h-3" />
                      {item.user?.username || 'Thám hiểm nhí'}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mt-1 font-bold">
                      <Clock className="w-3 h-3" />
                      {new Date(item.captured_at).toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { Timestamp } from './firebase';

export interface UserProfile {
  uid: string;
  username: string;
  parent_email?: string;
  total_points: number;
  avatar_id: number; // Default to 1 (Ladybug)
  custom_avatar?: string | null;
  role: 'user' | 'admin';
}

export interface Insect {
  id: string;
  name_vi: string;
  name_en: string;
  scientific_name: string;
  description: string;
  lifecycle_steps: {
    step: string;
    description: string;
    icon: string;
  }[];
  habitat: string;
  habitat_icon: string;
  role: string;
  role_icon: string;
  image_cartoon: string;
  category_color: string;
}

export interface CollectionItem {
  id: string;
  user_id: string;
  insect_id: string;
  photo_path: string;
  captured_at: Timestamp;
}

export interface RankItem {
  user_id: string;
  username: string;
  total_points: number;
  avatar_id: number;
  custom_avatar?: string | null;
  rank: number;
}

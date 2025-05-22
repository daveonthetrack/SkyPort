// Defines user roles within the application
export type UserRole = 'sender' | 'traveler' | null;

// Represents the structure of a user profile in the database
export interface Profile {
  id: string; // Corresponds to Supabase Auth user ID
  name?: string | null;
  phone_number?: string | null;
  role?: UserRole;
  avatar_url?: string | null;
  created_at?: string; // ISO date string
  updated_at?: string; // ISO date string
}

// Updated ItemStatus including offer stage
export type ItemStatus = 'pending' | 'accepted' | 'delivered' | 'cancelled';

export interface Item {
  id: number | string;
  title: string;
  description: string;
  pickup_location: string;
  destination: string;
  size: string;
  status: ItemStatus;
  created_at: string;
  image_url?: string;
  user_id: number | string;
  accepted_by?: number | string;
  pickup_date?: string;
  estimated_delivery_date?: string;
  sender: {
    id: number | string;
    name: string;
    avatar_url?: string;
  };
}

export type TripStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export type Trip = {
  id: string;
  user_id: string;
  origin: string;
  destination: string;
  departure_date: string;
  created_at: string;
  updated_at: string;
  capacity: 'small' | 'medium' | 'large';
  user?: {
    id: string;
    name: string;
    avatar_url?: string;
    rating?: number;
    delivery_count?: number;
  };
}; 
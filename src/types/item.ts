export type Item = {
  id: string;
  title: string;
  description?: string;
  pickup_location: string;
  destination: string;
  size: 'small' | 'medium' | 'large';
  status: 'pending' | 'accepted' | 'delivered';
  created_at: string;
  updated_at: string;
  user_id: string;
  image_url?: string;
  price?: number;
  pickup_date?: string;
  delivered_at?: string;
  estimated_delivery_date?: string;
  owner?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
}; 
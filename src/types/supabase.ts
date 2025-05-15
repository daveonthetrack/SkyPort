export interface Database {
  public: {
    Tables: {
      messages: {
        Row: {
          id: string;
          created_at: string;
          content: string;
          sender_id: string;
          receiver_id: string;
          item_id?: string;
          trip_id?: string;
          image_url?: string;
          type: 'text' | 'image' | 'system';
        };
      };
      profiles: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          avatar_url: string | null;
          role: 'sender' | 'traveler';
          phone_number: string | null;
          updated_at: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          created_at: string;
          user1_id: string;
          user2_id: string;
          last_message: string;
          last_message_at: string;
          unread_count: number;
          item_id?: string;
          trip_id?: string;
        };
      };
    };
  };
} 
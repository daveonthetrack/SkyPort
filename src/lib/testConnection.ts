import { supabase } from './supabase';

export const testDatabaseConnection = async () => {
  try {
    console.log('Testing database connection...');
    
    // Test profiles table
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
    } else {
      console.log('Profiles table accessible:', profiles);
    }

    // Test items table
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('*')
      .limit(1);
    
    if (itemsError) {
      console.error('Error fetching items:', itemsError);
    } else {
      console.log('Items table accessible:', items);
    }

    // Test messages table
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .limit(1);
    
    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
    } else {
      console.log('Messages table accessible:', messages);
    }

    return {
      profiles: !profilesError,
      items: !itemsError,
      messages: !messagesError
    };
  } catch (error) {
    console.error('Database connection test failed:', error);
    return {
      profiles: false,
      items: false,
      messages: false
    };
  }
}; 
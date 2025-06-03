const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Try with anon key first, fallback to service role key
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('❌ No Supabase key found in .env file');
  console.log('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95bW9yZWtqa3VkZ3h3b2ZlamJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDExMTQ1NSwiZXhwIjoyMDU5Njg3NDU1fQ.2oa7LrbJVSX1GZAAQwKCv5RO4TyeyzF9DTX2DtE6bZI');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  supabaseKey
);

async function setupStorageBuckets() {
  console.log('Setting up storage buckets...');
  console.log(`Using ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service role' : 'anon'} key`);

  try {
    // Create items bucket
    const { data: itemsBucket, error: itemsError } = await supabase.storage
      .createBucket('items', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif'],
        fileSizeLimit: 5242880 // 5MB
      });

    if (itemsError && !itemsError.message.includes('already exists')) {
      console.error('Error creating items bucket:', itemsError);
      if (itemsError.message.includes('permission') || itemsError.message.includes('unauthorized')) {
        console.log('💡 You may need the service role key for bucket creation');
        console.log('Get it from: Supabase Dashboard → Settings → API → service_role key');
      }
    } else {
      console.log('✅ Items bucket created/exists');
    }

    // Create avatars bucket
    const { data: avatarsBucket, error: avatarsError } = await supabase.storage
      .createBucket('avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png'],
        fileSizeLimit: 2097152 // 2MB
      });

    if (avatarsError && !avatarsError.message.includes('already exists')) {
      console.error('Error creating avatars bucket:', avatarsError);
      if (avatarsError.message.includes('permission') || avatarsError.message.includes('unauthorized')) {
        console.log('💡 You may need the service role key for bucket creation');
        console.log('Get it from: Supabase Dashboard → Settings → API → service_role key');
      }
    } else {
      console.log('✅ Avatars bucket created/exists');
    }

    // Try to create other buckets too
    const buckets = [
      { name: 'chat_images', public: true },
      { name: 'chat_audio', public: true },
      { name: 'verifications', public: false }
    ];

    for (const bucket of buckets) {
      const { data, error } = await supabase.storage
        .createBucket(bucket.name, {
          public: bucket.public,
          allowedMimeTypes: bucket.name.includes('audio') ? ['audio/*'] : ['image/*'],
          fileSizeLimit: 5242880 // 5MB
        });

      if (error && !error.message.includes('already exists')) {
        console.error(`Error creating ${bucket.name} bucket:`, error);
      } else {
        console.log(`✅ ${bucket.name} bucket created/exists`);
      }
    }

    console.log('Storage setup complete!');
  } catch (error) {
    console.error('Error setting up storage:', error);
    if (error.message.includes('permission') || error.message.includes('unauthorized')) {
      console.log('\n💡 Permission error detected. You need the service role key.');
      console.log('1. Go to: https://supabase.com/dashboard/project/oymorekjkudgxwofejbq/settings/api');
      console.log('2. Copy the "service_role" key');
      console.log('3. Add to .env: SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here');
    }
  }
}

setupStorageBuckets(); 
-- Enable real-time for messages table
begin;

  -- Create publication if it doesn't exist
  do $$ 
  begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      create publication supabase_realtime;
    end if;
  end $$;

  -- Add messages table to publication
  alter publication supabase_realtime add table messages;

  -- Create or replace function to update read_at timestamp
  create or replace function public.mark_message_as_read(message_id uuid)
  returns void
  language plpgsql
  security definer
  as $$
  begin
    update messages
    set read_at = now()
    where id = message_id
    and read_at is null;
  end;
  $$;

  -- Grant access to the function
  grant execute on function public.mark_message_as_read to authenticated;

  -- Create policy to allow users to mark messages as read if they are the receiver
  create policy "Users can mark messages as read if they are the receiver"
  on messages
  for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

  -- Enable RLS on messages if not already enabled
  alter table messages enable row level security;

  -- Create index for better performance on message queries
  create index if not exists messages_receiver_id_idx on messages(receiver_id);
  create index if not exists messages_sender_id_idx on messages(sender_id);
  create index if not exists messages_read_at_idx on messages(read_at);

  -- Update the messages table to ensure read_at can be null
  alter table messages alter column read_at drop not null;

commit; 
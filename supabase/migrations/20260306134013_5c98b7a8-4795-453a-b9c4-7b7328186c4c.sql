SELECT
  cron.schedule(
    'nfse-sync-hourly',
    '0 * * * *',
    $$
    SELECT
      net.http_post(
          url:='https://pnwstilxwpzrjqdwrqay.supabase.co/functions/v1/nfse-sync',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBud3N0aWx4d3B6cmpxZHdycWF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NTc1NTgsImV4cCI6MjA4NjMzMzU1OH0.yOq_G6NvZvTEFSj0Yb7fRfeQB5ovMuCuhOT3-ium8qU"}'::jsonb,
          body:=concat('{"time": "', now(), '"}')::jsonb
      ) as request_id;
    $$
  );
create policy "eventos_banners_auth_read" on storage.objects for select to authenticated using (bucket_id = 'eventos-banners');
create policy "eventos_banners_auth_insert" on storage.objects for insert to authenticated with check (bucket_id = 'eventos-banners');
create policy "eventos_banners_auth_update" on storage.objects for update to authenticated using (bucket_id = 'eventos-banners');
create policy "eventos_banners_auth_delete" on storage.objects for delete to authenticated using (bucket_id = 'eventos-banners');
-- Create policies for profile-avatars bucket to allow authenticated users to upload

-- Allow authenticated users to upload files to profile-avatars bucket
CREATE POLICY "Authenticated users can upload profile avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-avatars');

-- Allow authenticated users to update their uploaded files
CREATE POLICY "Authenticated users can update profile avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-avatars');

-- Allow authenticated users to delete files from profile-avatars
CREATE POLICY "Authenticated users can delete profile avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'profile-avatars');

-- Allow public read access (bucket is already public)
CREATE POLICY "Public read access for profile avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-avatars');
-- Add member_id to ebd_alunos and ebd_professores to link to church_members
ALTER TABLE ebd_alunos 
ADD COLUMN member_id uuid REFERENCES church_members(id) ON DELETE SET NULL;

ALTER TABLE ebd_professores 
ADD COLUMN member_id uuid REFERENCES church_members(id) ON DELETE SET NULL;

-- Add user_id to link to authenticated users
ALTER TABLE ebd_alunos 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ebd_professores 
ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create indexes for better performance
CREATE INDEX idx_ebd_alunos_member_id ON ebd_alunos(member_id);
CREATE INDEX idx_ebd_alunos_user_id ON ebd_alunos(user_id);
CREATE INDEX idx_ebd_professores_member_id ON ebd_professores(member_id);
CREATE INDEX idx_ebd_professores_user_id ON ebd_professores(user_id);

-- Add unique constraint to prevent duplicate activations
CREATE UNIQUE INDEX idx_ebd_alunos_member_church ON ebd_alunos(member_id, church_id) WHERE member_id IS NOT NULL;
CREATE UNIQUE INDEX idx_ebd_professores_member_church ON ebd_professores(member_id, church_id) WHERE member_id IS NOT NULL;
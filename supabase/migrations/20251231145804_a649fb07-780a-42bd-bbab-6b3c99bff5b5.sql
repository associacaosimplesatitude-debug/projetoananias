-- Drop the incorrect unique constraint that only allows one address per user
ALTER TABLE ebd_endereco_entrega DROP CONSTRAINT IF EXISTS unique_user_address;

-- Add a new unique constraint that allows multiple addresses per user, but unique by name
ALTER TABLE ebd_endereco_entrega ADD CONSTRAINT unique_user_address_name UNIQUE (user_id, nome);
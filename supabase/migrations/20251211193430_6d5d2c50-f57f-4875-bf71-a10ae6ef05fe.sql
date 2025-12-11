-- Add gerente_ebd role to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente_ebd';
-- Create a security definer function to get student's turma_id without RLS recursion
CREATE OR REPLACE FUNCTION public.get_student_turma_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT turma_id
  FROM public.ebd_alunos
  WHERE user_id = _user_id
    AND is_active = true
  LIMIT 1
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Students can view classmates for ranking" ON public.ebd_alunos;

-- Recreate the policy using the security definer function
CREATE POLICY "Students can view classmates for ranking" 
ON public.ebd_alunos 
FOR SELECT 
USING (turma_id = public.get_student_turma_id(auth.uid()));
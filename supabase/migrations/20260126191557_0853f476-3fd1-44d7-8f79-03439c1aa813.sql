-- Create a security definer function to execute read-only SQL queries
-- This is used by the AI assistant to query the database safely

CREATE OR REPLACE FUNCTION public.execute_readonly_query(sql_query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  normalized_query text;
BEGIN
  -- Normalize and validate the query
  normalized_query := upper(trim(sql_query));
  
  -- Only allow SELECT statements
  IF NOT normalized_query LIKE 'SELECT%' THEN
    RAISE EXCEPTION 'Only SELECT queries are allowed';
  END IF;
  
  -- Block dangerous patterns
  IF normalized_query ~ ';.*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE)' THEN
    RAISE EXCEPTION 'Query contains dangerous patterns';
  END IF;
  
  IF normalized_query ~ '--' OR normalized_query ~ '/\*' THEN
    RAISE EXCEPTION 'Query contains comment patterns';
  END IF;
  
  -- Execute the query and return results as JSON
  EXECUTE 'SELECT json_agg(row_to_json(t)) FROM (' || sql_query || ') t' INTO result;
  
  RETURN COALESCE(result, '[]'::json);
END;
$$;
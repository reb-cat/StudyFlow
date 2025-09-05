-- Step 2: Create the function (run this second)
CREATE OR REPLACE FUNCTION current_student() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_student', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
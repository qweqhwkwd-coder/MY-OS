ALTER TABLE users
  ADD CONSTRAINT users_sex_check CHECK (sex IN ('male', 'female'));

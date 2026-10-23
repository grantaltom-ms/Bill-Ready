-- Creating a business inserts the row and reads it back in one statement. The existing read policy
-- needs a membership row, which a trigger adds only after the insert, so the read-back was rejected
-- ("new row violates row-level security policy for table br_contractors").
-- Owners can always read the business they own. Already applied to the project as
-- billready_owner_can_read_own_contractor.
create policy "owner reads own contractor"
  on public.br_contractors
  for select
  to authenticated
  using (owner_user_id = auth.uid());

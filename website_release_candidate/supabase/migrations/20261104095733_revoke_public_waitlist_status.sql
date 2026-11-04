-- The public website does not use this aggregate and should not expose invoice metrics.
revoke all on function public.get_waitlist_status() from public;
revoke all on function public.get_waitlist_status() from anon, authenticated;
grant execute on function public.get_waitlist_status() to service_role;

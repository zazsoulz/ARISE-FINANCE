-- bootstrap_arise_user is a trigger-only SECURITY DEFINER function.
-- It must not be callable through the public REST/RPC surface.
revoke execute on function public.bootstrap_arise_user() from public, anon, authenticated;

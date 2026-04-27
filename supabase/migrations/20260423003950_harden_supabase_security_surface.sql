begin;

drop view if exists public.properties_public;
drop view if exists public.profiles_public;

alter function public.get_my_role() set search_path = public;
alter function public.get_top_properties(date, date, integer) set search_path = public;
alter function public.get_monthly_stats(date) set search_path = public;

commit;;

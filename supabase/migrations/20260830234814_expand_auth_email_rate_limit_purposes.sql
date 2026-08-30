alter table public.auth_email_rate_limits
  drop constraint if exists auth_email_rate_limits_purpose_check;

alter table public.auth_email_rate_limits
  add constraint auth_email_rate_limits_purpose_check
  check (purpose in ('login_code','password_recovery','signup','password_reset','password_change'));

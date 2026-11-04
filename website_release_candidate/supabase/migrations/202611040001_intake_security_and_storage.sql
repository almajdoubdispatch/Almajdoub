begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.intake_proxy_tokens (
  token_hash text primary key check (length(token_hash) = 64),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table private.intake_proxy_tokens enable row level security;
revoke all on private.intake_proxy_tokens from public, anon, authenticated;
grant select, insert, update, delete on private.intake_proxy_tokens to service_role;

create table if not exists private.intake_rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 1,
  primary key (ip_hash, window_start),
  check (request_count > 0)
);
alter table private.intake_rate_limits enable row level security;
revoke all on private.intake_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on private.intake_rate_limits to service_role;

alter table public.inquiries
  add column if not exists submission_data jsonb not null default '{}'::jsonb,
  add column if not exists signature_path text,
  add column if not exists signature_sha256 text,
  add column if not exists public_reference_id text;
create unique index if not exists inquiries_public_reference_id_uidx
  on public.inquiries(public_reference_id) where public_reference_id is not null;
alter table public.inquiries alter column tcpa_consent set default false;
alter table public.carriers alter column tcpa_consent set default false;
alter table public.authorizations alter column granted set default false;

alter table public.agreements alter column status set default 'PENDING_REVIEW';
alter table public.agreements drop constraint if exists agreements_status_check;
alter table public.agreements add constraint agreements_status_check
  check (status = any (array['PENDING_REVIEW','ACTIVE','SUPERSEDED','TERMINATED']));
alter table public.documents drop constraint if exists documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type = any (array['COI','W9','MC_AUTHORITY_CERT','VOIDED_CHECK','NOA','RATE_CON','BOL_POD','OTHER']));

drop policy if exists "Allow public insert on inquiries" on public.inquiries;
drop policy if exists "Allow anon insert inquiries" on public.inquiries;
drop policy if exists "Allow anon insert tickets" on public.tickets;
drop policy if exists "Allow anon insert carriers" on public.carriers;
drop policy if exists "Allow anon insert agreements" on public.agreements;
drop policy if exists "Allow anon insert authorizations" on public.authorizations;
drop policy if exists "Allow anon insert documents" on public.documents;
drop policy if exists "Allow anon insert traffic" on public.traffic_events;
revoke all privileges on table public.inquiries, public.tickets, public.carriers,
  public.agreements, public.authorizations, public.documents, public.traffic_events
  from public, anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('carrier-intake', 'carrier-intake', false, 8388608,
  array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.verify_intake_proxy(p_token text)
returns boolean
language sql
security definer
set search_path = pg_catalog, private, extensions
as $$
  select coalesce(exists (
    select 1 from private.intake_proxy_tokens t
    where t.active and t.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  ), false);
$$;
revoke all on function public.verify_intake_proxy(text) from public, anon, authenticated;
grant execute on function public.verify_intake_proxy(text) to service_role;

create or replace function public.consume_intake_rate_limit(p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if p_ip_hash is null or length(p_ip_hash) <> 64 then return false; end if;
  delete from private.intake_rate_limits where window_start < v_window - interval '24 hours';
  insert into private.intake_rate_limits(ip_hash, window_start, request_count)
    values (p_ip_hash, v_window, 1)
  on conflict (ip_hash, window_start)
    do update set request_count = private.intake_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= 10;
end;
$$;
revoke all on function public.consume_intake_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_intake_rate_limit(text) to service_role;

create or replace function public.register_public_intake(
  p_kind text,
  p_payload jsonb,
  p_signature_path text,
  p_signature_sha256 text,
  p_documents jsonb,
  p_reference_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_inquiry_id uuid;
  v_carrier_id uuid;
  v_doc jsonb;
  v_commission_model text;
begin
  if p_kind not in ('inquiry','onboarding') or jsonb_typeof(p_payload) <> 'object' then
    return jsonb_build_object('success', false, 'error', 'invalid_submission');
  end if;
  if coalesce(p_payload->>'tcpaConsent', p_payload->>'tcpa_consent', 'false') <> 'true' then
    return jsonb_build_object('success', false, 'error', 'consent_required');
  end if;

  if p_kind = 'inquiry' then
    insert into public.inquiries (
      name, company_name, phone, email, mc_number, dot_number, equipment_type,
      truck_count, preferred_lanes, source, notes, tcpa_consent, submission_data, public_reference_id
    ) values (
      left(coalesce(p_payload->>'name',''),160), nullif(left(coalesce(p_payload->>'company_name',''),160),''),
      left(coalesce(p_payload->>'phone',''),40), nullif(left(coalesce(p_payload->>'email',''),254),''),
      nullif(left(coalesce(p_payload->>'mc_number',''),32),''), nullif(left(coalesce(p_payload->>'dot_number',''),32),''),
      coalesce(p_payload->>'equipment_type','53_dry_van'),
      greatest(1, least(coalesce((p_payload->>'truck_count')::integer,1),100)),
      nullif(left(coalesce(p_payload->>'preferred_lanes',''),500),''), 'website_inquiry',
      nullif(left(coalesce(p_payload->>'notes',''),1000),''), true, p_payload, p_reference_id
    ) returning id into v_inquiry_id;
    return jsonb_build_object('success',true,'status','RECEIVED','reference_id',p_reference_id,'inquiry_id',v_inquiry_id);
  end if;

  if p_signature_path is null or p_signature_sha256 is null
     or coalesce(p_payload->>'signerName','') = ''
     or coalesce(p_payload->>'signedDate','') = ''
     or coalesce(p_payload->>'legalAckLpoa','false') <> 'true'
     or coalesce(p_payload->>'legalAckLoadboard','false') <> 'true'
     or coalesce(p_payload->>'legalAckUniversalAssignment','false') <> 'true'
     or coalesce(p_payload->>'legalAckDirectPay','false') <> 'true' then
    return jsonb_build_object('success',false,'error','agreement_acknowledgement_required');
  end if;
  if exists (select 1 from public.carriers c where c.mc_number = upper(p_payload->>'mc')) then
    return jsonb_build_object('success',false,'error','duplicate_mc');
  end if;

  insert into public.inquiries (
    name, company_name, phone, email, mc_number, dot_number, equipment_type,
    truck_count, source, notes, tcpa_consent, submission_data,
    signature_path, signature_sha256, public_reference_id
  ) values (
    left(coalesce(p_payload->>'name',''),160), left(coalesce(p_payload->>'company',''),160),
    left(coalesce(p_payload->>'phone',''),40), nullif(left(coalesce(p_payload->>'email',''),254),''),
    upper(left(coalesce(p_payload->>'mc',''),32)), nullif(left(coalesce(p_payload->>'dot',''),32),''),
    coalesce(p_payload->>'equipment','53_dry_van'),
    greatest(1, least(coalesce((p_payload->>'truck_count')::integer,1),100)),
    'website_onboarding', left('Signed onboarding submitted by ' || left(p_payload->>'signerName',120),1000),
    true, p_payload, p_signature_path, p_signature_sha256, p_reference_id
  ) returning id into v_inquiry_id;

  v_commission_model := case
    when p_payload->>'plan_code' = 'FLEET_FOUNDING_245' then 'FLEET_245'
    when p_payload->>'plan_code' = 'FLEET_STANDARD_299' then 'FLEET_299'
    when p_payload->>'equipment' = '53_reefer' then 'PERCENTAGE_5.5'
    else 'PERCENTAGE_5.0'
  end;
  insert into public.carriers (
    mc_number, dot_number, carrier_name, contact_person, phone, email, equipment,
    status, commission_model, signature_hash, signature_image, signature_date, tcpa_consent, notes
  ) values (
    upper(left(p_payload->>'mc',32)), nullif(left(p_payload->>'dot',32),''),
    left(p_payload->>'company',160), left(p_payload->>'name',160), left(p_payload->>'phone',40),
    nullif(left(p_payload->>'email',254),''), coalesce(p_payload->>'equipment','53_dry_van'),
    'ONBOARDING', v_commission_model, left(p_signature_sha256,128), p_signature_path,
    (p_payload->>'signedDate')::timestamptz, true, 'Application received; pending eligibility and document review.'
  ) returning id into v_carrier_id;

  insert into public.agreements (
    carrier_id, agreement_type, version, signature_hash, signature_image, signed_date, status
  ) values (
    v_carrier_id, 'CARRIER_DISPATCH_AGREEMENT', '2026.3', left(p_signature_sha256,128),
    p_signature_path, (p_payload->>'signedDate')::timestamptz, 'PENDING_REVIEW'
  );
  insert into public.authorizations(carrier_id, auth_type, granted, notes)
  values
    (v_carrier_id,'LOADBOARD_DAT_SEAT',true,'Carrier checked the dispatch sub-seat authorization.'),
    (v_carrier_id,'LOADBOARD_TRUCKSTOP_SEAT',true,'Carrier checked the dispatch sub-seat authorization.'),
    (v_carrier_id,'LPOA_BROKER_PACKETS',true,'Carrier checked the limited power of attorney acknowledgment.');
  if jsonb_typeof(p_documents) = 'array' then
    for v_doc in select value from jsonb_array_elements(p_documents) loop
      insert into public.documents(carrier_id, doc_type, file_name, file_url, status)
      values (
        v_carrier_id,
        case when v_doc->>'doc_type' in ('COI','W9','MC_AUTHORITY_CERT','VOIDED_CHECK','NOA','RATE_CON','BOL_POD')
          then v_doc->>'doc_type' else 'OTHER' end,
        left(coalesce(v_doc->>'file_name','supporting-document'),180),
        left(coalesce(v_doc->>'storage_path',''),500), 'PENDING_REVIEW'
      );
    end loop;
  end if;
  return jsonb_build_object('success',true,'status','PENDING_REVIEW','reference_id',p_reference_id,
    'inquiry_id',v_inquiry_id,'carrier_id',v_carrier_id,'plan_code',p_payload->>'plan_code');
end;
$$;
revoke all on function public.register_public_intake(text,jsonb,text,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.register_public_intake(text,jsonb,text,text,jsonb,text) to service_role;

alter function public.get_waitlist_status() set search_path = pg_catalog;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;

commit;

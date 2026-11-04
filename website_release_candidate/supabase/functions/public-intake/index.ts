import { createClient } from 'npm:@supabase/supabase-js@2';

const bucket = 'carrier-intake';
const allowedOrigins = new Set([
  'https://almajdoubdispatch.com',
  'https://www.almajdoubdispatch.com',
  'https://almajdoubdispatch.pages.dev'
]);
const jsonHeaders = { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

async function sha256(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeEquipment(value: unknown) {
  const text = String(value || '').toLowerCase();
  if (text.includes('reefer')) return '53_reefer';
  if (text.includes('other')) return 'other';
  return '53_dry_van';
}

function cleanFileName(value: string) {
  return value.replace(/[\\/\u0000-\u001f\u007f]/g, '_').slice(0, 180) || 'supporting-document';
}

function documentType(fileName: string) {
  const name = fileName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (name.includes('COI') || name.includes('INSURANCE')) return 'COI';
  if (name.includes('W9')) return 'W9';
  if (name.includes('MC') || name.includes('AUTHORITY')) return 'MC_AUTHORITY_CERT';
  if (name.includes('VOIDEDCHECK')) return 'VOIDED_CHECK';
  if (name.includes('NOA')) return 'NOA';
  return 'OTHER';
}

function validateInquiry(payload: Record<string, unknown>) {
  const name = String(payload.name || '').trim();
  const phone = String(payload.phone || '').trim();
  const consent = payload.tcpa_consent === true || payload.tcpaConsent === true;
  if (name.length < 2 || name.length > 160 || phone.length < 7 || phone.length > 40 || !consent) return false;
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email))) return false;
  if (payload.equipment_type && !['53_dry_van', '53_reefer', 'other'].includes(String(payload.equipment_type))) return false;
  const trucks = Number(payload.truck_count || 1);
  return Number.isInteger(trucks) && trucks >= 1 && trucks <= 100;
}

function validateOnboarding(payload: Record<string, unknown>) {
  const required = ['mc', 'name', 'company', 'phone', 'email', 'signerName', 'signedDate'];
  if (required.some((key) => !String(payload[key] || '').trim())) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email))) return false;
  const signedAt = Date.parse(String(payload.signedDate));
  return Number.isFinite(signedAt)
    && payload.tcpaConsent === true
    && payload.legalAckLpoa === true
    && payload.legalAckLoadboard === true
    && payload.legalAckUniversalAssignment === true
    && payload.legalAckDirectPay === true;
}

Deno.serve(async (request: Request) => {
  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const proxyToken = request.headers.get('x-intake-proxy-key') || '';
  if (!projectUrl || !serviceRoleKey) return reply(503, { error: 'Intake service is not configured.' });

  const admin = createClient(projectUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  if (request.method === 'GET') {
    const { error } = await admin.from('inquiries').select('id').limit(1);
    return error ? reply(503, { status: 'degraded' }) : reply(200, { status: 'ok' });
  }
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed.' });

  const origin = request.headers.get('x-intake-origin') || '';
  if (origin && !allowedOrigins.has(origin)) return reply(403, { error: 'Origin is not allowed.' });
  const { data: verified, error: verifyError } = await admin.rpc('verify_intake_proxy', { p_token: proxyToken });
  if (verifyError || verified !== true) return reply(403, { error: 'Intake request was rejected.' });

  const ip = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const ipHash = await sha256(`${proxyToken}:${ip}`);
  const { data: allowed, error: limitError } = await admin.rpc('consume_intake_rate_limit', { p_ip_hash: ipHash });
  if (limitError || allowed !== true) return reply(429, { error: 'Too many submissions. Please try again later.' });

  const contentType = request.headers.get('content-type') || '';
  let kind: 'inquiry' | 'onboarding';
  let payload: Record<string, unknown>;
  let signature: File | null = null;
  let documents: File[] = [];
  if (contentType.toLowerCase().includes('multipart/form-data')) {
    kind = 'onboarding';
    const form = await request.formData();
    try { payload = JSON.parse(String(form.get('payload') || '{}')); }
    catch (_) { return reply(400, { error: 'Application data is not valid JSON.' }); }
    const submittedSignature = form.get('signature');
    signature = submittedSignature instanceof File ? submittedSignature : null;
    documents = form.getAll('documents').filter((item): item is File => item instanceof File);
  } else {
    kind = 'inquiry';
    try { payload = await request.json(); }
    catch (_) { return reply(400, { error: 'Inquiry data is not valid JSON.' }); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return reply(422, { error: 'Inquiry data is incomplete.' });
    payload.equipment_type = normalizeEquipment(payload.equipment_type || payload.equipmentType || payload.equipment);
  }

  if (kind === 'inquiry') {
    if (!validateInquiry(payload)) return reply(422, { error: 'Please check the required fields and consent.' });
  } else {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !validateOnboarding(payload)) {
      return reply(422, { error: 'Please complete the required onboarding fields and acknowledgements.' });
    }
    if (!signature || signature.type !== 'image/png' || signature.size < 100 || signature.size > 1024 * 1024) {
      return reply(422, { error: 'A drawn signature image is required (maximum 1 MB).' });
    }
    const totalSize = documents.reduce((sum, file) => sum + file.size, signature.size);
    if (documents.length > 5 || totalSize > 25 * 1024 * 1024) return reply(413, { error: 'Upload up to five documents, with a 25 MB total limit.' });
    if (documents.some((file) => !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size < 1 || file.size > 8 * 1024 * 1024)) {
      return reply(422, { error: 'Documents must be PDF, JPG, or PNG files no larger than 8 MB each.' });
    }
  }

  const referenceId = `ADM-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const uploadedPaths: string[] = [];
  let signaturePath: string | null = null;
  let signatureHash: string | null = null;
  const documentRows: Array<Record<string, unknown>> = [];
  try {
    if (kind === 'onboarding' && signature) {
      signaturePath = `signatures/${crypto.randomUUID()}.png`;
      signatureHash = await sha256(new Uint8Array(await signature.arrayBuffer()));
      const { error } = await admin.storage.from(bucket).upload(signaturePath, signature, { contentType: 'image/png', upsert: false });
      if (error) throw new Error('signature_upload_failed');
      uploadedPaths.push(signaturePath);
    }
    for (const file of documents) {
      const extension = file.type === 'application/pdf' ? 'pdf' : file.type === 'image/jpeg' ? 'jpg' : 'png';
      const storagePath = `documents/${crypto.randomUUID()}.${extension}`;
      const { error } = await admin.storage.from(bucket).upload(storagePath, file, { contentType: file.type, upsert: false });
      if (error) throw new Error('document_upload_failed');
      uploadedPaths.push(storagePath);
      documentRows.push({
        doc_type: documentType(file.name),
        file_name: cleanFileName(file.name),
        storage_path: storagePath
      });
    }

    if (kind === 'onboarding') {
      payload.equipment = normalizeEquipment(payload.equipment);
      payload.signature_sha256 = signatureHash;
      payload.reference_id = referenceId;
      payload.documents = documentRows;
    } else {
      payload.source = 'website_inquiry';
      payload.public_reference_id = referenceId;
      payload.tcpa_consent = true;
    }
    const { data, error } = await admin.rpc('register_public_intake', {
      p_kind: kind,
      p_payload: payload,
      p_signature_path: signaturePath,
      p_signature_sha256: signatureHash,
      p_documents: documentRows,
      p_reference_id: referenceId
    });
    if (error) throw new Error('registration_failed');
    if (data?.success !== true) {
      await admin.storage.from(bucket).remove(uploadedPaths);
      return reply(data?.error === 'duplicate_mc' ? 409 : 422, { success: false, error: data?.error || 'submission_rejected' });
    }
    return reply(200, data);
  } catch (_) {
    if (uploadedPaths.length) await admin.storage.from(bucket).remove(uploadedPaths);
    return reply(500, { error: 'The submission could not be saved securely. Please retry or contact the dispatch desk.' });
  }
});

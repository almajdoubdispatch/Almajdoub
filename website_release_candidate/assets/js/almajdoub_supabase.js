/* Compatibility facade: all production traffic goes through AlmajdoubApi. */
(function (window) {
  'use strict';
  function api() {
    if (!window.AlmajdoubApi) throw new Error('Canonical API client is not loaded.');
    return window.AlmajdoubApi;
  }
  function mapInquiry(data) {
    return {
      name: data.name || data.contactName || 'Carrier Lead',
      company_name: data.company || data.carrierName || data.companyName || null,
      phone: data.phone || '', email: data.email || null,
      mc_number: data.mc || data.mcNumber || null, dot_number: data.dot || null,
      equipment_type: data.equipment || data.equipmentType || '53_dry_van',
      truck_count: parseInt(data.truckCount || data.trucks || '1', 10) || 1,
      preferred_lanes: data.preferredLanes || data.lanes || null,
      source: data.source || 'Website Carrier Intake Form', notes: data.notes || null,
      tcpa_consent: data.tcpaConsent === true
    };
  }
  const facade = {
    saveInquiry: async function (data) { try { return Object.assign({ success: true }, await api().submitInquiry(mapInquiry(data))); } catch (e) { return { success: false, code: e.code || 'API_ERROR', status: e.status, error: e.message }; } },
    saveTicket: async function (data) { try { const result = await api().publicRequest('/tickets', { method: 'POST', body: data }); return { success: true, data: result }; } catch (e) { return { success: false, code: e.code || 'API_ERROR', status: e.status, error: e.message }; } },
    checkWaitlistStatus: async function () { try { return await api().publicRequest('/waitlist/status', { method: 'GET' }); } catch (e) { return { success: false, code: e.code || 'API_ERROR', error: e.message }; } },
    getPublicPlans: async function () { try { return { success: true, plans: await api().publicRequest('/plans', { method: 'GET' }) }; } catch (e) { return { success: false, plans: [], code: e.code || 'API_ERROR', error: e.message }; } },
    validateReferralCode: async function (code) { if (!code || !code.trim()) return { valid: false, skips_waitlist: false, grants_trial: false }; try { return await api().publicRequest('/referrals/validate', { method: 'POST', body: { code: code.trim() } }); } catch (e) { return { valid: false, code: e.code || 'API_ERROR', error: e.message }; } },
    registerCarrier: async function (data, files, signature) { try { return await api().submitOnboarding(data, files, signature); } catch (e) { return { success: false, code: e.code || 'API_ERROR', status: e.status, error: e.message }; } },
    saveCarrier: async function (data) { return this.registerCarrier(data); },
    logTraffic: async function () { return { success: false, code: 'ANALYTICS_DISABLED_UNTIL_API_CONFIGURED' }; }
  };
  window.AlmajdoubSupabase = facade;
})(window);

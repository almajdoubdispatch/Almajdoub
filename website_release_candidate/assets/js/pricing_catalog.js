/**
 * Almajdoub Dispatch — Canonical Pricing Catalog Module (D-28)
 * Governs rate plans, equipment percentage models, and fleet flat retainers.
 * Plain ES5/ES2017 — No external build tools or bundlers required.
 */
(function(window) {
  'use strict';

  var FALLBACK_PLANS = [
    {
      code: 'TRIAL_14',
      name: '14-Day Free Operational Trial',
      model: 'TRIAL',
      dryVanRate: 0.0000,
      reeferRate: 0.0000,
      weeklyFee: 0,
      minTrucks: 1,
      trialDays: 14,
      description: '14 days of 100% free dispatch. 0% commission on base linehaul. No credit card required.'
    },
    {
      code: 'LAUNCH_PERCENTAGE',
      name: 'Launch Partner Rate',
      model: 'PERCENTAGE',
      dryVanRate: 0.0500,
      reeferRate: 0.0550,
      weeklyFee: 0,
      minTrucks: 1,
      trialDays: 0,
      description: '5.0% for 53′ Dry Van / 5.5% for 53′ Reefer. Preferred launch rate locked for active carriers.'
    },
    {
      code: 'STANDARD_PERCENTAGE',
      name: 'Standard Published Rate',
      model: 'PERCENTAGE',
      dryVanRate: 0.0700,
      reeferRate: 0.0800,
      weeklyFee: 0,
      minTrucks: 1,
      trialDays: 0,
      description: '7.0% for 53′ Dry Van / 8.0% for 53′ Reefer. Standard rate after roster maturation.'
    },
    {
      code: 'FLEET_FOUNDING_245',
      name: 'Founding Fleet Retainer',
      model: 'FLEET_RETAINER',
      dryVanRate: 0.0000,
      reeferRate: 0.0000,
      weeklyFee: 245,
      minTrucks: 2,
      trialDays: 0,
      description: '$245 / active truck / week (Min 2 trucks). 0% percentage commission. Prepaid weekly.'
    },
    {
      code: 'FLEET_STANDARD_299',
      name: 'Standard Fleet Retainer',
      model: 'FLEET_RETAINER',
      dryVanRate: 0.0000,
      reeferRate: 0.0000,
      weeklyFee: 299,
      minTrucks: 3,
      trialDays: 0,
      description: '$299 / active truck / week (Min 3 trucks = $897 baseline). 0% percentage commission. Prepaid weekly.'
    }
  ];

  var CANONICAL_RATES = [0.0000, 0.0500, 0.0550, 0.0700, 0.0800];

  var AlmajdoubPricing = {
    FALLBACK_PLANS: FALLBACK_PLANS,

    getPlans: async function() {
      // Attempt RPC call if Supabase client is configured
      var cfg = window.SUPABASE_CONFIG || (window.AlmajdoubSupabase && window.AlmajdoubSupabase.config);
      if (cfg && cfg.url) {
        try {
          var res = await fetch(cfg.url + '/rest/v1/rpc/get_public_plans', {
            method: 'POST',
            headers: {
              'apikey': cfg.anonKey,
              'Authorization': 'Bearer ' + cfg.anonKey,
              'Content-Type': 'application/json'
            },
            body: '{}'
          });
          if (res.ok) {
            var data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              return { source: 'database', plans: data };
            }
          }
        } catch (e) {
          // Graceful fallback to static catalogue
        }
      }
      return { source: 'fallback', plans: FALLBACK_PLANS };
    },

    formatRate: function(rate) {
      if (typeof rate !== 'number') rate = parseFloat(rate) || 0;
      return (rate * 100).toFixed(1) + '%';
    },

    formatWeeklyFee: function(plan) {
      if (!plan || plan.model !== 'FLEET_RETAINER') return '—';
      return '$' + plan.weeklyFee + ' / truck / week';
    },

    getPlan: function(planCode) {
      if (!planCode) return null;
      for (var i = 0; i < FALLBACK_PLANS.length; i++) {
        if (FALLBACK_PLANS[i].code === planCode) {
          return FALLBACK_PLANS[i];
        }
      }
      return null;
    },

    planLabel: function(planCode) {
      var p = this.getPlan(planCode);
      return p ? p.name : 'Custom Plan';
    },

    commissionFor: function(planCode, equipment, linehaul) {
      linehaul = parseFloat(linehaul) || 0;
      var plan = this.getPlan(planCode) || this.getPlan('LAUNCH_PERCENTAGE');
      
      if (!plan || plan.model === 'TRIAL' || plan.model === 'FLEET_RETAINER') {
        return { rate: 0.0, amount: 0.0, weeklyFee: plan ? plan.weeklyFee : 0 };
      }

      var isReefer = equipment && (equipment.indexOf('reefer') !== -1 || equipment === '53_reefer');
      var rate = isReefer ? plan.reeferRate : plan.dryVanRate;
      var amount = Math.round((linehaul * rate) * 100) / 100;

      return {
        rate: rate,
        rateFormatted: this.formatRate(rate),
        amount: amount,
        equipment: isReefer ? '53_reefer' : '53_dry_van'
      };
    },

    assertCanonical: function() {
      for (var i = 0; i < FALLBACK_PLANS.length; i++) {
        var p = FALLBACK_PLANS[i];
        if (p.model === 'PERCENTAGE') {
          if (CANONICAL_RATES.indexOf(p.dryVanRate) === -1) {
            throw new Error('Non-canonical Dry Van rate in plan: ' + p.code);
          }
          if (CANONICAL_RATES.indexOf(p.reeferRate) === -1) {
            throw new Error('Non-canonical Reefer rate in plan: ' + p.code);
          }
        }
      }
      return true;
    }
  };

  // Run assertion in dev mode
  try {
    AlmajdoubPricing.assertCanonical();
  } catch (err) {
    console.error('[AlmajdoubPricing] Assertion Error:', err);
  }

  window.AlmajdoubPricing = AlmajdoubPricing;

})(typeof window !== 'undefined' ? window : this);

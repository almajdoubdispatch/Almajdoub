/**
 * Almajdoub Dispatch — Unified Database & Real-Time Sync Engine (v3.0)
 * ----------------------------------------------------------------------
 * Provides a single shared reactive persistence layer for:
 * 1. Carrier App / Driver Dashboard (carrier_app.html)
 * 2. Dispatcher Operations Cockpit (Ahmed_Dispatch_Cockpit.html)
 * 3. 14-Day Free Landing Page (landing_14days_free.html)
 * 4. Referral & Rewards Portal (referral_portal.html)
 *
 * Implements: OTP Authentication, Load Offer Broadcasting, Carrier Ledger,
 * and Automated Weekly Settlement Invoicing.
 */

(function(window) {
  'use strict';

  const DB_KEYS = {
    CARRIERS: 'almajdoub_db_carriers',
    LOADS: 'almajdoub_db_loads',
    INVOICES: 'almajdoub_db_invoices',
    NOTIFICATIONS: 'almajdoub_db_notifications',
    CURRENT_SESSION: 'almajdoub_db_session',
    ACTIVE_OTP: 'almajdoub_db_otp',
    BROKERS: 'almajdoub_db_brokers',
    CALL_LOGS: 'almajdoub_db_call_logs',
    EMAIL_ARCHIVE: 'almajdoub_db_email_archive'
  };

  // Default Seed Data (Initial Production Carrier & Loads)
  const SEED_CARRIERS = [
    {
      mc: 'MC-987452',
      dot: 'DOT-3891045',
      name: 'Mack Miller',
      company: 'Miller Express Hauling LLC',
      phone: '+1 (409) 941-7180',
      email: 'mack@millerhauling.com',
      equipment: '53_dry_van',
      truck: '2023 Peterbilt 389 (Unit #101)',
      status: 'ACTIVE_TRIAL',
      freeDaysLeft: 42,
      baseDays: 14,
      referralDays: 28,
      referralsCount: 2,
      referredBy: 'ALM-ROOT',
      feePercent: 0, // In free trial
      joinedDate: '2026-10-14'
    },
    {
      mc: 'MC-112345',
      dot: 'DOT-2948123',
      name: 'Bobby Hayes',
      company: 'Hayes Freight Lines',
      phone: '+1 (555) 234-5678',
      email: 'bobby@hayesfreight.com',
      equipment: '53_reefer',
      truck: '2022 Kenworth W900 (Unit #12)',
      status: 'ACTIVE_TRIAL',
      freeDaysLeft: 14,
      baseDays: 14,
      referralDays: 0,
      referralsCount: 0,
      referredBy: 'MC-987452',
      feePercent: 0,
      joinedDate: '2026-10-20'
    },
    {
      mc: 'MC-884321',
      dot: 'DOT-4109823',
      name: 'Tony Ramirez',
      company: 'Ramirez Transport LLC',
      phone: '+1 (555) 876-5432',
      email: 'tony@ramireztrans.com',
      equipment: '53_dry_van',
      truck: '2024 Freightliner Cascadia',
      status: 'ACTIVE_PAID',
      freeDaysLeft: 0,
      baseDays: 14,
      referralDays: 0,
      referralsCount: 0,
      referredBy: 'MC-987452',
      feePercent: 7,
      joinedDate: '2026-09-15'
    }
  ];

  const SEED_LOADS = [
    {
      id: 'LD-2026-901',
      mc: 'MC-987452',
      carrierName: 'Miller Express Hauling LLC',
      broker: 'C.H. Robinson (MC-12345)',
      origin: 'Dallas, TX',
      pickupAddress: '4500 Logistics Way, Hutchins, TX 75141',
      pickupTime: '2026-10-24 08:00 AM CST',
      destination: 'Columbus, OH',
      deliveryAddress: '1200 Distribution Pkwy, Grove City, OH 43123',
      deliveryTime: '2026-10-25 04:00 PM EST',
      equipment: '53′ Dry Van',
      commodity: 'Consumer Electronics (Palletized)',
      weight: '34,500 lbs',
      loadedMiles: 1050,
      deadheadMiles: 25,
      totalMiles: 1075,
      grossRate: 3150.00,
      dispatcherFeePercent: 0.0, // Free trial
      dispatcherFeeAmount: 0.00,
      netCarrierPayout: 3150.00,
      rpm: 2.93,
      detentionClause: '$50.00/hr after 2 hrs free time',
      tonuAmount: 350.00,
      status: 'OFFERED_PENDING_APPROVAL', // Driver sees this in App!
      createdAt: new Date().toISOString()
    },
    {
      id: 'LD-2026-885',
      mc: 'MC-987452',
      carrierName: 'Miller Express Hauling LLC',
      broker: 'TQL Logistics (MC-45678)',
      origin: 'Atlanta, GA',
      pickupAddress: '880 Industrial Blvd, Forest Park, GA 30297',
      pickupTime: '2026-10-20 09:00 AM EST',
      destination: 'Chicago, IL',
      deliveryAddress: '2200 Gateway Dr, Joliet, IL 60436',
      deliveryTime: '2026-10-21 06:00 PM CST',
      equipment: '53′ Dry Van',
      commodity: 'Automotive Parts',
      weight: '41,000 lbs',
      loadedMiles: 715,
      deadheadMiles: 18,
      totalMiles: 733,
      grossRate: 2350.00,
      dispatcherFeePercent: 0.0,
      dispatcherFeeAmount: 0.00,
      netCarrierPayout: 2350.00,
      rpm: 3.20,
      detentionClause: '$50.00/hr after 2 hrs free',
      tonuAmount: 350.00,
      status: 'DELIVERED',
      deliveredAt: '2026-10-21T18:00:00Z',
      createdAt: '2026-10-20T07:00:00Z'
    },
    {
      id: 'LD-2026-882',
      mc: 'MC-987452',
      carrierName: 'Miller Express Hauling LLC',
      broker: 'Landstar Ranger (MC-99887)',
      origin: 'Savannah, GA',
      pickupAddress: 'Port Terminal Gate 4, Savannah, GA 31407',
      pickupTime: '2026-10-16 07:00 AM EST',
      destination: 'Allentown, PA',
      deliveryAddress: '500 Logistics Rd, Breinigsville, PA 18031',
      deliveryTime: '2026-10-17 01:00 PM EST',
      equipment: '53′ Dry Van',
      commodity: 'Dry Goods',
      weight: '38,000 lbs',
      loadedMiles: 685,
      deadheadMiles: 30,
      totalMiles: 715,
      grossRate: 2450.00,
      dispatcherFeePercent: 0.0,
      dispatcherFeeAmount: 0.00,
      netCarrierPayout: 2450.00,
      rpm: 3.42,
      detentionClause: '$60.00/hr after 2 hrs',
      tonuAmount: 350.00,
      status: 'DELIVERED',
      deliveredAt: '2026-10-17T13:00:00Z',
      createdAt: '2026-10-16T06:00:00Z'
    }
  ];

  const SEED_INVOICES = [
    {
      invoiceNum: 'INV-ALM-2026-W42',
      mc: 'MC-987452',
      carrierName: 'Miller Express Hauling LLC',
      weekEnding: '2026-10-21',
      loads: ['LD-2026-882', 'LD-2026-885'],
      totalGross: 4800.00,
      standardFeePercent: 6.0,
      nominalFee: 288.00,
      discountPromo: 288.00, // 100% Free Trial Discount
      totalFeeDue: 0.00,
      carrierRetained: 4800.00,
      status: 'SETTLED_FREE_TRIAL',
      paidDate: '2026-10-21',
      notes: 'Covered under 14-Day Free Trial Promotion (0% Dispatch Fee Applied).'
    }
  ];

  const SEED_BROKERS = [
    {
      mc: 'MC-12345',
      dot: 'DOT-884129',
      name: 'C.H. Robinson Worldwide',
      phone: '+1 (800) 323-7587',
      email: 'loads@chrobinson.com',
      factoringStatus: 'APPROVED',
      creditLimit: '$250,000',
      daysToPay: 18,
      detentionPolicy: '$50.00/hr after 2 hrs (Easy approval via Navisphere)',
      detentionScore: 'A (High Compliance)',
      tonuAmount: 250.00,
      tonuScore: 'A (Paid within 24h)',
      internalRating: 4.9,
      badge: 'TIER_1_PREFERRED',
      totalLoadsCompleted: 14,
      notes: 'Excellent partner. Use Navisphere for instant automated check-ins and detention clock.'
    },
    {
      mc: 'MC-34567',
      dot: 'DOT-912440',
      name: 'Total Quality Logistics (TQL)',
      phone: '+1 (800) 580-3101',
      email: 'carrierops@tql.com',
      factoringStatus: 'APPROVED',
      creditLimit: '$150,000',
      daysToPay: 21,
      detentionPolicy: '$50.00/hr (Strict: requires exact in/out stamp on BOL or denied)',
      detentionScore: 'B (Requires BOL Proof)',
      tonuAmount: 200.00,
      tonuScore: 'B (Requires arrival proof)',
      internalRating: 4.2,
      badge: 'VERIFIED_STRICT',
      totalLoadsCompleted: 9,
      notes: 'High freight volume. Strict tracking requirements. Always instruct driver to get stamped departure time.'
    },
    {
      mc: 'MC-54321',
      dot: 'DOT-667123',
      name: 'Echo Global Logistics',
      phone: '+1 (800) 354-7993',
      email: 'dispatch@echo.com',
      factoringStatus: 'APPROVED',
      creditLimit: '$100,000',
      daysToPay: 19,
      detentionPolicy: '$60.00/hr after 2 hrs',
      detentionScore: 'A (Quick Approval)',
      tonuAmount: 250.00,
      tonuScore: 'A',
      internalRating: 4.7,
      badge: 'TIER_1_PREFERRED',
      totalLoadsCompleted: 6,
      notes: 'Reliable rates on Midwest to Southeast lanes. Fast factoring approvals.'
    },
    {
      mc: 'MC-67890',
      dot: 'DOT-449102',
      name: 'Landstar Ranger Inc.',
      phone: '+1 (800) 872-9400',
      email: 'agentops@landstar.com',
      factoringStatus: 'APPROVED',
      creditLimit: '$200,000',
      daysToPay: 17,
      detentionPolicy: '$55.00/hr after 2 hrs',
      detentionScore: 'A (Honors contracts)',
      tonuAmount: 300.00,
      tonuScore: 'A',
      internalRating: 4.8,
      badge: 'TIER_1_PREFERRED',
      totalLoadsCompleted: 8,
      notes: 'Agent-based system. Excellent relationship with Dallas and Chicago agency desks.'
    },
    {
      mc: 'MC-999888',
      dot: 'DOT-110293',
      name: 'Apex Rapid Freight Logistics (Blacklisted Sample)',
      phone: '+1 (555) 019-2834',
      email: 'badops@apexrapid.com',
      factoringStatus: 'NO_BUY_DENIED',
      creditLimit: '$0 (Revoked)',
      daysToPay: 65,
      detentionPolicy: 'Disputes all claims',
      detentionScore: 'F (Zero payment)',
      tonuAmount: 0.00,
      tonuScore: 'F (Ghosted)',
      internalRating: 1.1,
      badge: 'BLACKLISTED',
      totalLoadsCompleted: 1,
      notes: 'High risk! Failed factoring pre-check. Disputed standard detention. Flagged on internal ledger.'
    }
  ];

  const SEED_CALL_LOGS = [
    {
      id: 'CALL-2026-101',
      date: '2026-10-27 10:15 AM EDT',
      brokerMC: 'MC-12345',
      brokerName: 'C.H. Robinson (Rep: David Miller)',
      carrierMC: 'MC-987452',
      driverName: 'Mack Miller (Unit #101)',
      lane: 'Dallas, TX to Columbus, OH',
      audioFile: 'call_rec_20261027_chrobinson.mp3',
      durationSeconds: 165,
      geminiAnalysis: {
        transcriptSummary: 'Negotiated linehaul from $2,200 to $2,450. Broker confirmed 34,500 lbs palletized electronics, strictly 53 Dry Van. Confirmed appointment windows.',
        agreedGrossRate: 2450.00,
        detentionRateConfirmed: 50.00,
        detentionFreeHours: 2,
        tonuAgreed: 250.00,
        verbalPromises: 'Broker agreed to issue clean Rate Con within 10 minutes and noted receiver dock usually empties in 45 mins.',
        riskScore: 'Low (0.05)',
        sentiment: 'Collaborative & Professional'
      }
    }
  ];

  const SEED_EMAILS = [
    {
      id: 'EML-2026-401',
      date: '2026-10-27 10:22 AM EDT',
      from: 'david.miller@chrobinson.com',
      to: 'dispatch@almajdoub.com',
      subject: 'RATE CONFIRMATION — Load #9410294 / Dallas to Columbus',
      attachment: 'RateCon_9410294.pdf',
      parsedByGemini: true,
      extractedData: {
        loadId: 'LD-2026-901',
        gross: 2450.00,
        origin: 'Hutchins, TX',
        destination: 'Grove City, OH',
        detentionClause: '$50.00/hr after 2 hrs',
        tonuClause: '$250.00 with verified dispatch',
        commodity: 'Palletized Consumer Electronics',
        weight: '34,500 lbs'
      }
    }
  ];

  // Helper storage functions
  function getStorage(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (e) {
      console.warn('Storage read error for key:', key, e);
      return defaultVal;
    }
  }

  function setStorage(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      window.dispatchEvent(new CustomEvent('almajdoub_db_change', { detail: { key, val } }));
    } catch (e) {
      console.warn('Storage write error for key:', key, e);
    }
  }

  // Database API
  const AlmajdoubDB = {
    init: function() {
      if (window.ALMAJDOUB_DEMO_MODE !== true) return;
      if (!localStorage.getItem(DB_KEYS.CARRIERS)) {
        setStorage(DB_KEYS.CARRIERS, SEED_CARRIERS);
      }
      if (!localStorage.getItem(DB_KEYS.LOADS)) {
        setStorage(DB_KEYS.LOADS, SEED_LOADS);
      }
      if (!localStorage.getItem(DB_KEYS.INVOICES)) {
        setStorage(DB_KEYS.INVOICES, SEED_INVOICES);
      }
      if (!localStorage.getItem(DB_KEYS.BROKERS)) {
        setStorage(DB_KEYS.BROKERS, SEED_BROKERS);
      }
      if (!localStorage.getItem(DB_KEYS.CALL_LOGS)) {
        setStorage(DB_KEYS.CALL_LOGS, SEED_CALL_LOGS);
      }
      if (!localStorage.getItem(DB_KEYS.EMAIL_ARCHIVE)) {
        setStorage(DB_KEYS.EMAIL_ARCHIVE, SEED_EMAILS);
      }
      console.log('🚛 Almajdoub Unified DB Initialized with Broker Memory & AI Logs.');
    },

    // Carrier Methods
    getCarriers: function() {
      return window.ALMAJDOUB_DEMO_MODE === true ? getStorage(DB_KEYS.CARRIERS, SEED_CARRIERS) : [];
    },

    getCarrierByMC: function(mc) {
      if (!mc) return null;
      const clean = mc.trim().toUpperCase().replace(/^MC-?/, 'MC-');
      return this.getCarriers().find(c => c.mc === clean || c.mc === mc);
    },

    saveCarrier: function(carrier) {
      const carriers = this.getCarriers();
      const idx = carriers.findIndex(c => c.mc === carrier.mc);
      if (idx >= 0) {
        carriers[idx] = Object.assign(carriers[idx], carrier);
      } else {
        carriers.unshift(carrier);
      }
      setStorage(DB_KEYS.CARRIERS, carriers);
      return carrier;
    },

    // Loads Methods
    getLoads: function(filterMC) {
      const loads = window.ALMAJDOUB_DEMO_MODE === true ? getStorage(DB_KEYS.LOADS, SEED_LOADS) : [];
      if (filterMC) {
        const clean = filterMC.trim().toUpperCase().replace(/^MC-?/, 'MC-');
        return loads.filter(l => l.mc === clean || l.mc === filterMC);
      }
      return loads;
    },

    getLoadById: function(loadId) {
      return this.getLoads().find(l => l.id === loadId);
    },

    saveLoad: function(load) {
      const loads = this.getLoads();
      const idx = loads.findIndex(l => l.id === load.id);
      if (idx >= 0) {
        loads[idx] = Object.assign(loads[idx], load);
      } else {
        loads.unshift(load);
      }
      setStorage(DB_KEYS.LOADS, loads);
      return load;
    },

    // Driver Load Response (ACCEPT / DECLINE)
    respondToLoad: async function(loadId, decision, reason, expectedVersion) {
      if (!window.AlmajdoubApi || typeof window.AlmajdoubApi.submitLoadDecision !== 'function') {
        throw new Error('Canonical API client is required; local decisions are disabled.');
      }
      return window.AlmajdoubApi.submitLoadDecision(loadId, decision, expectedVersion, { reason: reason || null });
    },

    // Weekly Invoices
    getInvoices: function(filterMC) {
      const invoices = window.ALMAJDOUB_DEMO_MODE === true ? getStorage(DB_KEYS.INVOICES, SEED_INVOICES) : [];
      if (filterMC) {
        return invoices.filter(inv => inv.mc === filterMC);
      }
      return invoices;
    },

    generateWeeklyInvoice: function(mc, weekEnding) {
      const carrier = this.getCarrierByMC(mc);
      if (!carrier) return null;

      const carrierLoads = this.getLoads(mc).filter(l => l.status === 'DELIVERED');
      const totalGross = carrierLoads.reduce((sum, l) => sum + (l.grossRate || 0), 0);
      
      const isFreeTrial = carrier.freeDaysLeft > 0 || carrier.feePercent === 0;
      const isReefer = carrier.equipment && carrier.equipment.includes('reefer');
      const defaultRate = isReefer ? 8.0 : 7.0;
      const feeRate = isFreeTrial ? 0 : (carrier.feePercent || defaultRate);
      const standardRate = carrier.feePercent || defaultRate;
      const nominalFee = totalGross * (standardRate / 100);
      const discount = isFreeTrial ? nominalFee : 0;
      const feeDue = isFreeTrial ? 0 : (totalGross * (feeRate / 100));

      const inv = {
        invoiceNum: `INV-ALM-${new Date().getFullYear()}-W${Math.ceil((new Date().getDate() + 6) / 7)}`,
        mc: carrier.mc,
        carrierName: carrier.company,
        weekEnding: weekEnding || new Date().toISOString().split('T')[0],
        loads: carrierLoads.map(l => l.id),
        totalGross: totalGross,
        standardFeePercent: standardRate,
        nominalFee: nominalFee,
        discountPromo: discount,
        totalFeeDue: feeDue,
        carrierRetained: totalGross - feeDue,
        status: isFreeTrial ? 'SETTLED_FREE_TRIAL' : 'INVOICED_PENDING_PAYMENT',
        paidDate: isFreeTrial ? new Date().toISOString().split('T')[0] : null,
        notes: isFreeTrial 
          ? `Covered under 14-Day Free Trial / Referral Runway (${carrier.freeDaysLeft} days remaining). $0.00 fee charged.`
          : `Dispatch settlement at ${standardRate}% for week ending ${weekEnding}.`
      };

      const invoices = this.getInvoices();
      invoices.unshift(inv);
      setStorage(DB_KEYS.INVOICES, invoices);
      return inv;
    },

    // OTP Authentication Service
    requestOTP: function(phoneOrMC) {
      return { success: false, code: 'LOCAL_OTP_DISABLED', message: 'Sign-in requires the approved identity provider. Local OTP is disabled.' };
    },

    verifyOTP: function(code) {
      return { success: false, code: 'LOCAL_OTP_DISABLED', message: 'Local OTP verification is disabled.' };
    },

    getCurrentSession: function() {
      return null;
    },

    logout: function() {
      localStorage.removeItem(DB_KEYS.CURRENT_SESSION);
      localStorage.removeItem(DB_KEYS.ACTIVE_OTP);
      window.dispatchEvent(new CustomEvent('almajdoub_db_change', { detail: { key: DB_KEYS.CURRENT_SESSION, val: null } }));
    },

    // Notifications
    addNotification: function(notif) {
      const list = getStorage(DB_KEYS.NOTIFICATIONS, []);
      list.unshift(notif);
      setStorage(DB_KEYS.NOTIFICATIONS, list);
    },

    getNotifications: function() {
      return getStorage(DB_KEYS.NOTIFICATIONS, []);
    },

    // Broker Intelligence & Credit Ledger Methods
    getBrokers: function() {
      return getStorage(DB_KEYS.BROKERS, SEED_BROKERS);
    },

    getBrokerByMC: function(mc) {
      if (!mc) return null;
      const clean = mc.trim().toUpperCase().replace(/^MC-?/, 'MC-');
      return this.getBrokers().find(b => b.mc === clean || b.mc === mc);
    },

    saveBroker: function(broker) {
      const brokers = this.getBrokers();
      const idx = brokers.findIndex(b => b.mc === broker.mc);
      if (idx >= 0) {
        brokers[idx] = Object.assign(brokers[idx], broker);
      } else {
        brokers.unshift(broker);
      }
      setStorage(DB_KEYS.BROKERS, brokers);
      return broker;
    },

    // Call Transcripts & AI Audio Dialogue Logs
    getCallLogs: function() {
      return getStorage(DB_KEYS.CALL_LOGS, SEED_CALL_LOGS);
    },

    addCallLog: function(callLog) {
      const logs = this.getCallLogs();
      logs.unshift(callLog);
      setStorage(DB_KEYS.CALL_LOGS, logs);
      return callLog;
    },

    // Email Archive & AI Parsed Documents
    getEmailArchive: function() {
      return getStorage(DB_KEYS.EMAIL_ARCHIVE, SEED_EMAILS);
    },

    addEmail: function(email) {
      const archive = this.getEmailArchive();
      archive.unshift(email);
      setStorage(DB_KEYS.EMAIL_ARCHIVE, archive);
      return email;
    }
  };

  // Auto-init on load
  AlmajdoubDB.init();

  // Export globally
  window.AlmajdoubDB = AlmajdoubDB;

})(window);

/**
 * Almajdoub Dispatch — Cockpit Backoffice Operations Controller (Phase 3)
 * Connects Ahmed_Dispatch_Cockpit.html directly to live Supabase backend.
 */
(function(window) {
  'use strict';

  function escapeHtml(unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const SUPABASE_CONFIG = { url: (window.ALMAJDOUB_API_CONFIG || {}).apiBaseUrl || '/api/v1', anonKey: '' };

  const CockpitController = {
    config: SUPABASE_CONFIG,
    state: {
      user: null,
      token: null,
      carriers: [],
      tickets: [],
      inquiries: [],
      cycles: []
    },

    // 1. AUTHENTICATION & SESSION
    auth: {
      getToken: function() {
        return sessionStorage.getItem('ALMAJDOUB_ADMIN_JWT') || null;
      },
      getUser: function() {
        const u = sessionStorage.getItem('ALMAJDOUB_ADMIN_USER');
        return u ? JSON.parse(u) : null;
      },
      setSession: function(token, user) {
        CockpitController.state.token = token;
        CockpitController.state.user = user;
        sessionStorage.setItem('ALMAJDOUB_ADMIN_JWT', token);
        sessionStorage.setItem('ALMAJDOUB_ADMIN_USER', JSON.stringify(user));
        CockpitController.ui.updateAuthBar();
      },
      clearSession: function() {
        CockpitController.state.token = null;
        CockpitController.state.user = null;
        sessionStorage.removeItem('ALMAJDOUB_ADMIN_JWT');
        sessionStorage.removeItem('ALMAJDOUB_ADMIN_USER');
        CockpitController.ui.updateAuthBar();
      },
      login: async function(email, password) {
        try {
          const res = await fetch(`${SUPABASE_CONFIG.url}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_CONFIG.anonKey,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email.trim(), password: password.trim() })
          });
          if (!res.ok) {
            const err = await res.json();
            return { success: false, error: err.error_description || err.message || 'Login failed' };
          }
          const data = await res.json();
          this.setSession(data.access_token, data.user);
          return { success: true, user: data.user };
        } catch (e) {
          return { success: false, error: e.message };
        }
      },
      promptLogin: async function() {
        const email = prompt('Enter Dispatcher Administrative Email:');
        if (!email || !email.trim()) return;
        const password = prompt('Enter Dispatcher Administrative Password:');
        if (!password || !password.trim()) return;
        const res = await this.login(email.trim(), password.trim());
        if (res.success) {
          alert('Authenticated successfully as ' + (res.user.email || 'Dispatcher'));
          await CockpitController.refreshAll();
        } else {
          alert('Login failed: ' + (res.error || 'Invalid credentials'));
        }
        return res;
      }
    },

    // 2. HTTP HELPERS
    api: {
      getHeaders: function() {
        const headers = {
          'apikey': SUPABASE_CONFIG.anonKey,
          'Content-Type': 'application/json'
        };
        const token = CockpitController.auth.getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
      },
      get: async function(path) {
        const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${path}`, {
          method: 'GET',
          headers: this.getHeaders()
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return await res.json();
      },
      postRpc: async function(fnName, payload = {}) {
        const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/rpc/${fnName}`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`RPC ${fnName} failed: ${await res.text()}`);
        return await res.json();
      },
      patch: async function(path, body) {
        const headers = this.getHeaders();
        headers['Prefer'] = 'return=minimal';
        const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${path}`, {
          method: 'PATCH',
          headers: headers,
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`PATCH ${path} failed: ${await res.text()}`);
        return true;
      },
      post: async function(path, body) {
        const headers = this.getHeaders();
        headers['Prefer'] = 'return=representation';
        const res = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${path}`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(`POST ${path} failed: ${await res.text()}`);
        return await res.json();
      }
    },

    // 3. CARRIERS ROSTER
    roster: {
      fetchAll: async function() {
        try {
          const carriers = await CockpitController.api.get('carriers?select=*&order=created_at.desc');
          CockpitController.state.carriers = carriers;
          this.render();
          this.populateDropdowns(carriers);
          return carriers;
        } catch (e) {
          console.warn('[CockpitRoster] Error fetching carriers:', e);
          return [];
        }
      },
      render: function() {
        const carriers = CockpitController.state.carriers || [];
        const statusFilter = document.getElementById('rosterStatusFilter')?.value || 'ALL';
        const search = (document.getElementById('rosterSearchInput')?.value || '').toLowerCase();

        const filtered = carriers.filter(c => {
          const matchesStatus = (statusFilter === 'ALL') || (c.status === statusFilter);
          const matchesSearch = !search ||
            (c.mc_number && c.mc_number.toLowerCase().includes(search)) ||
            (c.carrier_name && c.carrier_name.toLowerCase().includes(search)) ||
            (c.contact_person && c.contact_person.toLowerCase().includes(search));
          return matchesStatus && matchesSearch;
        });

        // Update KPIs
        const totalEl = document.getElementById('kpi-total-carriers');
        const trialEl = document.getElementById('kpi-trial-carriers');
        const paidEl = document.getElementById('kpi-paid-carriers');
        const suspEl = document.getElementById('kpi-suspended-carriers');

        if (totalEl) totalEl.innerText = carriers.length;
        if (trialEl) trialEl.innerText = carriers.filter(c => c.status === 'ACTIVE_TRIAL').length;
        if (paidEl) paidEl.innerText = carriers.filter(c => c.status === 'PAID_ACTIVE').length;
        if (suspEl) suspEl.innerText = carriers.filter(c => c.status === 'SUSPENDED').length;

        const tbody = document.getElementById('rosterTableBody');
        if (!tbody) return;

        if (filtered.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748B;">No carriers match current filters.</td></tr>`;
          return;
        }

        tbody.innerHTML = filtered.map(c => {
          let badgeColor = '#36B37E';
          let badgeBg = 'rgba(54,179,126,0.15)';
          if (c.status === 'SUSPENDED') {
            badgeColor = '#C0392B';
            badgeBg = 'rgba(192,57,43,0.15)';
          } else if (c.status === 'PENDING_PAYMENT') {
            badgeColor = '#D97706';
            badgeBg = 'rgba(217,119,6,0.15)';
          } else if (c.status === 'PAID_ACTIVE') {
            badgeColor = '#0284C7';
            badgeBg = 'rgba(2,132,199,0.15)';
          }

          const cleanMC = (c.mc_number || '').toUpperCase();
          const cleanPhone = (c.phone || '').replace(/[^0-9+]/g, '');
          const waPhone = cleanPhone.startsWith('+') ? cleanPhone.replace('+', '') : (cleanPhone.length === 10 ? '1' + cleanPhone : cleanPhone);
          const truncatedHash = c.signature_hash ? (c.signature_hash.substring(0, 16) + '…') : 'N/A';

          return `
            <tr style="border-bottom:1px solid #E2E8F0;">
              <td style="padding:10px 12px;">
                <strong style="color:var(--primary); font-size:13px;">${escapeHtml(c.carrier_name || 'Independent Carrier')}</strong>
                <span style="display:block; font-size:11px; color:#64748B;">
                  MC: <a href="https://safer.fmcsa.dot.gov/" target="_blank" style="color:var(--primary); font-weight:bold;">${escapeHtml(cleanMC)}</a>
                  ${c.dot_number ? ` • DOT: ${escapeHtml(c.dot_number)}` : ''}
                </span>
              </td>
              <td style="padding:10px 12px;">
                <span style="font-weight:600; color:#0F172A;">${escapeHtml(c.contact_person || 'Driver')}</span>
                <span style="display:block; font-size:11px; color:#64748B;">${escapeHtml(c.phone || 'N/A')}</span>
              </td>
              <td style="padding:10px 12px; font-size:12px;">
                <b>${escapeHtml((c.equipment || '53_dry_van').replace('_', ' ').toUpperCase())}</b>
                <span style="display:block; font-size:10px; color:#64748B;">${c.truck_count || 1} Power Unit(s)</span>
              </td>
              <td style="padding:10px 12px; font-size:11px;">
                <span style="background:#F1F5F9; padding:2px 6px; border-radius:4px; font-weight:700;">${escapeHtml(c.plan_code || 'TRIAL_14')}</span>
              </td>
              <td style="padding:10px 12px;">
                <span style="display:inline-block; padding:3px 8px; border-radius:12px; font-size:11px; font-weight:800; color:${badgeColor}; background:${badgeBg}; border:1px solid ${badgeColor};">
                  ${escapeHtml(c.status || 'ACTIVE_TRIAL')}
                </span>
                <span style="display:block; font-size:10px; color:#64748B; margin-top:2px;">
                  ${c.free_days_left !== null ? `${c.free_days_left}d free left` : ''}
                </span>
              </td>
              <td style="padding:10px 12px; font-size:11px; font-family:monospace; color:#64748B;" title="${c.signature_hash || ''}">
                ${truncatedHash}
              </td>
              <td style="padding:10px 12px; text-align:right;">
                <div style="display:flex; gap:6px; justify-content:flex-end;">
                  <button class="btn btn-accent" style="padding:3px 7px; font-size:10px;" onclick="CockpitController.roster.promptStatusChange('${c.id}', '${escapeHtml(cleanMC)}', '${escapeHtml(c.status)}')">
                    ⚙️ Status
                  </button>
                  <a href="https://wa.me/${waPhone}" target="_blank" class="btn" style="padding:3px 7px; font-size:10px; background:#25D366; text-decoration:none;" title="WhatsApp Carrier">
                    💬 WA
                  </a>
                  <button class="btn" style="padding:3px 7px; font-size:10px; background:var(--primary);" onclick="CockpitController.roster.refreshCarrier('${c.id}')" title="Refresh Status Machine">
                    🔄
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      },
      promptStatusChange: async function(carrierId, mc, currentStatus) {
        const newStatus = prompt(`Change Status for carrier ${mc}:\n\nAllowed: ACTIVE_TRIAL, PAID_ACTIVE, PENDING_PAYMENT, SUSPENDED\n\nCurrent: ${currentStatus}`);
        if (!newStatus) return;
        const valid = ['ACTIVE_TRIAL', 'PAID_ACTIVE', 'PENDING_PAYMENT', 'SUSPENDED'];
        const target = newStatus.trim().toUpperCase();
        if (!valid.includes(target)) {
          alert('Invalid status. Must be one of: ' + valid.join(', '));
          return;
        }
        const reason = prompt('Reason for override / status change (logged to audit trail):') || 'Manual dispatcher desk adjustment';
        try {
          await CockpitController.api.patch(`carriers?id=eq.${carrierId}`, {
            status_override: target,
            status: target,
            status_override_reason: reason
          });
          alert(`Status for ${mc} updated to ${target}!`);
          await this.fetchAll();
        } catch (e) {
          alert('Error updating status: ' + e.message);
        }
      },
      refreshCarrier: async function(carrierId) {
        try {
          await CockpitController.api.postRpc('refresh_carrier_status', {
            p_carrier_id: carrierId,
            p_source: 'MANUAL',
            p_reason: 'Dispatcher triggered refresh'
          });
          alert('Carrier status recomputed by backoffice machine!');
          await this.fetchAll();
        } catch (e) {
          alert('Error: ' + e.message);
        }
      },
      populateDropdowns: function(carriers) {
        // Driver App load dispatch select
        const selApp = document.getElementById('app-dispatch-mc');
        if (selApp && carriers.length > 0) {
          selApp.innerHTML = carriers.map(c => {
            const cleanMC = (c.mc_number || '').toUpperCase();
            const plan = c.plan_code || 'TRIAL_14';
            return `<option value="${escapeHtml(cleanMC)}" data-carrier-id="${c.id}">${escapeHtml(c.carrier_name || 'Independent Carrier')} (${escapeHtml(cleanMC)}) — ${escapeHtml(c.status)} (${plan})</option>`;
          }).join('');
        }
        // Billing commission entry select
        const selBill = document.getElementById('bill-carrier-select');
        if (selBill && carriers.length > 0) {
          selBill.innerHTML = carriers.map(c => {
            const cleanMC = (c.mc_number || '').toUpperCase();
            return `<option value="${c.id}" data-equipment="${c.equipment || '53_dry_van'}">${c.carrier_name || 'Carrier'} (${escapeHtml(cleanMC)})</option>`;
          }).join('');
        }
      }
    },

    // 4. TICKETS & INQUIRIES QUEUE
    queue: {
      fetchAll: async function() {
        try {
          const [tickets, inquiries] = await Promise.all([
            CockpitController.api.get('tickets?select=*&order=created_at.desc'),
            CockpitController.api.get('inquiries?select=*&order=created_at.desc')
          ]);
          CockpitController.state.tickets = tickets;
          CockpitController.state.inquiries = inquiries;
          this.render();
          return { tickets, inquiries };
        } catch (e) {
          console.warn('[CockpitQueue] Error fetching queue:', e);
          return { tickets: [], inquiries: [] };
        }
      },
      render: function() {
        const tickets = CockpitController.state.tickets || [];
        const inquiries = CockpitController.state.inquiries || [];

        // Tickets render
        const tBody = document.getElementById('ticketsTableBody');
        if (tBody) {
          if (tickets.length === 0) {
            tBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px; color:#64748B;">No tickets in queue.</td></tr>`;
          } else {
            tBody.innerHTML = tickets.map(t => `
              <tr style="border-bottom:1px solid #E2E8F0;">
                <td style="padding:8px 10px; font-weight:800; color:var(--primary); font-family:monospace;">${escapeHtml(t.ticket_number || 'TK-PENDING')}</td>
                <td style="padding:8px 10px;">
                  <b>${escapeHtml(t.carrier_name || 'Independent Carrier')}</b>
                  <span style="display:block; font-size:10px; color:#64748B;">MC: ${escapeHtml(t.mc_number || 'N/A')}</span>
                </td>
                <td style="padding:8px 10px; font-size:12px;">${escapeHtml(t.phone || 'N/A')}</td>
                <td style="padding:8px 10px;">
                  <span class="badge ${t.priority_level === 'HIGH' ? 'badge-danger' : 'badge-warning'}">${escapeHtml(t.priority_level || 'STANDARD')}</span>
                </td>
                <td style="padding:8px 10px;">
                  <span style="font-weight:700; font-size:11px;">${escapeHtml(t.status || 'ISSUED')}</span>
                </td>
                <td style="padding:8px 10px; text-align:right;">
                  <button class="btn" style="padding:2px 6px; font-size:10px;" onclick="CockpitController.queue.updateTicketStatus('${t.id}')">Update</button>
                </td>
              </tr>
            `).join('');
          }
        }

        // Inquiries render
        const iBody = document.getElementById('inquiriesTableBody');
        if (iBody) {
          if (inquiries.length === 0) {
            iBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px; color:#64748B;">No inbound leads.</td></tr>`;
          } else {
            iBody.innerHTML = inquiries.map(inq => `
              <tr style="border-bottom:1px solid #E2E8F0;">
                <td style="padding:8px 10px;"><b>${escapeHtml(inq.name || 'Lead')}</b><span style="display:block; font-size:10px; color:#64748B;">${escapeHtml(inq.company_name || '')}</span></td>
                <td style="padding:8px 10px; font-size:12px;">${escapeHtml(inq.phone || 'N/A')}</td>
                <td style="padding:8px 10px; font-size:11px;">${escapeHtml(inq.mc_number || 'Pending')}</td>
                <td style="padding:8px 10px; font-size:11px;">${escapeHtml((inq.equipment_type || '53_dry_van').replace('_', ' '))} (${inq.truck_count || 1} truck)</td>
                <td style="padding:8px 10px; font-size:11px;"><span class="badge badge-success">${escapeHtml(inq.status || 'NEW_LEAD')}</span></td>
                <td style="padding:8px 10px; font-size:10px; color:#64748B;">${escapeHtml(inq.source || 'Website')}</td>
              </tr>
            `).join('');
          }
        }
      },
      updateTicketStatus: async function(ticketId) {
        const next = prompt('Enter new ticket status (ISSUED, IN_REVIEW, RESOLVED, CLOSED):');
        if (!next) return;
        try {
          await CockpitController.api.patch(`tickets?id=eq.${ticketId}`, { status: next.trim().toUpperCase() });
          alert('Ticket status updated!');
          await this.fetchAll();
        } catch (e) {
          alert('Error: ' + e.message);
        }
      }
    },

    // 5. FRIDAY BILLING & PAYMENT RECONCILIATION ENGINE (Protocol D-31 & Phase 4)
    billing: {
      state: {
        filterStatus: 'ALL',
        activeTab: 'all'
      },
      fetchAll: async function() {
        try {
          const [cycles, imports, rows] = await Promise.all([
            CockpitController.api.get('billing_cycles?select=*,carriers(carrier_name,mc_number)&order=created_at.desc'),
            CockpitController.api.get('payment_imports?select=*&order=created_at.desc&limit=15'),
            CockpitController.api.get('payment_import_rows?select=*,carriers(carrier_name,mc_number)&order=created_at.desc&limit=50')
          ]);
          CockpitController.state.cycles = cycles || [];
          CockpitController.state.imports = imports || [];
          CockpitController.state.importRows = rows || [];
          this.render();
          return { cycles, imports, rows };
        } catch (e) {
          console.warn('[CockpitBilling] Error fetching billing & payment data:', e);
          return { cycles: [], imports: [], rows: [] };
        }
      },
      render: function() {
        const cycles = CockpitController.state.cycles || [];
        const imports = CockpitController.state.imports || [];
        const rows = CockpitController.state.importRows || [];
        const carriers = CockpitController.state.carriers || [];

        // 1. Update Financial KPI Summary Strip
        const totalInvoiced = cycles.reduce((acc, c) => acc + (parseFloat(c.total_due) || 0), 0);
        const totalCollected = cycles.reduce((acc, c) => acc + (parseFloat(c.amount_paid) || 0), 0);
        const balanceDue = cycles.reduce((acc, c) => acc + (parseFloat(c.balance_due) || 0), 0);
        const unsettledCount = cycles.filter(c => c.status !== 'PAID').length;

        const kpiInv = document.getElementById('kpi-total-invoiced');
        const kpiCol = document.getElementById('kpi-total-collected');
        const kpiBal = document.getElementById('kpi-balance-due');
        const kpiUns = document.getElementById('kpi-unsettled-count');

        if (kpiInv) kpiInv.innerText = '$' + totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (kpiCol) kpiCol.innerText = '$' + totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (kpiBal) kpiBal.innerText = '$' + balanceDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (kpiUns) kpiUns.innerText = unsettledCount;

        // 2. Render Invoices Table
        const tbodyCycles = document.getElementById('billingCyclesTableBody');
        if (tbodyCycles) {
          if (cycles.length === 0) {
            tbodyCycles.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:15px; color:#64748B;">No billing records found. Run Friday Billing to generate.</td></tr>`;
          } else {
            tbodyCycles.innerHTML = cycles.map(c => {
              const carrierName = (c.carriers && c.carriers.carrier_name) || 'Carrier';
              const mc = (c.carriers && c.carriers.mc_number) || '';
              return `
                <tr style="border-bottom:1px solid #E2E8F0;">
                  <td style="padding:8px 10px; font-weight:bold; font-family:monospace; color:var(--primary);">${escapeHtml(c.invoice_number || 'INV-PENDING')}</td>
                  <td style="padding:8px 10px; font-size:11px;">
                    <b>${escapeHtml(carrierName)}</b>
                    <span style="display:block; font-size:10px; color:#64748B;">MC: ${escapeHtml(mc || 'N/A')}</span>
                  </td>
                  <td style="padding:8px 10px; font-size:11px;">${escapeHtml(c.period_start || '')} ➔ ${escapeHtml(c.period_end || '')}</td>
                  <td style="padding:8px 10px; font-size:12px; font-weight:bold;">$${parseFloat(c.total_due || 0).toFixed(2)}</td>
                  <td style="padding:8px 10px; font-size:12px; font-weight:bold; color:${parseFloat(c.balance_due || 0) > 0 ? 'var(--danger)' : 'var(--accent)'};">
                    $${parseFloat(c.balance_due || 0).toFixed(2)}
                  </td>
                  <td style="padding:8px 10px;"><span class="badge ${c.status === 'PAID' ? 'badge-success' : 'badge-warning'}">${escapeHtml(c.status)}</span></td>
                  <td style="padding:8px 10px; font-size:11px; color:#64748B;">Due: ${escapeHtml(c.due_date || 'Monday 08:00 AM')}</td>
                </tr>
              `;
            }).join('');
          }
        }

        // 3. Render Imports History Table
        const tbodyImports = document.getElementById('paymentImportsTableBody');
        if (tbodyImports) {
          if (imports.length === 0) {
            tbodyImports.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:15px; color:#64748B;">No statement imports recorded yet.</td></tr>`;
          } else {
            tbodyImports.innerHTML = imports.map(imp => {
              const createdDate = imp.created_at ? new Date(imp.created_at).toLocaleDateString() : 'N/A';
              const statusBadge = imp.status === 'IMPORTED' ? 'badge-success' : 'badge-warning';
              return `
                <tr style="border-bottom:1px solid #E2E8F0;">
                  <td style="padding:6px 8px; font-size:11px;">${createdDate}</td>
                  <td style="padding:6px 8px; font-size:11px; font-weight:700;">${escapeHtml(imp.provider)}</td>
                  <td style="padding:6px 8px; font-size:11px; font-family:monospace; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(imp.file_name)}">${escapeHtml(imp.file_name)}</td>
                  <td style="padding:6px 8px; font-size:11px; text-align:center;">${imp.row_count || 0}</td>
                  <td style="padding:6px 8px; font-size:11px; text-align:center; color:var(--accent); font-weight:bold;">${imp.matched_count || 0}</td>
                  <td style="padding:6px 8px;"><span class="badge ${statusBadge}">${escapeHtml(imp.status)}</span></td>
                </tr>
              `;
            }).join('');
          }
        }

        // 4. Render Staged Transaction Rows with Dispatcher Resolution
        const tbodyRows = document.getElementById('paymentRowsTableBody');
        if (tbodyRows) {
          const filter = this.state.filterStatus;
          const filteredRows = rows.filter(r => {
            if (filter === 'ALL') return true;
            if (filter === 'MATCHED') return r.match_status === 'MATCHED';
            if (filter === 'UNMATCHED') return r.match_status === 'UNMATCHED';
            if (filter === 'REJECTED') return r.match_status === 'REJECTED' || r.match_status === 'DUPLICATE';
            return true;
          });

          if (filteredRows.length === 0) {
            tbodyRows.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748B;">No transaction rows match filter (${filter}).</td></tr>`;
          } else {
            tbodyRows.innerHTML = filteredRows.map(r => {
              let badgeClass = 'badge-warning';
              if (r.match_status === 'MATCHED') badgeClass = 'badge-success';
              else if (r.match_status === 'REJECTED' || r.match_status === 'DUPLICATE') badgeClass = 'badge-danger';

              const carrierMatched = (r.carriers && r.carriers.carrier_name) ? `${r.carriers.carrier_name} (${r.carriers.mc_number})` : '';

              // Manual match dropdown for UNMATCHED or REJECTED rows
              let actionHtml = '';
              if (r.match_status !== 'MATCHED') {
                actionHtml = `
                  <div style="display:flex; gap:4px; align-items:center; justify-content:flex-end;">
                    <select id="match-carrier-select-${r.id}" style="font-size:10px; padding:3px; max-width:130px; border:1px solid #CBD5E1; border-radius:4px;">
                      <option value="">-- Match Carrier --</option>
                      ${carriers.map(c => `<option value="${c.id}">${c.carrier_name || 'Carrier'} (${c.mc_number})</option>`).join('')}
                    </select>
                    <button class="btn btn-accent" style="padding:2px 7px; font-size:10px; font-weight:800;" onclick="CockpitController.billing.manualMatch('${r.id}')">Match</button>
                  </div>
                `;
              } else {
                actionHtml = `<span style="font-size:10px; color:var(--accent); font-weight:700;">✓ Matched to ${carrierMatched || 'Carrier'}</span>`;
              }

              return `
                <tr style="border-bottom:1px solid #E2E8F0;">
                  <td style="padding:8px 10px; font-family:monospace; font-size:11px; font-weight:bold;">${r.external_id || 'N/A'}</td>
                  <td style="padding:8px 10px; font-size:11px; font-weight:700;">${r.provider}</td>
                  <td style="padding:8px 10px; font-size:11px;">
                    <b>${r.payer_name || 'N/A'}</b>
                    <span style="display:block; font-size:10px; color:#64748B;">${r.payer_email || ''}</span>
                  </td>
                  <td style="padding:8px 10px; font-size:11px; font-family:monospace; color:var(--primary);">${r.reference || 'N/A'}</td>
                  <td style="padding:8px 10px; font-size:12px; font-weight:bold;">$${parseFloat(r.amount || 0).toFixed(2)}</td>
                  <td style="padding:8px 10px;">
                    <span class="badge ${badgeClass}">${r.match_status}</span>
                    ${r.match_reason ? `<span style="display:block; font-size:9px; color:#64748B; margin-top:2px;">${r.match_reason}</span>` : ''}
                  </td>
                  <td style="padding:8px 10px; text-align:right;">${actionHtml}</td>
                </tr>
              `;
            }).join('');
          }
        }
      },
      filterRows: function(status) {
        this.state.filterStatus = status;
        this.render();
      },
      runFridayBilling: async function() {
        if (!confirm('Run Friday Weekly Billing Protocol (D-31)?\n\nThis will compute linehaul commissions and generate invoices for active carriers.')) return;
        try {
          const res = await CockpitController.api.postRpc('generate_weekly_billing', {});
          alert(`Weekly Billing Run Completed successfully!\n\nCycles Processed: ${Array.isArray(res) ? res.length : 'OK'}`);
          await CockpitController.refreshAll();
        } catch (e) {
          alert('Billing execution error: ' + e.message);
        }
      },
      runMondayCutoff: async function() {
        if (!confirm('Enforce Monday Cutoff Protocol (D-31)?\n\nThis will mark overdue billing cycles and automatically transition non-compliant carriers to SUSPENDED.')) return;
        try {
          const res = await CockpitController.api.postRpc('enforce_monday_cutoff', {});
          alert(`Monday Cutoff Enforced!\n\nOverdue Cycles Flagged: ${res.overdue_cycles_flagged || 0}\nCarriers Suspended: ${res.carriers_suspended || 0}`);
          await CockpitController.refreshAll();
        } catch (e) {
          alert('Monday cutoff error: ' + e.message);
        }
      },
      recordManualCommission: async function() {
        const sel = document.getElementById('bill-carrier-select');
        const carrierId = sel ? sel.value : null;
        if (!carrierId) {
          alert('Please select a carrier');
          return;
        }
        const gross = parseFloat(document.getElementById('bill-gross-amount')?.value || '0');
        if (gross <= 0) {
          alert('Please enter a valid linehaul gross amount');
          return;
        }
        const equip = document.getElementById('bill-equipment')?.value || '53_dry_van';

        try {
          const dummyLoadId = '00000000-0000-0000-0000-000000000000';
          await CockpitController.api.postRpc('record_commission', {
            p_carrier_id: carrierId,
            p_load_id: dummyLoadId,
            p_gross_linehaul: gross,
            p_equipment: equip
          });
          alert(`Commission recorded on $${gross} gross linehaul!`);
          await this.fetchAll();
        } catch (e) {
          alert('Error: ' + e.message);
        }
      },
      // CSV Parsing Engine
      parseCSV: function(text) {
        if (!text || !text.trim()) return [];
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) return [];

        function splitLine(line) {
          const cells = [];
          let cur = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
              } else {
                inQuotes = !inQuotes;
              }
            } else if (char === ',' && !inQuotes) {
              cells.push(cur.trim());
              cur = '';
            } else {
              cur += char;
            }
          }
          cells.push(cur.trim());
          return cells;
        }

        const rawHeaders = splitLine(lines[0]);
        const headers = rawHeaders.map(h => h.replace(/^["']|["']$/g, '').trim());

        const result = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const values = splitLine(line);
          const row = {};
          headers.forEach((h, idx) => {
            let val = values[idx] || '';
            val = val.replace(/^["']|["']$/g, '').trim();
            row[h] = val;
          });
          result.push(row);
        }
        return result;
      },
      parseFastSpringCSV: function(text) {
        const rows = this.parseCSV(text);
        if (!rows || rows.length === 0) return [];
        return rows.map(r => {
          const ext = r['Order ID'] || r['OrderID'] || r['Transaction ID'] || r['id'] || r['external_id'] || '';
          const ref = r['Reference'] || r['Order Reference'] || r['Product Name'] || r['Notes'] || r['reference'] || '';
          const amountStr = r['Total'] || r['Total USD'] || r['Amount'] || r['amount'] || '0';
          const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0;
          const email = r['Customer Email'] || r['Email'] || r['payer_email'] || '';
          const fname = r['Customer First Name'] || '';
          const lname = r['Customer Last Name'] || '';
          const name = (fname || lname) ? `${fname} ${lname}`.trim() : (r['Customer Name'] || r['payer_name'] || '');
          const date = r['Date'] || r['Completed Date'] || r['paid_at'] || new Date().toISOString();
          const subId = r['Subscription ID'] || r['subscription_id'] || '';

          return {
            external_id: ext,
            amount: amount.toFixed(2),
            currency: 'USD',
            payer_name: name,
            payer_email: email,
            reference: ref,
            subscription_id: subId,
            paid_at: date
          };
        }).filter(item => item.external_id || parseFloat(item.amount) > 0);
      },
      parsePayoneerCSV: function(text) {
        const rows = this.parseCSV(text);
        if (!rows || rows.length === 0) return [];
        return rows.map(r => {
          const ext = r['Transaction ID'] || r['TransactionID'] || r['external_id'] || '';
          const ref = r['Description'] || r['Reference'] || r['reference'] || '';
          const amountStr = r['Amount'] || r['amount'] || '0';
          const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0;
          const currency = (r['Currency'] || 'USD').toUpperCase();
          const name = r['Sender Name'] || r['Payer'] || r['payer_name'] || '';
          const email = r['Payer Email'] || r['Email'] || r['payer_email'] || '';
          const date = r['Date'] || r['Transaction Date'] || r['paid_at'] || new Date().toISOString();

          return {
            external_id: ext,
            amount: amount.toFixed(2),
            currency: currency,
            payer_name: name,
            payer_email: email,
            reference: ref,
            paid_at: date
          };
        }).filter(item => item.external_id || parseFloat(item.amount) > 0);
      },
      computeSha256: async function(text) {
        const enc = new TextEncoder();
        const data = enc.encode(text);
        const hashBuf = await crypto.subtle.digest('SHA-256', data);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return 'sha256-' + hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
      },
      handleFileUpload: function(event) {
        const file = event.target.files[0];
        if (!file) return;
        const filenameInput = document.getElementById('reconcile-filename');
        if (filenameInput) filenameInput.value = file.name;

        const reader = new FileReader();
        reader.onload = function(e) {
          const text = e.target.result;
          const textEl = document.getElementById('reconcile-csv-text');
          if (textEl) textEl.value = text;
        };
        reader.readAsText(file);
      },
      stageStatement: async function() {
        const provider = document.getElementById('reconcile-provider')?.value || 'FASTSPRING';
        const fileName = (document.getElementById('reconcile-filename')?.value || 'statement.csv').trim();
        const csvText = (document.getElementById('reconcile-csv-text')?.value || '').trim();

        if (!csvText) {
          alert('Please upload a CSV file or paste statement text.');
          return;
        }

        const rows = provider === 'FASTSPRING' ? this.parseFastSpringCSV(csvText) : this.parsePayoneerCSV(csvText);
        if (rows.length === 0) {
          alert('Could not parse any valid transaction rows from the CSV text.');
          return;
        }

        try {
          const fileHash = await this.computeSha256(csvText + '-' + Date.now());
          const importId = await CockpitController.api.postRpc('stage_payment_import', {
            p_provider: provider,
            p_file_name: fileName,
            p_file_hash: fileHash,
            p_rows: rows
          });

          alert(`Payment Statement Staged & Reconciled Successfully!\n\nImport ID: ${importId}\nRows Processed: ${rows.length}`);
          await CockpitController.refreshAll();
        } catch (e) {
          alert('Statement staging error: ' + e.message);
        }
      },
      manualMatch: async function(rowId) {
        const sel = document.getElementById(`match-carrier-select-${rowId}`);
        const carrierId = sel ? sel.value : null;
        if (!carrierId) {
          alert('Please select a carrier to match with this transaction.');
          return;
        }

        try {
          await CockpitController.api.postRpc('manually_match_payment_row', {
            p_row_id: rowId,
            p_carrier_id: carrierId
          });
          alert('Transaction manually matched and carrier account updated!');
          await CockpitController.refreshAll();
        } catch (e) {
          alert('Manual match error: ' + e.message);
        }
      },
      loadSampleFastSpring: function() {
        const sampleCarrier = (CockpitController.state.carriers && CockpitController.state.carriers[0]) || { mc_number: 'MCTESTPHASE1', email: 'test@carrier.com' };
        const mc = sampleCarrier.mc_number || 'MCTESTPHASE1';
        const ts = Date.now().toString().slice(-4);
        const sample = `Order ID,Reference,Date,Total,Currency,Customer Email,Customer First Name,Customer Last Name,Subscription ID
FS-ORD-REC-${ts},${mc},${new Date().toISOString().split('T')[0]},245.00,USD,billing@fastspringcarrier.com,John,Carrier,sub_fs_${ts}`;
        const textEl = document.getElementById('reconcile-csv-text');
        const fnEl = document.getElementById('reconcile-filename');
        const provEl = document.getElementById('reconcile-provider');
        if (textEl) textEl.value = sample;
        if (fnEl) fnEl.value = `fastspring_payout_${ts}.csv`;
        if (provEl) provEl.value = 'FASTSPRING';
      },
      loadSamplePayoneer: function() {
        const sampleCarrier = (CockpitController.state.carriers && CockpitController.state.carriers[1]) || { mc_number: 'MC999001' };
        const mc = sampleCarrier.mc_number || 'MC999001';
        const ts = Date.now().toString().slice(-4);
        const sample = `Transaction ID,Date,Description,Amount,Currency,Status,Sender Name,Payer Email
PAY-TXN-${ts},${new Date().toISOString().split('T')[0]},Payment for ${mc},245.00,USD,COMPLETED,Alpha Express,finance@alphaexpress.com`;
        const textEl = document.getElementById('reconcile-csv-text');
        const fnEl = document.getElementById('reconcile-filename');
        const provEl = document.getElementById('reconcile-provider');
        if (textEl) textEl.value = sample;
        if (fnEl) fnEl.value = `payoneer_statement_${ts}.csv`;
        if (provEl) provEl.value = 'PAYONEER';
      }
    },

    // 6. LIVE LOAD DISPATCH BRIDGE
    dispatch: {
      broadcastLoad: async function(loadData) {
        // 1. Save locally to AlmajdoubDB
        if (window.AlmajdoubDB && typeof window.AlmajdoubDB.saveLoad === 'function') {
          window.AlmajdoubDB.saveLoad(loadData);
        }

        // 2. Save into live Supabase loads and load_approvals
        try {
          const selApp = document.getElementById('app-dispatch-mc');
          const opt = selApp ? selApp.selectedOptions[0] : null;
          const carrierId = opt ? opt.getAttribute('data-carrier-id') : null;

          if (carrierId) {
            const dbLoad = {
              load_number: loadData.id,
              carrier_id: carrierId,
              broker_name: loadData.broker || 'Brokerage',
              origin_city: loadData.origin.split(',')[0].trim(),
              origin_state: loadData.origin.split(',')[1]?.trim() || 'TX',
              destination_city: loadData.destination.split(',')[0].trim(),
              destination_state: loadData.destination.split(',')[1]?.trim() || 'OH',
              pickup_date: new Date().toISOString().split('T')[0],
              delivery_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
              equipment_type: '53_dry_van',
              loaded_miles: loadData.loadedMiles,
              deadhead_miles: loadData.deadheadMiles,
              rate_gross: loadData.grossRate,
              rate_per_mile: loadData.rpm,
              status: 'PENDING_APPROVAL',
              notes: `Broadcast to driver app portal: ${loadData.detentionClause}`
            };

            const insertedLoad = await CockpitController.api.post('loads', dbLoad);
            if (insertedLoad && insertedLoad[0]) {
              await CockpitController.api.post('load_approvals', {
                load_id: insertedLoad[0].id,
                carrier_id: carrierId,
                approval_status: 'PENDING',
                channel: 'PORTAL',
                carrier_feedback: 'Awaiting driver approval on mobile app'
              });
              console.log('[CockpitDispatch] Load and approval created in Supabase cloud:', insertedLoad[0].id);
            }
          }
        } catch (e) {
          console.warn('[CockpitDispatch] Cloud broadcast fallback (local saved):', e);
        }
      }
    },

    // 7. UI CONTROLS & INIT
    ui: {
      updateAuthBar: function() {
        const bar = document.getElementById('cockpitAuthBar');
        const user = CockpitController.auth.getUser();
        if (!bar) return;

        if (user) {
          bar.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:12px; flex-wrap:wrap;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#36B37E; box-shadow:0 0 8px #36B37E;"></span>
                <span style="font-weight:800; color:#A3E6CD;">LIVE CLOUD CONNECTED:</span>
                <span style="color:#FFF;">Ahmed Al-Majdoub (OWNER)</span>
                <span style="font-size:11px; color:#76D2E0; background:rgba(118,210,224,0.15); padding:2px 8px; border-radius:12px;">Authenticated Dispatch Desk</span>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-accent" style="padding:4px 10px; font-size:11px;" onclick="CockpitController.refreshAll()">🔄 Refresh All Data</button>
                <button class="btn" style="padding:4px 10px; font-size:11px; background:#C0392B;" onclick="CockpitController.auth.clearSession()">🚪 Disconnect</button>
              </div>
            </div>
          `;
          bar.style.background = '#0B2432';
          bar.style.borderBottom = '2px solid #36B37E';
        } else {
          bar.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:12px; flex-wrap:wrap;">
              <div>
                <span style="color:#F5B94C; font-weight:800;">🔒 DESK DISCONNECTED:</span>
                <span> Connect to Supabase Cloud to view real carrier accounts and execute Friday billing.</span>
              </div>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-accent" style="padding:5px 12px; font-size:11px;" onclick="CockpitController.auth.promptLogin()">🔐 Sign In to Live Desk</button>
              </div>
            </div>
          `;
          bar.style.background = '#0F243A';
          bar.style.borderBottom = '2px solid #F5B94C';
        }
      }
    },

    refreshAll: async function() {
      await Promise.all([
        this.roster.fetchAll(),
        this.queue.fetchAll(),
        this.billing.fetchAll()
      ]);
    },

    init: async function() {
      const token = this.auth.getToken();
      if (!token) {
        this.ui.updateAuthBar();
        return;
      } else {
        this.state.token = token;
        this.state.user = this.auth.getUser();
        this.ui.updateAuthBar();
      }
      await this.refreshAll();
    }
  };

  window.CockpitController = CockpitController;
})(window);

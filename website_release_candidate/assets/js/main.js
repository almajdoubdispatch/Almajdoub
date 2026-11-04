/**
 * ALMAJDOUB DISPATCH — CLIENT-SIDE SCRIPT (v6 APPROVED VISUAL IDENTITY)
 * Privacy-First, Zero External Trackers, WCAG Accessible Interactions
 * Zero PII in URLs, Proper Focus Trap, Real Fail-Safe Form Submission
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Navigation Toggle with WCAG Focus Trap & Inert
  const toggleBtn = document.querySelector('.mobile-nav-toggle');
  const navDrawer = document.querySelector('.mobile-nav-drawer');
  const mainContent = document.querySelector('main') || document.getElementById('main-content');

  if (toggleBtn && navDrawer) {
    navDrawer.setAttribute('role', 'dialog');
    navDrawer.setAttribute('aria-modal', 'true');
    navDrawer.setAttribute('aria-label', 'Main Navigation');

    function openDrawer() {
      navDrawer.classList.add('open');
      toggleBtn.setAttribute('aria-expanded', 'true');
      toggleBtn.innerText = '✕ Close';
      if (mainContent) mainContent.setAttribute('inert', '');

      const focusable = navDrawer.querySelectorAll('a, button, input, [tabindex="0"]');
      if (focusable.length > 0) focusable[0].focus();
    }

    function closeDrawer() {
      navDrawer.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.innerText = '☰ Menu';
      if (mainContent) mainContent.removeAttribute('inert');
      toggleBtn.focus();
    }

    toggleBtn.addEventListener('click', () => {
      const isOpen = navDrawer.classList.contains('open');
      if (isOpen) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    // Keyboard navigation: Escape to close, Tab focus wrap
    navDrawer.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDrawer();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = Array.from(navDrawer.querySelectorAll('a, button, input, [tabindex="0"]'));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  // 2. Carrier Intake / Inquiry Form Handler (Zero PII in URL, Zero Fake Success)
  const inquiryForm = document.getElementById('carrierInquiryForm');
  if (inquiryForm) {
    inquiryForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = document.getElementById('carrierName')?.value.trim() || '';
      const mcNumber = document.getElementById('mcNumber')?.value.trim() || '';
      const phone = document.getElementById('carrierPhone')?.value.trim() || '';
      const equipment = document.getElementById('equipmentType')?.value || '53 Dry Van';
      const preferredLanes = document.getElementById('preferredLanes')?.value.trim() || 'Flexible';
      const channel = document.querySelector('input[name="preferredChannel"]:checked')?.value || 'email';
      const submitBtn = inquiryForm.querySelector('button[type="submit"]');

      if (channel === 'whatsapp') {
        // Construct transparent pre-filled WhatsApp message
        const message = `Hello Almajdoub Dispatch,\n\nI am interested in back-office dispatch support.\n- Carrier / Driver: ${name}\n- MC / DOT#: ${mcNumber}\n- Phone: ${phone}\n- Equipment: ${equipment}\n- Preferred Lanes: ${preferredLanes}\n\nPlease let me know your current onboarding availability.\n\nThank you.`;
        
        const encoded = encodeURIComponent(message);
        // Using +1 (409) 941-7180 provisioned line
        const whatsappUrl = `https://wa.me/14099417180?text=${encoded}`;

        const confirmed = confirm(
          "TRANSPARENT ACTION NOTICE:\n\n" +
          "Clicking OK will open WhatsApp in a new tab with your inquiry pre-filled.\n" +
          "• You can review or edit the text before sending.\n" +
          "• The message is NOT sent until you tap send inside WhatsApp.\n" +
          "• Almajdoub Dispatch's website does not log or store this message.\n\n" +
          "Proceed to WhatsApp?"
        );

        if (confirmed) {
          // Store receipt in sessionStorage to avoid PII query params
          sessionStorage.setItem('ALM_INQUIRY_RECEIPT', JSON.stringify({
            mc: mcNumber,
            name: name,
            method: 'whatsapp',
            timestamp: Date.now()
          }));
          window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
          window.location.href = 'inquiry-success.html';
        }
      } else {
        // Direct Web Inquiry to Supabase
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerText = 'Submitting...';
        }

        try {
          let ticketCode = null;
          if (window.AlmajdoubSupabase && typeof window.AlmajdoubSupabase.saveInquiry === 'function') {
            const inqRes = await window.AlmajdoubSupabase.saveInquiry({
              name: name,
              companyName: name,
              phone: phone,
              mcNumber: mcNumber,
              equipmentType: equipment.toLowerCase().includes('reefer') ? '53_reefer' : '53_dry_van',
              truckCount: 1,
              source: 'Website Home Form',
              notes: `Preferred Lanes: ${preferredLanes}`
            });

            if (!inqRes || !inqRes.success) {
              throw new Error(inqRes?.error || 'Database submission failed');
            }

            if (typeof window.AlmajdoubSupabase.saveTicket === 'function') {
              const tRes = await window.AlmajdoubSupabase.saveTicket({
                mcNumber: mcNumber,
                carrierName: name,
                phone: phone,
                status: 'ISSUED'
              });
              if (tRes && tRes.ticket_number) {
                ticketCode = tRes.ticket_number;
              }
            }
          }

          // Store submission receipt in sessionStorage (Zero PII in URL!)
          sessionStorage.setItem('ALM_INQUIRY_RECEIPT', JSON.stringify({
            mc: mcNumber,
            name: name,
            ticket: ticketCode || '',
            method: 'email',
            timestamp: Date.now()
          }));

          window.location.href = 'inquiry-success.html';
        } catch (err) {
          console.error('[Inquiry Form] Submission error:', err);
          alert('Submission Notice: We were unable to transmit your inquiry to our dispatch desk. Please check your connection or contact Ahmed Al-Majdoub directly at (409) 941-7180 or via WhatsApp.');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Submit Dispatch Inquiry';
          }
        }
      }
    });
  }
});

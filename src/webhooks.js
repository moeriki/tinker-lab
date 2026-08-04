// Outbound only. The container holds no Home Assistant credentials -- MM wires the far end to
// automations, and MM-HANDOFF.md carries the instructions.
//
// Webhooks re-fire on every scan of /q/:slug, deliberately: a treasure hunt step is supposed to
// take several tries to interpret, and re-triggering means walking back to the code.
// See docs/adr/0003-qr-entry-mutates-on-get.md.

import { WEBHOOK_BASE_URL } from './config.js';

export function fireWebhook(name, payload = {}) {
  if (!name) return;

  if (!WEBHOOK_BASE_URL) {
    console.log(`webhook (not configured, skipped) → ${name}`, payload);
    return;
  }

  const url = `${WEBHOOK_BASE_URL.replace(/\/$/, '')}/${name}`;

  // Fire and forget: the guest is mid-redirect and must not wait on Home Assistant.
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  })
    .then((response) => {
      if (!response.ok) console.warn(`webhook ${name} → ${response.status}`);
    })
    .catch((error) => console.warn(`webhook ${name} failed: ${error.message}`));
}

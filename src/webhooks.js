// Outbound only. The container holds no Home Assistant credentials -- MM wires the far end to
// automations, and MM-HANDOFF.md carries the instructions.
//
// One URL, one automation, many effects: the hunt step's logical name travels in the payload as
// `node`, and MM branches on it. The webhook id never enters this repository, which is public.
// See docs/adr/0007-one-home-assistant-webhook.md.
//
// Webhooks re-fire on every scan of /q/:slug, deliberately: a treasure hunt step is supposed to
// take several tries to interpret, and re-triggering means walking back to the code.
// See docs/adr/0003-qr-entry-mutates-on-get.md.

import { HA_WEBHOOK_URL } from './config.js';

export function fireWebhook(node, payload = {}) {
  if (!node) return;

  if (!HA_WEBHOOK_URL) {
    console.log(`webhook (HA_WEBHOOK_URL unset, skipped) → ${node}`, payload);
    return;
  }

  // Fire and forget: the guest is mid-redirect and must not wait on Home Assistant. Nothing here
  // is awaited and nothing here can throw into the request.
  //
  // Home Assistant answers 200 to an unknown id, a disabled automation and a local_only
  // rejection alike, so a 200 proves nothing and there is nothing useful to retry. Failures are
  // logged for the host, never surfaced to the guest.
  fetch(HA_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, node, event: 'scan' }),
    signal: AbortSignal.timeout(2000),
  })
    .then((response) => {
      if (!response.ok) console.warn(`webhook ${node} → ${response.status}`);
    })
    .catch((error) => console.warn(`webhook ${node} failed: ${error.message}`));
}

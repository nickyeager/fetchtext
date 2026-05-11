/**
 * Webhook Subscriptions Service
 *
 * Client for managing outbound webhook subscriptions that receive document events.
 */

import { DOCUMENT_PROCESSOR_URL } from "@/lib/api-config";
import { supabase } from "@/lib/supabase";

export interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  events: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  last_status_code: number | null;
  consecutive_failures: number;
  disabled_at: string | null;
  disabled_reason: string | null;
  created_at: string;
}

export interface CreateWebhookPayload {
  name: string;
  url: string;
  secret?: string;
  events: string[];
}

export interface UpdateWebhookPayload {
  name?: string;
  url?: string;
  secret?: string;
  events?: string[];
  is_active?: boolean;
}

export interface WebhookTestResult {
  success: boolean;
  status_code?: number;
  error?: string;
}

const BASE = DOCUMENT_PROCESSOR_URL || "http://localhost:8090";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
}

export const webhookService = {
  async listEventTypes(): Promise<string[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/api/webhooks/events`, { headers });
    if (!res.ok) throw new Error(`Failed to list event types: ${res.status}`);
    return res.json();
  },

  async listSubscriptions(orgId: string): Promise<WebhookSubscription[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${BASE}/api/webhooks?organization_id=${orgId}`,
      { headers }
    );
    if (!res.ok) throw new Error(`Failed to list webhooks: ${res.status}`);
    return res.json();
  },

  async createSubscription(
    orgId: string,
    payload: CreateWebhookPayload
  ): Promise<WebhookSubscription> {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${BASE}/api/webhooks?organization_id=${orgId}`,
      { method: "POST", headers, body: JSON.stringify(payload) }
    );
    if (!res.ok) throw new Error(`Failed to create webhook: ${res.status}`);
    return res.json();
  },

  async updateSubscription(
    id: string,
    payload: UpdateWebhookPayload
  ): Promise<WebhookSubscription> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/api/webhooks/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Failed to update webhook: ${res.status}`);
    return res.json();
  },

  async deleteSubscription(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/api/webhooks/${id}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) throw new Error(`Failed to delete webhook: ${res.status}`);
  },

  async testSubscription(id: string): Promise<WebhookTestResult> {
    const headers = await getAuthHeaders();
    const res = await fetch(`${BASE}/api/webhooks/${id}/test`, {
      method: "POST",
      headers,
    });
    if (!res.ok) throw new Error(`Failed to test webhook: ${res.status}`);
    return res.json();
  },
};

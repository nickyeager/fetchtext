import { createFileRoute } from "@tanstack/react-router";
import WebhooksSettings from "@/features/settings/webhooks";

export const Route = createFileRoute("/_authenticated/settings/webhooks")({
  component: WebhooksSettings,
});

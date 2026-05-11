import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash2,
  TestTube,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useOrganization } from "@/context/organization-context";
import {
  webhookService,
  type WebhookSubscription,
  type CreateWebhookPayload,
} from "@/lib/services/webhook-service";
import { toast } from "sonner";

export default function WebhooksSettings() {
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;

  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [subs, events] = await Promise.all([
        webhookService.listSubscriptions(orgId),
        webhookService.listEventTypes(),
      ]);
      setSubscriptions(subs);
      setEventTypes(events);
    } catch (err) {
      toast.error("Failed to load webhook subscriptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [orgId]);

  const handleCreate = async () => {
    if (!orgId || !formName || !formUrl) return;
    try {
      const payload: CreateWebhookPayload = {
        name: formName,
        url: formUrl,
        events: formEvents,
      };
      if (formSecret) payload.secret = formSecret;
      await webhookService.createSubscription(orgId, payload);
      toast.success("Webhook created");
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      toast.error("Failed to create webhook");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await webhookService.deleteSubscription(id);
      toast.success("Webhook deleted");
      loadData();
    } catch (err) {
      toast.error("Failed to delete webhook");
    }
  };

  const handleToggle = async (sub: WebhookSubscription) => {
    try {
      await webhookService.updateSubscription(sub.id, {
        is_active: !sub.is_active,
      });
      toast.success(sub.is_active ? "Webhook paused" : "Webhook activated");
      loadData();
    } catch (err) {
      toast.error("Failed to update webhook");
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await webhookService.testSubscription(id);
      if (result.success) {
        toast.success("Test event delivered successfully");
      } else {
        toast.error(`Test failed: ${result.error || "Unknown error"}`);
      }
    } catch (err) {
      toast.error("Failed to send test event");
    } finally {
      setTestingId(null);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormUrl("");
    setFormSecret("");
    setFormEvents([]);
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Webhooks</h3>
        <p className="text-sm text-muted-foreground">
          Send document events to external systems. Connect to Zapier, Make,
          N8N, Slack, or any HTTP endpoint.
        </p>
      </div>
      <Separator />

      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Webhook Subscription</DialogTitle>
              <DialogDescription>
                Configure an endpoint to receive document processing events.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Zapier Invoice Hook"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="url">Endpoint URL</Label>
                <Input
                  id="url"
                  placeholder="https://hooks.zapier.com/..."
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret">
                  Signing Secret{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="secret"
                  type="password"
                  placeholder="HMAC-SHA256 signing secret"
                  value={formSecret}
                  onChange={(e) => setFormSecret(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If set, payloads are signed with HMAC-SHA256 in the
                  X-FetchText-Signature header.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Events</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select which events to receive. Leave all unchecked to receive
                  every event.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {eventTypes.map((event) => (
                    <label
                      key={event}
                      className="flex items-center space-x-2 text-sm"
                    >
                      <Checkbox
                        checked={formEvents.includes(event)}
                        onCheckedChange={() => toggleEvent(event)}
                      />
                      <code className="text-xs">{event}</code>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!formName || !formUrl}>
                Create Webhook
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : subscriptions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-2">
              No webhook subscriptions yet.
            </p>
            <p className="text-sm text-muted-foreground">
              Add a webhook to start sending document events to external
              systems.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => (
            <Card key={sub.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{sub.name}</CardTitle>
                    {sub.is_active ? (
                      <Badge variant="default" className="text-xs">
                        Active
                      </Badge>
                    ) : sub.disabled_at ? (
                      <Badge variant="destructive" className="text-xs">
                        Auto-disabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Paused
                      </Badge>
                    )}
                    {sub.consecutive_failures > 0 && sub.is_active && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {sub.consecutive_failures} failures
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={sub.is_active}
                      onCheckedChange={() => handleToggle(sub)}
                    />
                  </div>
                </div>
                <CardDescription className="font-mono text-xs">
                  {sub.url}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {sub.events.length === 0 ? (
                      <Badge variant="outline" className="text-xs">
                        All events
                      </Badge>
                    ) : (
                      sub.events.map((e) => (
                        <Badge
                          key={e}
                          variant="outline"
                          className="text-xs font-mono"
                        >
                          {e}
                        </Badge>
                      ))
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(sub.id)}
                      disabled={testingId === sub.id}
                    >
                      {testingId === sub.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <TestTube className="mr-1 h-3 w-3" />
                      )}
                      Test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(sub.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {sub.last_triggered_at && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Last triggered:{" "}
                    {new Date(sub.last_triggered_at).toLocaleString()}
                    {sub.last_status_code && ` (HTTP ${sub.last_status_code})`}
                  </p>
                )}
                {sub.disabled_reason && (
                  <p className="text-xs text-destructive mt-1">
                    {sub.disabled_reason}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Check,
  AlertCircle,
  CreditCard,
  Sparkles,
  Zap,
  Shield,
  Building2,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { useOrganization } from '@/context/organization-context'
import { toast } from 'sonner'
import {
  getBillingConfig,
  getSubscriptionStatus,
  createCheckoutSession,
  createCustomerPortal,
  cancelSubscription,
  TIER_INFO,
  type BillingTier,
  type AIModel,
} from '@/lib/services/billing-service'

export default function BillingSettings() {
  const [selectedTier, setSelectedTier] = useState<BillingTier | null>(null)
  const [selectedModel, setSelectedModel] = useState<AIModel>('gpt-4o-mini')
  const { activeOrganization } = useOrganization()
  const searchParams = useSearch({ from: '/_authenticated/settings/billing' })

  // Check for success/cancel from Stripe redirect
  useEffect(() => {
    const success = searchParams?.success
    const canceled = searchParams?.canceled

    if (success === 'true') {
      toast.success('Payment successful! Your subscription is now active.')
    } else if (canceled === 'true') {
      toast.info('Payment was canceled.')
    }
  }, [searchParams])

  // Fetch billing configuration
  const { data: billingConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['billing-config'],
    queryFn: getBillingConfig,
    retry: 2,
    staleTime: 60000,
  })

  // Fetch subscription status
  const {
    data: subscriptionStatus,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['subscription-status', activeOrganization?.id],
    queryFn: () =>
      activeOrganization?.id
        ? getSubscriptionStatus(activeOrganization.id)
        : Promise.resolve(null),
    enabled: !!activeOrganization?.id && billingConfig?.stripe_configured,
    retry: 1,
    staleTime: 30000,
  })

  // Create checkout session mutation
  const checkoutMutation = useMutation({
    mutationFn: (tier: BillingTier) =>
      createCheckoutSession({
        organizationId: activeOrganization!.id,
        tier,
        selectedModel: tier === 'enterprise' ? selectedModel : undefined,
      }),
    onSuccess: (data) => {
      // Redirect to Stripe checkout
      window.location.href = data.checkout_url
    },
    onError: (error: Error) => {
      toast.error(`Failed to start checkout: ${error.message}`)
    },
  })

  // Create portal session mutation
  const portalMutation = useMutation({
    mutationFn: () =>
      createCustomerPortal({
        organizationId: activeOrganization!.id,
      }),
    onSuccess: (data) => {
      window.location.href = data.portal_url
    },
    onError: (error: Error) => {
      toast.error(`Failed to open billing portal: ${error.message}`)
    },
  })

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: () => cancelSubscription(activeOrganization!.id),
    onSuccess: () => {
      toast.success('Subscription will be canceled at the end of the billing period.')
      refetchStatus()
    },
    onError: (error: Error) => {
      toast.error(`Failed to cancel subscription: ${error.message}`)
    },
  })

  const handleUpgrade = (tier: BillingTier) => {
    if (!activeOrganization) {
      toast.error('Please select an organization first')
      return
    }
    setSelectedTier(tier)
    checkoutMutation.mutate(tier)
  }

  const currentTier = subscriptionStatus?.tier || 'free'

  if (!billingConfig?.stripe_configured) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Billing & Subscription</h3>
          <p className="text-sm text-muted-foreground">
            Manage your subscription and billing settings.
          </p>
        </div>
        <Separator />
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Billing is not configured. Please contact support to enable
            subscription management.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Billing & Subscription</h3>
        <p className="text-sm text-muted-foreground">
          Manage your subscription and billing settings.
        </p>
      </div>
      <Separator />

      {/* Current Subscription Status */}
      {activeOrganization && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">
                  {activeOrganization.name}
                </CardTitle>
              </div>
              {isLoadingStatus ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                <Badge
                  variant={
                    subscriptionStatus?.status === 'active'
                      ? 'default'
                      : 'secondary'
                  }
                >
                  {subscriptionStatus?.status === 'active'
                    ? 'Active'
                    : subscriptionStatus?.status || 'Free'}
                </Badge>
              )}
            </div>
            <CardDescription>Current subscription status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingStatus ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {TIER_INFO[currentTier]?.name || 'Free'} Plan
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {TIER_INFO[currentTier]?.description}
                    </p>
                  </div>
                  <p className="text-2xl font-bold">
                    {TIER_INFO[currentTier]?.price}
                  </p>
                </div>

                {subscriptionStatus?.current_period_end && (
                  <p className="text-sm text-muted-foreground">
                    {subscriptionStatus.cancel_at_period_end
                      ? 'Cancels'
                      : 'Renews'}{' '}
                    on{' '}
                    {new Date(
                      subscriptionStatus.current_period_end * 1000
                    ).toLocaleDateString()}
                  </p>
                )}

                {subscriptionStatus?.status === 'active' && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => portalMutation.mutate()}
                      disabled={portalMutation.isPending}
                    >
                      {portalMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <CreditCard className="h-4 w-4 mr-2" />
                      )}
                      Manage Billing
                    </Button>
                    {!subscriptionStatus.cancel_at_period_end && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (
                            confirm(
                              'Are you sure you want to cancel your subscription?'
                            )
                          ) {
                            cancelMutation.mutate()
                          }
                        }}
                        disabled={cancelMutation.isPending}
                      >
                        Cancel Subscription
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pricing Tiers */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {(
          ['free', 'non_managed', 'professional', 'enterprise'] as BillingTier[]
        ).map((tier) => {
          const info = TIER_INFO[tier]
          const isCurrentTier = tier === currentTier
          const isUpgrade =
            ['non_managed', 'professional', 'enterprise'].indexOf(tier) >
            ['non_managed', 'professional', 'enterprise'].indexOf(currentTier)

          return (
            <Card
              key={tier}
              className={`relative ${
                info.highlighted
                  ? 'border-primary shadow-lg'
                  : isCurrentTier
                    ? 'border-green-500'
                    : ''
              }`}
            >
              {info.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">Most Popular</Badge>
                </div>
              )}
              {isCurrentTier && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge variant="outline" className="bg-background">
                    Current Plan
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <CardTitle className="text-lg">{info.name}</CardTitle>
                <CardDescription className="min-h-[40px]">
                  {info.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">{info.price}</div>

                <ul className="space-y-2">
                  {info.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {tier === 'enterprise' && selectedTier === 'enterprise' && (
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-sm font-medium">Select Model</label>
                    <Select
                      value={selectedModel}
                      onValueChange={(v) => setSelectedModel(v as AIModel)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gpt-4o-mini">
                          GPT-4o-mini (Recommended)
                        </SelectItem>
                        <SelectItem value="gpt-4o">
                          GPT-4o (Most Capable)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>

              <CardFooter>
                {tier === 'free' ? (
                  <Button variant="outline" className="w-full" disabled>
                    {isCurrentTier ? 'Current Plan' : 'Free Forever'}
                  </Button>
                ) : isCurrentTier ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : isUpgrade ? (
                  <Button
                    className="w-full"
                    onClick={() => handleUpgrade(tier)}
                    disabled={
                      checkoutMutation.isPending || !activeOrganization
                    }
                  >
                    {checkoutMutation.isPending && selectedTier === tier ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Redirecting...
                      </>
                    ) : (
                      <>
                        Upgrade
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => portalMutation.mutate()}
                    disabled={portalMutation.isPending}
                  >
                    Manage in Portal
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* Feature Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Why Upgrade?</CardTitle>
          <CardDescription>
            Compare features across all plans
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-4 rounded-lg border">
              <Zap className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium">Faster Processing</p>
                <p className="text-sm text-muted-foreground">
                  Professional and Enterprise plans use optimized AI models for
                  10x faster document processing.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg border">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">Data Privacy</p>
                <p className="text-sm text-muted-foreground">
                  Enterprise tier includes a dedicated Azure OpenAI instance
                  with complete data isolation.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg border">
              <Sparkles className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <p className="font-medium">Advanced AI</p>
                <p className="text-sm text-muted-foreground">
                  Access to GPT-4o and GPT-4o-mini for superior document
                  understanding and extraction.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

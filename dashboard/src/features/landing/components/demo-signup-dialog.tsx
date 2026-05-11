import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { SignUpForm } from '@/features/auth/sign-up/components/sign-up-form'

interface DemoSignupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (user: any, session: any) => void
}

export function DemoSignupDialog({
  open,
  onOpenChange,
  onSuccess,
}: DemoSignupDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md' data-testid='demo-signup-dialog'>
        <DialogHeader>
          <DialogTitle>Create an account to save your results</DialogTitle>
          <DialogDescription>
            Your extracted data is ready. Sign up to save it to your account.
          </DialogDescription>
        </DialogHeader>
        <SignUpForm onSuccess={onSuccess} />
      </DialogContent>
    </Dialog>
  )
}

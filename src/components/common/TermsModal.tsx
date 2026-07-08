import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Placeholder legal copy pending real legal review — do not treat as final terms of service text.
export function TermsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>Last updated: placeholder — pending legal review.</p>

          <div>
            <h3 className="font-semibold text-foreground mb-1">1. Acceptance of terms</h3>
            <p>
              By creating an account or using Forgefly, you agree to be bound by
              these Terms of Service. If you do not agree, do not use the service.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">2. Description of service</h3>
            <p>
              Forgefly provides tools for freelancers and solopreneurs to manage
              clients, proposals, invoices, projects, and related business
              operations. We may update or change features over time.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">3. Accounts</h3>
            <p>
              You are responsible for maintaining the confidentiality of your
              account credentials and for all activity under your account.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">4. Payments & subscriptions</h3>
            <p>
              Paid plans are billed on a recurring basis. Fees are non-refundable
              except as required by law. You may cancel at any time; access
              continues until the end of the current billing period.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">5. Acceptable use</h3>
            <p>
              You agree not to misuse the service, including attempting to disrupt
              it, reverse-engineer it, or use it for unlawful purposes.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">6. Limitation of liability</h3>
            <p>
              Forgefly is provided "as is" without warranties of any kind, to the
              maximum extent permitted by law.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">7. Contact us</h3>
            <p>
              Questions about these terms? Reach out via our{" "}
              <a href="/contact" className="underline hover:text-foreground">
                contact page
              </a>
              .
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

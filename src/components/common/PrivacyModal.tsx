import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Placeholder legal copy pending real legal review — do not treat as final privacy policy text.
export function PrivacyModal({
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
          <DialogTitle>Privacy Policy</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>Last updated: placeholder — pending legal review.</p>

          <div>
            <h3 className="font-semibold text-foreground mb-1">1. Information we collect</h3>
            <p>
              We collect information you provide directly, such as your name, email
              address, business details, and content you create within Forgefly
              (clients, proposals, invoices, and related records). We also collect
              usage data automatically, such as device information and how you
              interact with the app.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">2. How we use your information</h3>
            <p>
              We use your information to provide and improve the Forgefly service,
              process payments, communicate with you, and secure your account. We do
              not sell your personal information to third parties.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">3. Data sharing</h3>
            <p>
              We share data with service providers who help us operate Forgefly
              (such as payment processors and hosting infrastructure), only to the
              extent necessary to provide the service.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">4. Data retention & security</h3>
            <p>
              We retain your data for as long as your account is active, and take
              reasonable technical and organizational measures to protect it against
              unauthorized access.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">5. Your rights</h3>
            <p>
              You may request access to, correction of, or deletion of your personal
              information at any time.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-foreground mb-1">6. Contact us</h3>
            <p>
              Questions about this policy? Reach out via our{" "}
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

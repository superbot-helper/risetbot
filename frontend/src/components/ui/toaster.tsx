import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
  type ToastProps,
} from "@/components/ui/toast";

function ToastIcon({ variant }: { variant?: ToastProps["variant"] }) {
  if (variant === "destructive") {
    return (
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400">
        <AlertCircle className="h-4 w-4 animate-in zoom-in-50 duration-200" />
      </div>
    );
  }

  return (
    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400">
      <CheckCircle2 className="h-4 w-4 animate-in zoom-in-50 duration-200" />
    </div>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        variant,
        ...props
      }) {
        const hasContent = Boolean(title || description);

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex w-full items-start gap-3 pr-6">
              {hasContent ? (
                <ToastIcon variant={variant} />
              ) : (
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Info className="h-4 w-4" />
                </div>
              )}

              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>

            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}

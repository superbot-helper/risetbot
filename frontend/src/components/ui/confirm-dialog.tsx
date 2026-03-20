import { ReactNode } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Confirm handler */
  onConfirm: () => void;
  /** Dialog title */
  title: string;
  /** Dialog description */
  description: string | ReactNode;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Variant — destructive shows red styling */
  variant?: 'destructive' | 'warning' | 'info';
  /** Whether the confirm action is pending */
  isPending?: boolean;
}

const variantStyles = {
  destructive: {
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    btnBg: 'bg-red-600 hover:bg-red-700 shadow-red-600/20',
  },
  warning: {
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    btnBg: 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20',
  },
  info: {
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    btnBg: 'bg-primary hover:bg-blue-600 shadow-primary/20',
  },
};

/**
 * Reusable confirmation dialog with animation.
 * Used for Checkpoint 3 (Human-in-the-Loop delete confirmation)
 * and any other destructive or important actions.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'destructive',
  isPending = false,
}: ConfirmDialogProps) {
  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="relative bg-white dark:bg-card rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 text-center">
              {/* Icon */}
              <div className={`w-14 h-14 rounded-full ${styles.iconBg} flex items-center justify-center mx-auto mb-4`}>
                <AlertTriangle className={`w-7 h-7 ${styles.iconColor}`} />
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>

              {/* Description */}
              <div className="text-sm text-muted-foreground leading-relaxed mb-6">
                {description}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isPending}
                  className="flex-1 py-2.5 px-4 bg-gray-100 dark:bg-secondary text-gray-700 dark:text-secondary-foreground rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isPending}
                  className={`flex-1 py-2.5 px-4 text-white rounded-xl font-medium shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${styles.btnBg}`}
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"
import { CheckCircledIcon, ExclamationTriangleIcon, InfoCircledIcon } from "@radix-ui/react-icons"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, syncStatus, tone, ...props }) {
        return (
          <Toast key={id} {...props} syncStatus={syncStatus}
            className={syncStatus ? props.className : tone ? `t3-fidelity-toast t3-fidelity-toast-${tone}` : props.className}>
            {tone && !syncStatus && <span className="t3-fidelity-toast-icon" aria-hidden="true">{tone === "success" ? <CheckCircledIcon /> : tone === "info" ? <InfoCircledIcon /> : <ExclamationTriangleIcon />}</span>}
            <div className="grid min-w-0 gap-1 t3-fidelity-toast-text">
              {title && <ToastTitle className={syncStatus ? "text-sm font-bold" : ""}>{title}</ToastTitle>}
              {description && (
                <ToastDescription
                  className={syncStatus ? "line-clamp-3 !text-sm leading-5 opacity-100" : ""}>{description}</ToastDescription>
              )}
              {tone && action && <div className="t3-fidelity-toast-actions">{action}</div>}
            </div>
            {!tone && action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport className="desktop-toast-viewport" />
    </ToastProvider>
  )
}

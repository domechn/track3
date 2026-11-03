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
        const styledTone = !syncStatus && !props.className ? tone : undefined
        return (
          <Toast key={id} {...props} syncStatus={syncStatus}
            className={props.className ?? (styledTone ? `t3-fidelity-toast t3-fidelity-toast-${styledTone}` : undefined)}>
            {styledTone && <span className="t3-fidelity-toast-icon" aria-hidden="true">{styledTone === "success" ? <CheckCircledIcon /> : styledTone === "info" ? <InfoCircledIcon /> : <ExclamationTriangleIcon />}</span>}
            <div className="grid min-w-0 gap-1 t3-fidelity-toast-text">
              {title && <ToastTitle className={syncStatus ? "text-sm font-bold" : ""}>{title}</ToastTitle>}
              {description && (
                <ToastDescription
                  className={syncStatus ? "line-clamp-3 !text-sm leading-5 opacity-100" : ""}>{description}</ToastDescription>
              )}
              {styledTone && action && <div className="t3-fidelity-toast-actions">{action}</div>}
            </div>
            {!styledTone && action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport className="desktop-toast-viewport" />
    </ToastProvider>
  )
}

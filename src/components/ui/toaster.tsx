import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/components/ui/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, syncStatus, ...props }) {
        return (
          <Toast key={id} {...props} syncStatus={syncStatus}>
            <div className="grid min-w-0 gap-1">
              {title && <ToastTitle className={syncStatus ? "text-sm font-bold" : ""}>{title}</ToastTitle>}
              {description && (
                <ToastDescription
                  className={syncStatus ? "line-clamp-3 !text-sm leading-5 opacity-100" : ""}>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport className="desktop-toast-viewport" />
    </ToastProvider>
  )
}

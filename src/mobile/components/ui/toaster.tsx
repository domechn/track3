import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/mobile/components/ui/toast"
import { useToast } from "@/mobile/components/ui/use-toast"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, syncStatus, ...props }) {
        return (
          <Toast key={id} {...props} syncStatus={syncStatus} className="mobile-toast">
            <div data-selectable="" className="mobile-toast-copy grid min-w-0 gap-1">
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
      <ToastViewport className="ios-d3-toast-viewport" />
    </ToastProvider>
  )
}

import { Dialog as D } from "@base-ui/react/dialog"
import { cn } from "cn"

function Dialog({ open, onClose, title, className, children }: {
  open: boolean
  onClose: () => void
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Backdrop className="fixed inset-0 z-40 bg-black/40" />
        <D.Popup
          className={cn(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[min(42rem,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-xl border bg-background p-4 shadow-lg",
            className,
          )}
        >
          <D.Title className="sr-only">{title}</D.Title>
          {children}
        </D.Popup>
      </D.Portal>
    </D.Root>
  )
}

export { Dialog }

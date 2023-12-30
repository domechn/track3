import { Skeleton } from "@/components/ui/skeleton";
import { cn } from '@/lib/utils'

export function loadingWrapper(loading: boolean, reactNode: React.ReactNode, loadingClassName?: string) {
  return loading ? <Skeleton className={cn('w-[100%] h-[20px] rounded-full', loadingClassName)} /> : reactNode;
}

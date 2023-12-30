import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import _ from "lodash";
import {v4 as uuidv4} from 'uuid';

export function loadingWrapper(
  loading: boolean,
  reactNode: React.ReactNode,
  loadingClassName?: string,
  repeat = 1
) {
  const keyPrefix = uuidv4()
  return loading
    ? _(repeat).times((i) => (
        <Skeleton
          key={`loading-${keyPrefix}-${i}`}
          className={cn("w-[100%] h-[20px] rounded-full", loadingClassName)}
        />
      ))
    : reactNode;
}

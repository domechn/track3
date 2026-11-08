import type { AssetType } from "@/middlelayers/datafetch/types";
import { getAssetType } from "@/middlelayers/datafetch/utils/coins";
import { cn } from "@/lib/utils";
import { formatAssetLabel } from "@/utils/assets";

type AssetLabelProps = {
  asset: {
    symbol: string;
    assetType?: AssetType;
  };
  className?: string;
  labelClassName?: string;
  badgeClassName?: string;
};

const defaultBadgeClassName = "t3-tag";

export default function AssetLabel({
  asset,
  className,
  labelClassName,
  badgeClassName,
}: AssetLabelProps) {
  const assetType = getAssetType(asset);

  return (
    <span
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-2",
        className,
      )}
    >
      <span className={cn("min-w-0", labelClassName)}>
        {formatAssetLabel(asset)}
      </span>
      {assetType !== "crypto" ? (
        <span className={cn(defaultBadgeClassName, badgeClassName)} data-tone="neutral">
          {assetType}
        </span>
      ) : null}
    </span>
  );
}

import type { ReactNode } from "react";
import type { AssetType } from "@/middlelayers/datafetch/types";
import { getAssetType } from "@/middlelayers/datafetch/utils/coins";
import { cn } from "@/lib/utils";
import { formatAssetLabel } from "@/utils/assets";
import AssetIcon, { type AssetIconKind, type AssetIconSize } from "@/components/ui/asset-icon";
import { Tag, type TagTone } from "@/components/ui/tag";

type AssetLabelProps = {
  asset?: {
    symbol: string;
    assetType?: AssetType;
  };
  kind?: AssetIconKind;
  symbol?: string;
  type?: string;
  name?: string;
  src?: string | null;
  size?: AssetIconSize;
  secondary?: ReactNode;
  tag?: string;
  tagTone?: TagTone;
  quiet?: boolean;
  className?: string;
  labelClassName?: string;
  badgeClassName?: string;
};

export default function AssetLabel({
  asset,
  kind,
  symbol,
  type,
  name,
  src,
  size = 20,
  secondary,
  tag,
  tagTone,
  quiet,
  className,
  labelClassName,
  badgeClassName,
}: AssetLabelProps) {
  const assetType = asset ? getAssetType(asset) : undefined;
  const displayName = name ?? (asset ? formatAssetLabel(asset) : symbol ?? type ?? "");
  const iconKind = kind ?? (assetType === "stock" ? "stock" : "coin");
  const displayedTag = tag ?? (assetType === "stock" ? assetType : undefined);

  return (
    <span
      className={cn(
        "t3-asset-label inline-flex max-w-full min-w-0 items-start",
        className,
      )}
      data-size={size}
    >
      <AssetIcon kind={iconKind} symbol={asset?.symbol ?? symbol} type={type} name={displayName} src={src}
        size={size} quiet={quiet} decorative />
      <span className="t3-asset-label-text">
        <span className="t3-asset-label-line">
          <span className={cn("t3-asset-label-name", labelClassName)} title={displayName}>{displayName}</span>
          {displayedTag && <Tag tone={tagTone} className={cn("t3-asset-tag", badgeClassName)}>{displayedTag}</Tag>}
        </span>
        {secondary && <small className="t3-asset-label-secondary">{secondary}</small>}
      </span>
    </span>
  );
}

import { useState } from "react";
import AssetIcon, { type AssetIconSize } from "@/components/ui/asset-icon";
import "./index.css";

const ImageStack = ({
  imageSrcs,
  imageWidth,
  imageHeight,
  symbols = [],
}: {
  imageSrcs: string[];
  imageWidth: number;
  imageHeight: number;
  symbols?: string[];
}) => {
  const [expanded, setExpanded] = useState(false);
  const size: AssetIconSize = Math.max(imageWidth, imageHeight) <= 18 ? 20 : 24;

  const handleMouseEnter = () => {
    setExpanded(true);
  };

  const handleMouseLeave = () => {
    setExpanded(false);
  };

  return (
    <div
      className="image-stack"
      style={{
        height: size,
        width: size * 1.05 * imageSrcs.length
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {imageSrcs.map((image, index) => (
        <div
          className="image-stack-child"
          style={{ left: expanded ? index * size * 1.05 : index * size * 0.7 }}
          key={index}
        >
          <AssetIcon kind="coin" symbol={symbols[index] ?? "?"} src={image} size={size} quiet />
        </div>
      ))}
    </div>
  );
};

export default ImageStack;

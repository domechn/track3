import { useState } from "react";
import "./index.css";

const ImageStack = ({
  imageSrcs,
  imageWidth,
  imageHeight,
}: {
  imageSrcs: string[];
  imageWidth: number;
  imageHeight: number;
}) => {
  const [expanded, setExpanded] = useState(false);

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
        height: imageHeight,
        width:  imageWidth * 1.05 * imageSrcs.length
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {imageSrcs.map((image, index) => (
        <div
          className="image-stack-child rounded-full"
          style={{ left: expanded ? index * imageWidth * 1.05 : index * imageWidth * 0.7 }}
          key={index}
        >
          <img
            src={image}
            alt={`Image ${index + 1}`}
            style={{
              width: imageWidth,
              height: imageHeight,
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default ImageStack;

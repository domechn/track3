import "./index.css";
import refreshIcon from "./refresh-icon.png";
import Loading from "../loading";
import { useState } from "react";

const Configuration = () => {
  const [loading, setLoading] = useState(false);

  const handleButtonClick = () => {
    setLoading(true);
    console.log("handleButtonClick");

    setTimeout(() => {
	      setLoading(false);
    }, 2000);
  };

  return (
    <div>
      <Loading loading={loading} />
      <button className="refresh-button" onClick={handleButtonClick}>
        <img
          src={refreshIcon}
          alt="refresh"
          style={{
            border: 0,
            height: 30,
            width: 30,
          }}
        />
      </button>
    </div>
  );
};

export default Configuration;

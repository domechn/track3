import { useEffect, useState } from "react";
import "./index.css";

const App = ({ loading }: { loading: boolean }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(loading);
    if (loading) {
      document.body.classList.add("loading");
    } else {
      document.body.classList.remove("loading");
    }
  }, [loading]);

  if (!show) {
    return null;
  }

  return (
    <div className="loading-container" >
      <div className="loading-overlay" />
      <div className="loading-spinner" />
    </div>
  );
};

export default App;

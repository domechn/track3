import { useEffect, useState } from "react";

import "./index.css";

const App = (props: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(props.visible);

  useEffect(() => {
    setIsModalOpen(props.visible);
  }, [props.visible]);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
      props.onClose();
    }
  }, [isModalOpen]);

  const handleModalClose = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleModalClose}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#f5f5f5",
            }}
          >
            {props.children}
          </div>
        </div>
      )}
    </>
  );
};

export default App;

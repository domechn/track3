import { useEffect, useState } from "react";

import "./index.css";
import { useWindowSize } from "../../../utils/hook";

const App = (props: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  const [isModalOpen, setIsModalOpen] = useState(props.visible);

  const [offsetTop, setOffsetTop] = useState(0);
  const [offsetLeft, setOffsetLeft] = useState(0);

  const usize = useWindowSize();

  useEffect(() => setTopAndLeft(usize), [usize]);
  useEffect(() => setTopAndLeft(usize), [isModalOpen]);

  function setTopAndLeft(winSize: { width?: number; height?: number }) {
    const width = winSize.width ?? 800;
    const height = winSize.height ?? 800;

    // get modal by className

    const modal = document.querySelector(".modal");
    if (modal) {
      const modalWidth = modal.clientWidth;
      const modalHeight = modal.clientHeight;

      const top = (height - modalHeight) / 2;
      const left = (width - modalWidth) / 2;

      setOffsetTop(top);
      setOffsetLeft(left);
    }
  }

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
              top: offsetTop,
              left: offsetLeft,
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

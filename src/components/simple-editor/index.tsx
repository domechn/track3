import React, { useState } from "react";
import "./index.css";

const SimpleEditor = ({data, onSubmit} : {
	  data: string,
	  onSubmit: (d: string) => unknown
}) => {
  const [inputData, setInputData] = useState(data);

  const handleChange = (event: { target: { value: React.SetStateAction<string> } }) => {
    const newValue = event.target.value;
    setInputData(newValue);
  };

  const handleSubmit = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    onSubmit(inputData)
  };

  return (
    <div className="simple-editor">
      <form onSubmit={handleSubmit}>
        <textarea value={inputData} onChange={handleChange} />
        <button type="submit">Save</button>
      </form>
    </div>
  );
};

export default SimpleEditor;

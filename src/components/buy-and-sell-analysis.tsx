import { useParams } from "react-router-dom";

const App = ({}) => {
  const { symbol } = useParams();
  return <div>Buy and Sell: {symbol}</div>;
};

export default App;

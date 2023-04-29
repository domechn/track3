import { useEffect } from "react";
import IndexApp from "./components/index"
import "./App.css";
import { getDatabase, initTables } from './middlelayers/database'

function App() {
  
  useEffect(() => {
    console.log("App.tsx: useEffect");
    getDatabase().then(db=> initTables(db))
  }, [])

  return (
    <div className="container">
      <IndexApp />
    </div>
  );
}

export default App;

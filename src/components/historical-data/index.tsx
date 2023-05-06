import { useEffect, useState } from "react";
import {
  deleteHistoricalDataById,
  queryHistoricalData,
} from "../../middlelayers/charts";
import Loading from "../common/loading";
import { HistoricalData } from "../../middlelayers/types";
import Modal from "../common/modal";
import historyIcon from "../../assets/icons/history-icon.png";
import deleteIcon from "../../assets/icons/delete-icon.png";
import Table from "../common/table"
import _ from "lodash";

import "./index.css";
import { toast } from "react-hot-toast";

const App = ({
  afterDataDeleted,
}: {
  afterDataDeleted: (id: number) => unknown;
}) => {
  const [data, setData] = useState([] as HistoricalData[]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const columns = [
    {
      title: "Opt",
      dataIndex: "id",
      key: "operations",
      render: (id: number | string) => (
        <a href="#" onClick={() => onDeleteClick(id as number)}>
          <img
            src={deleteIcon}
            alt="delete"
            style={{
              border: 0,
              height: 20,
              width: 20,
            }}
          />
        </a>
      ),
    },
    {
      key: "createdAt",
      dataIndex: "createdAt",
      title: "Date",
    },
    {
      key: "top01",
      dataIndex: "top01",
      title: "Top01",
    },
    {
      key: "amount01",
      dataIndex: "amount01",
      title: "Amount01",
    },
    {
      key: "value01",
      dataIndex: "value01",
      title: "Value01",
    },
    {
      key: "top02",
      dataIndex: "top02",
      title: "Top02",
    },
    {
      key: "amount02",
      dataIndex: "amount02",
      title: "Amount02",
    },
    {
      key: "value02",
      dataIndex: "value02",
      title: "Value02",
    },
    {
      key: "top03",
      dataIndex: "top03",
      title: "Top03",
    },
    {
      key: "amount03",
      dataIndex: "amount03",
      title: "Amount03",
    },
    {
      key: "value03",
      dataIndex: "value03",
      title: "Value03",
    },
    {
      key: "top04",
      dataIndex: "top04",
      title: "Top04",
    },
    {
      key: "amount04",
      dataIndex: "amount04",
      title: "Amount04",
    },
    {
      key: "value04",
      dataIndex: "value04",
      title: "Value04",
    },
    {
      key: "top05",
      dataIndex: "top05",
      title: "Top05",
    },
    {
      key: "amount05",
      dataIndex: "amount05",
      title: "Amount05",
    },
    {
      key: "value05",
      dataIndex: "value05",
      title: "Value05",
    },
    {
      key: "top06",
      dataIndex: "top06",
      title: "Top06",
    },
    {
      key: "amount06",
      dataIndex: "amount06",
      title: "Amount06",
    },
    {
      key: "value06",
      dataIndex: "value06",
      title: "Value06",
    },
    {
      key: "top07",
      dataIndex: "top07",
      title: "Top07",
    },
    {
      key: "amount07",
      dataIndex: "amount07",
      title: "Amount07",
    },
    {
      key: "value07",
      dataIndex: "value07",
      title: "Value07",
    },
    {
      key: "top08",
      dataIndex: "top08",
      title: "Top08",
    },
    {
      key: "amount08",
      dataIndex: "amount08",
      title: "Amount08",
    },
    {
      key: "value08",
      dataIndex: "value08",
      title: "Value08",
    },
    {
      key: "top09",
      dataIndex: "top09",
      title: "Top09",
    },
    {
      key: "amount09",
      dataIndex: "amount09",
      title: "Amount09",
    },
    {
      key: "value09",
      dataIndex: "value09",
      title: "Value09",
    },
    {
      key: "top10",
      dataIndex: "top10",
      title: "Top10",
    },
    {
      key: "amount10",
      dataIndex: "amount10",
      title: "Amount10",
    },
    {
      key: "value10",
      dataIndex: "value10",
      title: "Value10",
    },
    {
      key: "topOthers",
      dataIndex: "topOthers",
      title: "TopOthers",
    },
    {
      key: "valueOthers",
      dataIndex: "valueOthers",
      title: "ValueOthers",
    },
  ];

  const handleButtonClick = () => {
    setIsModalOpen(true);
    loadAllData();
  };

  useEffect(() => {}, []);

  function loadAllData() {
    setLoading(true);
    queryHistoricalData()
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }

  function onModalClose() {
    setIsModalOpen(false);
  }

  function onDeleteClick(id: number) {
    setLoading(true);
    deleteHistoricalDataById(id)
      .then(() => {
        toast.success("Record deleted");
        loadAllData();
        afterDataDeleted(id);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }

  return (
    <div>
      <button className="history-button" onClick={handleButtonClick}>
        <img
          src={historyIcon}
          alt="history"
          style={{
            border: 0,
            height: 30,
            width: 30,
          }}
        />
      </button>
      <Modal visible={isModalOpen} onClose={onModalClose}>
        <Loading loading={loading} />
        <h2>Historical Data</h2>
        <Table data={data} columns={columns} />
      </Modal>
    </div>
  );
};

export default App;

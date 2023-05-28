import { useContext, useState } from "react";
import {
  deleteHistoricalDataById,
  queryHistoricalData,
} from "../../middlelayers/charts";
import { HistoricalData } from "../../middlelayers/types";
import Modal from "../common/modal";
import historyIcon from "../../assets/icons/history-icon.png";
import deleteIcon from "../../assets/icons/delete-icon.png";
import exportIcon from "../../assets/icons/export-icon.png";
import Table from "../common/table";
import _ from "lodash";

import "./index.css";
import { toast } from "react-hot-toast";
import { useWindowSize } from "../../utils/hook";
import { LoadingContext } from "../../App";
import { exportHistoricalData } from "../../middlelayers/data";

type RankData = {
  id: number;
  rank: number;
  symbol: string;
  value: number;
  amount: number | string;
  price: number | string;
};

const App = ({
  afterDataDeleted,
}: {
  afterDataDeleted: (id: number) => unknown;
}) => {
  const [data, setData] = useState([] as HistoricalData[]);
  const [rankData, setRankData] = useState([] as RankData[]);
  const { setLoading } = useContext(LoadingContext);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const size = useWindowSize();
  const leftTableWidth = 350;
  const rightTableWidth = 420;
  const twoTablesWidth = 800;

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
      key: "total",
      dataIndex: "total",
      title: "Total",
    },
  ];

  const rankColumns = [
    {
      key: "rank",
      dataIndex: "rank",
      title: "Rank",
    },
    {
      key: "symbol",
      dataIndex: "symbol",
      title: "Symbol",
    },
    {
      key: "amount",
      dataIndex: "amount",
      title: "Amount",
    },
    {
      key: "value",
      dataIndex: "value",
      title: "Value",
    },
    {
      key: "price",
      dataIndex: "price",
      title: "Price",
    },
  ];

  const handleButtonClick = () => {
    setIsModalOpen(true);
    loadAllData();
  };

  function loadAllData() {
    setLoading(true);
    queryHistoricalData()
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }

  function onModalClose() {
    setIsModalOpen(false);
    // clean data rank when modal close
    setRankData([]);
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

  function onRowClick(id: number | string) {
    const d = _(data).find((d) => d.id === id);
    if (!d) {
      return;
    }

    const rankData = _([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      .map((i) => {
        const idxStr = i.toString().padStart(2, "0");

        const top = _(d).get(`top${idxStr}`) as string | undefined;
        const amount = _(d).get(`amount${idxStr}`) as number | undefined;
        const value = _(d).get(`value${idxStr}`) as number | undefined;

        if (!top || !amount || !value) {
          return;
        }

        return {
          id: i,
          rank: i,
          symbol: top,
          amount: amount.toFixed(5),
          value: +value.toFixed(4),
          price: (value / amount).toFixed(4),
        } as RankData;
      })
      .compact()
      .value();

    // others
    const top = _(d).get("topOthers") as string | undefined;
    const value = _(d).get("valueOthers") as number | undefined;

    if (top && value) {
      rankData.push({
        id: 11,
        rank: 11,
        symbol: top,
        amount: "N/A",
        value: value,
        price: "N/A",
      });
    }

    setRankData(rankData);
  }

  function getLeftPosition() {
    const modalMaxSize = size.width! * 0.9;
    return (Math.min(modalMaxSize, twoTablesWidth) - leftTableWidth) / 2;
  }

  async function onExportButtonClick() {
    await exportHistoricalData();
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
        <h2>Historical Data</h2>
        <button className="export" onClick={onExportButtonClick}>
          <img
            src={exportIcon}
            alt="export"
            style={{
              border: 0,
              height: 25,
              width: 25,
            }}
          />
        </button>
        <div
          style={{
            position: "relative",
            height: Math.max(30 * data.length + 30, 30 * rankData.length + 55),
            width: twoTablesWidth,
          }}
        >
          <div
            style={{
              overflow: "auto",
              height: 30 * data.length + 30,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: rankData.length > 0 ? 0 : getLeftPosition(),
                width: leftTableWidth,
              }}
            >
              <Table data={data} columns={columns} onRowClick={onRowClick} />
            </div>
            <div
              style={{
                position: "absolute",
                display: rankData.length > 0 ? "block" : "none",
                width: rightTableWidth,
                marginLeft: 10,
                left: leftTableWidth,
              }}
            >
              <Table
                data={rankData}
                columns={rankColumns}
                onRowClick={onRowClick}
              />
              <h3>👆 Details</h3>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default App;

import { useContext, useEffect, useState } from "react";
import {
  deleteHistoricalDataByUUID,
  queryHistoricalData,
} from "../../middlelayers/charts";
import { HistoricalData } from "../../middlelayers/types";
import deleteIcon from "../../assets/icons/delete-icon.png";
import Table from "../common/table";
import _ from "lodash";

import "./index.css";
import { toast } from "react-hot-toast";
import { LoadingContext } from "../../App";
import { timestampToDate } from "../../utils/date";

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
  afterDataDeleted?: (id: string) => unknown;
}) => {
  const [data, setData] = useState([] as HistoricalData[]);
  const [rankData, setRankData] = useState([] as RankData[]);
  const { setLoading } = useContext(LoadingContext);

  const columns = [
    {
      key: "createdAt",
      dataIndex: "createdAt",
      title: "Date",
      render: (id: number | string) => (
        <>
          {timestampToDate(
            new Date(
              _(data).find((d) => d.id === id)!.createdAt as string
            ).getTime(),
            true
          )}
        </>
      ),
    },
    {
      key: "total",
      dataIndex: "total",
      title: "Total",
    },
    {
      title: "Opt",
      dataIndex: "id",
      key: "operations",
      render: (id: number | string) => (
        <a href="#" onClick={() => onDeleteClick(id as string)}>
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

  useEffect(() => {
    loadAllData();
  }, []);

  function loadAllData() {
    setLoading(true);
    queryHistoricalData(-1)
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }

  function onDeleteClick(id: string) {
    setLoading(true);
    deleteHistoricalDataByUUID(id)
      .then(() => {
        toast.success("Record deleted");
        loadAllData();
        if (afterDataDeleted) {
          afterDataDeleted(id);
        }
        // hide rank data when some data is deleted
        setRankData([]);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }

  function onRowClick(id: number | string) {
    const d = _(data).find((d) => d.id === id);
    if (!d) {
      return;
    }

    const revAssets = _(d.assets).sortBy("value").reverse().value();
    setRankData(
      _(d.assets)
        .map((asset, idx) => ({
          id: idx,
          rank: _(revAssets).findIndex((a) => a.symbol === asset.symbol) + 1,
          amount: asset.amount,
          symbol: asset.symbol,
          value: asset.value,
          price: asset.price,
        }))
        .filter((d) => d.value > 1) // ignore value less than 1 dollar
        .sortBy("rank")
        .value()
    );
  }

  return (
    <div>
      <h2>Historical Data</h2>
      <div className="historical-data">
        <div
          id="detail-view"
          style={{
            display: rankData.length > 0 ? "inline-block" : "none",
            marginRight: 10,
            verticalAlign: "top",
          }}
        >
          <Table
            data={rankData}
            columns={rankColumns}
          />
          <h3>👆 Details</h3>
        </div>
        <div
          id="simple-view"
          style={{
            display: "inline-block",
            verticalAlign: "top",
          }}
        >
          <Table data={data} columns={columns} onRowClick={onRowClick} />
        </div>
      </div>
    </div>
  );
};

export default App;

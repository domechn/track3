import { useContext, useEffect, useState } from "react";
import {
  deleteHistoricalDataByUUID,
  queryHistoricalData,
} from "../../middlelayers/charts";
import { CurrencyRateDetail, HistoricalData } from "../../middlelayers/types";
import deleteIcon from "../../assets/icons/delete-icon.png";
import Table from "../common/table";
import _ from "lodash";

import "./index.css";
import { toast } from "react-hot-toast";
import { LoadingContext } from "../../App";
import { timestampToDate } from "../../utils/date";
import {
  currencyWrapper,
  prettyNumberToLocaleString,
} from "../../utils/currency";
import Modal from "../common/modal";

type RankData = {
  id: number;
  rank: number;
  symbol: string;
  value: number;
  amount: number;
  price: number;
};

const App = ({
  afterDataDeleted,
  currency,
}: {
  afterDataDeleted?: (id: string) => unknown;
  currency: CurrencyRateDetail;
}) => {
  const [data, setData] = useState([] as HistoricalData[]);
  const [rankData, setRankData] = useState([] as RankData[]);
  const { setLoading } = useContext(LoadingContext);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [pageNum, setPageNum] = useState(1);
  const pageSize = 10;

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
      render: (id: number | string) => {
        const curData = _(rankData).find((d) => d.id === id);

        return (
          <>
            {curData
              ? currency.symbol +
                prettyNumberToLocaleString(
                  currencyWrapper(currency)(curData.value)
                )
              : "-"}
          </>
        );
      },
    },
    {
      key: "price",
      dataIndex: "price",
      title: "Price",
      render: (id: number | string) => {
        const curData = _(rankData).find((d) => d.id === id);

        return (
          <>
            {curData
              ? currency.symbol + currencyWrapper(currency)(curData.price)
              : "-"}
          </>
        );
      },
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

    setIsModalOpen(true);
  }

  function onModalClose() {
    setIsModalOpen(false);
  }

  function getUpOrDown(val: number) {
    const p = val > 0 ? "+" : val === 0 ? "" : "-";
    return p;
  }

  function renderHistoricalDataList() {
    // split data into pages
    const idx = (pageNum - 1) * pageSize;
    return _(data)
      .slice(idx, idx + pageSize)
      .map((d, idx) => {
        return (
          <div
            key={d.id}
            className="historical-data-card"
            onClick={() => onRowClick(d.id)}
          >
            <div>
              <div className="historical-data-card-created-at">
                {timestampToDate(new Date(d.createdAt).getTime(), true)}
              </div>
              <div className="historical-data-card-total">
                {currency.symbol +
                  prettyNumberToLocaleString(
                    currencyWrapper(currency)(d.total)
                  )}
              </div>
            </div>

            <div className="historical-data-card-bottom">
              <div className="historical-data-card-bottom-operations">
                <a href="#" onClick={() => onDeleteClick(d.id)}>
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
              </div>
              <div
                className="historical-data-card-bottom-changes"
                style={{
                  color: d.total - data[idx + 1]?.total > 0 ? "green" : "red",
                }}
              >
                {idx < data.length - 1
                  ? getUpOrDown(d.total - data[idx + 1].total) +
                    currency.symbol +
                    prettyNumberToLocaleString(
                      currencyWrapper(currency)(
                        Math.abs(d.total - data[idx + 1].total)
                      )
                    )
                  : ""}
              </div>
            </div>
          </div>
        );
      })
      .value();
  }

  function page() {
    return _(data.length / pageSize)
      .range()
      .map((i) => {
        const curPageNum = i + 1;

        return (
          <a
            href="#"
            key={"his-page-" + curPageNum}
            onClick={() => setPageNum(curPageNum)}
            style={{
              color: curPageNum === pageNum ? "black" : "gray",
              marginRight: 10,
            }}
          >
            {curPageNum}
          </a>
        );
      })
      .value();
  }

  return (
    <div>
      <h2
        style={{
          marginBottom: 5,
        }}
      >
        Historical Data
      </h2>
      <Modal visible={isModalOpen} onClose={onModalClose}>
        <div
          id="detail-view"
          style={{
            display: rankData.length > 0 ? "inline-block" : "none",
            marginRight: 10,
            verticalAlign: "top",
          }}
        >
          <Table data={rankData} columns={rankColumns} />
        </div>
      </Modal>
      <div
        style={{
          marginBottom: 10,
          color: "gray",
        }}
      >
        <a
          href="#"
          onClick={() => (pageNum > 1 ? setPageNum(pageNum - 1) : null)}
          style={{
            marginRight: 10,
            color: "gray",
          }}
        >
          {"<"}
        </a>
        {page()}
        <a
          href="#"
          onClick={() =>
            pageNum < data.length / pageSize ? setPageNum(pageNum + 1) : null
          }
          style={{
            color: "gray",
          }}
        >
          {">"}
        </a>
      </div>
      <div className="historical-data">{renderHistoricalDataList()}</div>
    </div>
  );
};

export default App;

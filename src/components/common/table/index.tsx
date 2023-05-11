import _ from "lodash";
import React, { createRef, useEffect, useMemo, useState } from "react";

import "./index.css";

export type ColumnData = {
  title: string;
  key: string;
  width?: number;
  render?: (id: string | number) => JSX.Element;
  dataIndex: string;
};

const App = ({
  columns,
  data,
  onRowClick,
}: {
  columns: ColumnData[];
  data: ({ id: string | number } & unknown)[];
  onRowClick?: (id: string | number) => unknown;
}) => {
  const randomId = useMemo(() => "" + Math.floor(Math.random() * 1000000), []);
  const getColStyle = (column: ColumnData): React.CSSProperties => {
    const style = {} as React.CSSProperties;
    if (column.width) {
      style.width = column.width;
    }
    return style;
  };

  const [clickedRow, setClickedRow] = useState<number | null>(null);

  function onRowClickInternal(id: string | number, idx: number) {
    if (!onRowClick) {
      return;
    }
    onRowClick(id);

    const realId = (i: string | number) => "row-" + i + "-" + randomId;

    console.log("clicked", idx, realId(idx), clickedRow);
    
    // set clicked background
    if (clickedRow !== null) {
      document.getElementById(realId(clickedRow))?.classList.remove("clicked");
    }
    document.getElementById(realId(idx))?.classList.add("clicked");
    setClickedRow(idx);
  }

  return (
    <div className="nice-table">
      <table>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={getColStyle(column)} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.title}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row, idx) => (
            <tr
              id={"row-" + idx + "-" + randomId}
              key={row.id}
              onClick={() => onRowClickInternal(row.id, idx)}
              style={{
                cursor: onRowClick ? "pointer" : "default",
              }}
            >
              {columns.map((column) => (
                <td key={column.dataIndex + row.id}>
                  {column.render
                    ? column.render(row.id)
                    : _(row).get(column.dataIndex)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default App;

import _ from "lodash";
import React from "react";

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
}: {
  columns: ColumnData[];
  data: ({ id: string | number } & unknown)[];
}) => {
  const getColStyle = (column: ColumnData): React.CSSProperties => {
    const style = {} as React.CSSProperties;
    if (column.width) {
      style.width = column.width;
    }
    return style;
  };

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
          {data.map((row) => (
            <tr key={row.id}>
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

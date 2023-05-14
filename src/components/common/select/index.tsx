import "./index.css";

export type SelectOption = { value: string; label: string };

const App = ({
  options,
  onSelectChange,
  defaultValue,
  width,
  height,
}: {
  options: SelectOption[];
  defaultValue?: string;
  width?: number;
  height?: number;
  onSelectChange: (val: string) => unknown;
}) => {
  return (
    <>
      <label className="nice-select">
        <select
          id="slct"
          name="coins"
          onChange={(e) => onSelectChange(e.target.value)}
          defaultValue={defaultValue}
          style={{
            width: width ? `${width}px` : "",
            height: height ? `${height}px` : "",
          }}
        >
          {options.map((d) => {
            return (
              <option key={d.label} value={d.value}>
                {d.label}
              </option>
            );
          })}
        </select>
        <svg>
          <use xlinkHref="#select-arrow-down"></use>
        </svg>
      </label>
      <svg className="sprites">
        <symbol id="select-arrow-down" viewBox="0 0 10 6">
          <polyline points="1 1 5 5 9 1"></polyline>
        </symbol>
      </svg>
    </>
  );
};

export default App;

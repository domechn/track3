import "./index.css";

export type SelectOption = { value: string; label: string };

const App = ({
  id,
  options,
  onSelectChange,
  defaultValue,
  value,
  width,
  height,
}: {
  id?: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
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
          value={value}
          style={{
            width: width ? `${width}px` : "",
            height: height ? `${height}px` : "",
          }}
        >
          {options.map((d, idx) => {
            return (
              <option key={`${id ?? ""}-${d.label}-${idx}`} value={d.value}>
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

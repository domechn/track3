import _ from "lodash";
import {
  CurrencyRateDetail,
  WalletAssetsChangeData,
} from "@/middlelayers/types";
import {
  currencyWrapper,
  prettyNumberToLocaleString,
} from "@/utils/currency";
import { insertEllipsis } from "@/utils/string";
import {
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
  Table,
} from "@/components/ui/table";

const App = ({
  data,
  currency,
}: {
  data: WalletAssetsChangeData;
  currency: CurrencyRateDetail;
}) => {
  function getArrow(value: number) {
    if (value < 0) {
      return "↓";
    } else if (value > 0) {
      return "↑";
    }
    return "";
  }

  function getChangeClassName(value: number) {
    if (value < 0) {
      return "red";
    } else if (value > 0) {
      return "green";
    }
    return "gray";
  }

  function getPositiveValue(value: number) {
    if (value < 0) {
      return -value;
    }
    return value;
  }

  function tweakWalletType(walletType: string) {
    return <span>{walletType}</span>;
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-left py-4 ml-10">Value Changes</h2>
      <div className="flex justify-center items-center">
        <div className="w-4/5 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Wallet Type</TableHead>
                <TableHead>Wallet Alias</TableHead>
                <TableHead>Percentage</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.wallet}>
                  <TableCell className="font-medium">
                    {!d.walletType || d.walletType === "null"
                      ? "Unknown"
                      : tweakWalletType(d.walletType)}
                  </TableCell>
                  <TableCell>
                    {d.walletAlias ??
                      insertEllipsis(
                        !d.wallet || d.wallet === "null" ? "Unknown" : d.wallet,
                        32
                      )}
                  </TableCell>
                  <TableCell
                    className={`text-${getChangeClassName(
                      d.changePercentage
                    )}-500`}
                  >
                    {" "}
                    {getArrow(d.changePercentage)}
                    {prettyNumberToLocaleString(
                      getPositiveValue(d.changePercentage)
                    )}
                    %
                  </TableCell>
                  <TableCell
                    className={`text-right text-${getChangeClassName(
                      d.changePercentage
                    )}-500`}
                  >
                    {getArrow(d.changeValue)}
                    {currency.symbol}
                    {prettyNumberToLocaleString(
                      currencyWrapper(currency)(getPositiveValue(d.changeValue))
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
};

export default App;

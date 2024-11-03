use std::{
    collections::{HashMap},
    fs::{self, File},
    path::Path,
};

use indexmap::IndexSet;
use sqlx::{Connection, Executor, SqliteConnection};
use version_compare::{compare_to, Cmp};
use tokio::runtime::Runtime;
use uuid::Uuid;

use crate::types::{AssetPrice, AssetsV1, AssetsV2, Configuration, Transaction};

static CLIENT_ID_CONFIGURATION_ID: i32 = 998;
static VERSION_CONFIGURATION_ID: i32 = 999;

static CONFIGURATION_TABLE_NAME: &str = "configuration";
static ASSETS_V2_TABLE_NAME: &str = "assets_v2";
static TRANSACTION_TABLE_NAME: &str = "transactions";

pub fn is_first_run(path: &Path) -> bool {
    // check sqlite file exists
    if path.join("track3.db").exists() {
        false
    } else {
        true
    }
}

fn get_sqlite_file_path(path: &Path) -> String {
    String::from(path.join("track3.db").to_str().unwrap())
}

pub fn init_sqlite_tables(app_version: String, app_dir: &Path, resource_dir: &Path) {
    println!("start initing sqlite tables in rust");
    let sqlite_path = get_sqlite_file_path(app_dir);
    let configuration =
        fs::read_to_string(resource_dir.join("migrations/init/configuration_up.sql")).unwrap();
    let assets_v2 =
        fs::read_to_string(resource_dir.join("migrations/init/assets_v2_up.sql")).unwrap();
    let currency_rates_sync =
        fs::read_to_string(resource_dir.join("migrations/init/currency_rates_up.sql")).unwrap();
    let asset_actions =
        fs::read_to_string(resource_dir.join("migrations/init/asset_prices_up.sql")).unwrap();

    let rt = Runtime::new().unwrap();
    rt.block_on(async move {
        println!("init sqlite tables in tokio spawn");
        let mut conn = SqliteConnection::connect(&sqlite_path).await.unwrap();
        conn.execute(configuration.as_str()).await.unwrap();
        conn.execute(assets_v2.as_str()).await.unwrap();
        conn.execute(currency_rates_sync.as_str()).await.unwrap();
        conn.execute(asset_actions.as_str()).await.unwrap();

        // record current app version
        sqlx::query(
            format!(
                "INSERT INTO {} (id, data) VALUES (?, ?)",
                CONFIGURATION_TABLE_NAME
            )
            .as_str(),
        )
        .bind(VERSION_CONFIGURATION_ID)
        .bind(app_version.as_str())
        .execute(&mut conn)
        .await
        .unwrap();

        conn.close().await.unwrap();
        println!("init sqlite tables in tokio spawn done");
    });
}

pub fn prepare_required_data(app_version: String, app_dir: &Path) {
    println!("start preparing required data");
    let sqlite_path = get_sqlite_file_path(app_dir);
    let rt = Runtime::new().unwrap();
    rt.block_on(async move {
        println!("prepare required data in tokio spawn");
        let mut conn = SqliteConnection::connect(&sqlite_path).await.unwrap();

        // record current app version
        sqlx::query(
            format!(
                "INSERT INTO {} (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = ?",
                CONFIGURATION_TABLE_NAME
            )
            .as_str(),
        )
        .bind(VERSION_CONFIGURATION_ID)
        .bind(app_version.as_str())
        .bind(app_version.as_str())
        .execute(&mut conn)
        .await
        .unwrap();

        let client_id = Uuid::new_v4();
        // record client id
        sqlx::query(
            format!(
                "INSERT OR IGNORE INTO {} (id, data) VALUES (?, ?)",
                CONFIGURATION_TABLE_NAME
            )
            .as_str(),
        )
        .bind(CLIENT_ID_CONFIGURATION_ID)
        .bind(client_id.to_string())
        .execute(&mut conn)
        .await
        .unwrap();

        conn.close().await.unwrap();
        println!("prepare required data in tokio spawn done");
    });
}

pub fn init_sqlite_file(app_dir: &Path) {
    println!("init sqlite file in rust");
    let sqlite_path = get_sqlite_file_path(app_dir);
    File::create(&sqlite_path).unwrap();
    println!("init sqlite file in rust done");
}

pub fn load_previous_version(path: &Path) -> Result<String, Box<dyn std::error::Error>> {
    let sqlite_path = get_sqlite_file_path(path);
    let rt = Runtime::new().unwrap();
    return Ok(rt.block_on(async move {
        let mut conn = SqliteConnection::connect(&sqlite_path).await.unwrap();
        let data = sqlx::query_as::<_, Configuration>(
            format!("select * from {} where id = ?", CONFIGURATION_TABLE_NAME).as_str(),
        )
        .bind(VERSION_CONFIGURATION_ID)
        .fetch_one(&mut conn)
        .await;
        conn.close().await.unwrap();

        let res = match data {
            Ok(data) => Ok(data.data),
            Err(e) => {
                // if error is RowNotFound, not need to migrate
                match e {
                    // because this field is created in v0.3.0
                    sqlx::Error::RowNotFound => Ok("0.2.0".to_string()),
                    _ => Err(e),
                }
            }
        };

        println!("load previous version in tokio spawn: {:?}", res);
        res
    })?);
}

pub struct V1TV2 {
    app_dir: String,
    resource_dir: String,
}

pub trait Migration {
    fn new(app_dir: String, resource_dir: String) -> Self;
    fn need_to_run(&self, previous_version: &str) -> Result<bool, Box<dyn std::error::Error>>;
    fn migrate(&self);
}

impl Migration for V1TV2 {
    fn new(app_dir: String, resource_dir: String) -> Self {
        V1TV2 {
            app_dir,
            resource_dir,
        }
    }

    fn need_to_run(&self, _previous_version: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let path = Path::new(&self.app_dir);
        let sqlite_path = get_sqlite_file_path(path);
        let rt = Runtime::new().unwrap();
        return Ok(rt.block_on(async move {
            println!("check if from v0.1 to v0.2 in tokio spawn");
            let mut conn = SqliteConnection::connect(&sqlite_path).await.unwrap();
            let table_name =
                sqlx::query("SELECT name FROM sqlite_master WHERE type='table' AND name='assets'")
                    .fetch_one(&mut conn)
                    .await;
            conn.close().await.unwrap();

            // print table name

            let res = match table_name {
                Ok(_) => Ok(true),
                Err(e) => {
                    // if error is RowNotFound, not need to migrate
                    match e {
                        sqlx::Error::RowNotFound => Ok(false),
                        _ => Err(e),
                    }
                }
            };

            println!("check if from v0.1 to v0.2 in tokio spawn done, {:?}", res);

            res
        })?);
    }

    fn migrate(&self) {
        let app_dir = Path::new(&self.app_dir);
        let resource_dir = Path::new(&self.resource_dir);
        println!("migrate from v0.1 to v0.2");
        let sqlite_path = get_sqlite_file_path(app_dir);
        let assets_v2 =
            fs::read_to_string(resource_dir.join("migrations/v01t02/assets_v2_up.sql")).unwrap();
        let cloud_sync =
            fs::read_to_string(resource_dir.join("migrations/v01t02/cloud_sync_up.sql")).unwrap();
        let assets_down =
            fs::read_to_string(resource_dir.join("migrations/v01t02/assets_down.sql")).unwrap();

        let rt = Runtime::new().unwrap();
        rt.block_on(async move {
            println!("migrate from v0.1 to v0.2 in tokio spawn");
            let mut conn = SqliteConnection::connect(&sqlite_path).await.unwrap();
            conn.execute(assets_v2.as_str()).await.unwrap();
            conn.execute(cloud_sync.as_str()).await.unwrap();
            let mut tx = conn.begin().await.unwrap();
            // read all data from assets table and migrate to assets
            // let data : Vec<AssetsV1>= tx.fetch_all::<_, AssetsV1>("select * from assets").await.unwrap();
            let data = sqlx::query_as::<_, AssetsV1>("select * from assets")
            .fetch_all(&mut *tx)
            .await
            .unwrap();
            let data_v2 = self.move_data_from_assets_to_v2(data);
            // insert data_v2 to assets_v2
            for row in data_v2 {
            sqlx::query(format!("insert into {} (uuid, symbol, amount, value, price, createdAt) values (?, ?, ?, ?, ?, ?)", ASSETS_V2_TABLE_NAME).as_str())
            .bind(row.uuid)
                .bind(row.symbol)
                .bind(row.amount)
                .bind(row.value)
                .bind(row.price)
                .bind(row.createdAt)
                .execute(&mut *tx)
                .await
                .unwrap();
            }
            tx.execute(assets_down.as_str()).await.unwrap();
            tx.commit().await.unwrap();
            conn.close().await.unwrap();
            println!("migrate from v0.1 to v0.2 in tokio spawn done");
        });
    }
}

impl V1TV2 {
    fn asset_v1_model_to_v2(
        &self,
        uuid: String,
        created_at: String,
        symbol: Option<String>,
        amount: Option<f64>,
        value: Option<f64>,
    ) -> Option<AssetsV2> {
        if None == symbol || None == amount || None == value {
            return None;
        }

        let symbol = symbol.unwrap();
        let amount = amount.unwrap();
        let value = value.unwrap();

        if amount == 0.0 || value == 0.0 {
            return None;
        }

        let data = AssetsV2 {
            id: 0,
            uuid,
            symbol,
            amount,
            value,
            price: value / amount,
            createdAt: created_at,
            wallet: None,
        };

        return Some(data);
    }

    fn move_data_from_assets_to_v2(&self, data: Vec<AssetsV1>) -> Vec<AssetsV2> {
        let mut v2_data = Vec::new();
        for row in data {
            let mut v2_data_item = Vec::<AssetsV2>::new();
            let uuid = Uuid::new_v4();

            let ca = row.createdAt;

            let data1 = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.top01,
                row.amount01,
                row.value01,
            );
            if let Some(data1) = data1 {
                v2_data_item.push(data1);
            }

            let data2 = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.top02,
                row.amount02,
                row.value02,
            );
            if let Some(data2) = data2 {
                v2_data_item.push(data2);
            }

            let data3 = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.top03,
                row.amount03,
                row.value03,
            );
            if let Some(data3) = data3 {
                v2_data_item.push(data3);
            }

            let data4 = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.top04,
                row.amount04,
                row.value04,
            );
            if let Some(data4) = data4 {
                v2_data_item.push(data4);
            }

            let data5 = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.top05,
                row.amount05,
                row.value05,
            );
            if let Some(data5) = data5 {
                v2_data_item.push(data5);
            }

            let data6 = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.top06,
                row.amount06,
                row.value06,
            );
            if let Some(data6) = data6 {
                v2_data_item.push(data6);
            }

            let data7 = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.top07,
                row.amount07,
                row.value07,
            );
            if let Some(data7) = data7 {
                v2_data_item.push(data7);
            }

            let data8 = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.top08,
                row.amount08,
                row.value08,
            );
            if let Some(data8) = data8 {
                v2_data_item.push(data8);
            }

            let data9 = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.top09,
                row.amount09,
                row.value09,
            );
            if let Some(data9) = data9 {
                v2_data_item.push(data9);
            }

            let data10 = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.top10,
                row.amount10,
                row.value10,
            );
            if let Some(data10) = data10 {
                v2_data_item.push(data10);
            }

            // for each v2_data_item, if found symbol is USDT or USDC, then add to data_others

            let mut found = false;

            let data_others = self.asset_v1_model_to_v2(
                uuid.to_string(),
                ca.clone(),
                row.topOthers,
                row.valueOthers,
                row.valueOthers,
            );
            if let Some(data_others) = data_others {
                for item in &mut v2_data_item {
                    if item.symbol == "USDT" || item.symbol == "USDC" {
                        item.amount += data_others.amount;
                        item.value += data_others.value;
                        found = true;
                        break;
                    }
                }

                if !found {
                    v2_data.push(AssetsV2 {
                        id: 0,
                        uuid: uuid.to_string(),
                        symbol: "USDT".to_string(),
                        amount: data_others.amount,
                        value: data_others.value,
                        price: 1.0,
                        createdAt: ca.clone(),
                        wallet: None,
                    });
                }
            }

            v2_data.extend(v2_data_item);
        }
        v2_data
    }
}

pub struct V2TV3 {
    app_dir: String,
    resource_dir: String,
}

impl Migration for V2TV3 {
    fn new(app_dir: String, resource_dir: String) -> Self {
        V2TV3 {
            app_dir,
            resource_dir,
        }
    }

    fn need_to_run(&self, previous_version: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let res = compare_to(previous_version, "0.3.0", Cmp::Lt).unwrap();
        println!("check if from v0.2 to v0.3 in rust, {:?}", res);
        return Ok(res);
    }

    fn migrate(&self) {
        let app_dir = Path::new(&self.app_dir);
        let resource_dir = Path::new(&self.resource_dir);
        println!("migrate from v0.2 to v0.3");
        let sqlite_path = get_sqlite_file_path(app_dir);
        let assets_v2 =
            fs::read_to_string(resource_dir.join("migrations/v02t03/assets_v2_migrate.sql"))
                .unwrap();

        // let new_version: &str = "v0.3";

        let rt = Runtime::new().unwrap();
        rt.block_on(async move {
            println!("migrate from v0.2 to v0.3 in tokio spawn");
            let mut conn = SqliteConnection::connect(&sqlite_path).await.unwrap();
            conn.execute(assets_v2.as_str()).await.unwrap();
            conn.close().await.unwrap();
            println!("migrate from v0.2 to v0.3 in tokio spawn done");
        });
    }
}

pub struct V3TV4 {
    app_dir: String,
    resource_dir: String,
}

impl Migration for V3TV4 {
    fn new(app_dir: String, resource_dir: String) -> Self {
        V3TV4 {
            app_dir,
            resource_dir,
        }
    }

    fn need_to_run(&self, previous_version: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let res = compare_to(previous_version, "0.4.0", Cmp::Lt).unwrap();
        println!("check if from v0.3 to v0.4 in rust, {:?}", res);
        return Ok(res);
    }

    fn migrate(&self) {
        let app_dir = Path::new(&self.app_dir);
        let resource_dir = Path::new(&self.resource_dir);
        println!("migrate from v0.3 to v0.4");
        let sqlite_path = get_sqlite_file_path(app_dir);
        let asset_prices =
            fs::read_to_string(resource_dir.join("migrations/v03t04/asset_prices_up.sql")).unwrap();

        let rt = Runtime::new().unwrap();
        rt.block_on(async move {
            println!("migrate from v0.3 to v0.4 in tokio spawn");
            let mut conn = SqliteConnection::connect(&sqlite_path).await.unwrap();
            conn.execute(asset_prices.as_str()).await.unwrap();
            conn.close().await.unwrap();
            println!("migrate from v0.3 to v0.4 in tokio spawn done");
        });
    }
}

// todo: enable it when v0.5 is ready
pub struct V4TV5 {
    app_dir: String,
    resource_dir: String,
}

impl Migration for V4TV5 {
    fn new(app_dir: String, resource_dir: String) -> Self {
        V4TV5 {
            app_dir,
            resource_dir,
        }
    }

    fn need_to_run(&self, previous_version: &str) -> Result<bool, Box<dyn std::error::Error>> {
        let res = compare_to(previous_version, "0.5.0", Cmp::Lt).unwrap();
        println!("check if from v0.4 to v0.5 in rust, {:?}", res);
        return Ok(res);
    }

    fn migrate(&self) {
        let app_dir = Path::new(&self.app_dir);
        let resource_dir = Path::new(&self.resource_dir);
        println!("migrate from v0.4 to v0.5");
        let sqlite_path = get_sqlite_file_path(app_dir);
        let cloud_sync_down =
            fs::read_to_string(resource_dir.join("migrations/v04t05/cloud_sync_down.sql")).unwrap();
        let assets_v2_uniq_idx_up =
            fs::read_to_string(resource_dir.join("migrations/v04t05/assets_v2_idx_up.sql"))
                .unwrap();
        let transactions_up =
            fs::read_to_string(resource_dir.join("migrations/v04t05/transactions_up.sql")).unwrap();

        // todo: down asset_prices table in the future

        let rt = Runtime::new().unwrap();
        rt.block_on(async move {
            println!("migrate from v0.4 to v0.5 in tokio spawn");
            let mut conn = SqliteConnection::connect(&sqlite_path).await.unwrap();
            conn.execute(cloud_sync_down.as_str()).await.unwrap();
            conn.execute(assets_v2_uniq_idx_up.as_str()).await.unwrap();
            conn.execute(transactions_up.as_str()).await.unwrap();

            let mut tx = conn.begin().await.unwrap();
            // read all data from assets table and migrate to assets
            let assets =
                sqlx::query_as::<_, AssetsV2>("select * from assets_v2 order by createdAt ASC")
                    .fetch_all(&mut *tx)
                    .await
                    .unwrap();
            let asset_prices = sqlx::query_as::<_, AssetPrice>("select * from asset_prices")
                .fetch_all(&mut *tx)
                .await
                .unwrap();
            let transaction_data =
                self.move_data_from_assets_and_assets_price_to_transactions(assets, asset_prices);
            // insert transaction data to transaction table
            for row in transaction_data {
            sqlx::query(format!("insert into {} (uuid, assetID, wallet, symbol, amount, price, txnType, txnCreatedAt, createdAt) values (?, ?, ?, ?, ?, ?, ?, ?, ?)", TRANSACTION_TABLE_NAME).as_str())
            .bind(row.uuid)
                .bind(row.assetID)
                .bind(row.wallet)
                .bind(row.symbol)
                .bind(row.amount)
                .bind(row.price)
                .bind(row.txnType)
                .bind(row.txnCreatedAt)
                .bind(row.createdAt)
                .execute(&mut *tx)
                .await
                .unwrap();
            }
            tx.commit().await.unwrap();
            conn.close().await.unwrap();
            println!("migrate from v0.4 to v0.5 in tokio spawn done");
        });
    }
}

impl V4TV5 {
    fn move_data_from_assets_and_assets_price_to_transactions(
        &self,
        assets: Vec<AssetsV2>,
        asset_prices: Vec<AssetPrice>,
    ) -> Vec<Transaction> {
        if assets.len() == 0 {
            return Vec::new();
        }
        let mut asset_prices_map = HashMap::<i32, f64>::new();
        for asset_price in asset_prices {
            asset_prices_map.insert(asset_price.assetID, asset_price.price);
        }

        // get all uuids of assets
        let mut uuids = IndexSet::<String>::new();
        // sort assets by createdAt asc
        for asset in &assets {
            uuids.insert(asset.uuid.clone());
        }

        let mut last_grouped_assets = Vec::<AssetsV2>::new();
        let mut transactions = Vec::<Transaction>::new();

        for uuid in uuids {
            let grouped_assets = assets
                .iter()
                .filter(|asset| asset.uuid == uuid)
                .cloned()
                .collect::<Vec<AssetsV2>>();

            // calculate transaction by grouped_assets and last_grouped_assets
            for asset in &grouped_assets {
                let mut last_asset: Option<&AssetsV2> = None;
                // find last asset by wallet and symbol
                for last_grouped_asset in &last_grouped_assets {
                    if last_grouped_asset.wallet == asset.wallet
                        && last_grouped_asset.symbol == asset.symbol
                    {
                        last_asset = Some(last_grouped_asset);
                        break;
                    }
                }

                let amount: f64;
                if let Some(last_asset) = last_asset {
                    amount = asset.amount - last_asset.amount;
                } else {
                    amount = asset.amount;
                }
                let price = asset_prices_map.get(&asset.id).unwrap_or(&asset.price);
                if amount == 0.0 {
                    // if asset.symbol == "BTC" {
                    //     println!("uuid: {}, asset: {:?}", uuid, asset);
                    // }
                    continue;
                }
                let mut txn_type = "buy";
                if amount > 0.0 {
                    if *price == 0.0 {
                        txn_type = "deposit";
                    }
                } else {
                    if *price != 0.0 {
                        txn_type = "sell";
                    } else {
                        txn_type = "withdraw";
                    }
                }
                let transaction = Transaction {
                    id: 0,
                    uuid: uuid.clone(),
                    assetID: asset.id,
                    wallet: asset.wallet.clone().unwrap_or("".to_string()),
                    symbol: asset.symbol.clone(),
                    amount: amount.abs(),
                    price: *price,
                    txnType: txn_type.to_string(),
                    txnCreatedAt: asset.createdAt.clone(),
                    createdAt: asset.createdAt.clone(),
                };
                transactions.push(transaction);
            }

            for last_grouped_asset in &last_grouped_assets {
                let mut found = false;
                for asset in &grouped_assets {
                    if last_grouped_asset.wallet == asset.wallet
                        && last_grouped_asset.symbol == asset.symbol
                    {
                        found = true;
                        break;
                    }
                }

                if !found {
                    let price = asset_prices_map
                        .get(&last_grouped_asset.id)
                        .unwrap_or(&last_grouped_asset.price);
                    let mut txn_type = "sell";
                    if price == &0.0 {
                        txn_type = "withdraw";
                    }
                    if last_grouped_asset.amount == 0.0 {
                        continue;
                    }
                    let transaction = Transaction {
                        id: 0,
                        uuid: uuid.clone(),
                        assetID: last_grouped_asset.id,
                        wallet: last_grouped_asset.wallet.clone().unwrap_or("".to_string()),
                        symbol: last_grouped_asset.symbol.clone(),
                        amount: last_grouped_asset.amount,
                        price: *price,
                        txnType: txn_type.to_string(),
                        txnCreatedAt: last_grouped_asset.createdAt.clone(),
                        createdAt: last_grouped_asset.createdAt.clone(),
                    };
                    transactions.push(transaction);
                }
            }

            last_grouped_assets = grouped_assets.clone();
        }

        return transactions;
    }
}

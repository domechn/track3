use std::{
    fs::{self, File},
    path::Path,
};

use sqlx::{Connection, Executor, SqliteConnection};
use tokio::runtime::Runtime;
use uuid::Uuid;

use crate::types::{AssetsV1, AssetsV2};

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

pub fn init_resources(app_dir: &Path, resource_dir: &Path) {
    println!("init resources in rust");
    let sqlite_path = get_sqlite_file_path(app_dir);
    File::create(&sqlite_path).unwrap();

    let configuration =
        fs::read_to_string(resource_dir.join("migrations/init/configuration_up.sql")).unwrap();
    let assets_v2 =
        fs::read_to_string(resource_dir.join("migrations/init/assets_v2_up.sql")).unwrap();

    let rt = Runtime::new().unwrap();
    rt.block_on(async move {
        println!("init resources in tokio spawn");
        let mut conn = SqliteConnection::connect(&sqlite_path).await.unwrap();
        conn.execute(configuration.as_str()).await.unwrap();
        conn.execute(assets_v2.as_str()).await.unwrap();
        conn.close().await.unwrap();
        println!("init resources in tokio spawn done");
    });
}

pub fn is_from_v01_to_v02(path: &Path) -> Result<bool, Box<dyn std::error::Error>> {
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
                    sqlx::Error::RowNotFound => {
                        Ok(false)
                    }
                    _ => {
                        Err(e)
                    }
                }
            }
        };

        println!("check if from v0.1 to v0.2 in tokio spawn done, {:?}", res);

        res
    })?);
}

pub fn migrate_from_v01_to_v02(app_dir: &Path, resource_dir: &Path) {
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
		.fetch_all(&mut tx)
		.await
		.unwrap();
    
	    let data_v2 = move_data_from_assets_to_v2(data);
    
	    // insert data_v2 to assets_v2
	    for row in data_v2 {
		sqlx::query("insert into assets_v2 (uuid, symbol, amount, value, price, createdAt) values (?, ?, ?, ?, ?, ?)")
		.bind(row.uuid)
		    .bind(row.symbol)
		    .bind(row.amount)
		    .bind(row.value)
		    .bind(row.price)
		    .bind(row.created_at)
		    .execute(&mut tx)
		    .await
		    .unwrap();
	    }
    
    
	    tx.execute(assets_down.as_str()).await.unwrap();
    
	    tx.commit().await.unwrap();
	    conn.close().await.unwrap();
	    println!("migrate from v0.1 to v0.2 in tokio spawn done");
	});
}

fn asset_v1_model_to_v2(
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
        created_at,
    };

    return Some(data);
}

fn move_data_from_assets_to_v2(data: Vec<AssetsV1>) -> Vec<AssetsV2> {
    let mut v2_data = Vec::new();
    for row in data {
        let mut v2_data_item = Vec::<AssetsV2>::new();
	let uuid = Uuid::new_v4();

        let ca = row.createdAt;

        let data1 = asset_v1_model_to_v2(uuid.to_string(), ca.clone(), row.top01, row.amount01, row.value01);
        if let Some(data1) = data1 {
            v2_data_item.push(data1);
        }

        let data2 = asset_v1_model_to_v2(uuid.to_string(),ca.clone(), row.top02, row.amount02, row.value02);
        if let Some(data2) = data2 {
            v2_data_item.push(data2);
        }

        let data3 = asset_v1_model_to_v2(uuid.to_string(),ca.clone(), row.top03, row.amount03, row.value03);
        if let Some(data3) = data3 {
            v2_data_item.push(data3);
        }

        let data4 = asset_v1_model_to_v2(uuid.to_string(),ca.clone(), row.top04, row.amount04, row.value04);
        if let Some(data4) = data4 {
            v2_data_item.push(data4);
        }

        let data5 = asset_v1_model_to_v2(uuid.to_string(),ca.clone(), row.top05, row.amount05, row.value05);
        if let Some(data5) = data5 {
            v2_data_item.push(data5);
        }

        let data6 = asset_v1_model_to_v2(uuid.to_string(),ca.clone(), row.top06, row.amount06, row.value06);
        if let Some(data6) = data6 {
            v2_data_item.push(data6);
        }

        let data7 = asset_v1_model_to_v2(uuid.to_string(),ca.clone(), row.top07, row.amount07, row.value07);
        if let Some(data7) = data7 {
            v2_data_item.push(data7);
        }

        let data8 = asset_v1_model_to_v2(uuid.to_string(),ca.clone(), row.top08, row.amount08, row.value08);
        if let Some(data8) = data8 {
            v2_data_item.push(data8);
        }

        let data9 = asset_v1_model_to_v2(uuid.to_string(),ca.clone(), row.top09, row.amount09, row.value09);
        if let Some(data9) = data9 {
            v2_data_item.push(data9);
        }

        let data10 = asset_v1_model_to_v2(uuid.to_string(),ca.clone(), row.top10, row.amount10, row.value10);
        if let Some(data10) = data10 {
            v2_data_item.push(data10);
        }

        // for each v2_data_item, if found symbol is USDT or USDC, then add to data_others

        let mut found = false;

        let data_others =
            asset_v1_model_to_v2(uuid.to_string(),ca.clone(), row.topOthers, row.valueOthers, row.valueOthers);
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
		    uuid:uuid.to_string(),
                    symbol: "USDT".to_string(),
                    amount: data_others.amount,
                    value: data_others.value,
                    price: 1.0,
                    created_at: ca.clone(),
                });
            }
        }

        v2_data.extend(v2_data_item);
    }
    v2_data
}

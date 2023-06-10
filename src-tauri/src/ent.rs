use magic_crypt::{new_magic_crypt, MagicCrypt256, MagicCryptTrait};
use rand::Rng;

pub struct Ent {
    salt: String,
    ent_prefix: String,

    key: Option<String>,
}

impl Ent {
    pub fn new() -> Self {
        Self {
            salt: String::from_utf8(vec![
                46, 51, 115, 116, 98, 101, 105, 64, 104, 107, 99, 97, 44, 116, 114, 33, 35,
            ])
            .unwrap(),
            ent_prefix: String::from("!ent:"),
            key: None,
        }
    }

    pub fn set_key(&mut self, key: String) {
        self.key = Some(key);
    }

    fn get_key(&self) -> String {
        if let Some(key) = &self.key {
            return key.clone();
        }
        return "#t.3eis@hck,btr!a".to_string();
    }

    fn get_magic_crypt(&self) -> MagicCrypt256 {
        let mc = new_magic_crypt!(&self.get_key(), 256);
        return mc;
    }

    fn get_rand_str(&self, size: i32) -> String {
        let mut rng = rand::thread_rng();
        let chars: Vec<char> = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            .chars()
            .collect();
        let string: String = (0..size).map(|_| rng.choose(&chars).unwrap()).collect();
        string
    }

    pub fn encrypt(&self, data: String) -> Result<String, Box<dyn std::error::Error>> {
        let iv = self.get_rand_str(16);

        // push iv as string to the beginning of data
        let mut iv_data = iv.clone();
        iv_data.push_str(data.as_str());

        // add salt to data
        let mut data_with_salt = iv_data.clone();
        data_with_salt.push_str(self.salt.as_str());

        let mc = self.get_magic_crypt();

        let encrypted = mc.encrypt_str_to_base64(&data_with_salt);

        // add prefix to the beginning of encrypted data
        let mut res = self.ent_prefix.clone();
        // push iv to res
        res.push_str(iv.as_str());

        res.push_str(encrypted.as_str());

        Ok(res)
    }

    pub fn decrypt(&self, encrypted_data: String) -> Result<String, Box<dyn std::error::Error>> {
        // check data if is ent
        if !self.is_ent(&encrypted_data) {
            return Err("not ent".into());
        }

        // remove prefix
        let mut data = encrypted_data.clone();
        data.replace_range(0..self.ent_prefix.len(), "");

        // remove first 16 string from data
        let iv: [u8; 16] = data.as_bytes()[0..16].try_into().unwrap();
        // remove iv from data
        let mut data = data.clone();
        data.replace_range(0..16, "");

        // decrypt

        let mc = self.get_magic_crypt();
        let decrypted = mc.decrypt_base64_to_string(&data)?;

        // check iv in decrypted beginning

        let decrypted_iv: [u8; 16] = decrypted.as_bytes()[0..16].try_into().unwrap();
        if decrypted_iv != iv {
            return Err("iv not match".into());
        }

        // remove iv from decrypted
        let mut decrypted = decrypted.clone();
        decrypted.replace_range(0..16, "");

        // check salt in decrypted end
        let salt_len = self.salt.len();
        let salt = decrypted
            .chars()
            .rev()
            .take(salt_len)
            .collect::<String>()
            .chars()
            .rev()
            .collect::<String>();
        if salt != self.salt {
            return Err("salt not match".into());
        }

        // remove salt from decrypted
        let mut decrypted = decrypted.clone();
        decrypted.replace_range(decrypted.len() - salt_len..decrypted.len(), "");

        return Ok(decrypted);
    }

    fn is_ent(&self, data: &str) -> bool {
        data.starts_with(&self.ent_prefix)
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_encrypt_and_decrypt() {
        use super::Ent;
        let ent = Ent::new();
        let encrypted = ent.encrypt("hello".to_string()).unwrap();
        assert_eq!(ent.is_ent(encrypted.as_str()), true);

        let decrypted = ent.decrypt(encrypted).unwrap();
        assert_eq!(decrypted, "hello".to_string());
    }

    #[test]
    fn test_encrypt_and_decrypt_large_string() {
        use super::Ent;
        let ent = Ent::new();
        let encrypted = ent.encrypt("hello".repeat(10000).to_string()).unwrap();
        assert_eq!(ent.is_ent(encrypted.as_str()), true);

        let decrypted = ent.decrypt(encrypted).unwrap();
        assert_eq!(decrypted, "hello".repeat(10000).to_string());
    }
}

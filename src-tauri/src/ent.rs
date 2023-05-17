use crypto::buffer::{BufferResult, ReadBuffer, WriteBuffer};
use crypto::{aes, blockmodes, buffer, symmetriccipher};
use rand::{OsRng, Rng};

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

    fn get_key(&self) -> &[u8] {
        if let Some(key) = &self.key {
            return key.as_bytes();
        }
        return "#t.3eis@hck,btr!a".as_bytes();
    }

    pub fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>, symmetriccipher::SymmetricCipherError> {
        let mut iv: [u8; 16] = [0; 16];
        let mut rng = OsRng::new().ok().unwrap();
        rng.fill_bytes(&mut iv);

        let key = self.get_key();
        
        // combine data and salt

        let mut data_with_salt = Vec::<u8>::new();
        data_with_salt.extend(data);
        data_with_salt.extend(self.salt.as_bytes());

        let mut encryptor =
            aes::cbc_encryptor(aes::KeySize::KeySize256, key, &iv, blockmodes::PkcsPadding);

        let mut final_result = Vec::<u8>::new();
        let mut read_buffer = buffer::RefReadBuffer::new(data_with_salt.as_slice());
        // let mut buffer = vec![];
        let mut buffer = [0; 4096];
        let mut write_buffer = buffer::RefWriteBuffer::new(&mut buffer);

        loop {
            let result = encryptor.encrypt(&mut read_buffer, &mut write_buffer, true)?;

            final_result.extend(
                write_buffer
                    .take_read_buffer()
                    .take_remaining()
                    .iter()
                    .map(|&i| i),
            );

            match result {
                BufferResult::BufferUnderflow => break,
                BufferResult::BufferOverflow => {}
            }
        }

        let mut final_result_with_iv = Vec::<u8>::new();
        final_result_with_iv.extend(self.ent_prefix.as_bytes());
        final_result_with_iv.extend(&iv);
        final_result_with_iv.extend(&final_result);

        Ok(final_result_with_iv)
    }

    pub fn decrypt(
        &self,
        encrypted_data: &[u8],
    ) -> Result<Vec<u8>, symmetriccipher::SymmetricCipherError> {
        if !self.is_ent(encrypted_data) {
            return Err(symmetriccipher::SymmetricCipherError::InvalidPadding);
        }
        // remove ent prefix
        let encrypted_data = &encrypted_data[self.ent_prefix.len()..];
        // if ed size < 16, it's not encrypted, raise error
        if encrypted_data.len() < 16 {
            return Err(symmetriccipher::SymmetricCipherError::InvalidLength);
        }

        // iv is the first 16 bytes
        let iv = &encrypted_data[0..16];

        // remove iv from encrypted_data
        let encrypted_data = &encrypted_data[16..];

        let key = self.get_key();

        let mut decryptor =
            aes::cbc_decryptor(aes::KeySize::KeySize256, key, iv, blockmodes::PkcsPadding);

        let mut final_result = Vec::<u8>::new();
        let mut read_buffer = buffer::RefReadBuffer::new(encrypted_data);
        // let mut buffer = vec![];
        let mut buffer = [0; 4096];
        let mut write_buffer = buffer::RefWriteBuffer::new(&mut buffer);

        loop {
            let result = decryptor.decrypt(&mut read_buffer, &mut write_buffer, true)?;
            final_result.extend(
                write_buffer
                    .take_read_buffer()
                    .take_remaining()
                    .iter()
                    .map(|&i| i),
            );
            match result {
                BufferResult::BufferUnderflow => break,
                BufferResult::BufferOverflow => {}
            }
        }

        // remove salt
        let salt_len = self.salt.len();
        final_result.truncate(final_result.len() - salt_len);

        Ok(final_result)
    }

    fn is_ent(&self, data: &[u8]) -> bool {
        // data.starts_with(&self.ent_prefix)

        let prefix = self.ent_prefix.as_bytes();
        let prefix_len = prefix.len();
        if data.len() < prefix_len {
            return false;
        }

        for i in 0..prefix_len {
            if data[i] != prefix[i] {
                return false;
            }
        }
        return true;
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_encrypt_and_decrypt() {
        use super::Ent;
        let ent = Ent::new();
        let encrypted = ent.encrypt("hello".as_bytes()).unwrap();
        assert_eq!(ent.is_ent(&encrypted), true);

        let decrypted = ent.decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, "hello".as_bytes());
    }

    #[test]
    fn test_encrypt_and_decrypt_large_string() {
        use super::Ent;
        let ent = Ent::new();
        let encrypted = ent.encrypt("hello".repeat(10000).as_bytes()).unwrap();
        assert_eq!(ent.is_ent(&encrypted), true);

        let decrypted = ent.decrypt(&encrypted).unwrap();
        assert_eq!(decrypted, "hello".repeat(10000).as_bytes());
    }
}
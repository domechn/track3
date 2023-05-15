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

    pub fn encrypt(&self, data: String) -> Result<String, symmetriccipher::SymmetricCipherError> {
        let mut iv: [u8; 16] = [0; 16];
        let mut rng = OsRng::new().ok().unwrap();
        rng.fill_bytes(&mut iv);

        let key = self.get_key();

        // combine data and salt

        let mut data_with_salt = Vec::<u8>::new();
        data_with_salt.extend(data.as_bytes());
        data_with_salt.extend(self.salt.as_bytes());

        let mut encryptor =
            aes::cbc_encryptor(aes::KeySize::KeySize256, key, &iv, blockmodes::PkcsPadding);

        let mut final_result = Vec::<u8>::new();
        let mut read_buffer = buffer::RefReadBuffer::new(data_with_salt.as_slice());
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

        Ok(String::from_utf8_lossy(&final_result).to_string())
    }

    pub fn decrypt(
        &self,
        encrypted_data: String,
    ) -> Result<String, symmetriccipher::SymmetricCipherError> {
        if self.is_ent(encrypted_data.as_str()) {
            return Ok(encrypted_data.clone());
        }
        let ed = encrypted_data.as_bytes();
        // if ed size < 16, it's not encrypted, raise error
        if ed.len() < 16 {
            return Err(symmetriccipher::SymmetricCipherError::InvalidLength);
        }

        // iv is the first 16 bytes
        let iv = &ed[0..16];

        let key = self.get_key();

        let mut decryptor =
            aes::cbc_decryptor(aes::KeySize::KeySize256, key, iv, blockmodes::PkcsPadding);

        let mut final_result = Vec::<u8>::new();
        let mut read_buffer = buffer::RefReadBuffer::new(encrypted_data.as_bytes());
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

        Ok(String::from_utf8(final_result).unwrap())
    }

    fn is_ent(&self, data: &str) -> bool {
        data.starts_with(&self.ent_prefix)
    }
}

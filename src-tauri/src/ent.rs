use std::sync::OnceLock;
use aes::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
use aes::Aes256;
use aes_gcm_siv::aead::{Aead, KeyInit};
use aes_gcm_siv::{Aes256GcmSiv, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use sha2::{Digest as _, Sha256};
use uuid::Uuid;

const ENT_V2_PREFIX: &str = "!ent:v2:";
const LEGACY_IV_LEN: usize = 16;
const NONCE_LEN: usize = 12;

type LegacyAes256CbcDec = cbc::Decryptor<Aes256>;

pub struct Ent {
    salt: String,
    ent_prefix: String,
    key: OnceLock<String>,
}

impl Ent {
    pub fn new() -> Self {
        Self {
            salt: String::from_utf8(vec![
                46, 51, 115, 116, 98, 101, 105, 64, 104, 107, 99, 97, 44, 116, 114, 33, 35,
            ])
            .unwrap(),
            ent_prefix: String::from("!ent:"),
            key: OnceLock::new(),
        }
    }

    /// Set the encryption key. Can only be called once; returns an error if
    /// already initialized. Must be called before any encrypt/decrypt operation.
    pub fn set_key(&self, key: String) -> Result<(), String> {
        self.key.set(key).map_err(|_| "encryption key already initialized".to_string())
    }

    fn get_key(&self) -> Result<&str, Box<dyn std::error::Error>> {
        self.key.get().map(String::as_str).ok_or_else(|| {
            "encryption key not set at startup. This is a critical bug — restart the application.".into()
        })
    }

    fn get_key_hash(&self) -> Result<[u8; 32], Box<dyn std::error::Error>> {
        let key = self.get_key()?;
        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        Ok(hasher.finalize().into())
    }

    fn get_nonce_bytes(&self) -> [u8; NONCE_LEN] {
        let bytes = Uuid::new_v4().into_bytes();
        bytes[..NONCE_LEN].try_into().unwrap()
    }

    pub fn encrypt(&self, data: String) -> Result<String, Box<dyn std::error::Error>> {
        let key = self.get_key_hash()?;
        let cipher = Aes256GcmSiv::new_from_slice(&key)?;
        let nonce = self.get_nonce_bytes();
        let encrypted = cipher
            .encrypt(Nonce::from_slice(&nonce), data.as_bytes())
            .map_err(|_| "encrypt error")?;

        let mut payload = Vec::with_capacity(NONCE_LEN + encrypted.len());
        payload.extend_from_slice(&nonce);
        payload.extend_from_slice(&encrypted);

        Ok(format!("{ENT_V2_PREFIX}{}", STANDARD.encode(payload)))
    }

    fn decrypt_v2(&self, encrypted_data: &str) -> Result<String, Box<dyn std::error::Error>> {
        let encoded = encrypted_data
            .strip_prefix(ENT_V2_PREFIX)
            .ok_or("not ent")?;
        let payload = STANDARD.decode(encoded)?;
        if payload.len() <= NONCE_LEN {
            return Err("invalid encrypted payload".into());
        }

        let (nonce, ciphertext) = payload.split_at(NONCE_LEN);
        let key = self.get_key_hash()?;
        let cipher = Aes256GcmSiv::new_from_slice(&key)?;
        let decrypted = cipher
            .decrypt(Nonce::from_slice(nonce), ciphertext)
            .map_err(|_| "decrypt error")?;

        Ok(String::from_utf8(decrypted)?)
    }

    /// Legacy AES-256-CBC decryption path (pre-v0.5.0 format with zero IV).
    /// Only active when the payload starts with `!ent:` but not `!ent:v2:`.
    /// This path is inherently weaker than the v2 AES-GCM-SIV path.
    /// TODO: migrate all legacy payloads to v2 format on read via the frontend.
    fn decrypt_legacy(&self, encrypted_data: String) -> Result<String, Box<dyn std::error::Error>> {
        if !self.is_ent(&encrypted_data) {
            return Err("not ent".into());
        }

        let data = encrypted_data
            .strip_prefix(&self.ent_prefix)
            .ok_or("not ent")?;

        if data.len() <= LEGACY_IV_LEN {
            return Err("invalid legacy encrypted payload".into());
        }

        let iv: [u8; LEGACY_IV_LEN] = data.as_bytes()[..LEGACY_IV_LEN].try_into()?;
        let mut encrypted = STANDARD.decode(&data[LEGACY_IV_LEN..])?;
        let zero_iv = [0u8; LEGACY_IV_LEN];
        let key = self.get_key_hash()?;
        let cipher = LegacyAes256CbcDec::new_from_slices(&key, &zero_iv)?;
        let decrypted = cipher
            .decrypt_padded_mut::<Pkcs7>(&mut encrypted)
            .map_err(|_| "legacy decrypt error")?;
        let mut decrypted = String::from_utf8(decrypted.to_vec())?;

        let decrypted_iv: [u8; LEGACY_IV_LEN] = decrypted.as_bytes()[..LEGACY_IV_LEN].try_into()?;
        if decrypted_iv != iv {
            return Err("iv not match".into());
        }

        decrypted.replace_range(0..LEGACY_IV_LEN, "");

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

        decrypted.replace_range(decrypted.len() - salt_len..decrypted.len(), "");

        Ok(decrypted)
    }

    pub fn decrypt(&self, encrypted_data: String) -> Result<String, Box<dyn std::error::Error>> {
        if encrypted_data.starts_with(ENT_V2_PREFIX) {
            return self.decrypt_v2(&encrypted_data);
        }

        // Legacy backward-compatibility path for data encrypted before AES-GCM-SIV migration
        self.decrypt_legacy(encrypted_data)
    }

    fn is_ent(&self, data: &str) -> bool {
        data.starts_with(&self.ent_prefix)
    }
}

#[cfg(test)]
mod tests {
    use aes::cipher::{block_padding::Pkcs7, BlockEncryptMut, KeyIvInit};
    use aes::Aes256;
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    use sha2::{Digest as _, Sha256};

    type LegacyAes256CbcEnc = cbc::Encryptor<Aes256>;

    const TEST_KEY: &str = "test-key-for-unit-tests";

    fn make_ent() -> super::Ent {
        let ent = super::Ent::new();
        ent.set_key(TEST_KEY.to_string()).unwrap();
        ent
    }

    fn legacy_encrypt(ent: &super::Ent, data: &str) -> String {
        let iv = "1234567890abcdef";
        let mut plaintext = String::from(iv);
        plaintext.push_str(data);
        plaintext.push_str(ent.salt.as_str());

        let mut key_hasher = Sha256::new();
        key_hasher.update(TEST_KEY.as_bytes());
        let key: [u8; 32] = key_hasher.finalize().into();

        let cipher = LegacyAes256CbcEnc::new_from_slices(&key, &[0u8; super::LEGACY_IV_LEN]).unwrap();
        let mut buffer = plaintext.into_bytes();
        let message_len = buffer.len();
        let padded_len = ((message_len / super::LEGACY_IV_LEN) + 1) * super::LEGACY_IV_LEN;
        buffer.resize(padded_len, 0);
        let encrypted = cipher
            .encrypt_padded_mut::<Pkcs7>(&mut buffer, message_len)
            .unwrap();

        format!("{}{}{}", ent.ent_prefix, iv, STANDARD.encode(encrypted))
    }

    #[test]
    fn test_encrypt_and_decrypt() {
        let ent = make_ent();
        let encrypted = ent.encrypt("hello".to_string()).unwrap();
        assert_eq!(ent.is_ent(encrypted.as_str()), true);
        assert!(encrypted.starts_with("!ent:v2:"));

        let decrypted = ent.decrypt(encrypted).unwrap();
        assert_eq!(decrypted, "hello".to_string());
    }

    #[test]
    fn test_encrypt_and_decrypt_large_string() {
        let ent = make_ent();
        let encrypted = ent.encrypt("hello".repeat(10000).to_string()).unwrap();
        assert_eq!(ent.is_ent(encrypted.as_str()), true);

        let decrypted = ent.decrypt(encrypted).unwrap();
        assert_eq!(decrypted, "hello".repeat(10000).to_string());
    }

    #[test]
    fn test_decrypt_legacy_payload() {
        let ent = make_ent();
        let encrypted = legacy_encrypt(&ent, "hello");

        let decrypted = ent.decrypt(encrypted).unwrap();

        assert_eq!(decrypted, "hello".to_string());
    }
}

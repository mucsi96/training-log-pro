use aes_gcm::{
    Aes256Gcm, KeyInit, Nonce,
    aead::{Aead, Generate},
};
use base64::{Engine, engine::general_purpose::STANDARD};

#[derive(Clone)]
pub struct Cipher(Aes256Gcm);
impl Cipher {
    pub fn new(key: &str) -> anyhow::Result<Self> {
        let key = STANDARD.decode(key)?;
        anyhow::ensure!(
            key.len() == 32,
            "token-encryption-key must contain 32 bytes"
        );
        Ok(Self(
            Aes256Gcm::new_from_slice(&key).map_err(|_| anyhow::anyhow!("Invalid AES key"))?,
        ))
    }
    /// Compatible with Java's Base64(12-byte IV || ciphertext || 16-byte tag).
    pub fn encrypt(&self, text: &str) -> anyhow::Result<String> {
        let nonce = Nonce::generate();
        let ciphertext = self
            .0
            .encrypt(&nonce, text.as_bytes())
            .map_err(|_| anyhow::anyhow!("Encryption failed"))?;
        Ok(STANDARD.encode([&nonce[..], &ciphertext].concat()))
    }
    pub fn decrypt(&self, text: &str) -> anyhow::Result<String> {
        let bytes = STANDARD.decode(text)?;
        anyhow::ensure!(bytes.len() >= 28, "Invalid encrypted token length");
        let nonce: [u8; 12] = bytes[..12].try_into()?;
        let plaintext = self
            .0
            .decrypt(&Nonce::from(nonce), &bytes[12..])
            .map_err(|_| anyhow::anyhow!("Token authentication failed"))?;
        Ok(String::from_utf8(plaintext)?)
    }
}

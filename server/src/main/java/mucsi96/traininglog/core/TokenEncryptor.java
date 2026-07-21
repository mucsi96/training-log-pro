package mucsi96.traininglog.core;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import lombok.SneakyThrows;

/**
 * Encrypts OAuth token values before they are persisted and decrypts them when
 * they are read back. Uses AES-256-GCM with a random per-value IV so the tokens
 * are unreadable to anyone who only has access to the database, while remaining
 * fully recoverable for use against the Strava and Withings APIs.
 *
 * Wire format (Base64 encoded): iv (12 bytes) || ciphertext || GCM tag (16 bytes).
 *
 * The wire format carries no algorithm/key version, so rotating the key means
 * previously stored tokens can no longer be decrypted; a rotation therefore
 * requires clearing oauth2_authorized_client and having users re-authorize,
 * exactly like the initial migration to encryption at rest.
 */
@Component
public class TokenEncryptor {

  private static final String TRANSFORMATION = "AES/GCM/NoPadding";
  private static final int IV_LENGTH = 12;
  private static final int TAG_LENGTH_BITS = 128;
  private static final int TAG_LENGTH_BYTES = TAG_LENGTH_BITS / 8;
  private static final int KEY_LENGTH_BYTES = 32;

  private final SecretKeySpec keySpec;
  private final SecureRandom secureRandom = new SecureRandom();

  public TokenEncryptor(@Value("${token-encryption-key}") String base64Key) {
    byte[] key = Base64.getDecoder().decode(base64Key);
    if (key.length != KEY_LENGTH_BYTES) {
      throw new IllegalStateException(
          "token-encryption-key must be a Base64 encoded 256-bit (32 byte) key, but was " + key.length + " bytes");
    }
    this.keySpec = new SecretKeySpec(key, "AES");
  }

  @SneakyThrows
  public String encrypt(String plaintext) {
    byte[] iv = new byte[IV_LENGTH];
    secureRandom.nextBytes(iv);

    Cipher cipher = Cipher.getInstance(TRANSFORMATION);
    cipher.init(Cipher.ENCRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
    byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

    byte[] payload = new byte[iv.length + ciphertext.length];
    System.arraycopy(iv, 0, payload, 0, iv.length);
    System.arraycopy(ciphertext, 0, payload, iv.length, ciphertext.length);

    return Base64.getEncoder().encodeToString(payload);
  }

  @SneakyThrows
  public String decrypt(String value) {
    byte[] payload = Base64.getDecoder().decode(value);
    if (payload.length < IV_LENGTH + TAG_LENGTH_BYTES) {
      throw new IllegalStateException(
          "Encrypted token payload is too short: " + payload.length + " bytes");
    }
    byte[] iv = Arrays.copyOfRange(payload, 0, IV_LENGTH);
    byte[] ciphertext = Arrays.copyOfRange(payload, IV_LENGTH, payload.length);

    Cipher cipher = Cipher.getInstance(TRANSFORMATION);
    cipher.init(Cipher.DECRYPT_MODE, keySpec, new GCMParameterSpec(TAG_LENGTH_BITS, iv));

    return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
  }
}

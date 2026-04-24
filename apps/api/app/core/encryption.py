"""
Fernet-based encryption for tenant-level secrets (Slack webhooks, etc.).
Fails loudly if ENCRYPTION_KEY is missing — these values are not optional at rest.
"""
from cryptography.fernet import Fernet, InvalidToken
from app.core.config import settings


class EncryptionNotConfigured(RuntimeError):
    """Raised when ENCRYPTION_KEY is unset and a caller tries to encrypt/decrypt."""


def _fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        raise EncryptionNotConfigured(
            "ENCRYPTION_KEY is not set. Generate one with "
            "`python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"` "
            "and add it to your .env."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a short secret (webhook URL, token). Returns base64-encoded ciphertext."""
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    """Decrypt a value produced by encrypt_secret. Raises InvalidToken on tamper/wrong key."""
    return _fernet().decrypt(ciphertext.encode()).decode()


__all__ = ["encrypt_secret", "decrypt_secret", "EncryptionNotConfigured", "InvalidToken"]

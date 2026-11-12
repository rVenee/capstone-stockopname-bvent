from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    token_hari: int = 7

    # Foto barang dan berkas impor disimpan sebagai file di folder ini (relatif terhadap folder backend)
    upload_dir: str = "uploads"
    maks_foto_mb: int = 6
    maks_impor_mb: int = 10
    maks_baris_impor: int = 50000

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
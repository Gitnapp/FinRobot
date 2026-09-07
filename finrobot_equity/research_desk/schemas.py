from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class SymbolInput(StrictModel):
    symbol: str = Field(min_length=1, max_length=15, pattern=r"^[A-Z0-9][A-Z0-9.\-^=]{0,14}$")

    @field_validator("symbol", mode="before")
    @classmethod
    def normalize(cls, value):
        return value.strip().upper() if isinstance(value, str) else value


class CoverageInput(StrictModel):
    cadence: Literal["daily", "weekly"] = "weekly"
    active: bool = True


class ResearchInput(SymbolInput):
    focus: str = Field(default="", max_length=1200)


class Assumptions(StrictModel):
    growth: float = Field(default=0.20, ge=-0.80, le=2)
    gross_margin: float = Field(default=0.42, ge=0, le=1)
    opex_ratio: float = Field(default=0.20, ge=0, le=1)
    tax_rate: float = Field(default=0.25, ge=0, le=0.60)
    da_ratio: float = Field(default=0.05, ge=0, le=0.50)
    capex_ratio: float = Field(default=0.06, ge=0, le=0.60)
    nwc_ratio: float = Field(default=0.10, ge=0, le=1)
    exit_multiple: float = Field(default=15, ge=1, le=100)


class SettingsInput(StrictModel):
    provider: Literal["openai", "siliconflow", "kimi", "mock"] = "openai"
    model: str = Field(min_length=1, max_length=150)
    data_mode: Literal["auto", "mock"] = "auto"

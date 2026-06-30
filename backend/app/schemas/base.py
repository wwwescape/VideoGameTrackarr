from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base for every API schema. Python/SQLAlchemy stay snake_case internally; the API
    boundary speaks camelCase since the frontend is (and will remain, post-M6) JS/TS."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

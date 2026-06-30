from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.repositories import company_repository
from app.schemas.company import CompanyResponse

router = APIRouter(prefix="/api/companies", tags=["companies"], dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[CompanyResponse])
def list_companies(db: Session = Depends(get_db)) -> list[CompanyResponse]:
    companies = company_repository.list_companies(db)
    return [CompanyResponse.model_validate(company) for company in companies]
